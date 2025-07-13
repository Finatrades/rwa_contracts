// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "./IClaimTopicsRegistry.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

/**
 * @title ClaimTopicsRegistry
 * @notice Registry for managing claim topics and trusted issuers in ERC-3643
 */
contract ClaimTopicsRegistry is IClaimTopicsRegistry, Initializable, AccessControlUpgradeable, UUPSUpgradeable {
    bytes32 public constant OWNER_ROLE = keccak256("OWNER_ROLE");
    bytes32 public constant UPGRADER_ROLE = keccak256("UPGRADER_ROLE");
    
    // Claim topics required for the token
    uint256[] private claimTopics;
    mapping(uint256 => bool) private claimTopicsMap;
    
    // Trusted claim issuers
    address[] private trustedIssuers;
    mapping(address => bool) private trustedIssuersMap;
    mapping(address => uint256[]) private issuerClaimTopics;
    mapping(address => mapping(uint256 => bool)) private issuerTopicMap;
    
    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }
    
    function initialize(address _admin) public initializer {
        __AccessControl_init();
        __UUPSUpgradeable_init();
        
        _grantRole(DEFAULT_ADMIN_ROLE, _admin);
        _grantRole(OWNER_ROLE, _admin);
        _grantRole(UPGRADER_ROLE, _admin);
    }
    
    function addClaimTopic(uint256 _claimTopic) external override onlyRole(OWNER_ROLE) {
        require(!claimTopicsMap[_claimTopic], "Claim topic already exists");
        
        claimTopics.push(_claimTopic);
        claimTopicsMap[_claimTopic] = true;
        
        emit ClaimTopicAdded(_claimTopic);
    }
    
    function removeClaimTopic(uint256 _claimTopic) external override onlyRole(OWNER_ROLE) {
        require(claimTopicsMap[_claimTopic], "Claim topic does not exist");
        
        claimTopicsMap[_claimTopic] = false;
        
        // Remove from array
        for (uint256 i = 0; i < claimTopics.length; i++) {
            if (claimTopics[i] == _claimTopic) {
                claimTopics[i] = claimTopics[claimTopics.length - 1];
                claimTopics.pop();
                break;
            }
        }
        
        emit ClaimTopicRemoved(_claimTopic);
    }
    
    function addTrustedIssuer(address _issuer, uint256[] calldata _claimTopics) external override onlyRole(OWNER_ROLE) {
        require(!trustedIssuersMap[_issuer], "Issuer already trusted");
        require(_issuer != address(0), "Invalid issuer address");
        
        trustedIssuers.push(_issuer);
        trustedIssuersMap[_issuer] = true;
        
        for (uint256 i = 0; i < _claimTopics.length; i++) {
            require(claimTopicsMap[_claimTopics[i]], "Invalid claim topic");
            issuerClaimTopics[_issuer].push(_claimTopics[i]);
            issuerTopicMap[_issuer][_claimTopics[i]] = true;
        }
        
        emit TrustedIssuerAdded(_issuer, _claimTopics);
    }
    
    function removeTrustedIssuer(address _issuer) external override onlyRole(OWNER_ROLE) {
        require(trustedIssuersMap[_issuer], "Issuer not trusted");
        
        trustedIssuersMap[_issuer] = false;
        
        // Remove from array
        for (uint256 i = 0; i < trustedIssuers.length; i++) {
            if (trustedIssuers[i] == _issuer) {
                trustedIssuers[i] = trustedIssuers[trustedIssuers.length - 1];
                trustedIssuers.pop();
                break;
            }
        }
        
        // Clear issuer claim topics
        uint256[] memory topics = issuerClaimTopics[_issuer];
        for (uint256 i = 0; i < topics.length; i++) {
            issuerTopicMap[_issuer][topics[i]] = false;
        }
        delete issuerClaimTopics[_issuer];
        
        emit TrustedIssuerRemoved(_issuer);
    }
    
    function updateTrustedIssuer(address _issuer, uint256[] calldata _claimTopics) external override onlyRole(OWNER_ROLE) {
        require(trustedIssuersMap[_issuer], "Issuer not trusted");
        
        // Clear existing topics
        uint256[] memory oldTopics = issuerClaimTopics[_issuer];
        for (uint256 i = 0; i < oldTopics.length; i++) {
            issuerTopicMap[_issuer][oldTopics[i]] = false;
        }
        delete issuerClaimTopics[_issuer];
        
        // Add new topics
        for (uint256 i = 0; i < _claimTopics.length; i++) {
            require(claimTopicsMap[_claimTopics[i]], "Invalid claim topic");
            issuerClaimTopics[_issuer].push(_claimTopics[i]);
            issuerTopicMap[_issuer][_claimTopics[i]] = true;
        }
        
        emit TrustedIssuerUpdated(_issuer, _claimTopics);
    }
    
    function getTrustedIssuers() external view override returns (address[] memory) {
        return trustedIssuers;
    }
    
    function isTrustedIssuer(address _issuer, uint256 _claimTopic) external view override returns (bool) {
        return trustedIssuersMap[_issuer] && issuerTopicMap[_issuer][_claimTopic];
    }
    
    function getTrustedIssuerClaimTopics(address _issuer) external view override returns (uint256[] memory) {
        return issuerClaimTopics[_issuer];
    }
    
    function getClaimTopics() external view override returns (uint256[] memory) {
        return claimTopics;
    }
    
    function _authorizeUpgrade(address newImplementation) internal override onlyRole(UPGRADER_ROLE) {}
}