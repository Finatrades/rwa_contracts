// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "./IRegulatoryIdentity.sol";
import "./RegulatoryIdentityRegistry.sol";

// Chainlink CCIP Interfaces
interface IRouterClient {
    function getFee(
        uint64 destinationChainSelector,
        Client.EVM2AnyMessage memory message
    ) external view returns (uint256 fee);
    
    function ccipSend(
        uint64 destinationChainSelector,
        Client.EVM2AnyMessage memory message
    ) external payable returns (bytes32);
}

interface LinkTokenInterface {
    function approve(address spender, uint256 value) external returns (bool);
    function transfer(address to, uint256 value) external returns (bool);
    function balanceOf(address owner) external view returns (uint256);
}

library Client {
    struct EVMTokenAmount {
        address token;
        uint256 amount;
    }
    
    struct EVM2AnyMessage {
        bytes receiver;
        bytes data;
        EVMTokenAmount[] tokenAmounts;
        address feeToken;
        bytes extraArgs;
    }
    
    struct EVMExtraArgsV1 {
        uint256 gasLimit;
        bool strict;
    }
    
    function _argsToBytes(EVMExtraArgsV1 memory extraArgs) internal pure returns (bytes memory bts) {
        return abi.encode(extraArgs);
    }
}

/**
 * @title CCIPRegulatoryBridge
 * @notice Handles cross-chain identity propagation using Chainlink CCIP
 * @dev Integrates with RegulatoryIdentityRegistry to sync identities across chains
 */
contract CCIPRegulatoryBridge is 
    Initializable,
    AccessControlUpgradeable,
    PausableUpgradeable,
    UUPSUpgradeable
{
    using Client for Client.EVM2AnyMessage;
    
    // Constants
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");
    bytes32 public constant UPGRADER_ROLE = keccak256("UPGRADER_ROLE");
    
    uint256 public constant MAX_GAS_LIMIT = 2_000_000;
    uint256 public constant DEFAULT_GAS_LIMIT = 500_000;
    
    // State variables
    IRouterClient public router;
    LinkTokenInterface public linkToken;
    RegulatoryIdentityRegistry public identityRegistry;
    
    mapping(uint64 => address) public destinationRegistries;
    mapping(uint64 => bool) public supportedChains;
    mapping(bytes32 => MessageStatus) public messageStatuses;
    
    struct MessageStatus {
        uint64 destinationChain;
        address user;
        uint256 timestamp;
        bool processed;
        bool failed;
        string failureReason;
    }
    
    // Audit trail
    struct AuditEntry {
        bytes32 messageId;
        uint64 sourceChain;
        uint64 destinationChain;
        address user;
        string action;
        uint256 timestamp;
        bytes proof;
    }
    
    mapping(address => AuditEntry[]) public userAuditTrail;
    mapping(bytes32 => AuditEntry) public messageAuditTrail;
    
    // Events
    event ChainEnabled(uint64 indexed chainSelector, address indexed registry);
    event ChainDisabled(uint64 indexed chainSelector);
    event IdentityPropagated(
        address indexed user,
        uint64 indexed destinationChain,
        bytes32 indexed messageId,
        uint256 timestamp
    );
    event MessageFailed(bytes32 indexed messageId, string reason);
    event MessageProcessed(bytes32 indexed messageId, uint64 chain);
    event FeesWithdrawn(address indexed to, uint256 amount);
    
    // Modifiers
    modifier onlySupportedChain(uint64 chainSelector) {
        require(supportedChains[chainSelector], "Chain not supported");
        require(destinationRegistries[chainSelector] != address(0), "Registry not set");
        _;
    }
    
    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }
    
    /**
     * @notice Initialize the contract
     * @param _admin Admin address
     * @param _router Chainlink CCIP Router address
     * @param _link LINK token address
     * @param _identityRegistry RegulatoryIdentityRegistry address
     */
    function initialize(
        address _admin,
        address _router,
        address _link,
        address _identityRegistry
    ) public initializer {
        require(_admin != address(0), "Invalid admin");
        require(_router != address(0), "Invalid router");
        require(_link != address(0), "Invalid LINK");
        require(_identityRegistry != address(0), "Invalid registry");
        
        __AccessControl_init();
        __Pausable_init();
        __UUPSUpgradeable_init();
        
        _grantRole(DEFAULT_ADMIN_ROLE, _admin);
        _grantRole(ADMIN_ROLE, _admin);
        _grantRole(OPERATOR_ROLE, _admin);
        _grantRole(UPGRADER_ROLE, _admin);
        
        router = IRouterClient(_router);
        linkToken = LinkTokenInterface(_link);
        identityRegistry = RegulatoryIdentityRegistry(_identityRegistry);
    }
    
    /**
     * @notice Enable a destination chain
     * @param chainSelector CCIP chain selector
     * @param registryAddress Identity registry address on destination chain
     */
    function enableChain(
        uint64 chainSelector,
        address registryAddress
    ) external onlyRole(ADMIN_ROLE) {
        require(registryAddress != address(0), "Invalid registry");
        
        supportedChains[chainSelector] = true;
        destinationRegistries[chainSelector] = registryAddress;
        
        emit ChainEnabled(chainSelector, registryAddress);
    }
    
    /**
     * @notice Disable a destination chain
     * @param chainSelector CCIP chain selector
     */
    function disableChain(uint64 chainSelector) external onlyRole(ADMIN_ROLE) {
        supportedChains[chainSelector] = false;
        
        emit ChainDisabled(chainSelector);
    }
    
    /**
     * @notice Propagate identity to a single chain
     * @param destinationChain Destination chain selector
     * @param user User address
     */
    function propagateIdentity(
        uint64 destinationChain,
        address user
    ) external 
      onlyRole(OPERATOR_ROLE) 
      whenNotPaused 
      onlySupportedChain(destinationChain) 
      returns (bytes32 messageId) 
    {
        // Get identity from registry
        IRegulatoryIdentity.RegulatoryIdentity memory identity = identityRegistry.getIdentity(user);
        require(identity.status == IRegulatoryIdentity.ComplianceStatus.APPROVED, "Identity not approved");
        require(identity.kycVerified, "KYC not verified");
        
        // Create CCIP message
        IRegulatoryIdentity.CCIPMessage memory ccipData = IRegulatoryIdentity.CCIPMessage({
            userAddress: user,
            kycHash: keccak256(abi.encode(identity)),
            timestamp: block.timestamp,
            jurisdiction: identity.jurisdiction,
            isAccredited: identity.isAccredited,
            investorType: identity.investorType,
            adminSignature: abi.encode(identity.approvedBy, identity.approvalTimestamp),
            documentProof: identity.documentHash,
            status: identity.status
        });
        
        // Send via CCIP
        messageId = _sendMessage(destinationChain, abi.encode(ccipData));
        
        // Record audit trail
        _recordAuditEntry(
            messageId,
            uint64(block.chainid),
            destinationChain,
            user,
            "IDENTITY_PROPAGATED"
        );
        
        emit IdentityPropagated(user, destinationChain, messageId, block.timestamp);
        
        return messageId;
    }
    
    /**
     * @notice Propagate identity to multiple chains
     * @param destinationChains Array of destination chain selectors
     * @param user User address
     */
    function propagateIdentityMultichain(
        uint64[] calldata destinationChains,
        address user
    ) external onlyRole(OPERATOR_ROLE) whenNotPaused returns (bytes32[] memory messageIds) {
        require(destinationChains.length > 0, "No chains specified");
        require(destinationChains.length <= 10, "Too many chains");
        
        messageIds = new bytes32[](destinationChains.length);
        
        for (uint256 i = 0; i < destinationChains.length; i++) {
            if (supportedChains[destinationChains[i]]) {
                messageIds[i] = this.propagateIdentity(destinationChains[i], user);
            }
        }
        
        return messageIds;
    }
    
    /**
     * @notice Batch propagate multiple identities to multiple chains
     * @param users Array of user addresses
     * @param destinationChains Array of destination chains
     */
    function batchPropagateIdentities(
        address[] calldata users,
        uint64[] calldata destinationChains
    ) external onlyRole(OPERATOR_ROLE) whenNotPaused {
        require(users.length > 0, "No users specified");
        require(users.length <= 50, "Too many users");
        require(destinationChains.length > 0, "No chains specified");
        
        for (uint256 i = 0; i < users.length; i++) {
            for (uint256 j = 0; j < destinationChains.length; j++) {
                if (supportedChains[destinationChains[j]]) {
                    try this.propagateIdentity(destinationChains[j], users[i]) {
                        // Success, continue
                    } catch {
                        // Log failure but continue with other users
                        emit MessageFailed(
                            keccak256(abi.encode(users[i], destinationChains[j])),
                            "Propagation failed"
                        );
                    }
                }
            }
        }
    }
    
    /**
     * @notice Send CCIP message
     * @param destinationChain Destination chain selector
     * @param data Encoded message data
     */
    function _sendMessage(
        uint64 destinationChain,
        bytes memory data
    ) internal returns (bytes32 messageId) {
        // Create CCIP message
        Client.EVM2AnyMessage memory message = Client.EVM2AnyMessage({
            receiver: abi.encode(destinationRegistries[destinationChain]),
            data: data,
            tokenAmounts: new Client.EVMTokenAmount[](0),
            feeToken: address(linkToken),
            extraArgs: Client._argsToBytes(
                Client.EVMExtraArgsV1({
                    gasLimit: DEFAULT_GAS_LIMIT,
                    strict: true // Ensure message delivery
                })
            )
        });
        
        // Get fee
        uint256 fees = router.getFee(destinationChain, message);
        require(linkToken.balanceOf(address(this)) >= fees, "Insufficient LINK");
        
        // Approve router to spend LINK
        linkToken.approve(address(router), fees);
        
        // Send message
        messageId = router.ccipSend(destinationChain, message);
        
        // Record message status
        messageStatuses[messageId] = MessageStatus({
            destinationChain: destinationChain,
            user: address(0), // Will be updated by caller
            timestamp: block.timestamp,
            processed: false,
            failed: false,
            failureReason: ""
        });
        
        return messageId;
    }
    
    /**
     * @notice Record audit entry
     */
    function _recordAuditEntry(
        bytes32 messageId,
        uint64 sourceChain,
        uint64 destinationChain,
        address user,
        string memory action
    ) internal {
        AuditEntry memory entry = AuditEntry({
            messageId: messageId,
            sourceChain: sourceChain,
            destinationChain: destinationChain,
            user: user,
            action: action,
            timestamp: block.timestamp,
            proof: abi.encode(messageId, block.timestamp)
        });
        
        userAuditTrail[user].push(entry);
        messageAuditTrail[messageId] = entry;
    }
    
    /**
     * @notice Get user audit trail
     * @param user User address
     * @return AuditEntry[] Array of audit entries
     */
    function getUserAuditTrail(address user) external view returns (AuditEntry[] memory) {
        return userAuditTrail[user];
    }
    
    /**
     * @notice Get message status
     * @param messageId CCIP message ID
     * @return MessageStatus Message status details
     */
    function getMessageStatus(bytes32 messageId) external view returns (MessageStatus memory) {
        return messageStatuses[messageId];
    }
    
    /**
     * @notice Estimate fees for propagation
     * @param destinationChain Destination chain
     * @param user User address
     * @return fees Estimated LINK fees
     */
    function estimateFees(
        uint64 destinationChain,
        address user
    ) external view returns (uint256 fees) {
        IRegulatoryIdentity.RegulatoryIdentity memory identity = identityRegistry.getIdentity(user);
        
        IRegulatoryIdentity.CCIPMessage memory ccipData = IRegulatoryIdentity.CCIPMessage({
            userAddress: user,
            kycHash: keccak256(abi.encode(identity)),
            timestamp: block.timestamp,
            jurisdiction: identity.jurisdiction,
            isAccredited: identity.isAccredited,
            investorType: identity.investorType,
            adminSignature: abi.encode(identity.approvedBy, identity.approvalTimestamp),
            documentProof: identity.documentHash,
            status: identity.status
        });
        
        Client.EVM2AnyMessage memory message = Client.EVM2AnyMessage({
            receiver: abi.encode(destinationRegistries[destinationChain]),
            data: abi.encode(ccipData),
            tokenAmounts: new Client.EVMTokenAmount[](0),
            feeToken: address(linkToken),
            extraArgs: Client._argsToBytes(
                Client.EVMExtraArgsV1({
                    gasLimit: DEFAULT_GAS_LIMIT,
                    strict: true
                })
            )
        });
        
        return router.getFee(destinationChain, message);
    }
    
    /**
     * @notice Withdraw LINK tokens
     * @param to Recipient address
     * @param amount Amount to withdraw
     */
    function withdrawLink(
        address to,
        uint256 amount
    ) external onlyRole(ADMIN_ROLE) {
        require(linkToken.transfer(to, amount), "Transfer failed");
        emit FeesWithdrawn(to, amount);
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
     * @notice Receive Ether
     */
    receive() external payable {}
}