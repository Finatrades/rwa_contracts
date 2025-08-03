// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "./IRegulatoryIdentity.sol";
import "../identity/IIdentityRegistry.sol";

/**
 * @title RegulatoryIdentityRegistry
 * @notice Manages regulatory-compliant identities with admin approval
 * @dev Integrates with existing ERC-3643 identity system and prepares for CCIP
 */
contract RegulatoryIdentityRegistry is 
    Initializable,
    AccessControlUpgradeable,
    PausableUpgradeable,
    ReentrancyGuardUpgradeable,
    UUPSUpgradeable,
    IRegulatoryIdentity
{
    // Constants
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant COMPLIANCE_OFFICER_ROLE = keccak256("COMPLIANCE_OFFICER_ROLE");
    bytes32 public constant CCIP_ROLE = keccak256("CCIP_ROLE");
    bytes32 public constant UPGRADER_ROLE = keccak256("UPGRADER_ROLE");
    
    uint256 public constant DEFAULT_EXPIRY_DURATION = 365 days;
    uint256 public constant WARNING_PERIOD = 30 days;
    
    // State variables
    mapping(address => RegulatoryIdentity) private _identities;
    mapping(address => mapping(uint64 => bool)) private _chainAuthorizations;
    mapping(string => mapping(address => bool)) private _jurisdictionAllowlist;
    mapping(bytes32 => bool) private _processedMessages;
    
    address[] private _registeredUsers;
    mapping(address => uint256) private _userIndex;
    
    IIdentityRegistry public identityRegistry; // ERC-3643 registry
    uint64 public currentChainId;
    
    // Modifiers
    modifier onlyCompliance() {
        require(
            hasRole(ADMIN_ROLE, msg.sender) || 
            hasRole(COMPLIANCE_OFFICER_ROLE, msg.sender),
            "Not authorized"
        );
        _;
    }
    
    modifier onlyValidAddress(address user) {
        require(user != address(0), "Invalid address");
        _;
    }
    
    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }
    
    /**
     * @notice Initialize the contract
     * @param _admin Admin address
     * @param _identityRegistryAddress ERC-3643 Identity Registry address
     * @param _chainId Current chain ID for CCIP
     */
    function initialize(
        address _admin,
        address _identityRegistryAddress,
        uint64 _chainId
    ) public initializer {
        __AccessControl_init();
        __Pausable_init();
        __ReentrancyGuard_init();
        __UUPSUpgradeable_init();
        
        _grantRole(DEFAULT_ADMIN_ROLE, _admin);
        _grantRole(ADMIN_ROLE, _admin);
        _grantRole(UPGRADER_ROLE, _admin);
        
        identityRegistry = IIdentityRegistry(_identityRegistryAddress);
        currentChainId = _chainId;
    }
    
    /**
     * @notice Register a new identity with admin approval
     * @param user User address
     * @param data Compliance data including jurisdiction, accreditation status, etc.
     */
    function registerIdentity(
        address user,
        ComplianceData calldata data
    ) external override onlyCompliance onlyValidAddress(user) whenNotPaused returns (bool) {
        require(_identities[user].status != ComplianceStatus.APPROVED, "Already registered");
        require(bytes(data.jurisdiction).length > 0, "Invalid jurisdiction");
        require(data.riskScore <= 100, "Invalid risk score");
        
        // Create identity
        RegulatoryIdentity storage identity = _identities[user];
        identity.kycVerified = true;
        identity.amlCleared = true;
        identity.jurisdiction = data.jurisdiction;
        identity.riskScore = data.riskScore;
        identity.documentHash = data.documentProof;
        identity.approvalTimestamp = block.timestamp;
        identity.expiryDate = block.timestamp + DEFAULT_EXPIRY_DURATION;
        identity.approvedBy = msg.sender;
        identity.sourceChain = currentChainId;
        identity.investorType = data.investorType;
        identity.status = ComplianceStatus.APPROVED;
        identity.isAccredited = data.accredited;
        
        // Add to registered users list if new
        if (_userIndex[user] == 0) {
            _registeredUsers.push(user);
            _userIndex[user] = _registeredUsers.length;
        }
        
        // Emit event
        emit IdentityRegistered(
            user,
            msg.sender,
            currentChainId,
            keccak256(abi.encode(data))
        );
        
        return true;
    }
    
    /**
     * @notice Update identity status (suspend, expire, etc.)
     * @param user User address
     * @param status New compliance status
     * @param reason Reason for status change
     */
    function updateIdentityStatus(
        address user,
        ComplianceStatus status,
        string calldata reason
    ) external override onlyCompliance onlyValidAddress(user) returns (bool) {
        RegulatoryIdentity storage identity = _identities[user];
        require(identity.approvalTimestamp > 0, "Identity not found");
        
        ComplianceStatus oldStatus = identity.status;
        identity.status = status;
        
        emit ComplianceStatusChanged(user, oldStatus, status, reason);
        emit IdentityUpdated(user, msg.sender, status, block.timestamp);
        
        return true;
    }
    
    /**
     * @notice Get identity information
     * @param user User address
     * @return RegulatoryIdentity struct
     */
    function getIdentity(address user) 
        external 
        view 
        override 
        returns (RegulatoryIdentity memory) 
    {
        return _identities[user];
    }
    
    /**
     * @notice Check if user is compliant
     * @param user User address
     * @return bool compliance status
     */
    function isCompliant(address user) external view override returns (bool) {
        RegulatoryIdentity memory identity = _identities[user];
        return identity.status == ComplianceStatus.APPROVED &&
               identity.kycVerified &&
               identity.amlCleared &&
               identity.expiryDate > block.timestamp;
    }
    
    /**
     * @notice Check if transfer is allowed between two addresses
     * @param from Sender address
     * @param to Receiver address
     * @param amount Transfer amount (for future limit checks)
     * @return bool transfer permission
     */
    function canTransfer(
        address from,
        address to,
        uint256 amount
    ) external view override returns (bool) {
        // Skip checks for minting (from == address(0)) and burning (to == address(0))
        if (from == address(0) || to == address(0)) {
            return true;
        }
        
        RegulatoryIdentity memory fromIdentity = _identities[from];
        RegulatoryIdentity memory toIdentity = _identities[to];
        
        // Both parties must be compliant
        bool fromCompliant = fromIdentity.status == ComplianceStatus.APPROVED &&
                           fromIdentity.kycVerified &&
                           fromIdentity.amlCleared &&
                           fromIdentity.expiryDate > block.timestamp;
                           
        bool toCompliant = toIdentity.status == ComplianceStatus.APPROVED &&
                         toIdentity.kycVerified &&
                         toIdentity.amlCleared &&
                         toIdentity.expiryDate > block.timestamp;
        
        return fromCompliant && toCompliant;
    }
    
    /**
     * @notice Get compliance status
     * @param user User address
     * @return ComplianceStatus
     */
    function getComplianceStatus(address user) 
        external 
        view 
        override 
        returns (ComplianceStatus) 
    {
        return _identities[user].status;
    }
    
    /**
     * @notice Check if identity is expired
     * @param user User address
     * @return bool expiry status
     */
    function isIdentityExpired(address user) external view override returns (bool) {
        return _identities[user].expiryDate <= block.timestamp;
    }
    
    /**
     * @notice Get risk score
     * @param user User address
     * @return uint8 risk score
     */
    function getRiskScore(address user) external view override returns (uint8) {
        return _identities[user].riskScore;
    }
    
    /**
     * @notice Batch register multiple identities
     * @param users Array of user addresses
     * @param dataArray Array of compliance data
     */
    function batchRegisterIdentity(
        address[] calldata users,
        ComplianceData[] calldata dataArray
    ) external onlyCompliance whenNotPaused {
        require(users.length == dataArray.length, "Array length mismatch");
        require(users.length <= 100, "Batch too large");
        
        for (uint256 i = 0; i < users.length; i++) {
            if (users[i] != address(0) && _identities[users[i]].status != ComplianceStatus.APPROVED) {
                this.registerIdentity(users[i], dataArray[i]);
            }
        }
    }
    
    /**
     * @notice Get all registered users
     * @return address[] array of registered users
     */
    function getRegisteredUsers() external view returns (address[] memory) {
        return _registeredUsers;
    }
    
    /**
     * @notice Get users requiring KYC renewal
     * @return address[] array of users with expiring KYC
     */
    function getUsersRequiringRenewal() external view returns (address[] memory) {
        uint256 count = 0;
        uint256 expiryThreshold = block.timestamp + WARNING_PERIOD;
        
        // Count users requiring renewal
        for (uint256 i = 0; i < _registeredUsers.length; i++) {
            RegulatoryIdentity memory identity = _identities[_registeredUsers[i]];
            if (identity.status == ComplianceStatus.APPROVED && 
                identity.expiryDate <= expiryThreshold) {
                count++;
            }
        }
        
        // Create result array
        address[] memory result = new address[](count);
        uint256 index = 0;
        
        for (uint256 i = 0; i < _registeredUsers.length; i++) {
            RegulatoryIdentity memory identity = _identities[_registeredUsers[i]];
            if (identity.status == ComplianceStatus.APPROVED && 
                identity.expiryDate <= expiryThreshold) {
                result[index] = _registeredUsers[i];
                index++;
            }
        }
        
        return result;
    }
    
    /**
     * @notice Set jurisdiction allowlist for a token
     * @param jurisdiction Jurisdiction code
     * @param token Token address
     * @param allowed Whether the token is allowed in this jurisdiction
     */
    function setJurisdictionAllowlist(
        string calldata jurisdiction,
        address token,
        bool allowed
    ) external onlyCompliance {
        _jurisdictionAllowlist[jurisdiction][token] = allowed;
    }
    
    /**
     * @notice Check if token is allowed in jurisdiction
     * @param jurisdiction Jurisdiction code
     * @param token Token address
     * @return bool allowlist status
     */
    function isTokenAllowedInJurisdiction(
        string calldata jurisdiction,
        address token
    ) external view returns (bool) {
        return _jurisdictionAllowlist[jurisdiction][token];
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
     * @param newImplementation New implementation address
     */
    function _authorizeUpgrade(address newImplementation)
        internal
        override
        onlyRole(UPGRADER_ROLE)
    {}
    
    /**
     * @notice Process CCIP message (to be called by CCIP contract)
     * @param messageId CCIP message ID
     * @param sourceChain Source chain ID
     * @param data Encoded compliance data
     */
    function processCCIPMessage(
        bytes32 messageId,
        uint64 sourceChain,
        bytes calldata data
    ) external onlyRole(CCIP_ROLE) whenNotPaused {
        require(!_processedMessages[messageId], "Message already processed");
        _processedMessages[messageId] = true;
        
        // Decode message
        CCIPMessage memory message = abi.decode(data, (CCIPMessage));
        
        // Update identity
        RegulatoryIdentity storage identity = _identities[message.userAddress];
        identity.kycVerified = true;
        identity.amlCleared = true;
        identity.jurisdiction = message.jurisdiction;
        identity.approvalTimestamp = message.timestamp;
        identity.sourceChain = sourceChain;
        identity.investorType = message.investorType;
        identity.status = message.status;
        identity.isAccredited = message.isAccredited;
        identity.ccipAttestation = abi.encode(messageId, sourceChain);
        
        emit CrossChainIdentityReceived(
            message.userAddress,
            sourceChain,
            messageId,
            block.timestamp
        );
    }
}