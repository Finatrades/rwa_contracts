// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "./IIdentity.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

/**
 * @title ClaimIssuer
 * @notice Claim issuer contract for KYC/AML verification in ERC-3643
 * @dev Issues identity claims for verified investors
 */
contract ClaimIssuer is Initializable, AccessControlUpgradeable, UUPSUpgradeable {
    bytes32 public constant CLAIM_ISSUER_ROLE = keccak256("CLAIM_ISSUER_ROLE");
    bytes32 public constant UPGRADER_ROLE = keccak256("UPGRADER_ROLE");
    
    // Standard claim topics as per ERC-735
    uint256 public constant KYC_TOPIC = 1; // KYC verification
    uint256 public constant AML_TOPIC = 2; // AML verification
    uint256 public constant ACCREDITATION_TOPIC = 3; // Accredited investor status
    uint256 public constant COUNTRY_TOPIC = 4; // Country of residence
    uint256 public constant INCOME_TOPIC = 5; // Income verification
    uint256 public constant PROPERTY_OWNERSHIP_TOPIC = 6; // Property ownership verification
    
    // Claim data storage
    mapping(address => mapping(uint256 => bytes32)) public issuedClaims;
    mapping(bytes32 => bool) public revokedClaims;
    mapping(address => uint256) public claimIssuanceDate;
    
    // Events
    event ClaimIssued(address indexed identity, uint256 indexed topic, bytes32 claimId);
    event ClaimRevoked(bytes32 indexed claimId);
    event ClaimDataUpdated(address indexed identity, uint256 indexed topic, bytes32 newClaimId);
    
    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }
    
    function initialize(address _admin) public initializer {
        __AccessControl_init();
        __UUPSUpgradeable_init();
        
        _grantRole(DEFAULT_ADMIN_ROLE, _admin);
        _grantRole(CLAIM_ISSUER_ROLE, _admin);
        _grantRole(UPGRADER_ROLE, _admin);
    }
    
    /**
     * @notice Issue a claim for an identity
     * @param _identity The identity contract address
     * @param _topic The claim topic
     * @param _data The claim data
     */
    function issueClaim(
        address _identity,
        uint256 _topic,
        bytes calldata _data
    ) external onlyRole(CLAIM_ISSUER_ROLE) returns (bytes32) {
        require(_identity != address(0), "Invalid identity address");
        
        // Generate claim ID
        bytes32 claimId = keccak256(abi.encodePacked(_identity, _topic, _data, block.timestamp));
        
        // Store claim reference
        issuedClaims[_identity][_topic] = claimId;
        claimIssuanceDate[_identity] = block.timestamp;
        
        // Sign the claim
        bytes memory signature = _signClaim(claimId);
        
        // Add claim to identity
        IIdentity(_identity).addClaim(
            _topic,
            1, // Scheme: ECDSA
            address(this),
            signature,
            _data,
            ""
        );
        
        emit ClaimIssued(_identity, _topic, claimId);
        
        return claimId;
    }
    
    /**
     * @notice Batch issue claims for multiple identities
     */
    function batchIssueClaims(
        address[] calldata _identities,
        uint256[] calldata _topics,
        bytes[] calldata _data
    ) external onlyRole(CLAIM_ISSUER_ROLE) {
        require(_identities.length == _topics.length && _identities.length == _data.length, "Arrays length mismatch");
        
        for (uint256 i = 0; i < _identities.length; i++) {
            this.issueClaim(_identities[i], _topics[i], _data[i]);
        }
    }
    
    /**
     * @notice Issue standard KYC/AML claims for an identity
     */
    function issueKYCAMLClaims(
        address _identity,
        string calldata _countryCode,
        bool _isAccredited
    ) external onlyRole(CLAIM_ISSUER_ROLE) {
        // Issue KYC claim
        this.issueClaim(_identity, KYC_TOPIC, abi.encode(true, block.timestamp));
        
        // Issue AML claim
        this.issueClaim(_identity, AML_TOPIC, abi.encode(true, block.timestamp));
        
        // Issue country claim
        this.issueClaim(_identity, COUNTRY_TOPIC, abi.encode(_countryCode));
        
        // Issue accreditation claim if applicable
        if (_isAccredited) {
            this.issueClaim(_identity, ACCREDITATION_TOPIC, abi.encode(true, block.timestamp));
        }
    }
    
    /**
     * @notice Revoke a claim
     */
    function revokeClaim(bytes32 _claimId) external onlyRole(CLAIM_ISSUER_ROLE) {
        require(!revokedClaims[_claimId], "Claim already revoked");
        
        revokedClaims[_claimId] = true;
        emit ClaimRevoked(_claimId);
    }
    
    /**
     * @notice Update claim data for an identity
     */
    function updateClaim(
        address _identity,
        uint256 _topic,
        bytes calldata _newData
    ) external onlyRole(CLAIM_ISSUER_ROLE) {
        // Revoke old claim if exists
        bytes32 oldClaimId = issuedClaims[_identity][_topic];
        if (oldClaimId != bytes32(0)) {
            this.revokeClaim(oldClaimId);
        }
        
        // Issue new claim
        bytes32 newClaimId = this.issueClaim(_identity, _topic, _newData);
        emit ClaimDataUpdated(_identity, _topic, newClaimId);
    }
    
    /**
     * @notice Check if a claim is valid
     */
    function isClaimValid(address _identity, uint256 _topic) external view returns (bool) {
        bytes32 claimId = issuedClaims[_identity][_topic];
        return claimId != bytes32(0) && !revokedClaims[claimId];
    }
    
    /**
     * @notice Get claim data
     */
    function getClaim(address _identity, uint256 _topic) external view returns (bytes32) {
        return issuedClaims[_identity][_topic];
    }
    
    /**
     * @notice Internal function to sign a claim
     */
    function _signClaim(bytes32 _claimId) private pure returns (bytes memory) {
        // In production, this would use proper ECDSA signing
        // For now, return a placeholder signature
        return abi.encodePacked(_claimId);
    }
    
    function _authorizeUpgrade(address newImplementation) internal override onlyRole(UPGRADER_ROLE) {}
}