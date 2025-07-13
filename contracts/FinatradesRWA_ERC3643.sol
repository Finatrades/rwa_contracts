// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "./token/Token.sol";
import "./libraries/AssetLib.sol";
import "./libraries/JurisdictionLib.sol";

/**
 * @title FinatradesRWA_ERC3643
 * @notice ERC-3643 compliant security token for real-world asset tokenization with asset management
 * @dev Extends the base ERC-3643 token with asset management features
 */
contract FinatradesRWA_ERC3643 is Token {
    using AssetLib for AssetLib.Asset;
    
    // Additional roles for asset management
    bytes32 public constant ASSET_MANAGER_ROLE = keccak256("ASSET_MANAGER_ROLE");
    bytes32 public constant CORPORATE_ACTIONS_ROLE = keccak256("CORPORATE_ACTIONS_ROLE");
    
    // Asset Management
    mapping(bytes32 => AssetLib.Asset) public assets;
    mapping(bytes32 => AssetLib.RentalInfo) public rentalInfo;
    bytes32[] public assetIds;
    uint256 public totalAssets;
    
    // Dividend Management
    mapping(uint256 => uint256) public dividendAmounts;
    mapping(uint256 => uint256) public dividendSnapshots;
    mapping(uint256 => mapping(address => bool)) public dividendClaimed;
    mapping(uint256 => bytes32) public dividendAsset;
    uint256 public dividendIndex;
    uint256 public totalDividendsDistributed;
    
    // Constants
    uint256 private constant MAX_ASSETS = 1000;
    uint256 private constant MAX_DIVIDEND_AMOUNT = 1000000 * 10**18;
    
    // Events
    event AssetAdded(bytes32 indexed assetId, AssetLib.AssetType assetType, uint256 valuationAmount);
    event AssetUpdated(bytes32 indexed assetId, string field, uint256 newValue);
    event AssetStatusChanged(bytes32 indexed assetId, AssetLib.AssetStatus oldStatus, AssetLib.AssetStatus newStatus);
    event RentalIncomeDeposited(bytes32 indexed assetId, uint256 amount, uint256 timestamp);
    event DividendDeposited(uint256 indexed dividendIndex, uint256 amount, uint256 totalSupply, bytes32 assetId);
    event DividendClaimed(address indexed investor, uint256 indexed dividendIndex, uint256 amount);
    
    function initialize(
        address _admin,
        string memory _name,
        string memory _symbol,
        uint8 _decimals,
        address _identityRegistryAddress,
        address _complianceAddress
    ) public override initializer {
        super.initialize(_admin, _name, _symbol, _decimals, _identityRegistryAddress, _complianceAddress);
        
        _grantRole(ASSET_MANAGER_ROLE, _admin);
        _grantRole(CORPORATE_ACTIONS_ROLE, _admin);
    }
    
    // Asset Management Functions
    function addAsset(
        bytes32 _assetId,
        AssetLib.AssetType _assetType,
        string calldata _assetAddress,
        string calldata _legalDescription,
        uint256 _valuationAmount,
        uint256 _yearBuilt,
        uint256 _totalArea,
        string calldata _ipfsHash
    ) external onlyRole(ASSET_MANAGER_ROLE) {
        require(totalAssets < MAX_ASSETS, "Max assets reached");
        require(assets[_assetId].assetStatus == AssetLib.AssetStatus.NONE, "Asset already exists");
        
        AssetLib.Asset storage newAsset = assets[_assetId];
        newAsset.assetType = _assetType;
        newAsset.assetAddress = _assetAddress;
        newAsset.legalDescription = _legalDescription;
        newAsset.valuationAmount = _valuationAmount;
        newAsset.valuationDate = block.timestamp;
        newAsset.yearBuilt = _yearBuilt;
        newAsset.totalArea = _totalArea;
        newAsset.assetStatus = AssetLib.AssetStatus.ACTIVE;
        newAsset.ipfsHash = _ipfsHash;
        
        assetIds.push(_assetId);
        totalAssets++;
        
        emit AssetAdded(_assetId, _assetType, _valuationAmount);
    }
    
    function updateAssetValuation(
        bytes32 _assetId,
        uint256 _newValuation
    ) external onlyRole(ASSET_MANAGER_ROLE) {
        require(assets[_assetId].assetStatus != AssetLib.AssetStatus.NONE, "Asset not found");
        
        uint256 oldValuation = assets[_assetId].valuationAmount;
        assets[_assetId].valuationAmount = _newValuation;
        assets[_assetId].valuationDate = block.timestamp;
        
        emit AssetUpdated(_assetId, "valuation", _newValuation);
    }
    
    function setAssetStatus(
        bytes32 _assetId,
        AssetLib.AssetStatus _newStatus
    ) external onlyRole(ASSET_MANAGER_ROLE) {
        require(assets[_assetId].assetStatus != AssetLib.AssetStatus.NONE, "Asset not found");
        
        AssetLib.AssetStatus oldStatus = assets[_assetId].assetStatus;
        assets[_assetId].assetStatus = _newStatus;
        
        emit AssetStatusChanged(_assetId, oldStatus, _newStatus);
    }
    
    function setRentalInfo(
        bytes32 _assetId,
        uint256 _monthlyRent,
        uint256 _occupancyRate,
        address _rentCollector
    ) external onlyRole(ASSET_MANAGER_ROLE) {
        require(assets[_assetId].assetStatus != AssetLib.AssetStatus.NONE, "Asset not found");
        
        AssetLib.RentalInfo storage rental = rentalInfo[_assetId];
        rental.monthlyRent = _monthlyRent;
        rental.occupancyRate = _occupancyRate;
        rental.rentCollector = _rentCollector;
    }
    
    // Dividend Distribution
    function depositRentalIncome(bytes32 _assetId) external payable {
        require(assets[_assetId].assetStatus == AssetLib.AssetStatus.ACTIVE, "Asset not active");
        require(msg.sender == rentalInfo[_assetId].rentCollector || hasRole(CORPORATE_ACTIONS_ROLE, msg.sender), "Not authorized");
        require(msg.value > 0 && msg.value <= MAX_DIVIDEND_AMOUNT, "Invalid amount");
        
        AssetLib.RentalInfo storage rental = rentalInfo[_assetId];
        rental.lastRentCollection = block.timestamp;
        rental.totalRentCollected += msg.value;
        
        // Create snapshot for dividend distribution
        uint256 snapshotId = _snapshot();
        
        dividendAmounts[dividendIndex] = msg.value;
        dividendSnapshots[dividendIndex] = snapshotId;
        dividendAsset[dividendIndex] = _assetId;
        
        totalDividendsDistributed += msg.value;
        
        emit RentalIncomeDeposited(_assetId, msg.value, block.timestamp);
        emit DividendDeposited(dividendIndex, msg.value, totalSupply(), _assetId);
        
        dividendIndex++;
    }
    
    function claimDividend(uint256 _dividendIndex) external nonReentrant {
        require(_dividendIndex < dividendIndex, "Invalid dividend index");
        require(!dividendClaimed[_dividendIndex][msg.sender], "Dividend already claimed");
        require(identityRegistry().isVerified(msg.sender), "Identity not verified");
        
        uint256 snapshotId = dividendSnapshots[_dividendIndex];
        uint256 balance = balanceOfAt(msg.sender, snapshotId);
        require(balance > 0, "No tokens at snapshot");
        
        uint256 totalSupplyAtSnapshot = totalSupplyAt(snapshotId);
        uint256 dividendAmount = (dividendAmounts[_dividendIndex] * balance) / totalSupplyAtSnapshot;
        
        dividendClaimed[_dividendIndex][msg.sender] = true;
        
        (bool success, ) = payable(msg.sender).call{value: dividendAmount}("");
        require(success, "Transfer failed");
        
        emit DividendClaimed(msg.sender, _dividendIndex, dividendAmount);
    }
    
    function claimMultipleDividends(uint256[] calldata _dividendIndexes) external nonReentrant {
        uint256 totalAmount = 0;
        
        for (uint256 i = 0; i < _dividendIndexes.length; i++) {
            uint256 index = _dividendIndexes[i];
            
            if (index >= dividendIndex || dividendClaimed[index][msg.sender]) {
                continue;
            }
            
            uint256 snapshotId = dividendSnapshots[index];
            uint256 balance = balanceOfAt(msg.sender, snapshotId);
            
            if (balance > 0) {
                uint256 totalSupplyAtSnapshot = totalSupplyAt(snapshotId);
                uint256 dividendAmount = (dividendAmounts[index] * balance) / totalSupplyAtSnapshot;
                
                dividendClaimed[index][msg.sender] = true;
                totalAmount += dividendAmount;
                
                emit DividendClaimed(msg.sender, index, dividendAmount);
            }
        }
        
        require(totalAmount > 0, "No dividends to claim");
        require(identityRegistry().isVerified(msg.sender), "Identity not verified");
        
        (bool success, ) = payable(msg.sender).call{value: totalAmount}("");
        require(success, "Transfer failed");
    }
    
    function getUnclaimedDividends(address _investor) external view returns (uint256) {
        uint256 unclaimed = 0;
        
        for (uint256 i = 0; i < dividendIndex; i++) {
            if (!dividendClaimed[i][_investor]) {
                uint256 snapshotId = dividendSnapshots[i];
                uint256 balance = balanceOfAt(_investor, snapshotId);
                
                if (balance > 0) {
                    uint256 totalSupplyAtSnapshot = totalSupplyAt(snapshotId);
                    unclaimed += (dividendAmounts[i] * balance) / totalSupplyAtSnapshot;
                }
            }
        }
        
        return unclaimed;
    }
    
    // Emergency withdrawal for unclaimed dividends after a certain period
    function withdrawUnclaimedDividends(uint256 _dividendIndex, uint256 _gracePeriod) external onlyRole(CORPORATE_ACTIONS_ROLE) {
        require(_dividendIndex < dividendIndex, "Invalid dividend index");
        require(block.timestamp > dividendSnapshots[_dividendIndex] + _gracePeriod, "Grace period not over");
        
        uint256 totalUnclaimed = 0;
        uint256 snapshotId = dividendSnapshots[_dividendIndex];
        uint256 totalSupplyAtSnapshot = totalSupplyAt(snapshotId);
        
        // Calculate total unclaimed amount
        address[] memory investors = investorsList();
        for (uint256 i = 0; i < investors.length; i++) {
            address investor = investors[i];
            if (!dividendClaimed[_dividendIndex][investor]) {
                uint256 balance = balanceOfAt(investor, snapshotId);
                if (balance > 0) {
                    totalUnclaimed += (dividendAmounts[_dividendIndex] * balance) / totalSupplyAtSnapshot;
                }
            }
        }
        
        require(totalUnclaimed > 0, "No unclaimed dividends");
        
        (bool success, ) = payable(msg.sender).call{value: totalUnclaimed}("");
        require(success, "Withdrawal failed");
    }
    
    // View functions
    function getAsset(bytes32 _assetId) external view returns (AssetLib.Asset memory) {
        return assets[_assetId];
    }
    
    function getRentalInfo(bytes32 _assetId) external view returns (AssetLib.RentalInfo memory) {
        return rentalInfo[_assetId];
    }
    
    function getAssetIds() external view returns (bytes32[] memory) {
        return assetIds;
    }
    
    function getDividendInfo(uint256 _dividendIndex) external view returns (
        uint256 amount,
        uint256 snapshotId,
        bytes32 assetId,
        bool claimed
    ) {
        require(_dividendIndex < dividendIndex, "Invalid dividend index");
        
        return (
            dividendAmounts[_dividendIndex],
            dividendSnapshots[_dividendIndex],
            dividendAsset[_dividendIndex],
            dividendClaimed[_dividendIndex][msg.sender]
        );
    }
    
    // Get investors list (needed for dividend calculations)
    function investorsList() internal view returns (address[] memory) {
        return identityRegistry().getInvestorsList();
    }
    
    // Receive function to accept ETH
    receive() external payable {
        require(msg.value > 0, "No ETH sent");
    }
}