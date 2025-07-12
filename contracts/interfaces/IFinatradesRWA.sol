// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

interface IFinatradesRWA {
    // Investor types
    enum InvestorType {
        NONE,
        RETAIL,
        QUALIFIED,
        INSTITUTIONAL,
        PROFESSIONAL
    }

    // Events
    event InvestorRegistered(address indexed investor, uint256 investorType, string jurisdiction);
    event InvestorKYCUpdated(address indexed investor, uint256 newExpiry);
    event InvestorDeactivated(address indexed investor);
    event DividendDeposited(uint256 amount, uint256 totalSupply, uint256 dividendIndex);
    event DividendClaimed(address indexed investor, uint256 amount);
    event ComplianceConfigurationUpdated(string parameter, uint256 value);
    event JurisdictionUpdated(string indexed jurisdiction, bool allowed);
    event DocumentUpdated(bytes32 indexed documentHash, string uri);
    event AssetMetadataUpdated(string assetType, uint256 valuationAmount);
    event TokensPaused(address indexed by);
    event TokensUnpaused(address indexed by);
    event EmergencyWithdrawal(address indexed to, uint256 amount);
    event PartitionCreated(bytes32 indexed partition);
    event TransferByPartition(
        bytes32 indexed fromPartition,
        address operator,
        address indexed from,
        address indexed to,
        uint256 value,
        bytes data,
        bytes operatorData
    );

    // Core functions
    function registerInvestor(
        address investor,
        InvestorType investorType,
        string calldata jurisdiction,
        uint256 kycExpiry,
        string calldata encryptedDataURI
    ) external;

    function updateInvestorKYC(address investor, uint256 newKycExpiry) external;
    function deactivateInvestor(address investor) external;
    function updateJurisdiction(string calldata jurisdiction, bool allowed) external;
    function issue(address to, uint256 value, bytes calldata data) external;
    function redeem(uint256 value, bytes calldata data) external;
    function depositDividend() external payable;
    function claimDividend(uint256 snapshotId) external;
    function pause() external;
    function unpause() external;
    function setMaxHolders(uint256 newMaxHolders) external;
    function setInvestmentLimits(uint256 minAmount, uint256 maxAmount) external;
    
    // View functions
    function getInvestorInfo(address investor) external view returns (
        InvestorType investorType,
        string memory jurisdiction,
        uint256 kycExpiry,
        bool isActive,
        uint256 lockupExpiry
    );
    function canTransfer(address to, uint256 value) external view returns (
        bool success,
        bytes1 statusCode,
        bytes32 reasonHash
    );
    function getUnclaimedDividends(address investor) external view returns (uint256);
    function isJurisdictionAllowed(string calldata jurisdiction) external view returns (bool);
}