// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title IRegulatoryIdentity
 * @notice Interface for regulatory-compliant cross-chain identity management
 * @dev This interface defines the structure for CCIP-enabled identity verification
 */
interface IRegulatoryIdentity {
    // Enums
    enum InvestorType { RETAIL, PROFESSIONAL, INSTITUTIONAL }
    enum ComplianceStatus { PENDING, APPROVED, REJECTED, EXPIRED, SUSPENDED }
    
    // Structs
    struct RegulatoryIdentity {
        bool kycVerified;
        bool amlCleared;
        string jurisdiction;
        uint8 riskScore;
        bytes32 documentHash; // IPFS hash of KYC documents
        uint256 approvalTimestamp;
        uint256 expiryDate;
        address approvedBy;
        uint64 sourceChain; // Chain where KYC was originally approved
        bytes ccipAttestation; // Proof of cross-chain verification
        InvestorType investorType;
        ComplianceStatus status;
        bool isAccredited;
    }
    
    struct ComplianceData {
        string jurisdiction;
        bool accredited;
        InvestorType investorType;
        bytes signature;
        bytes32 documentProof;
        uint8 riskScore;
    }
    
    struct CCIPMessage {
        address userAddress;
        bytes32 kycHash;
        uint256 timestamp;
        string jurisdiction;
        bool isAccredited;
        InvestorType investorType;
        bytes adminSignature;
        bytes32 documentProof;
        ComplianceStatus status;
    }
    
    // Events
    event IdentityRegistered(
        address indexed user,
        address indexed approvedBy,
        uint64 sourceChain,
        bytes32 kycHash
    );
    
    event IdentityUpdated(
        address indexed user,
        address indexed updatedBy,
        ComplianceStatus newStatus,
        uint256 timestamp
    );
    
    event IdentityPropagated(
        address indexed user,
        uint64 indexed destinationChain,
        bytes32 indexed messageId,
        uint256 timestamp
    );
    
    event ComplianceStatusChanged(
        address indexed user,
        ComplianceStatus oldStatus,
        ComplianceStatus newStatus,
        string reason
    );
    
    event CrossChainIdentityReceived(
        address indexed user,
        uint64 indexed sourceChain,
        bytes32 indexed messageId,
        uint256 timestamp
    );
    
    // Functions
    function registerIdentity(
        address user,
        ComplianceData calldata data
    ) external returns (bool);
    
    function updateIdentityStatus(
        address user,
        ComplianceStatus status,
        string calldata reason
    ) external returns (bool);
    
    function getIdentity(address user) external view returns (RegulatoryIdentity memory);
    
    function isCompliant(address user) external view returns (bool);
    
    function canTransfer(
        address from,
        address to,
        uint256 amount
    ) external view returns (bool);
    
    function getComplianceStatus(address user) external view returns (ComplianceStatus);
    
    function isIdentityExpired(address user) external view returns (bool);
    
    function getRiskScore(address user) external view returns (uint8);
}