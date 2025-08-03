// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "./RegulatoryIdentityRegistry.sol";
import "./IRegulatoryIdentity.sol";

// Chainlink CCIP Receiver Interface
interface CCIPReceiver {
    struct Any2EVMMessage {
        bytes32 messageId;
        uint64 sourceChainSelector;
        bytes sender;
        bytes data;
    }
}

/**
 * @title CCIPIdentityReceiver
 * @notice Receives and processes cross-chain identity updates via CCIP
 * @dev Implements CCIP receiver pattern for regulatory compliance
 */
contract CCIPIdentityReceiver is 
    Initializable,
    AccessControlUpgradeable,
    PausableUpgradeable,
    UUPSUpgradeable
{
    // Constants
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant ROUTER_ROLE = keccak256("ROUTER_ROLE");
    bytes32 public constant UPGRADER_ROLE = keccak256("UPGRADER_ROLE");
    
    // State variables
    RegulatoryIdentityRegistry public identityRegistry;
    address public ccipRouter;
    
    mapping(uint64 => bool) public authorizedSourceChains;
    mapping(uint64 => address) public authorizedSenders;
    mapping(bytes32 => bool) public processedMessages;
    
    // Events
    event MessageReceived(
        bytes32 indexed messageId,
        uint64 indexed sourceChain,
        address indexed user,
        uint256 timestamp
    );
    
    event MessageProcessed(
        bytes32 indexed messageId,
        bool success,
        string reason
    );
    
    event SourceChainAuthorized(uint64 indexed chainSelector, address indexed sender);
    event SourceChainRevoked(uint64 indexed chainSelector);
    
    // Errors
    error UnauthorizedRouter();
    error UnauthorizedSourceChain();
    error UnauthorizedSender();
    error MessageAlreadyProcessed();
    error InvalidMessageFormat();
    
    // Modifiers
    modifier onlyRouter() {
        if (msg.sender != ccipRouter) revert UnauthorizedRouter();
        _;
    }
    
    modifier onlyAuthorizedChain(uint64 sourceChain) {
        if (!authorizedSourceChains[sourceChain]) revert UnauthorizedSourceChain();
        _;
    }
    
    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }
    
    /**
     * @notice Initialize the contract
     * @param _admin Admin address
     * @param _ccipRouter CCIP Router address
     * @param _identityRegistry RegulatoryIdentityRegistry address
     */
    function initialize(
        address _admin,
        address _ccipRouter,
        address _identityRegistry
    ) public initializer {
        require(_admin != address(0), "Invalid admin");
        require(_ccipRouter != address(0), "Invalid router");
        require(_identityRegistry != address(0), "Invalid registry");
        
        __AccessControl_init();
        __Pausable_init();
        __UUPSUpgradeable_init();
        
        _grantRole(DEFAULT_ADMIN_ROLE, _admin);
        _grantRole(ADMIN_ROLE, _admin);
        _grantRole(ROUTER_ROLE, _ccipRouter);
        _grantRole(UPGRADER_ROLE, _admin);
        
        ccipRouter = _ccipRouter;
        identityRegistry = RegulatoryIdentityRegistry(_identityRegistry);
    }
    
    /**
     * @notice CCIP entry point - receives messages from router
     * @param message The CCIP message
     */
    function ccipReceive(
        CCIPReceiver.Any2EVMMessage calldata message
    ) external onlyRouter whenNotPaused {
        // Check if message already processed
        if (processedMessages[message.messageId]) revert MessageAlreadyProcessed();
        
        // Mark as processed
        processedMessages[message.messageId] = true;
        
        // Verify source chain
        if (!authorizedSourceChains[message.sourceChainSelector]) {
            emit MessageProcessed(message.messageId, false, "Unauthorized source chain");
            revert UnauthorizedSourceChain();
        }
        
        // Verify sender
        address sender = abi.decode(message.sender, (address));
        if (authorizedSenders[message.sourceChainSelector] != sender) {
            emit MessageProcessed(message.messageId, false, "Unauthorized sender");
            revert UnauthorizedSender();
        }
        
        // Process the message
        try this.processMessage(
            message.messageId,
            message.sourceChainSelector,
            message.data
        ) {
            emit MessageProcessed(message.messageId, true, "Success");
        } catch Error(string memory reason) {
            emit MessageProcessed(message.messageId, false, reason);
        } catch {
            emit MessageProcessed(message.messageId, false, "Unknown error");
        }
    }
    
    /**
     * @notice Process the identity update message
     * @param messageId CCIP message ID
     * @param sourceChain Source chain selector
     * @param data Encoded message data
     */
    function processMessage(
        bytes32 messageId,
        uint64 sourceChain,
        bytes calldata data
    ) external {
        require(msg.sender == address(this), "Internal function");
        
        // Decode the message
        IRegulatoryIdentity.CCIPMessage memory ccipMessage;
        try this.decodeMessage(data) returns (IRegulatoryIdentity.CCIPMessage memory decoded) {
            ccipMessage = decoded;
        } catch {
            revert InvalidMessageFormat();
        }
        
        // Update identity registry via CCIP role
        identityRegistry.processCCIPMessage(
            messageId,
            sourceChain,
            abi.encode(ccipMessage)
        );
        
        emit MessageReceived(
            messageId,
            sourceChain,
            ccipMessage.userAddress,
            block.timestamp
        );
    }
    
    /**
     * @notice Decode CCIP message
     * @param data Encoded message data
     * @return CCIPMessage Decoded message
     */
    function decodeMessage(bytes calldata data) 
        external 
        pure 
        returns (IRegulatoryIdentity.CCIPMessage memory) 
    {
        return abi.decode(data, (IRegulatoryIdentity.CCIPMessage));
    }
    
    /**
     * @notice Authorize a source chain and sender
     * @param chainSelector Source chain selector
     * @param sender Authorized sender address on source chain
     */
    function authorizeSourceChain(
        uint64 chainSelector,
        address sender
    ) external onlyRole(ADMIN_ROLE) {
        require(sender != address(0), "Invalid sender");
        
        authorizedSourceChains[chainSelector] = true;
        authorizedSenders[chainSelector] = sender;
        
        emit SourceChainAuthorized(chainSelector, sender);
    }
    
    /**
     * @notice Revoke authorization for a source chain
     * @param chainSelector Source chain selector
     */
    function revokeSourceChain(uint64 chainSelector) external onlyRole(ADMIN_ROLE) {
        authorizedSourceChains[chainSelector] = false;
        delete authorizedSenders[chainSelector];
        
        emit SourceChainRevoked(chainSelector);
    }
    
    /**
     * @notice Update CCIP router address
     * @param newRouter New router address
     */
    function updateRouter(address newRouter) external onlyRole(ADMIN_ROLE) {
        require(newRouter != address(0), "Invalid router");
        
        // Revoke old router role
        if (ccipRouter != address(0)) {
            revokeRole(ROUTER_ROLE, ccipRouter);
        }
        
        // Grant new router role
        ccipRouter = newRouter;
        grantRole(ROUTER_ROLE, newRouter);
    }
    
    /**
     * @notice Check if a message has been processed
     * @param messageId Message ID to check
     * @return bool Whether the message has been processed
     */
    function isMessageProcessed(bytes32 messageId) external view returns (bool) {
        return processedMessages[messageId];
    }
    
    /**
     * @notice Get authorized sender for a chain
     * @param chainSelector Chain selector
     * @return address Authorized sender address
     */
    function getAuthorizedSender(uint64 chainSelector) external view returns (address) {
        return authorizedSenders[chainSelector];
    }
    
    /**
     * @notice Pause contract
     */
    function pause() external onlyRole(ADMIN_ROLE) {
        _pause();
    }
    
    /**
     * @notice Unpause contract
     */
    function unpause() external onlyRole(ADMIN_ROLE) {
        _unpause();
    }
    
    /**
     * @notice Authorize upgrade
     */
    function _authorizeUpgrade(address newImplementation)
        internal
        override
        onlyRole(UPGRADER_ROLE)
    {}
    
    /**
     * @notice Handle incoming CCIP messages
     * @dev This is the standard CCIP receiver interface
     */
    function _ccipReceive(
        CCIPReceiver.Any2EVMMessage memory message
    ) internal {
        // This function would be called by the actual CCIP router
        // For now, it's implemented via ccipReceive
    }
}