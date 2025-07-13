// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title AssetLib
 * @notice Library for asset management functions
 */
library AssetLib {
    enum AssetType { NONE, RESIDENTIAL, COMMERCIAL, INDUSTRIAL, AGRICULTURAL, MIXED_USE }
    enum AssetStatus { NONE, ACTIVE, UNDER_MANAGEMENT, FOR_SALE, SOLD, DEFAULTED }
    
    struct Asset {
        AssetType assetType;
        string assetAddress;
        string legalDescription;
        uint256 valuationAmount;
        uint256 valuationDate;
        uint256 yearBuilt;
        uint256 totalArea;
        AssetStatus assetStatus;
        string ipfsHash;
    }
    
    struct RentalInfo {
        uint256 monthlyRent;
        uint256 lastRentCollection;
        uint256 totalRentCollected;
        uint256 occupancyRate;
        address rentCollector;
    }
    
    event AssetAdded(bytes32 indexed assetId, AssetType assetType, uint256 valuationAmount);
    event AssetValuationUpdated(bytes32 indexed assetId, uint256 oldValuation, uint256 newValuation);
    event AssetStatusChanged(bytes32 indexed assetId, AssetStatus oldStatus, AssetStatus newStatus);
    event RentalIncomeDeposited(bytes32 indexed assetId, uint256 amount, uint256 timestamp);
    
    function validateAsset(Asset memory asset) internal pure {
        require(asset.assetType != AssetType.NONE, "Invalid asset type");
        require(bytes(asset.assetAddress).length > 0, "Asset address required");
        require(asset.valuationAmount > 0, "Invalid valuation amount");
        require(asset.yearBuilt > 1800 && asset.yearBuilt <= 2100, "Invalid year built");
        require(asset.totalArea > 0, "Invalid total area");
    }
    
    function updateValuation(
        Asset storage asset,
        uint256 newValuation
    ) internal returns (uint256 oldValuation) {
        require(newValuation > 0, "Invalid valuation amount");
        oldValuation = asset.valuationAmount;
        asset.valuationAmount = newValuation;
        asset.valuationDate = block.timestamp;
    }
    
    function updateStatus(
        Asset storage asset,
        AssetStatus newStatus
    ) internal returns (AssetStatus oldStatus) {
        require(newStatus != AssetStatus.NONE, "Invalid status");
        oldStatus = asset.assetStatus;
        asset.assetStatus = newStatus;
    }
    
    function recordRent(
        RentalInfo storage rental,
        uint256 amount
    ) internal {
        require(amount > 0, "Invalid rent amount");
        rental.totalRentCollected += amount;
        rental.lastRentCollection = block.timestamp;
    }
}