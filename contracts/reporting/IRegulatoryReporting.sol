// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title IRegulatoryReporting
 * @dev Interface for regulatory reporting functionality
 */
interface IRegulatoryReporting {
    // Report types
    enum ReportType {
        INVESTOR_LIST,
        TRANSACTION_SUMMARY,
        COMPLIANCE_VIOLATIONS,
        OWNERSHIP_DISTRIBUTION,
        DIVIDEND_DISTRIBUTION,
        ASSET_PERFORMANCE,
        KYC_STATUS,
        JURISDICTIONAL_BREAKDOWN
    }

    // Structs for report data
    struct InvestorReport {
        address wallet;
        address identity;
        uint16 country;
        uint256 balance;
        uint256 totalTransactions;
        uint256 lastActivityTimestamp;
        bool isAccredited;
        bool kycVerified;
    }

    struct TransactionReport {
        address from;
        address to;
        uint256 amount;
        uint256 timestamp;
        string assetId;
        bool wasCompliant;
        string violationReason;
    }

    struct ComplianceViolation {
        address attemptedBy;
        address attemptedTo;
        uint256 amount;
        uint256 timestamp;
        string reason;
        string moduleViolated;
    }

    struct OwnershipReport {
        string assetId;
        uint256 totalSupply;
        uint256 totalHolders;
        uint256 top10Percentage;
        uint256 averageHolding;
        uint256 medianHolding;
    }

    struct DividendReport {
        uint256 dividendId;
        uint256 totalAmount;
        uint256 claimedAmount;
        uint256 unclaimedAmount;
        uint256 totalRecipients;
        uint256 claimDeadline;
        address dividendToken;
    }

    struct JurisdictionalReport {
        uint16 countryCode;
        string countryName;
        uint256 investorCount;
        uint256 totalHoldings;
        uint256 percentageOfSupply;
    }

    // Events
    event ReportGenerated(ReportType indexed reportType, uint256 timestamp, address requestedBy);
    event ComplianceViolationRecorded(address indexed attemptedBy, string reason, uint256 timestamp);
    event ReportingPeriodSet(uint256 startDate, uint256 endDate);
    
    // Reporting functions
    function generateInvestorReport(uint256 limit, uint256 offset) external view returns (InvestorReport[] memory);
    
    function generateTransactionReport(uint256 fromTimestamp, uint256 toTimestamp, uint256 limit) 
        external view returns (TransactionReport[] memory);
    
    function generateComplianceViolationReport(uint256 fromTimestamp, uint256 toTimestamp) 
        external view returns (ComplianceViolation[] memory);
    
    function generateOwnershipDistributionReport(string memory assetId) 
        external view returns (OwnershipReport memory);
    
    function generateDividendReport(uint256 fromDividendId, uint256 toDividendId) 
        external view returns (DividendReport[] memory);
    
    function generateJurisdictionalReport() 
        external view returns (JurisdictionalReport[] memory);
    
    // Administrative functions
    function recordComplianceViolation(
        address attemptedBy,
        address attemptedTo,
        uint256 amount,
        string memory reason,
        string memory moduleViolated
    ) external;
    
    function setReportingPeriod(uint256 startDate, uint256 endDate) external;
    
    function exportReportData(ReportType reportType, uint256 fromTimestamp, uint256 toTimestamp) 
        external view returns (bytes memory);
    
    // Query functions
    function getInvestorStatistics(address investor) external view returns (
        uint256 totalTransactions,
        uint256 totalVolume,
        uint256 complianceViolations,
        uint256 firstTransactionDate,
        uint256 lastTransactionDate
    );
    
    function getAssetStatistics(string memory assetId) external view returns (
        uint256 totalHolders,
        uint256 totalSupply,
        uint256 totalTransactions,
        uint256 averageTransactionSize
    );
    
    function getComplianceStatistics(uint256 fromTimestamp, uint256 toTimestamp) external view returns (
        uint256 totalTransactions,
        uint256 compliantTransactions,
        uint256 violationCount,
        uint256 uniqueViolators
    );
    
    // Transaction recording function
    function recordTransaction(
        address from,
        address to,
        uint256 amount,
        string memory assetId,
        bool wasCompliant
    ) external;
}