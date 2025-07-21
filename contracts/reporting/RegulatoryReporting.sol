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
 * @title RegulatoryReporting
 * @dev Comprehensive regulatory reporting system for RWA tokens
 * Provides various reports required by regulators including investor lists,
 * transaction summaries, compliance violations, and jurisdictional breakdowns
 */
contract RegulatoryReporting is 
    Initializable, 
    AccessControlUpgradeable, 
    PausableUpgradeable, 
    UUPSUpgradeable,
    IRegulatoryReporting 
{
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
    ComplianceViolation[] private violations;
    mapping(address => uint256[]) private investorViolations;
    mapping(address => TransactionRecord[]) private investorTransactions;
    mapping(string => uint256) private assetTransactionCounts;
    
    // Pagination constants
    uint256 private constant MAX_REPORT_SIZE = 100;
    
    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }
    
    /**
     * @dev Initialize the contract
     */
    function initialize(
        address _token,
        address _identityRegistry,
        address _assetRegistry,
        address _compliance
    ) public initializer {
        require(_token != address(0), "Invalid token address");
        require(_identityRegistry != address(0), "Invalid identity registry");
        require(_assetRegistry != address(0), "Invalid asset registry");
        require(_compliance != address(0), "Invalid compliance address");
        
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
     * @dev Generate investor report with pagination
     */
    function generateInvestorReport(uint256 limit, uint256 offset) 
        external 
        view 
        override 
        returns (InvestorReport[] memory) 
    {
        require(hasRole(REPORTER_ROLE, msg.sender), "Not authorized");
        
        uint256 reportLimit = limit > MAX_REPORT_SIZE ? MAX_REPORT_SIZE : limit;
        address[] memory investors = identityRegistry.getInvestorsList();
        
        uint256 end = offset + reportLimit;
        if (end > investors.length) {
            end = investors.length;
        }
        
        InvestorReport[] memory report = new InvestorReport[](end - offset);
        
        for (uint256 i = offset; i < end; i++) {
            address investor = investors[i];
            IIdentity identityContract = identityRegistry.identity(investor);
            address identity = address(identityContract);
            uint16 country = identityRegistry.investorCountry(investor);
            
            report[i - offset] = InvestorReport({
                wallet: investor,
                identity: identity,
                country: country,
                balance: tokenContract.balanceOf(investor),
                totalTransactions: investorTransactions[investor].length,
                lastActivityTimestamp: _getLastActivity(investor),
                isAccredited: _checkAccreditation(identity),
                kycVerified: identityRegistry.isVerified(investor)
            });
        }
        
        return report;
    }
    
    /**
     * @dev Generate transaction report for a time period
     */
    function generateTransactionReport(
        uint256 fromTimestamp, 
        uint256 toTimestamp, 
        uint256 limit
    ) external view override returns (TransactionReport[] memory) {
        require(hasRole(REPORTER_ROLE, msg.sender), "Not authorized");
        require(fromTimestamp < toTimestamp, "Invalid time range");
        
        uint256 reportLimit = limit > MAX_REPORT_SIZE ? MAX_REPORT_SIZE : limit;
        TransactionReport[] memory report = new TransactionReport[](reportLimit);
        uint256 count = 0;
        
        address[] memory investors = identityRegistry.getInvestorsList();
        
        for (uint256 i = 0; i < investors.length && count < reportLimit; i++) {
            TransactionRecord[] memory records = investorTransactions[investors[i]];
            
            for (uint256 j = 0; j < records.length && count < reportLimit; j++) {
                if (records[j].timestamp >= fromTimestamp && 
                    records[j].timestamp <= toTimestamp) {
                    
                    report[count] = TransactionReport({
                        from: records[j].from,
                        to: records[j].to,
                        amount: records[j].amount,
                        timestamp: records[j].timestamp,
                        assetId: records[j].assetId,
                        wasCompliant: records[j].wasCompliant,
                        violationReason: records[j].wasCompliant ? "" : "Compliance check failed"
                    });
                    count++;
                }
            }
        }
        
        // Create properly sized array
        TransactionReport[] memory finalReport = new TransactionReport[](count);
        for (uint256 i = 0; i < count; i++) {
            finalReport[i] = report[i];
        }
        
        return finalReport;
    }
    
    /**
     * @dev Generate compliance violation report
     */
    function generateComplianceViolationReport(
        uint256 fromTimestamp, 
        uint256 toTimestamp
    ) external view override returns (ComplianceViolation[] memory) {
        require(hasRole(COMPLIANCE_OFFICER_ROLE, msg.sender), "Not authorized");
        
        uint256 count = 0;
        for (uint256 i = 0; i < violations.length; i++) {
            if (violations[i].timestamp >= fromTimestamp && 
                violations[i].timestamp <= toTimestamp) {
                count++;
            }
        }
        
        ComplianceViolation[] memory report = new ComplianceViolation[](count);
        uint256 index = 0;
        
        for (uint256 i = 0; i < violations.length; i++) {
            if (violations[i].timestamp >= fromTimestamp && 
                violations[i].timestamp <= toTimestamp) {
                report[index] = violations[i];
                index++;
            }
        }
        
        return report;
    }
    
    /**
     * @dev Generate ownership distribution report for an asset
     */
    function generateOwnershipDistributionReport(string memory assetId) 
        external 
        view 
        override 
        returns (OwnershipReport memory) 
    {
        require(hasRole(REPORTER_ROLE, msg.sender), "Not authorized");
        
        address[] memory investors = identityRegistry.getInvestorsList();
        uint256 totalSupply = tokenContract.totalSupply();
        uint256 holdersCount = 0;
        uint256[] memory holdings = new uint256[](investors.length);
        
        // Collect holdings data
        for (uint256 i = 0; i < investors.length; i++) {
            // For asset-specific balance, would need to cast to specific implementation
            // For now, using total balance as proxy
            uint256 balance = tokenContract.balanceOf(investors[i]);
            if (balance > 0) {
                holdings[holdersCount] = balance;
                holdersCount++;
            }
        }
        
        // Calculate statistics
        uint256 totalHoldings = 0;
        uint256 top10Holdings = 0;
        
        // Sort holdings (simple bubble sort for top 10)
        for (uint256 i = 0; i < holdersCount && i < 10; i++) {
            for (uint256 j = i + 1; j < holdersCount; j++) {
                if (holdings[j] > holdings[i]) {
                    uint256 temp = holdings[i];
                    holdings[i] = holdings[j];
                    holdings[j] = temp;
                }
            }
            top10Holdings += holdings[i];
            totalHoldings += holdings[i];
        }
        
        for (uint256 i = 10; i < holdersCount; i++) {
            totalHoldings += holdings[i];
        }
        
        return OwnershipReport({
            assetId: assetId,
            totalSupply: totalHoldings,
            totalHolders: holdersCount,
            top10Percentage: totalHoldings > 0 ? (top10Holdings * 100) / totalHoldings : 0,
            averageHolding: holdersCount > 0 ? totalHoldings / holdersCount : 0,
            medianHolding: _calculateMedian(holdings, holdersCount)
        });
    }
    
    /**
     * @dev Generate dividend distribution report
     */
    function generateDividendReport(uint256 fromDividendId, uint256 toDividendId) 
        external 
        view 
        override 
        returns (DividendReport[] memory) 
    {
        require(hasRole(REPORTER_ROLE, msg.sender), "Not authorized");
        
        uint256 count = toDividendId - fromDividendId + 1;
        DividendReport[] memory report = new DividendReport[](count);
        
        // Simplified implementation - in production, would interface with actual dividend contract
        for (uint256 i = 0; i < count; i++) {
            uint256 dividendId = fromDividendId + i;
            
            // Placeholder data - would need specific dividend contract interface
            report[i] = DividendReport({
                dividendId: dividendId,
                totalAmount: 0, // Would fetch from dividend contract
                claimedAmount: 0,
                unclaimedAmount: 0,
                totalRecipients: 0,
                claimDeadline: block.timestamp + 365 days,
                dividendToken: address(0)
            });
        }
        
        return report;
    }
    
    /**
     * @dev Generate jurisdictional breakdown report
     */
    function generateJurisdictionalReport() 
        external 
        view 
        override 
        returns (JurisdictionalReport[] memory) 
    {
        require(hasRole(REPORTER_ROLE, msg.sender), "Not authorized");
        
        uint16[] memory countries = new uint16[](200); // Max countries
        uint256[] memory holdings = new uint256[](200);
        uint256[] memory investorCounts = new uint256[](200);
        uint256 countryCount = 0;
        
        address[] memory investors = identityRegistry.getInvestorsList();
        uint256 totalSupply = tokenContract.totalSupply();
        
        // Aggregate by country
        for (uint256 i = 0; i < investors.length; i++) {
            uint16 country = identityRegistry.investorCountry(investors[i]);
            uint256 balance = tokenContract.balanceOf(investors[i]);
            
            if (balance > 0) {
                // Find or add country
                bool found = false;
                uint256 countryIndex = 0;
                
                for (uint256 j = 0; j < countryCount; j++) {
                    if (countries[j] == country) {
                        found = true;
                        countryIndex = j;
                        break;
                    }
                }
                
                if (!found && countryCount < 200) {
                    countries[countryCount] = country;
                    countryIndex = countryCount;
                    countryCount++;
                }
                
                if (found || countryCount <= 200) {
                    holdings[countryIndex] += balance;
                    investorCounts[countryIndex]++;
                }
            }
        }
        
        // Build report
        JurisdictionalReport[] memory report = new JurisdictionalReport[](countryCount);
        
        for (uint256 i = 0; i < countryCount; i++) {
            report[i] = JurisdictionalReport({
                countryCode: countries[i],
                countryName: _getCountryName(countries[i]),
                investorCount: investorCounts[i],
                totalHoldings: holdings[i],
                percentageOfSupply: totalSupply > 0 ? (holdings[i] * 100) / totalSupply : 0
            });
        }
        
        return report;
    }
    
    /**
     * @dev Record a compliance violation
     */
    function recordComplianceViolation(
        address attemptedBy,
        address attemptedTo,
        uint256 amount,
        string memory reason,
        string memory moduleViolated
    ) external override {
        require(hasRole(COMPLIANCE_OFFICER_ROLE, msg.sender) || 
                msg.sender == address(complianceContract), "Not authorized");
        
        ComplianceViolation memory violation = ComplianceViolation({
            attemptedBy: attemptedBy,
            attemptedTo: attemptedTo,
            amount: amount,
            timestamp: block.timestamp,
            reason: reason,
            moduleViolated: moduleViolated
        });
        
        violations.push(violation);
        investorViolations[attemptedBy].push(violations.length - 1);
        
        emit ComplianceViolationRecorded(attemptedBy, reason, block.timestamp);
    }
    
    /**
     * @dev Set reporting period
     */
    function setReportingPeriod(uint256 startDate, uint256 endDate) external override {
        require(hasRole(COMPLIANCE_OFFICER_ROLE, msg.sender), "Not authorized");
        require(startDate < endDate, "Invalid period");
        
        currentPeriod.startDate = startDate;
        currentPeriod.endDate = endDate;
        
        emit ReportingPeriodSet(startDate, endDate);
    }
    
    /**
     * @dev Export report data in encoded format
     */
    function exportReportData(
        ReportType reportType, 
        uint256 fromTimestamp, 
        uint256 toTimestamp
    ) external view override returns (bytes memory) {
        require(hasRole(REPORTER_ROLE, msg.sender), "Not authorized");
        
        if (reportType == ReportType.INVESTOR_LIST) {
            return abi.encode(this.generateInvestorReport(MAX_REPORT_SIZE, 0));
        } else if (reportType == ReportType.COMPLIANCE_VIOLATIONS) {
            return abi.encode(this.generateComplianceViolationReport(fromTimestamp, toTimestamp));
        } else if (reportType == ReportType.JURISDICTIONAL_BREAKDOWN) {
            return abi.encode(this.generateJurisdictionalReport());
        }
        
        revert("Report type not supported for export");
    }
    
    /**
     * @dev Get investor statistics
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
        TransactionRecord[] memory records = investorTransactions[investor];
        totalTransactions = records.length;
        
        if (records.length > 0) {
            firstTransactionDate = records[0].timestamp;
            lastTransactionDate = records[records.length - 1].timestamp;
            
            for (uint256 i = 0; i < records.length; i++) {
                totalVolume += records[i].amount;
            }
        }
        
        complianceViolations = investorViolations[investor].length;
    }
    
    /**
     * @dev Get asset statistics
     */
    function getAssetStatistics(string memory assetId) 
        external 
        view 
        override 
        returns (
            uint256 totalHolders,
            uint256 totalSupply,
            uint256 totalTransactions,
            uint256 averageTransactionSize
        ) 
    {
        address[] memory investors = identityRegistry.getInvestorsList();
        uint256 totalVolume = 0;
        
        for (uint256 i = 0; i < investors.length; i++) {
            // For asset-specific balance, would need to cast to specific implementation
            // For now, using total balance as proxy
            uint256 balance = tokenContract.balanceOf(investors[i]);
            if (balance > 0) {
                totalHolders++;
                totalSupply += balance;
            }
        }
        
        totalTransactions = assetTransactionCounts[assetId];
        averageTransactionSize = totalTransactions > 0 ? totalVolume / totalTransactions : 0;
    }
    
    /**
     * @dev Get compliance statistics
     */
    function getComplianceStatistics(uint256 fromTimestamp, uint256 toTimestamp) 
        external 
        view 
        override 
        returns (
            uint256 totalTransactions,
            uint256 compliantTransactions,
            uint256 violationCount,
            uint256 uniqueViolators
        ) 
    {
        require(hasRole(COMPLIANCE_OFFICER_ROLE, msg.sender), "Not authorized");
        
        address[] memory investors = identityRegistry.getInvestorsList();
        address[] memory uniqueViolatorsArray = new address[](violations.length);
        uint256 uniqueViolatorCount = 0;
        
        for (uint256 i = 0; i < investors.length; i++) {
            TransactionRecord[] memory records = investorTransactions[investors[i]];
            
            for (uint256 j = 0; j < records.length; j++) {
                if (records[j].timestamp >= fromTimestamp && 
                    records[j].timestamp <= toTimestamp) {
                    totalTransactions++;
                    if (records[j].wasCompliant) {
                        compliantTransactions++;
                    }
                }
            }
        }
        
        for (uint256 i = 0; i < violations.length; i++) {
            if (violations[i].timestamp >= fromTimestamp && 
                violations[i].timestamp <= toTimestamp) {
                violationCount++;
                
                // Check if violator is already counted
                bool alreadyCounted = false;
                for (uint256 j = 0; j < uniqueViolatorCount; j++) {
                    if (uniqueViolatorsArray[j] == violations[i].attemptedBy) {
                        alreadyCounted = true;
                        break;
                    }
                }
                
                if (!alreadyCounted) {
                    uniqueViolatorsArray[uniqueViolatorCount] = violations[i].attemptedBy;
                    uniqueViolatorCount++;
                }
            }
        }
        uniqueViolators = uniqueViolatorCount;
    }
    
    /**
     * @dev Record a transaction (called by token contract)
     */
    function recordTransaction(
        address from,
        address to,
        uint256 amount,
        string memory assetId,
        bool wasCompliant
    ) external {
        require(msg.sender == address(tokenContract), "Only token contract");
        
        TransactionRecord memory record = TransactionRecord({
            from: from,
            to: to,
            amount: amount,
            timestamp: block.timestamp,
            assetId: assetId,
            wasCompliant: wasCompliant
        });
        
        investorTransactions[from].push(record);
        if (from != to) {
            investorTransactions[to].push(record);
        }
        
        assetTransactionCounts[assetId]++;
    }
    
    // Internal helper functions
    
    function _getLastActivity(address investor) private view returns (uint256) {
        TransactionRecord[] memory records = investorTransactions[investor];
        if (records.length == 0) return 0;
        return records[records.length - 1].timestamp;
    }
    
    function _checkAccreditation(address identity) private view returns (bool) {
        // Check for accreditation claim (claim topic 10 as example)
        // This would integrate with the Identity contract's claim system
        return true; // Placeholder
    }
    
    function _calculateMedian(uint256[] memory values, uint256 count) private pure returns (uint256) {
        if (count == 0) return 0;
        if (count == 1) return values[0];
        
        // For simplicity, return middle value (proper implementation would sort first)
        return values[count / 2];
    }
    
    function _getCountryName(uint16 countryCode) private pure returns (string memory) {
        // Simplified country code mapping
        if (countryCode == 1) return "United States";
        if (countryCode == 2) return "Canada";
        if (countryCode == 3) return "United Kingdom";
        if (countryCode == 4) return "Germany";
        if (countryCode == 5) return "France";
        if (countryCode == 6) return "Japan";
        if (countryCode == 7) return "Australia";
        if (countryCode == 8) return "Singapore";
        return "Other";
    }
    
    function _authorizeUpgrade(address newImplementation) internal override onlyRole(DEFAULT_ADMIN_ROLE) {}
}