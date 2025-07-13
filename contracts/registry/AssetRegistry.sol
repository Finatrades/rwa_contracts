// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "../libraries/UniversalAssetLib.sol";

/**
 * @title AssetRegistry
 * @notice Universal registry for ANY type of real-world asset
 * @dev Separate contract for unlimited asset storage with flexible attributes
 */
contract AssetRegistry is 
    AccessControlUpgradeable,
    PausableUpgradeable,
    ReentrancyGuardUpgradeable,
    UUPSUpgradeable 
{
    using UniversalAssetLib for UniversalAssetLib.Asset;

    // Roles
    bytes32 public constant ASSET_MANAGER_ROLE = keccak256("ASSET_MANAGER_ROLE");
    bytes32 public constant AUDITOR_ROLE = keccak256("AUDITOR_ROLE");
    bytes32 public constant UPGRADER_ROLE = keccak256("UPGRADER_ROLE");

    // Asset storage - no limits!
    mapping(bytes32 => UniversalAssetLib.Asset) public assets;
    mapping(bytes32 => UniversalAssetLib.AssetAttributes) private assetAttributes;
    mapping(bytes32 => UniversalAssetLib.RevenueStream) public revenueStreams;
    
    // Asset tracking
    bytes32[] public assetIds;
    mapping(address => bytes32[]) public assetsByCustodian;
    mapping(UniversalAssetLib.AssetCategory => bytes32[]) public assetsByCategory;
    mapping(address => bool) public authorizedTokenContracts;
    
    // Metadata
    uint256 public totalAssets;
    uint256 public totalValueLocked;
    
    // Events
    event AssetRegistered(
        bytes32 indexed assetId,
        string name,
        UniversalAssetLib.AssetCategory indexed category,
        uint256 valuationAmount,
        address indexed registeredBy
    );
    
    event AssetAttributeUpdated(
        bytes32 indexed assetId,
        string attributeKey,
        string attributeType,
        address updatedBy
    );
    
    event RevenueStreamCreated(
        bytes32 indexed assetId,
        uint256 amount,
        uint256 frequency,
        address collector
    );
    
    event TokenContractAuthorized(address indexed tokenContract, bool authorized);

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(address _admin) public initializer {
        __AccessControl_init();
        __Pausable_init();
        __ReentrancyGuard_init();
        __UUPSUpgradeable_init();
        
        _grantRole(DEFAULT_ADMIN_ROLE, _admin);
        _grantRole(ASSET_MANAGER_ROLE, _admin);
        _grantRole(UPGRADER_ROLE, _admin);
    }

    // ========== Asset Registration ==========

    /**
     * @notice Register a new asset of any type
     * @param assetId Unique identifier for the asset
     * @param name Human-readable name
     * @param category Asset category
     * @param valuationAmount Initial valuation
     * @param metadataURI IPFS or external metadata link
     * @param custodian Physical custodian address (if applicable)
     */
    function registerAsset(
        bytes32 assetId,
        string memory name,
        UniversalAssetLib.AssetCategory category,
        uint256 valuationAmount,
        string memory metadataURI,
        address custodian
    ) external onlyRole(ASSET_MANAGER_ROLE) whenNotPaused {
        require(assets[assetId].createdAt == 0, "Asset already exists");
        require(assetId != bytes32(0), "Invalid asset ID");
        
        UniversalAssetLib.Asset storage asset = assets[assetId];
        asset.name = name;
        asset.category = category;
        asset.status = UniversalAssetLib.AssetStatus.PENDING_VERIFICATION;
        asset.valuationAmount = valuationAmount;
        asset.valuationDate = block.timestamp;
        asset.metadataURI = metadataURI;
        asset.custodian = custodian;
        asset.createdAt = block.timestamp;
        asset.lastUpdated = block.timestamp;
        
        assetIds.push(assetId);
        assetsByCategory[category].push(assetId);
        if (custodian != address(0)) {
            assetsByCustodian[custodian].push(assetId);
        }
        
        totalAssets++;
        totalValueLocked += valuationAmount;
        
        emit AssetRegistered(assetId, name, category, valuationAmount, msg.sender);
    }

    // ========== Flexible Attribute Management ==========

    function setTextAttribute(
        bytes32 assetId,
        string memory key,
        string memory value
    ) external onlyRole(ASSET_MANAGER_ROLE) {
        require(assets[assetId].createdAt != 0, "Asset does not exist");
        assetAttributes[assetId].textAttributes[key] = value;
        assets[assetId].lastUpdated = block.timestamp;
        emit AssetAttributeUpdated(assetId, key, "text", msg.sender);
    }

    function setNumericAttribute(
        bytes32 assetId,
        string memory key,
        uint256 value
    ) external onlyRole(ASSET_MANAGER_ROLE) {
        require(assets[assetId].createdAt != 0, "Asset does not exist");
        assetAttributes[assetId].numericAttributes[key] = value;
        assets[assetId].lastUpdated = block.timestamp;
        emit AssetAttributeUpdated(assetId, key, "numeric", msg.sender);
    }

    function setBooleanAttribute(
        bytes32 assetId,
        string memory key,
        bool value
    ) external onlyRole(ASSET_MANAGER_ROLE) {
        require(assets[assetId].createdAt != 0, "Asset does not exist");
        assetAttributes[assetId].booleanAttributes[key] = value;
        assets[assetId].lastUpdated = block.timestamp;
        emit AssetAttributeUpdated(assetId, key, "boolean", msg.sender);
    }

    function setAddressAttribute(
        bytes32 assetId,
        string memory key,
        address value
    ) external onlyRole(ASSET_MANAGER_ROLE) {
        require(assets[assetId].createdAt != 0, "Asset does not exist");
        assetAttributes[assetId].addressAttributes[key] = value;
        assets[assetId].lastUpdated = block.timestamp;
        emit AssetAttributeUpdated(assetId, key, "address", msg.sender);
    }

    // Batch attribute setting
    function setBatchTextAttributes(
        bytes32 assetId,
        string[] memory keys,
        string[] memory values
    ) external onlyRole(ASSET_MANAGER_ROLE) {
        require(assets[assetId].createdAt != 0, "Asset does not exist");
        require(keys.length == values.length, "Arrays length mismatch");
        
        for (uint i = 0; i < keys.length; i++) {
            assetAttributes[assetId].textAttributes[keys[i]] = values[i];
        }
        assets[assetId].lastUpdated = block.timestamp;
    }

    // ========== Revenue Stream Management ==========

    function createRevenueStream(
        bytes32 assetId,
        uint256 amount,
        uint256 frequency,
        address collector
    ) external onlyRole(ASSET_MANAGER_ROLE) {
        require(assets[assetId].createdAt != 0, "Asset does not exist");
        require(collector != address(0), "Invalid collector");
        
        UniversalAssetLib.RevenueStream storage revenue = revenueStreams[assetId];
        revenue.amount = amount;
        revenue.frequency = frequency;
        revenue.revenueCollector = collector;
        revenue.isActive = true;
        revenue.lastDistribution = block.timestamp;
        
        emit RevenueStreamCreated(assetId, amount, frequency, collector);
    }

    // ========== Asset Updates ==========

    function updateAssetValuation(
        bytes32 assetId,
        uint256 newValuation,
        string memory source
    ) external onlyRole(ASSET_MANAGER_ROLE) {
        require(assets[assetId].createdAt != 0, "Asset does not exist");
        
        uint256 oldValuation = assets[assetId].valuationAmount;
        totalValueLocked = totalValueLocked - oldValuation + newValuation;
        
        assets[assetId].updateValuation(newValuation, source);
        
        emit UniversalAssetLib.AssetValuationUpdated(assetId, oldValuation, newValuation, source);
    }

    function updateAssetStatus(
        bytes32 assetId,
        UniversalAssetLib.AssetStatus newStatus
    ) external onlyRole(ASSET_MANAGER_ROLE) {
        require(assets[assetId].createdAt != 0, "Asset does not exist");
        
        UniversalAssetLib.AssetStatus oldStatus = assets[assetId].updateStatus(newStatus);
        
        emit UniversalAssetLib.AssetStatusChanged(assetId, oldStatus, newStatus);
    }

    // ========== View Functions ==========

    function getAsset(bytes32 assetId) external view returns (UniversalAssetLib.Asset memory) {
        require(assets[assetId].createdAt != 0, "Asset does not exist");
        return assets[assetId];
    }

    function getTextAttribute(bytes32 assetId, string memory key) external view returns (string memory) {
        return assetAttributes[assetId].textAttributes[key];
    }

    function getNumericAttribute(bytes32 assetId, string memory key) external view returns (uint256) {
        return assetAttributes[assetId].numericAttributes[key];
    }

    function getBooleanAttribute(bytes32 assetId, string memory key) external view returns (bool) {
        return assetAttributes[assetId].booleanAttributes[key];
    }

    function getAddressAttribute(bytes32 assetId, string memory key) external view returns (address) {
        return assetAttributes[assetId].addressAttributes[key];
    }

    function getAssetsByCategory(
        UniversalAssetLib.AssetCategory category,
        uint256 offset,
        uint256 limit
    ) external view returns (bytes32[] memory) {
        bytes32[] storage categoryAssets = assetsByCategory[category];
        uint256 total = categoryAssets.length;
        
        if (offset >= total) {
            return new bytes32[](0);
        }
        
        uint256 end = offset + limit;
        if (end > total) {
            end = total;
        }
        
        bytes32[] memory result = new bytes32[](end - offset);
        for (uint256 i = offset; i < end; i++) {
            result[i - offset] = categoryAssets[i];
        }
        
        return result;
    }

    function getAssetsByCustodian(
        address custodian,
        uint256 offset,
        uint256 limit
    ) external view returns (bytes32[] memory) {
        bytes32[] storage custodianAssets = assetsByCustodian[custodian];
        uint256 total = custodianAssets.length;
        
        if (offset >= total) {
            return new bytes32[](0);
        }
        
        uint256 end = offset + limit;
        if (end > total) {
            end = total;
        }
        
        bytes32[] memory result = new bytes32[](end - offset);
        for (uint256 i = offset; i < end; i++) {
            result[i - offset] = custodianAssets[i];
        }
        
        return result;
    }

    // ========== Token Contract Authorization ==========

    function authorizeTokenContract(address tokenContract, bool authorized) 
        external 
        onlyRole(DEFAULT_ADMIN_ROLE) 
    {
        authorizedTokenContracts[tokenContract] = authorized;
        emit TokenContractAuthorized(tokenContract, authorized);
    }

    modifier onlyAuthorizedToken() {
        require(authorizedTokenContracts[msg.sender], "Caller not authorized token");
        _;
    }

    // ========== Emergency Functions ==========

    function pause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
    }

    // ========== UUPS Upgrade ==========

    function _authorizeUpgrade(address newImplementation)
        internal
        override
        onlyRole(UPGRADER_ROLE)
    {}
}