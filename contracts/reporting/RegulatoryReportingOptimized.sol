// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "./IRegulatoryReporting.sol";
import "../token/IToken.sol";
import "../identity/IIdentityRegistry.sol";
import "../registry/IAssetRegistry.sol";
import "../compliance/ICompliance.sol";

/**
 * @title RegulatoryReportingOptimized
 * @notice Gas-optimized regulatory reporting system for RWA tokens
 * @dev Implements pagination and off-chain data aggregation patterns
 */
contract RegulatoryReportingOptimized is 
    Initializable, 
    AccessControlUpgradeable, 
    PausableUpgradeable, 
    UUPSUpgradeable,
    IRegulatoryReporting 
{
    // Custom errors for gas optimization
    error NotAuthorized();
    error InvalidTimeRange();
    error InvalidPeriod();
    error InvalidReportType();
    error InvalidDividendIndex();
    error OnlyTokenContract();
    error InvalidAddress();
    
    bytes32 public constant REPORTER_ROLE = keccak256("REPORTER_ROLE");
    bytes32 public constant COMPLIANCE_OFFICER_ROLE = keccak256("COMPLIANCE_OFFICER_ROLE");
    
    // Contract references
    IToken public tokenContract;
    IIdentityRegistry public identityRegistry;
    IAssetRegistry public assetRegistry;
    ICompliance public complianceContract;
    
    // Reporting data structures
    struct ReportingPeriod {
        uint256 startDate;
        uint256 endDate;
    }
    
    struct TransactionRecord {
        address from;
        address to;
        uint256 amount;
        uint256 timestamp;
        string assetId;
        bool wasCompliant;
    }
    
    // Storage
    ReportingPeriod public currentPeriod;
    
    // Optimized storage using mappings instead of arrays
    mapping(uint256 => ComplianceViolation) private violations;
    uint256 private violationCount;
    
    mapping(address => uint256) private investorViolationCount;
    mapping(address => mapping(uint256 => uint256)) private investorViolationIds;
    
    mapping(address => uint256) private investorTransactionCount;
    mapping(address => mapping(uint256 => TransactionRecord)) private investorTransactionRecords;
    
    mapping(string => uint256) private assetTransactionCounts;
    
    // Pagination constants
    uint256 private constant MAX_REPORT_SIZE = 50; // Reduced for gas optimization
    
    // Events
    event TransactionRecorded(address indexed from, address indexed to, uint256 amount, uint256 timestamp);
    event ViolationRecorded(address indexed attemptedBy, uint256 violationId, uint256 timestamp);
    
    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }
    
    /**
     * @notice Initialize the contract
     * @param _token Token contract address
     * @param _identityRegistry Identity registry address
     * @param _assetRegistry Asset registry address
     * @param _compliance Compliance contract address
     */
    function initialize(
        address _token,
        address _identityRegistry,
        address _assetRegistry,
        address _compliance
    ) public initializer {
        if (_token == address(0) || 
            _identityRegistry == address(0) || 
            _assetRegistry == address(0) || 
            _compliance == address(0)) revert InvalidAddress();
        
        __AccessControl_init();
        __Pausable_init();
        __UUPSUpgradeable_init();
        
        tokenContract = IToken(_token);
        identityRegistry = IIdentityRegistry(_identityRegistry);
        assetRegistry = IAssetRegistry(_assetRegistry);
        complianceContract = ICompliance(_compliance);
        
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(REPORTER_ROLE, msg.sender);
        _grantRole(COMPLIANCE_OFFICER_ROLE, msg.sender);
        
        // Set initial reporting period (current year)
        currentPeriod.startDate = block.timestamp - (block.timestamp % 365 days);
        currentPeriod.endDate = currentPeriod.startDate + 365 days;
    }
    
    /**
     * @notice Generate investor report with pagination
     * @dev Optimized to reduce gas costs
     * @param limit Maximum number of results
     * @param offset Starting index
     * @return report Array of investor data
     */
    function generateInvestorReport(uint256 limit, uint256 offset) 
        external 
        view 
        override 
        returns (InvestorReport[] memory report) 
    {
        if (!hasRole(REPORTER_ROLE, msg.sender)) revert NotAuthorized();
        
        uint256 reportLimit = limit > MAX_REPORT_SIZE ? MAX_REPORT_SIZE : limit;
        address[] memory investors = identityRegistry.getInvestorsList();
        
        uint256 end = offset + reportLimit;
        if (end > investors.length) {
            end = investors.length;
        }
        
        uint256 actualSize = end > offset ? end - offset : 0;
        report = new InvestorReport[](actualSize);
        
        for (uint256 i = 0; i < actualSize; i++) {
            address investor = investors[offset + i];
            IIdentity identityContract = identityRegistry.identity(investor);
            
            report[i] = InvestorReport({
                wallet: investor,
                identity: address(identityContract),
                country: identityRegistry.investorCountry(investor),
                balance: tokenContract.balanceOf(investor),
                totalTransactions: investorTransactionCount[investor],
                lastActivityTimestamp: _getLastActivity(investor),
                isAccredited: _checkAccreditation(address(identityContract)),
                kycVerified: identityRegistry.isVerified(investor)
            });
        }
    }
    
    /**
     * @notice Generate transaction report for a time period
     * @dev Returns transactions for a single investor to reduce gas
     * @param investor Address to get transactions for
     * @param fromTimestamp Start timestamp
     * @param toTimestamp End timestamp
     * @param limit Maximum results
     * @return report Array of transactions
     */
    function generateInvestorTransactionReport(
        address investor,
        uint256 fromTimestamp, 
        uint256 toTimestamp, 
        uint256 limit
    ) external view returns (TransactionReport[] memory report) {
        if (!hasRole(REPORTER_ROLE, msg.sender)) revert NotAuthorized();
        if (fromTimestamp >= toTimestamp) revert InvalidTimeRange();
        
        uint256 reportLimit = limit > MAX_REPORT_SIZE ? MAX_REPORT_SIZE : limit;
        uint256 totalTx = investorTransactionCount[investor];
        uint256 count = 0;
        
        // First pass: count matching transactions
        for (uint256 i = 0; i < totalTx && count < reportLimit; i++) {
            if (investorTransactionRecords[investor][i].timestamp >= fromTimestamp && 
                investorTransactionRecords[investor][i].timestamp <= toTimestamp) {
                count++;
            }
        }
        
        // Second pass: fill report
        report = new TransactionReport[](count);
        uint256 index = 0;
        
        for (uint256 i = 0; i < totalTx && index < count; i++) {
            TransactionRecord memory record = investorTransactionRecords[investor][i];
            if (record.timestamp >= fromTimestamp && record.timestamp <= toTimestamp) {
                report[index] = TransactionReport({
                    from: record.from,
                    to: record.to,
                    amount: record.amount,
                    timestamp: record.timestamp,
                    assetId: record.assetId,
                    wasCompliant: record.wasCompliant,
                    violationReason: record.wasCompliant ? "" : "Compliance check failed"
                });
                index++;
            }
        }
    }
    
    /**
     * @notice Generate paginated compliance violation report
     * @param fromTimestamp Start timestamp
     * @param toTimestamp End timestamp
     * @param offset Starting index
     * @param limit Maximum results
     * @return report Array of violations
     */
    function generateComplianceViolationReportPaginated(
        uint256 fromTimestamp, 
        uint256 toTimestamp,
        uint256 offset,
        uint256 limit
    ) external view returns (ComplianceViolation[] memory report) {
        if (!hasRole(COMPLIANCE_OFFICER_ROLE, msg.sender)) revert NotAuthorized();
        if (fromTimestamp >= toTimestamp) revert InvalidTimeRange();
        
        uint256 reportLimit = limit > MAX_REPORT_SIZE ? MAX_REPORT_SIZE : limit;
        uint256 count = 0;
        
        // Count matching violations starting from offset
        for (uint256 i = offset; i < violationCount && count < reportLimit; i++) {
            if (violations[i].timestamp >= fromTimestamp && 
                violations[i].timestamp <= toTimestamp) {
                count++;
            }
        }
        
        report = new ComplianceViolation[](count);
        uint256 index = 0;
        
        for (uint256 i = offset; i < violationCount && index < count; i++) {
            if (violations[i].timestamp >= fromTimestamp && 
                violations[i].timestamp <= toTimestamp) {
                report[index] = violations[i];
                index++;
            }
        }
    }
    
    /**
     * @notice Record a compliance violation
     * @param attemptedBy Address that attempted the transfer
     * @param attemptedTo Intended recipient
     * @param amount Amount attempted
     * @param reason Violation reason
     * @param moduleViolated Module that blocked transfer
     */
    function recordComplianceViolation(
        address attemptedBy,
        address attemptedTo,
        uint256 amount,
        string memory reason,
        string memory moduleViolated
    ) external override {
        if (!hasRole(COMPLIANCE_OFFICER_ROLE, msg.sender) && 
            msg.sender != address(complianceContract)) revert NotAuthorized();
        
        uint256 violationId = violationCount++;
        
        violations[violationId] = ComplianceViolation({
            attemptedBy: attemptedBy,
            attemptedTo: attemptedTo,
            amount: amount,
            timestamp: block.timestamp,
            reason: reason,
            moduleViolated: moduleViolated
        });
        
        uint256 investorViolationIndex = investorViolationCount[attemptedBy]++;
        investorViolationIds[attemptedBy][investorViolationIndex] = violationId;
        
        emit ComplianceViolationRecorded(attemptedBy, reason, block.timestamp);
        emit ViolationRecorded(attemptedBy, violationId, block.timestamp);
    }
    
    /**
     * @notice Record a transaction
     * @param from Sender address
     * @param to Recipient address
     * @param amount Amount transferred
     * @param assetId Asset identifier
     * @param wasCompliant Whether transfer was compliant
     */
    function recordTransaction(
        address from,
        address to,
        uint256 amount,
        string memory assetId,
        bool wasCompliant
    ) external override {
        if (msg.sender != address(tokenContract)) revert OnlyTokenContract();
        
        uint256 fromIndex = investorTransactionCount[from]++;
        investorTransactionRecords[from][fromIndex] = TransactionRecord({
            from: from,
            to: to,
            amount: amount,
            timestamp: block.timestamp,
            assetId: assetId,
            wasCompliant: wasCompliant
        });
        
        if (from != to) {
            uint256 toIndex = investorTransactionCount[to]++;
            investorTransactionRecords[to][toIndex] = TransactionRecord({
                from: from,
                to: to,
                amount: amount,
                timestamp: block.timestamp,
                assetId: assetId,
                wasCompliant: wasCompliant
            });
        }
        
        if (bytes(assetId).length > 0) {
            assetTransactionCounts[assetId]++;
        }
        
        emit TransactionRecorded(from, to, amount, block.timestamp);
    }
    
    /**
     * @notice Set reporting period
     * @param startDate Period start
     * @param endDate Period end
     */
    function setReportingPeriod(uint256 startDate, uint256 endDate) external override {
        if (!hasRole(COMPLIANCE_OFFICER_ROLE, msg.sender)) revert NotAuthorized();
        if (startDate >= endDate) revert InvalidPeriod();
        
        currentPeriod.startDate = startDate;
        currentPeriod.endDate = endDate;
        
        emit ReportingPeriodSet(startDate, endDate);
    }
    
    /**
     * @notice Get investor statistics
     * @param investor Address to query
     * @return totalTransactions Number of transactions
     * @return totalVolume Total volume transferred
     * @return complianceViolations Number of violations
     * @return firstTransactionDate First transaction timestamp
     * @return lastTransactionDate Last transaction timestamp
     */
    function getInvestorStatistics(address investor) 
        external 
        view 
        override 
        returns (
            uint256 totalTransactions,
            uint256 totalVolume,
            uint256 complianceViolations,
            uint256 firstTransactionDate,
            uint256 lastTransactionDate
        ) 
    {
        totalTransactions = investorTransactionCount[investor];
        complianceViolations = investorViolationCount[investor];
        
        if (totalTransactions > 0) {
            firstTransactionDate = investorTransactionRecords[investor][0].timestamp;
            lastTransactionDate = investorTransactionRecords[investor][totalTransactions - 1].timestamp;
            
            for (uint256 i = 0; i < totalTransactions; i++) {
                totalVolume += investorTransactionRecords[investor][i].amount;
            }
        }
    }
    
    // Stubbed functions to satisfy interface
    function generateTransactionReport(uint256, uint256, uint256) 
        external view override returns (TransactionReport[] memory) {
        revert("Use generateInvestorTransactionReport instead");
    }
    
    function generateComplianceViolationReport(uint256, uint256) 
        external view override returns (ComplianceViolation[] memory) {
        revert("Use generateComplianceViolationReportPaginated instead");
    }
    
    function generateOwnershipDistributionReport(string memory) 
        external view override returns (OwnershipReport memory) {
        revert("Not implemented - use off-chain aggregation");
    }
    
    function generateDividendReport(uint256, uint256) 
        external view override returns (DividendReport[] memory) {
        revert("Not implemented - use dividend contract");
    }
    
    function generateJurisdictionalReport() 
        external view override returns (JurisdictionalReport[] memory) {
        revert("Not implemented - use off-chain aggregation");
    }
    
    function exportReportData(ReportType, uint256, uint256) 
        external view override returns (bytes memory) {
        revert("Not implemented - use specific report functions");
    }
    
    function getAssetStatistics(string memory) 
        external view override returns (uint256, uint256, uint256, uint256) {
        revert("Not implemented - use off-chain aggregation");
    }
    
    function getComplianceStatistics(uint256, uint256) 
        external view override returns (uint256, uint256, uint256, uint256) {
        revert("Not implemented - use off-chain aggregation");
    }
    
    // Internal functions
    function _getLastActivity(address investor) private view returns (uint256) {
        uint256 txCount = investorTransactionCount[investor];
        if (txCount == 0) return 0;
        return investorTransactionRecords[investor][txCount - 1].timestamp;
    }
    
    function _checkAccreditation(address) private pure returns (bool) {
        // Placeholder - implement actual accreditation check
        return true;
    }
    
    function _authorizeUpgrade(address newImplementation) 
        internal 
        override 
        onlyRole(DEFAULT_ADMIN_ROLE) 
    {}
}