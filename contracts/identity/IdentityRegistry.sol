// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "./IIdentityRegistry.sol";
import "./IClaimTopicsRegistry.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

/**
 * @title IdentityRegistry
 * @notice Identity registry for ERC-3643 compliant token
 * @dev Manages the link between wallet addresses and their Identity contracts
 */
contract IdentityRegistry is IIdentityRegistry, Initializable, AccessControlUpgradeable, UUPSUpgradeable {
    bytes32 public constant AGENT_ROLE = keccak256("AGENT_ROLE");
    bytes32 public constant OWNER_ROLE = keccak256("OWNER_ROLE");
    bytes32 public constant UPGRADER_ROLE = keccak256("UPGRADER_ROLE");
    
    mapping(address => IIdentity) private _identities;
    mapping(address => uint16) private _countries;
    mapping(address => bool) private _hasIdentity;
    
    IClaimTopicsRegistry public topicsRegistry;
    address[] public investorsList;
    
    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }
    
    function initialize(address _admin) public initializer {
        __AccessControl_init();
        __UUPSUpgradeable_init();
        
        _grantRole(DEFAULT_ADMIN_ROLE, _admin);
        _grantRole(OWNER_ROLE, _admin);
        _grantRole(AGENT_ROLE, _admin);
        _grantRole(UPGRADER_ROLE, _admin);
    }
    
    function setClaimTopicsRegistry(address _claimTopicsRegistry) external onlyRole(OWNER_ROLE) {
        topicsRegistry = IClaimTopicsRegistry(_claimTopicsRegistry);
    }
    
    function registerIdentity(
        address _userAddress,
        IIdentity _identity,
        uint16 _country
    ) external override onlyRole(AGENT_ROLE) {
        require(!_hasIdentity[_userAddress], "Identity already registered");
        require(address(_identity) != address(0), "Invalid identity address");
        
        _identities[_userAddress] = _identity;
        _countries[_userAddress] = _country;
        _hasIdentity[_userAddress] = true;
        investorsList.push(_userAddress);
        
        emit IdentityRegistered(_userAddress, _identity);
        emit CountryUpdated(_userAddress, _country);
    }
    
    function deleteIdentity(address _userAddress) external override onlyRole(AGENT_ROLE) {
        require(_hasIdentity[_userAddress], "No identity registered");
        
        IIdentity deletedIdentity = _identities[_userAddress];
        delete _identities[_userAddress];
        delete _countries[_userAddress];
        _hasIdentity[_userAddress] = false;
        
        // Remove from investorsList
        for (uint256 i = 0; i < investorsList.length; i++) {
            if (investorsList[i] == _userAddress) {
                investorsList[i] = investorsList[investorsList.length - 1];
                investorsList.pop();
                break;
            }
        }
        
        emit IdentityRemoved(_userAddress, deletedIdentity);
    }
    
    function updateIdentity(address _userAddress, IIdentity _identity) external override onlyRole(AGENT_ROLE) {
        require(_hasIdentity[_userAddress], "No identity registered");
        require(address(_identity) != address(0), "Invalid identity address");
        
        IIdentity oldIdentity = _identities[_userAddress];
        _identities[_userAddress] = _identity;
        
        emit IdentityUpdated(_userAddress, oldIdentity, _identity);
    }
    
    function updateCountry(address _userAddress, uint16 _country) external override onlyRole(AGENT_ROLE) {
        require(_hasIdentity[_userAddress], "No identity registered");
        
        _countries[_userAddress] = _country;
        emit CountryUpdated(_userAddress, _country);
    }
    
    function batchRegisterIdentity(
        address[] calldata _userAddresses,
        IIdentity[] calldata _identityContracts,
        uint16[] calldata _countryCodes
    ) external override onlyRole(AGENT_ROLE) {
        require(_userAddresses.length == _identityContracts.length, "Arrays length mismatch");
        require(_userAddresses.length == _countryCodes.length, "Arrays length mismatch");
        
        for (uint256 i = 0; i < _userAddresses.length; i++) {
            if (!_hasIdentity[_userAddresses[i]]) {
                _identities[_userAddresses[i]] = _identityContracts[i];
                _countries[_userAddresses[i]] = _countryCodes[i];
                _hasIdentity[_userAddresses[i]] = true;
                investorsList.push(_userAddresses[i]);
                
                emit IdentityRegistered(_userAddresses[i], _identityContracts[i]);
                emit CountryUpdated(_userAddresses[i], _countryCodes[i]);
            }
        }
    }
    
    function contains(address _userAddress) external view override returns (bool) {
        return _hasIdentity[_userAddress];
    }
    
    function identity(address _userAddress) external view override returns (IIdentity) {
        return _identities[_userAddress];
    }
    
    function investorCountry(address _userAddress) external view override returns (uint16) {
        return _countries[_userAddress];
    }
    
    function isVerified(address _userAddress) external view override returns (bool) {
        if (!_hasIdentity[_userAddress]) {
            return false;
        }
        
        if (address(topicsRegistry) == address(0)) {
            return true; // If no topics registry set, consider all registered identities as verified
        }
        
        uint256[] memory requiredTopics = topicsRegistry.getClaimTopics();
        IIdentity userIdentity = _identities[_userAddress];
        
        for (uint256 i = 0; i < requiredTopics.length; i++) {
            bytes32[] memory claimIds = userIdentity.getClaimIdsByTopic(requiredTopics[i]);
            if (claimIds.length == 0) {
                return false;
            }
            
            // Check if at least one claim for this topic is valid
            bool hasValidClaim = false;
            for (uint256 j = 0; j < claimIds.length; j++) {
                (uint256 topic, , address issuer, , , ) = userIdentity.getClaim(claimIds[j]);
                if (topic == requiredTopics[i] && topicsRegistry.isTrustedIssuer(issuer, requiredTopics[i])) {
                    hasValidClaim = true;
                    break;
                }
            }
            
            if (!hasValidClaim) {
                return false;
            }
        }
        
        return true;
    }
    
    function getInvestorsList() external view returns (address[] memory) {
        return investorsList;
    }
    
    function _authorizeUpgrade(address newImplementation) internal override onlyRole(UPGRADER_ROLE) {}
}