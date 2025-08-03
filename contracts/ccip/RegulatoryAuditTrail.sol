// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

/**
 * @title RegulatoryAuditTrail
 * @notice Maintains immutable audit trail for regulatory compliance
 * @dev Records all cross-chain identity operations for regulatory reporting
 */
contract RegulatoryAuditTrail is 
    Initializable,
    AccessControlUpgradeable,
    UUPSUpgradeable
{
    // Constants
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant AUDITOR_ROLE = keccak256("AUDITOR_ROLE");
    bytes32 public constant RECORDER_ROLE = keccak256("RECORDER_ROLE");
    bytes32 public constant UPGRADER_ROLE = keccak256("UPGRADER_ROLE");
    
    // Enums
    enum ActionType {
        IDENTITY_REGISTERED,
        IDENTITY_UPDATED,
        IDENTITY_SUSPENDED,
        IDENTITY_REVOKED,
        IDENTITY_PROPAGATED,
        IDENTITY_RECEIVED,
        COMPLIANCE_CHECK,
        TRANSFER_APPROVED,
        TRANSFER_BLOCKED
    }
    
    // Structs
    struct AuditRecord {
        uint256 timestamp;
        address user;
        address operator;
        ActionType action;
        uint64 sourceChain;
        uint64 destinationChain;
        bytes32 dataHash;
        string metadata;
        bytes proof;
    }
    
    struct ComplianceReport {
        uint256 startDate;
        uint256 endDate;
        uint256 totalIdentities;
        uint256 totalTransfers;
        uint256 blockedTransfers;
        uint256 crossChainMessages;
        mapping(string => uint256) jurisdictionCounts;
        mapping(ActionType => uint256) actionCounts;
    }
    
    // State variables
    AuditRecord[] private auditTrail;
    mapping(address => uint256[]) private userAuditIndices;
    mapping(bytes32 => uint256) private messageToAuditIndex;
    mapping(uint256 => ComplianceReport) private monthlyReports;
    
    uint256 public totalRecords;
    
    // Events
    event AuditRecordCreated(
        uint256 indexed recordId,
        address indexed user,
        ActionType indexed action,
        uint256 timestamp
    );
    
    event ComplianceReportGenerated(
        uint256 indexed year,
        uint256 indexed month,
        uint256 totalRecords
    );
    
    event AuditExported(
        uint256 fromRecord,
        uint256 toRecord,
        address exportedBy
    );
    
    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }
    
    /**
     * @notice Initialize the contract
     * @param _admin Admin address
     */
    function initialize(address _admin) public initializer {
        require(_admin != address(0), "Invalid admin");
        
        __AccessControl_init();
        __UUPSUpgradeable_init();
        
        _grantRole(DEFAULT_ADMIN_ROLE, _admin);
        _grantRole(ADMIN_ROLE, _admin);
        _grantRole(AUDITOR_ROLE, _admin);
        _grantRole(UPGRADER_ROLE, _admin);
    }
    
    /**
     * @notice Record an audit entry
     * @param user User address
     * @param action Action type
     * @param sourceChain Source chain ID
     * @param destinationChain Destination chain ID
     * @param dataHash Hash of the data
     * @param metadata Additional metadata
     * @param proof Cryptographic proof
     */
    function recordAudit(
        address user,
        ActionType action,
        uint64 sourceChain,
        uint64 destinationChain,
        bytes32 dataHash,
        string calldata metadata,
        bytes calldata proof
    ) external onlyRole(RECORDER_ROLE) returns (uint256 recordId) {
        recordId = totalRecords;
        
        AuditRecord memory record = AuditRecord({
            timestamp: block.timestamp,
            user: user,
            operator: msg.sender,
            action: action,
            sourceChain: sourceChain,
            destinationChain: destinationChain,
            dataHash: dataHash,
            metadata: metadata,
            proof: proof
        });
        
        auditTrail.push(record);
        userAuditIndices[user].push(recordId);
        
        if (dataHash != bytes32(0)) {
            messageToAuditIndex[dataHash] = recordId;
        }
        
        totalRecords++;
        
        emit AuditRecordCreated(recordId, user, action, block.timestamp);
        
        return recordId;
    }
    
    /**
     * @notice Get audit record by ID
     * @param recordId Record ID
     * @return AuditRecord
     */
    function getAuditRecord(uint256 recordId) 
        external 
        view 
        returns (AuditRecord memory) 
    {
        require(recordId < totalRecords, "Invalid record ID");
        return auditTrail[recordId];
    }
    
    /**
     * @notice Get all audit records for a user
     * @param user User address
     * @return AuditRecord[] array
     */
    function getUserAuditTrail(address user) 
        external 
        view 
        returns (AuditRecord[] memory) 
    {
        uint256[] memory indices = userAuditIndices[user];
        AuditRecord[] memory records = new AuditRecord[](indices.length);
        
        for (uint256 i = 0; i < indices.length; i++) {
            records[i] = auditTrail[indices[i]];
        }
        
        return records;
    }
    
    /**
     * @notice Get audit records by action type
     * @param action Action type
     * @param limit Maximum number of records to return
     * @return AuditRecord[] array
     */
    function getAuditsByAction(ActionType action, uint256 limit) 
        external 
        view 
        returns (AuditRecord[] memory) 
    {
        uint256 count = 0;
        
        // Count matching records
        for (uint256 i = 0; i < totalRecords && count < limit; i++) {
            if (auditTrail[i].action == action) {
                count++;
            }
        }
        
        // Collect matching records
        AuditRecord[] memory records = new AuditRecord[](count);
        uint256 index = 0;
        
        for (uint256 i = 0; i < totalRecords && index < count; i++) {
            if (auditTrail[i].action == action) {
                records[index] = auditTrail[i];
                index++;
            }
        }
        
        return records;
    }
    
    /**
     * @notice Get audit records within time range
     * @param startTime Start timestamp
     * @param endTime End timestamp
     * @return AuditRecord[] array
     */
    function getAuditsByTimeRange(uint256 startTime, uint256 endTime) 
        external 
        view 
        onlyRole(AUDITOR_ROLE)
        returns (AuditRecord[] memory) 
    {
        require(startTime <= endTime, "Invalid time range");
        
        uint256 count = 0;
        
        // Count matching records
        for (uint256 i = 0; i < totalRecords; i++) {
            if (auditTrail[i].timestamp >= startTime && 
                auditTrail[i].timestamp <= endTime) {
                count++;
            }
        }
        
        // Collect matching records
        AuditRecord[] memory records = new AuditRecord[](count);
        uint256 index = 0;
        
        for (uint256 i = 0; i < totalRecords && index < count; i++) {
            if (auditTrail[i].timestamp >= startTime && 
                auditTrail[i].timestamp <= endTime) {
                records[index] = auditTrail[i];
                index++;
            }
        }
        
        return records;
    }
    
    /**
     * @notice Generate compliance statistics
     * @param startTime Start timestamp
     * @param endTime End timestamp
     * @return totalActions Total number of actions
     * @return identityRegistrations Number of identity registrations
     * @return identityUpdates Number of identity updates
     * @return crossChainPropagations Number of cross-chain propagations
     * @return blockedTransfers Number of blocked transfers
     */
    function generateComplianceStats(uint256 startTime, uint256 endTime)
        external
        view
        onlyRole(AUDITOR_ROLE)
        returns (
            uint256 totalActions,
            uint256 identityRegistrations,
            uint256 identityUpdates,
            uint256 crossChainPropagations,
            uint256 blockedTransfers
        )
    {
        for (uint256 i = 0; i < totalRecords; i++) {
            AuditRecord memory record = auditTrail[i];
            
            if (record.timestamp >= startTime && record.timestamp <= endTime) {
                totalActions++;
                
                if (record.action == ActionType.IDENTITY_REGISTERED) {
                    identityRegistrations++;
                } else if (record.action == ActionType.IDENTITY_UPDATED) {
                    identityUpdates++;
                } else if (record.action == ActionType.IDENTITY_PROPAGATED) {
                    crossChainPropagations++;
                } else if (record.action == ActionType.TRANSFER_BLOCKED) {
                    blockedTransfers++;
                }
            }
        }
        
        return (
            totalActions,
            identityRegistrations,
            identityUpdates,
            crossChainPropagations,
            blockedTransfers
        );
    }
    
    /**
     * @notice Get audit record by message ID
     * @param messageId CCIP message ID
     * @return recordId Audit record ID
     */
    function getAuditByMessageId(bytes32 messageId) 
        external 
        view 
        returns (uint256) 
    {
        return messageToAuditIndex[messageId];
    }
    
    /**
     * @notice Export audit records for regulatory submission
     * @param fromRecord Starting record ID
     * @param toRecord Ending record ID
     * @return records Array of audit records
     */
    function exportAuditRecords(uint256 fromRecord, uint256 toRecord)
        external
        onlyRole(AUDITOR_ROLE)
        returns (AuditRecord[] memory records)
    {
        require(fromRecord <= toRecord, "Invalid range");
        require(toRecord < totalRecords, "Record out of range");
        
        uint256 count = toRecord - fromRecord + 1;
        records = new AuditRecord[](count);
        
        for (uint256 i = 0; i < count; i++) {
            records[i] = auditTrail[fromRecord + i];
        }
        
        emit AuditExported(fromRecord, toRecord, msg.sender);
        
        return records;
    }
    
    /**
     * @notice Grant recorder role to an address (typically bridge contracts)
     * @param recorder Address to grant role to
     */
    function addRecorder(address recorder) external onlyRole(ADMIN_ROLE) {
        grantRole(RECORDER_ROLE, recorder);
    }
    
    /**
     * @notice Remove recorder role from an address
     * @param recorder Address to revoke role from
     */
    function removeRecorder(address recorder) external onlyRole(ADMIN_ROLE) {
        revokeRole(RECORDER_ROLE, recorder);
    }
    
    /**
     * @notice Authorize upgrade
     */
    function _authorizeUpgrade(address newImplementation)
        internal
        override
        onlyRole(UPGRADER_ROLE)
    {}
}