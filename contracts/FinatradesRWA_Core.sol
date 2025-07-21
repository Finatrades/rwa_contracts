// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "./token/Token.sol";
import "./registry/IAssetRegistry.sol";
import "./libraries/UniversalAssetLib.sol";
import "./libraries/DividendLib.sol";

/**
 * @title FinatradesRWA_Core
 * @author Finatrades
 * @notice Core ERC-3643 compliant security token for real-world asset tokenization
 * @dev Optimized implementation focusing on essential RWA functionality
 * 
 * @custom:security-contact security@finatrades.com
 * 
 * This contract provides core RWA tokenization features:
 * - ERC-3643 compliant security token
 * - Asset tokenization and management
 * - Dividend distribution with slippage protection
 * - Integration with identity and compliance systems
 * 
 * Additional features can be added through:
 * - Regulatory reporting (separate contract)
 * - Extended asset management (modules)
 * - Advanced dividend features (extensions)
 */
contract FinatradesRWA_Core is Token {
    using DividendLib for uint256;
    
    // Custom errors
    error InvalidAsset();
    error InvalidDividend();
    error AlreadyClaimed();
    error NoTokensAtSnapshot();
    error InsufficientAssetTokens();
    
    // Roles
    bytes32 public constant ASSET_MANAGER_ROLE = keccak256("ASSET_MANAGER_ROLE");
    bytes32 public constant CORPORATE_ACTIONS_ROLE = keccak256("CORPORATE_ACTIONS_ROLE");
    
    // Asset Registry
    IAssetRegistry public assetRegistry;
    
    // Token-to-Asset mapping
    mapping(bytes32 => uint256) public assetTokenSupply;
    mapping(bytes32 => mapping(address => uint256)) public assetTokenBalance;
    
    // Dividend Management
    mapping(uint256 => uint256) public dividendAmounts;
    mapping(uint256 => uint256) public dividendSnapshots;
    mapping(uint256 => mapping(address => bool)) public dividendClaimed;
    mapping(uint256 => bytes32) public dividendAsset;
    uint256 public dividendIndex;
    
    // Events
    event AssetRegistrySet(address indexed registry);
    event AssetTokenized(bytes32 indexed assetId, uint256 tokenAmount, address indexed recipient);
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
        
        if (_assetRegistryAddress == address(0)) revert InvalidAsset();
        assetRegistry = IAssetRegistry(_assetRegistryAddress);
        
        _grantRole(ASSET_MANAGER_ROLE, _admin);
        _grantRole(CORPORATE_ACTIONS_ROLE, _admin);
        
        emit AssetRegistrySet(_assetRegistryAddress);
    }
    
    /**
     * @notice Tokenize an asset from the registry
     */
    function tokenizeAsset(
        bytes32 assetId,
        uint256 tokenAmount,
        address recipient
    ) external onlyRole(ASSET_MANAGER_ROLE) {
        UniversalAssetLib.Asset memory asset = assetRegistry.getAsset(assetId);
        if (asset.status != UniversalAssetLib.AssetStatus.ACTIVE &&
            asset.status != UniversalAssetLib.AssetStatus.UNDER_MANAGEMENT) {
            revert InvalidAsset();
        }
        
        _mint(recipient, tokenAmount);
        
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
        if (assetTokenBalance[assetId][from] < tokenAmount) revert InsufficientAssetTokens();
        
        _burn(from, tokenAmount);
        
        assetTokenSupply[assetId] -= tokenAmount;
        assetTokenBalance[assetId][from] -= tokenAmount;
    }
    
    /**
     * @notice Deposit dividend for asset holders
     */
    function depositDividend(bytes32 assetId) 
        external 
        payable 
        onlyRole(CORPORATE_ACTIONS_ROLE) 
    {
        if (msg.value == 0) revert InvalidDividend();
        
        uint256 snapshotId = _snapshot();
        dividendIndex++;
        
        dividendAmounts[dividendIndex] = msg.value;
        dividendSnapshots[dividendIndex] = snapshotId;
        dividendAsset[dividendIndex] = assetId;
        
        emit DividendDeposited(dividendIndex, msg.value, assetId);
    }
    
    /**
     * @notice Claim dividend with slippage protection
     */
    function claimDividend(uint256 _dividendIndex, uint256 _minAmount) external {
        bytes32 assetId = dividendAsset[_dividendIndex];
        uint256 snapshotId = dividendSnapshots[_dividendIndex];
        
        uint256 assetBalance = balanceOfAt(msg.sender, snapshotId);
        if (assetBalance == 0) revert NoTokensAtSnapshot();
        
        uint256 totalSupplyAtSnapshot = totalSupplyAt(snapshotId);
        uint256 amount = DividendLib.calculateDividendAmount(
            dividendAmounts[_dividendIndex],
            assetBalance,
            totalSupplyAtSnapshot
        );
        
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
     * @notice Transfer tokens with asset tracking
     */
    function transferWithAsset(
        address to,
        uint256 amount,
        bytes32 assetId
    ) external virtual returns (bool) {
        if (assetTokenBalance[assetId][msg.sender] < amount) revert InsufficientAssetTokens();
        
        bool success = transfer(to, amount);
        
        if (success) {
            assetTokenBalance[assetId][msg.sender] -= amount;
            assetTokenBalance[assetId][to] += amount;
        }
        
        return success;
    }
    
    /**
     * @notice Get asset balance
     */
    function getAssetBalance(address user, bytes32 assetId) external view returns (uint256) {
        return assetTokenBalance[assetId][user];
    }
    
    /**
     * @notice Get total supply for an asset
     */
    function getAssetTotalSupply(bytes32 assetId) external view returns (uint256) {
        return assetTokenSupply[assetId];
    }
}