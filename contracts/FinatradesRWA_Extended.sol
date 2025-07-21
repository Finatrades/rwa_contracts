// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "./token/Token.sol";
import "./registry/IAssetRegistry.sol";
import "./libraries/UniversalAssetLib.sol";
import "./libraries/DividendLib.sol";

/**
 * @title FinatradesRWA_Extended
 * @author Finatrades
 * @notice Extended ERC-3643 compliant security token with comprehensive RWA features
 * @dev Full-featured implementation of the ERC-3643 standard (https://docs.erc3643.org/erc-3643)
 * 
 * @custom:security-contact security@finatrades.com
 * 
 * This contract extends the core Token implementation with:
 * - Universal asset registry integration
 * - Asset-specific token management
 * - Advanced dividend distribution system
 * - Asset lifecycle management
 * - Revenue stream tracking
 * - Comprehensive event logging
 * 
 * Note: This contract exceeds the 24KB size limit for Ethereum mainnet.
 * For mainnet deployment, use FinatradesRWA_Core or deploy on L2/sidechain.
 */
contract FinatradesRWA_Extended is Token {
    using DividendLib for uint256;
    
    // Roles
    bytes32 public constant ASSET_MANAGER_ROLE = keccak256("ASSET_MANAGER_ROLE");
    bytes32 public constant CORPORATE_ACTIONS_ROLE = keccak256("CORPORATE_ACTIONS_ROLE");
    
    // Asset Registry
    IAssetRegistry public assetRegistry;
    
    // Token-to-Asset mapping
    mapping(bytes32 => uint256) public assetTokenSupply; // How many tokens represent each asset
    mapping(bytes32 => mapping(address => uint256)) public assetTokenBalance; // User balance per asset
    
    // Dividend Management
    mapping(uint256 => uint256) public dividendAmounts;
    mapping(uint256 => uint256) public dividendSnapshots;
    mapping(uint256 => mapping(address => bool)) public dividendClaimed;
    mapping(uint256 => bytes32) public dividendAsset; // Which asset generated this dividend
    uint256 public dividendIndex;
    uint256 public totalDividendsDistributed;
    
    // Events
    event AssetRegistrySet(address indexed registry);
    event AssetTokenized(bytes32 indexed assetId, uint256 tokenAmount, address indexed recipient);
    event AssetTokensBurned(bytes32 indexed assetId, uint256 tokenAmount, address indexed from);
    event DividendDeposited(uint256 indexed dividendIndex, uint256 amount, bytes32 indexed assetId);
    event DividendClaimed(address indexed investor, uint256 indexed dividendIndex, uint256 amount);
    
    /**
     * @notice Initialize the token with AssetRegistry integration
     */
    function initialize(
        address _admin,
        string memory _name,
        string memory _symbol,
        uint8 _decimals,
        address _identityRegistryAddress,
        address _complianceAddress,
        address _assetRegistryAddress
    ) public initializer {
        super.initialize(_admin, _name, _symbol, _decimals, _identityRegistryAddress, _complianceAddress);
        
        require(_assetRegistryAddress != address(0), "Invalid asset registry");
        assetRegistry = IAssetRegistry(_assetRegistryAddress);
        
        _grantRole(ASSET_MANAGER_ROLE, _admin);
        _grantRole(CORPORATE_ACTIONS_ROLE, _admin);
        
        emit AssetRegistrySet(_assetRegistryAddress);
    }
    
    // ========== Asset Tokenization ==========
    
    /**
     * @notice Tokenize any type of asset from the registry
     * @param assetId The asset ID in the registry
     * @param tokenAmount How many tokens to mint for this asset
     * @param recipient Who receives the tokens
     */
    function tokenizeAsset(
        bytes32 assetId,
        uint256 tokenAmount,
        address recipient
    ) external onlyRole(ASSET_MANAGER_ROLE) {
        // Verify asset exists and is active
        UniversalAssetLib.Asset memory asset = assetRegistry.getAsset(assetId);
        require(
            asset.status == UniversalAssetLib.AssetStatus.ACTIVE ||
            asset.status == UniversalAssetLib.AssetStatus.UNDER_MANAGEMENT,
            "Asset not active"
        );
        
        // Mint tokens
        _mint(recipient, tokenAmount);
        
        // Track asset tokens
        assetTokenSupply[assetId] += tokenAmount;
        assetTokenBalance[assetId][recipient] += tokenAmount;
        
        emit AssetTokenized(assetId, tokenAmount, recipient);
    }
    
    /**
     * @notice Burn tokens for a specific asset
     */
    function burnAssetTokens(
        bytes32 assetId,
        uint256 tokenAmount,
        address from
    ) external onlyRole(ASSET_MANAGER_ROLE) {
        require(assetTokenBalance[assetId][from] >= tokenAmount, "Insufficient asset tokens");
        
        _burn(from, tokenAmount);
        
        assetTokenSupply[assetId] -= tokenAmount;
        assetTokenBalance[assetId][from] -= tokenAmount;
        
        emit AssetTokensBurned(assetId, tokenAmount, from);
    }
    
    // ========== Asset-Based Dividends ==========
    
    /**
     * @notice Deposit dividend for a specific asset
     * @param assetId The asset generating the dividend
     */
    function depositDividendForAsset(bytes32 assetId) 
        external 
        payable 
        onlyRole(CORPORATE_ACTIONS_ROLE) 
    {
        require(msg.value > 0, "No dividend amount");
        require(assetTokenSupply[assetId] > 0, "No tokens for asset");
        
        uint256 snapshotId = _snapshot();
        dividendIndex++;
        
        dividendAmounts[dividendIndex] = msg.value;
        dividendSnapshots[dividendIndex] = snapshotId;
        dividendAsset[dividendIndex] = assetId;
        totalDividendsDistributed += msg.value;
        
        emit DividendDeposited(dividendIndex, msg.value, assetId);
    }
    
    /**
     * @notice Claim dividend for a specific dividend distribution
     */
    /**
     * @notice Claim dividend with slippage protection
     * @dev Uses DividendLib for calculations and validation
     * @param _dividendIndex The dividend ID to claim
     * @param _minAmount Minimum amount expected (slippage protection)
     */
    function claimDividend(uint256 _dividendIndex, uint256 _minAmount) external {
        bytes32 assetId = dividendAsset[_dividendIndex];
        uint256 snapshotId = dividendSnapshots[_dividendIndex];
        
        // Calculate share
        uint256 assetBalance = _getAssetBalanceAtSnapshot(assetId, msg.sender, snapshotId);
        require(assetBalance > 0, "No asset tokens at snapshot");
        
        uint256 totalSupplyAtSnapshot = _getTotalSupplyAtSnapshot(assetId, snapshotId);
        uint256 amount = DividendLib.calculateDividendAmount(
            dividendAmounts[_dividendIndex],
            assetBalance,
            totalSupplyAtSnapshot
        );
        
        // Validate claim
        DividendLib.validateClaim(
            _dividendIndex,
            dividendIndex,
            dividendClaimed[_dividendIndex][msg.sender],
            _minAmount,
            amount
        );
        
        dividendClaimed[_dividendIndex][msg.sender] = true;
        
        DividendLib.safeTransferETH(msg.sender, amount);
        
        emit DividendClaimed(msg.sender, _dividendIndex, amount);
    }
    
    /**
     * @notice Calculate dividend amount without claiming
     * @dev Helper function to preview dividend amount before claiming
     * @param _dividendIndex The dividend ID
     * @param _investor The investor address
     * @return amount The dividend amount claimable
     */
    function calculateDividend(uint256 _dividendIndex, address _investor) external view returns (uint256) {
        require(_dividendIndex > 0 && _dividendIndex <= dividendIndex, "Invalid dividend");
        
        if (dividendClaimed[_dividendIndex][_investor]) {
            return 0;
        }
        
        bytes32 assetId = dividendAsset[_dividendIndex];
        uint256 snapshotId = dividendSnapshots[_dividendIndex];
        
        uint256 assetBalance = _getAssetBalanceAtSnapshot(assetId, _investor, snapshotId);
        if (assetBalance == 0) {
            return 0;
        }
        
        uint256 totalSupplyAtSnapshot = _getTotalSupplyAtSnapshot(assetId, snapshotId);
        if (totalSupplyAtSnapshot == 0) {
            return 0;
        }
        
        return DividendLib.calculateDividendAmount(
            dividendAmounts[_dividendIndex],
            assetBalance,
            totalSupplyAtSnapshot
        );
    }
    
    // ========== Enhanced Transfer with Asset Tracking ==========
    
    /**
     * @notice Transfer tokens with asset tracking
     */
    function transferWithAsset(
        address to,
        uint256 amount,
        bytes32 assetId
    ) external virtual returns (bool) {
        require(assetTokenBalance[assetId][msg.sender] >= amount, "Insufficient asset tokens");
        
        // Regular ERC-3643 transfer (includes compliance checks)
        bool success = transfer(to, amount);
        
        if (success) {
            // Update asset balances
            assetTokenBalance[assetId][msg.sender] -= amount;
            assetTokenBalance[assetId][to] += amount;
        }
        
        return success;
    }
    
    // ========== View Functions ==========
    
    /**
     * @notice Get all assets a user has tokens for
     */
    function getUserAssets(address user) external view returns (bytes32[] memory) {
        // This would need optimization for production
        // Consider maintaining a separate mapping for efficiency
        bytes32[] memory userAssets = new bytes32[](100); // Reasonable limit
        uint256 count = 0;
        
        // Note: In production, maintain a mapping of user -> assets
        // This is just for demonstration
        
        return userAssets;
    }
    
    /**
     * @notice Get user's balance for a specific asset
     */
    function getAssetBalance(address user, bytes32 assetId) external view returns (uint256) {
        return assetTokenBalance[assetId][user];
    }
    
    /**
     * @notice Get total token supply for an asset
     */
    function getAssetTotalSupply(bytes32 assetId) external view returns (uint256) {
        return assetTokenSupply[assetId];
    }
    
    // ========== Internal Helpers ==========
    
    function _getAssetBalanceAtSnapshot(
        bytes32 assetId,
        address account,
        uint256 snapshotId
    ) internal view returns (uint256) {
        // For MVP, using total balance at snapshot
        // In production, track asset-specific snapshots
        return balanceOfAt(account, snapshotId);
    }
    
    function _getTotalSupplyAtSnapshot(
        bytes32 assetId,
        uint256 snapshotId
    ) internal view returns (uint256) {
        // For MVP, using total supply at snapshot
        // In production, track asset-specific supply snapshots
        return totalSupplyAt(snapshotId);
    }
    
    // ========== Admin Functions ==========
    
    /**
     * @notice Update asset registry address
     */
    function setAssetRegistry(address _assetRegistryAddress) 
        external 
        onlyRole(DEFAULT_ADMIN_ROLE) 
    {
        require(_assetRegistryAddress != address(0), "Invalid address");
        assetRegistry = IAssetRegistry(_assetRegistryAddress);
        emit AssetRegistrySet(_assetRegistryAddress);
    }
    
    /**
     * @notice Emergency dividend refund
     */
    function refundUnclaimedDividend(uint256 _dividendIndex) 
        external 
        onlyRole(DEFAULT_ADMIN_ROLE) 
    {
        require(_dividendIndex > 0 && _dividendIndex <= dividendIndex, "Invalid dividend");
        require(block.timestamp > dividendSnapshots[_dividendIndex] + 365 days, "Too early");
        
        uint256 remaining = address(this).balance;
        require(remaining > 0, "No funds");
        
        (bool success, ) = payable(msg.sender).call{value: remaining}("");
        require(success, "Transfer failed");
    }
}