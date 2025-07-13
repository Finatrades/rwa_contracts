// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "../libraries/UniversalAssetLib.sol";

/**
 * @title IAssetRegistry
 * @notice Interface for the universal asset registry
 */
interface IAssetRegistry {
    // Asset registration
    function registerAsset(
        bytes32 assetId,
        string memory name,
        UniversalAssetLib.AssetCategory category,
        uint256 valuationAmount,
        string memory metadataURI,
        address custodian
    ) external;

    // Attribute setters
    function setTextAttribute(bytes32 assetId, string memory key, string memory value) external;
    function setNumericAttribute(bytes32 assetId, string memory key, uint256 value) external;
    function setBooleanAttribute(bytes32 assetId, string memory key, bool value) external;
    function setAddressAttribute(bytes32 assetId, string memory key, address value) external;

    // Batch operations
    function setBatchTextAttributes(
        bytes32 assetId,
        string[] memory keys,
        string[] memory values
    ) external;

    // Revenue streams
    function createRevenueStream(
        bytes32 assetId,
        uint256 amount,
        uint256 frequency,
        address collector
    ) external;

    // Updates
    function updateAssetValuation(
        bytes32 assetId,
        uint256 newValuation,
        string memory source
    ) external;

    function updateAssetStatus(
        bytes32 assetId,
        UniversalAssetLib.AssetStatus newStatus
    ) external;

    // View functions
    function getAsset(bytes32 assetId) external view returns (UniversalAssetLib.Asset memory);
    function getTextAttribute(bytes32 assetId, string memory key) external view returns (string memory);
    function getNumericAttribute(bytes32 assetId, string memory key) external view returns (uint256);
    function getBooleanAttribute(bytes32 assetId, string memory key) external view returns (bool);
    function getAddressAttribute(bytes32 assetId, string memory key) external view returns (address);

    function getAssetsByCategory(
        UniversalAssetLib.AssetCategory category,
        uint256 offset,
        uint256 limit
    ) external view returns (bytes32[] memory);

    function getAssetsByCustodian(
        address custodian,
        uint256 offset,
        uint256 limit
    ) external view returns (bytes32[] memory);

    // State variables
    function totalAssets() external view returns (uint256);
    function totalValueLocked() external view returns (uint256);
    function authorizedTokenContracts(address) external view returns (bool);
}