// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts-upgradeable/token/ERC1155/IERC1155Upgradeable.sol";
import "../identity/IIdentityRegistry.sol";
import "../compliance/ICompliance.sol";

/**
 * @title IMultiToken
 * @notice Interface for ERC1155 compliant multi-token for RWA with multiple ownership
 * @dev Extends ERC1155 with compliance and identity management for fractional assets
 */
interface IMultiToken is IERC1155Upgradeable {
    // Struct for batch metadata
    struct BatchMetadata {
        bytes32 assetId;
        string name;
        string description;
        uint256 totalSupply;
        uint256 mintedSupply;
        uint256 unitValue;  // Value per token in wei
        string metadataURI;
        bool isActive;
        uint256 createdAt;
    }
    
    // Events
    event BatchCreated(uint256 indexed tokenId, bytes32 indexed assetId, uint256 totalSupply);
    event BatchMinted(uint256 indexed tokenId, address indexed to, uint256 amount);
    event BatchBurned(uint256 indexed tokenId, address indexed from, uint256 amount);
    event BatchFrozen(uint256 indexed tokenId, bool frozen);
    event AddressFrozen(address indexed account, bool frozen);
    event IdentityRegistryAdded(address indexed identityRegistry);
    event ComplianceAdded(address indexed compliance);
    event BatchMetadataUpdated(uint256 indexed tokenId, string metadataURI);
    event BatchValueUpdated(uint256 indexed tokenId, uint256 newUnitValue);
    
    // Errors
    error BatchNotActive();
    error InsufficientSupply();
    error InvalidBatchId();
    error UnauthorizedAccess();
    error ComplianceCheckFailed();
    error IdentityNotVerified();
    error AccountFrozen();
    error BatchIsFrozen();
    error ExceedsMaxSupply();
    
    // Core functions
    function identityRegistry() external view returns (IIdentityRegistry);
    function compliance() external view returns (ICompliance);
    
    /**
     * @notice Create a new batch/token type
     * @param _assetId Asset ID from registry
     * @param _name Batch name (e.g., "Gold Batch Q1 2024")
     * @param _description Detailed description
     * @param _totalSupply Maximum supply for this batch
     * @param _unitValue Value per token unit
     * @param _metadataURI URI for metadata
     * @return tokenId The ID of the created batch
     */
    function createBatch(
        bytes32 _assetId,
        string memory _name,
        string memory _description,
        uint256 _totalSupply,
        uint256 _unitValue,
        string memory _metadataURI
    ) external returns (uint256 tokenId);
    
    /**
     * @notice Mint tokens from a batch to an address
     * @param _tokenId Batch/token ID
     * @param _to Recipient address
     * @param _amount Amount to mint
     */
    function mintBatch(uint256 _tokenId, address _to, uint256 _amount) external;
    
    /**
     * @notice Mint to multiple addresses
     * @param _tokenId Batch/token ID
     * @param _recipients Array of recipient addresses
     * @param _amounts Array of amounts
     */
    function mintBatchMultiple(
        uint256 _tokenId,
        address[] memory _recipients,
        uint256[] memory _amounts
    ) external;
    
    /**
     * @notice Burn tokens from a batch
     * @param _tokenId Batch/token ID
     * @param _from Address to burn from
     * @param _amount Amount to burn
     */
    function burnBatch(uint256 _tokenId, address _from, uint256 _amount) external;
    
    /**
     * @notice Redeem tokens for underlying asset value
     * @param _tokenId Batch/token ID
     * @param _amount Amount to redeem
     */
    function redeemTokens(uint256 _tokenId, uint256 _amount) external;
    
    /**
     * @notice Get batch metadata
     * @param _tokenId Batch/token ID
     * @return BatchMetadata struct
     */
    function getBatchMetadata(uint256 _tokenId) external view returns (BatchMetadata memory);
    
    /**
     * @notice Get ownership distribution for a batch
     * @param _tokenId Batch/token ID
     * @param _offset Starting index
     * @param _limit Number of holders to return
     * @return holders Array of holder addresses
     * @return balances Array of balances
     */
    function getOwnershipDistribution(
        uint256 _tokenId,
        uint256 _offset,
        uint256 _limit
    ) external view returns (address[] memory holders, uint256[] memory balances);
    
    /**
     * @notice Calculate total value held by an address across all batches
     * @param _holder Address to check
     * @return totalValue Total value in wei
     */
    function getTotalValue(address _holder) external view returns (uint256 totalValue);
    
    /**
     * @notice Freeze/unfreeze a specific batch
     * @param _tokenId Batch/token ID
     * @param _freeze Freeze status
     */
    function freezeBatch(uint256 _tokenId, bool _freeze) external;
    
    /**
     * @notice Freeze/unfreeze an address
     * @param _account Address to freeze/unfreeze
     * @param _freeze Freeze status
     */
    function freezeAddress(address _account, bool _freeze) external;
    
    /**
     * @notice Check if address is frozen
     * @param _account Address to check
     * @return Freeze status
     */
    function isFrozen(address _account) external view returns (bool);
    
    /**
     * @notice Check if batch is frozen
     * @param _tokenId Batch/token ID
     * @return Freeze status
     */
    function isBatchFrozen(uint256 _tokenId) external view returns (bool);
    
    /**
     * @notice Update batch metadata URI
     * @param _tokenId Batch/token ID
     * @param _metadataURI New metadata URI
     */
    function updateBatchMetadata(uint256 _tokenId, string memory _metadataURI) external;
    
    /**
     * @notice Update batch unit value
     * @param _tokenId Batch/token ID
     * @param _newUnitValue New value per token
     */
    function updateBatchValue(uint256 _tokenId, uint256 _newUnitValue) external;
    
    /**
     * @notice Forced transfer for compliance/recovery
     * @param _tokenId Batch/token ID
     * @param _from Source address
     * @param _to Destination address
     * @param _amount Amount to transfer
     */
    function forcedTransfer(
        uint256 _tokenId,
        address _from,
        address _to,
        uint256 _amount
    ) external;
}