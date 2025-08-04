// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "./Identity.sol";
import "./IIdentityRegistry.sol";

/**
 * @title IdentityFactory
 * @notice Factory contract for deploying Identity contracts for users
 * @dev Integrates with IdentityRegistry to automatically register created identities
 */
contract IdentityFactory is Initializable, AccessControlUpgradeable, UUPSUpgradeable {
    // Roles
    bytes32 public constant FACTORY_ADMIN_ROLE = keccak256("FACTORY_ADMIN_ROLE");
    bytes32 public constant IDENTITY_DEPLOYER_ROLE = keccak256("IDENTITY_DEPLOYER_ROLE");
    bytes32 public constant UPGRADER_ROLE = keccak256("UPGRADER_ROLE");
    
    // Events
    event IdentityCreated(address indexed user, address indexed identityContract, uint16 country);
    event IdentityRegistryUpdated(address indexed oldRegistry, address indexed newRegistry);
    event IdentityDeployed(address indexed identity, address indexed owner, uint256 timestamp);
    
    // State variables
    IIdentityRegistry public identityRegistry;
    mapping(address => address) public userIdentities; // user => identity contract
    mapping(address => bool) public deployedIdentities; // identity contract => is deployed by factory
    address[] public allIdentities;
    
    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }
    
    /**
     * @dev Initialize the factory
     * @param _admin Admin address
     * @param _identityRegistry Address of the IdentityRegistry contract
     */
    function initialize(address _admin, address _identityRegistry) public initializer {
        __AccessControl_init();
        __UUPSUpgradeable_init();
        
        require(_admin != address(0), "Invalid admin address");
        require(_identityRegistry != address(0), "Invalid registry address");
        
        identityRegistry = IIdentityRegistry(_identityRegistry);
        
        _grantRole(DEFAULT_ADMIN_ROLE, _admin);
        _grantRole(FACTORY_ADMIN_ROLE, _admin);
        _grantRole(IDENTITY_DEPLOYER_ROLE, _admin);
        _grantRole(UPGRADER_ROLE, _admin);
    }
    
    /**
     * @dev Deploy a new Identity contract for a user
     * @param _user The user's wallet address
     * @param _country The user's country code
     * @return identityAddress The deployed Identity contract address
     */
    function deployIdentity(
        address _user,
        uint16 _country
    ) external onlyRole(IDENTITY_DEPLOYER_ROLE) returns (address identityAddress) {
        require(_user != address(0), "Invalid user address");
        require(userIdentities[_user] == address(0), "Identity already exists for user");
        
        // Deploy new Identity contract
        Identity identity = new Identity(_user, false);
        identityAddress = address(identity);
        
        // Store mapping
        userIdentities[_user] = identityAddress;
        deployedIdentities[identityAddress] = true;
        allIdentities.push(identityAddress);
        
        // Register in IdentityRegistry
        identityRegistry.registerIdentity(_user, IIdentity(identityAddress), _country);
        
        emit IdentityCreated(_user, identityAddress, _country);
        emit IdentityDeployed(identityAddress, _user, block.timestamp);
        
        return identityAddress;
    }
    
    /**
     * @dev Deploy identity and add initial claims in one transaction
     * @param _user The user's wallet address
     * @param _country The user's country code
     * @param _claimTopic The claim topic (e.g., KYC = 7)
     * @param _claimData The claim data
     * @return identityAddress The deployed Identity contract address
     */
    function deployIdentityWithClaim(
        address _user,
        uint16 _country,
        uint256 _claimTopic,
        bytes calldata _claimData
    ) external onlyRole(IDENTITY_DEPLOYER_ROLE) returns (address identityAddress) {
        // Deploy identity
        identityAddress = this.deployIdentity(_user, _country);
        
        // Add claim
        Identity identity = Identity(identityAddress);
        identity.addClaim(
            _claimTopic,
            1, // scheme
            msg.sender, // issuer
            "", // signature (empty for now)
            _claimData,
            "" // uri
        );
        
        return identityAddress;
    }
    
    /**
     * @dev Get identity contract address for a user
     * @param _user The user's wallet address
     * @return The identity contract address (or zero address if none)
     */
    function getIdentity(address _user) external view returns (address) {
        return userIdentities[_user];
    }
    
    /**
     * @dev Check if an address is a factory-deployed identity
     * @param _identity The address to check
     * @return True if deployed by this factory
     */
    function isFactoryIdentity(address _identity) external view returns (bool) {
        return deployedIdentities[_identity];
    }
    
    /**
     * @dev Get total number of deployed identities
     * @return The total count
     */
    function getIdentityCount() external view returns (uint256) {
        return allIdentities.length;
    }
    
    /**
     * @dev Get all deployed identity addresses
     * @return Array of identity addresses
     */
    function getAllIdentities() external view returns (address[] memory) {
        return allIdentities;
    }
    
    /**
     * @dev Update the IdentityRegistry address
     * @param _newRegistry New registry address
     */
    function setIdentityRegistry(address _newRegistry) external onlyRole(FACTORY_ADMIN_ROLE) {
        require(_newRegistry != address(0), "Invalid registry address");
        address oldRegistry = address(identityRegistry);
        identityRegistry = IIdentityRegistry(_newRegistry);
        emit IdentityRegistryUpdated(oldRegistry, _newRegistry);
    }
    
    /**
     * @dev Required by UUPSUpgradeable
     */
    function _authorizeUpgrade(address newImplementation) internal override onlyRole(UPGRADER_ROLE) {}
    
    /**
     * @dev Get implementation version
     * @return Version string
     */
    function version() external pure returns (string memory) {
        return "1.0.0";
    }
}