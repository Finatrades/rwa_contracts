// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title ComplianceLib
 * @notice Library for compliance and investor management
 */
library ComplianceLib {
    enum InvestorType { NONE, RETAIL, QUALIFIED, INSTITUTIONAL, PROFESSIONAL }
    
    struct Investor {
        InvestorType investorType;
        string jurisdictionCode;
        uint256 kycExpiry;
        uint256 amlCheckDate;
        bool isActive;
        uint256 totalInvested;
        uint256 totalDividendsClaimed;
    }
    
    event InvestorRegistered(address indexed investor, InvestorType investorType, string jurisdiction);
    event InvestorKYCUpdated(address indexed investor, uint256 oldExpiry, uint256 newExpiry);
    event InvestorDeactivated(address indexed investor, uint256 timestamp);
    
    function validateInvestor(
        Investor memory investor,
        mapping(string => bool) storage allowedJurisdictions
    ) internal view {
        require(investor.isActive, "Investor not active");
        require(investor.kycExpiry > block.timestamp, "KYC expired");
        require(allowedJurisdictions[investor.jurisdictionCode], "Jurisdiction not allowed");
    }
    
    function canTransfer(
        Investor memory from,
        Investor memory to,
        mapping(string => bool) storage allowedJurisdictions
    ) internal view returns (bool, string memory) {
        if (!from.isActive) return (false, "Sender not active");
        if (!to.isActive) return (false, "Recipient not active");
        if (from.kycExpiry <= block.timestamp) return (false, "Sender KYC expired");
        if (to.kycExpiry <= block.timestamp) return (false, "Recipient KYC expired");
        if (!allowedJurisdictions[to.jurisdictionCode]) return (false, "Recipient jurisdiction not allowed");
        
        return (true, "");
    }
    
    function registerInvestor(
        Investor storage investor,
        InvestorType investorType,
        string memory jurisdictionCode,
        uint256 kycExpiry
    ) internal {
        require(investorType != InvestorType.NONE, "Invalid investor type");
        require(bytes(jurisdictionCode).length == 2, "Invalid jurisdiction code");
        require(kycExpiry > block.timestamp, "KYC already expired");
        
        investor.investorType = investorType;
        investor.jurisdictionCode = jurisdictionCode;
        investor.kycExpiry = kycExpiry;
        investor.amlCheckDate = block.timestamp;
        investor.isActive = true;
    }
}