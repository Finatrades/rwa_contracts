// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "./IMultiToken.sol";
import "../identity/IIdentityRegistry.sol";
import "../compliance/ICompliance.sol";
import "../libraries/BatchOperationsLib.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC1155/ERC1155Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC1155/extensions/ERC1155SupplyUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

/**
 * @title FinatradesMultiToken
 * @notice ERC1155 compliant multi-token for RWA with fractional ownership
 * @dev Implements ERC1155 with ERC-3643 compliance for multiple ownership assets
 * @custom:security-contact security@finatrades.com
 * 
 * This contract enables:
 * - Creation of asset batches with fractional ownership
 * - Multiple token types in a single contract
 * - Compliance checks on all transfers
 * - Flexible ownership models (unique + fractional)
 * 
 * Use cases:
 * - Gold mining batches with fractional shares
 * - Real estate with multiple unit types
 * - Art collections with varying ownership structures
 */
contract FinatradesMultiToken is
    Initializable,
    ERC1155Upgradeable,
    ERC1155SupplyUpgradeable,
    PausableUpgradeable,
    AccessControlUpgradeable,
    ReentrancyGuardUpgradeable,
    UUPSUpgradeable,
    IMultiToken
{
    using BatchOperationsLib for uint256;
    
    // Roles
    bytes32 public constant OWNER_ROLE = keccak256("OWNER_ROLE");
    bytes32 public constant AGENT_ROLE = keccak256("AGENT_ROLE");
    bytes32 public constant UPGRADER_ROLE = keccak256("UPGRADER_ROLE");
    bytes32 public constant BATCH_CREATOR_ROLE = keccak256("BATCH_CREATOR_ROLE");
    
    // State variables
    IIdentityRegistry private _identityRegistry;
    ICompliance private _tokenCompliance;
    
    // Batch management
    uint256 private _currentTokenId;
    mapping(uint256 => BatchMetadata) private _batchMetadata;
    mapping(uint256 => bool) private _batchFrozen;
    mapping(uint256 => address[]) private _batchHolders;
    mapping(uint256 => mapping(address => bool)) private _isHolder;
    
    // Freeze management
    mapping(address => bool) private _frozen;
    
    // Events (additional to interface)
    event TokensPaused(address indexed agent);
    event TokensUnpaused(address indexed agent);
    event RecoverySuccess(uint256 indexed tokenId, address indexed from, address indexed to);
    
    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }
    
    /**
     * @notice Initialize the contract
     * @param _admin Admin address
     * @param _uri Base URI for metadata
     * @param _identityRegistryAddress Identity registry address
     * @param _complianceAddress Compliance module address
     */
    function initialize(
        address _admin,
        string memory _uri,
        address _identityRegistryAddress,
        address _complianceAddress
    ) public initializer {
        __ERC1155_init(_uri);
        __ERC1155Supply_init();
        __Pausable_init();
        __AccessControl_init();
        __ReentrancyGuard_init();
        __UUPSUpgradeable_init();
        
        _identityRegistry = IIdentityRegistry(_identityRegistryAddress);
        _tokenCompliance = ICompliance(_complianceAddress);
        
        _grantRole(DEFAULT_ADMIN_ROLE, _admin);
        _grantRole(OWNER_ROLE, _admin);
        _grantRole(AGENT_ROLE, _admin);
        _grantRole(BATCH_CREATOR_ROLE, _admin);
        _grantRole(UPGRADER_ROLE, _admin);
        
        emit IdentityRegistryAdded(_identityRegistryAddress);
        emit ComplianceAdded(_complianceAddress);
    }
    
    // Registry getters
    function identityRegistry() public view override returns (IIdentityRegistry) {
        return _identityRegistry;
    }
    
    function compliance() public view override returns (ICompliance) {
        return _tokenCompliance;
    }
    
    /**
     * @notice Create a new batch/token type
     * @dev Only BATCH_CREATOR_ROLE can create batches
     */
    function createBatch(
        bytes32 _assetId,
        string memory _name,
        string memory _description,
        uint256 _totalSupply,
        uint256 _unitValue,
        string memory _metadataURI
    ) external override onlyRole(BATCH_CREATOR_ROLE) whenNotPaused returns (uint256 tokenId) {
        require(_assetId != bytes32(0), "Invalid asset ID");
        require(_totalSupply > 0, "Total supply must be > 0");
        require(_unitValue > 0, "Unit value must be > 0");
        require(bytes(_name).length > 0, "Name cannot be empty");
        
        tokenId = ++_currentTokenId;
        
        _batchMetadata[tokenId] = BatchMetadata({
            assetId: _assetId,
            name: _name,
            description: _description,
            totalSupply: _totalSupply,
            mintedSupply: 0,
            unitValue: _unitValue,
            metadataURI: _metadataURI,
            isActive: true,
            createdAt: block.timestamp
        });
        
        emit BatchCreated(tokenId, _assetId, _totalSupply);
        return tokenId;
    }
    
    /**
     * @notice Mint tokens from a batch to an address
     * @dev Checks identity verification and compliance
     */
    function mintBatch(
        uint256 _tokenId,
        address _to,
        uint256 _amount
    ) external override onlyRole(AGENT_ROLE) whenNotPaused nonReentrant {
        _validateAndMint(_tokenId, _to, _amount);
    }
    
    /**
     * @notice Mint to multiple addresses
     * @dev Batch operation with compliance checks
     */
    function mintBatchMultiple(
        uint256 _tokenId,
        address[] memory _recipients,
        uint256[] memory _amounts
    ) external override onlyRole(AGENT_ROLE) whenNotPaused nonReentrant {
        BatchOperationsLib.validateBatchArrays(_recipients.length, _amounts.length);
        
        for (uint256 i = 0; i < _recipients.length; i++) {
            _validateAndMint(_tokenId, _recipients[i], _amounts[i]);
        }
    }
    
    /**
     * @notice Internal mint with validation
     */
    function _validateAndMint(uint256 _tokenId, address _to, uint256 _amount) private {
        require(_to != address(0), "Cannot mint to zero address");
        require(_amount > 0, "Amount must be > 0");
        
        BatchMetadata storage batch = _batchMetadata[_tokenId];
        if (!batch.isActive) revert BatchNotActive();
        if (batch.mintedSupply + _amount > batch.totalSupply) revert ExceedsMaxSupply();
        
        // Identity verification
        if (!_identityRegistry.isVerified(_to)) revert IdentityNotVerified();
        
        // Update holder tracking
        if (!_isHolder[_tokenId][_to] && _amount > 0) {
            _batchHolders[_tokenId].push(_to);
            _isHolder[_tokenId][_to] = true;
        }
        
        batch.mintedSupply += _amount;
        
        // Notify compliance
        _tokenCompliance.created(_to, _amount * batch.unitValue);
        
        _mint(_to, _tokenId, _amount, "");
        emit BatchMinted(_tokenId, _to, _amount);
    }
    
    /**
     * @notice Burn tokens from a batch
     */
    function burnBatch(
        uint256 _tokenId,
        address _from,
        uint256 _amount
    ) external override onlyRole(AGENT_ROLE) whenNotPaused nonReentrant {
        require(_from != address(0), "Cannot burn from zero address");
        require(_amount > 0, "Amount must be > 0");
        
        BatchMetadata storage batch = _batchMetadata[_tokenId];
        require(batch.isActive, "Batch not active");
        
        uint256 balance = balanceOf(_from, _tokenId);
        require(balance >= _amount, "Insufficient balance");
        
        batch.mintedSupply -= _amount;
        
        // Update holder tracking
        if (balance == _amount) {
            _removeHolder(_tokenId, _from);
        }
        
        // Notify compliance
        _tokenCompliance.destroyed(_from, _amount * batch.unitValue);
        
        _burn(_from, _tokenId, _amount);
        emit BatchBurned(_tokenId, _from, _amount);
    }
    
    /**
     * @notice Redeem tokens for underlying asset value
     * @dev Implementation depends on specific asset type
     */
    function redeemTokens(
        uint256 _tokenId,
        uint256 _amount
    ) external override whenNotPaused nonReentrant {
        require(_amount > 0, "Amount must be > 0");
        require(balanceOf(msg.sender, _tokenId) >= _amount, "Insufficient balance");
        
        BatchMetadata storage batch = _batchMetadata[_tokenId];
        require(batch.isActive, "Batch not active");
        
        // Burn the tokens
        _burn(msg.sender, _tokenId, _amount);
        batch.mintedSupply -= _amount;
        
        // Update holder tracking
        if (balanceOf(msg.sender, _tokenId) == 0) {
            _removeHolder(_tokenId, msg.sender);
        }
        
        // Notify compliance
        _tokenCompliance.destroyed(msg.sender, _amount * batch.unitValue);
        
        // Additional redemption logic would go here
        // (e.g., transfer underlying asset, record redemption, etc.)
    }
    
    /**
     * @notice Get batch metadata
     */
    function getBatchMetadata(uint256 _tokenId) external view override returns (BatchMetadata memory) {
        return _batchMetadata[_tokenId];
    }
    
    /**
     * @notice Get ownership distribution for a batch
     */
    function getOwnershipDistribution(
        uint256 _tokenId,
        uint256 _offset,
        uint256 _limit
    ) external view override returns (address[] memory holders, uint256[] memory balances) {
        address[] storage allHolders = _batchHolders[_tokenId];
        uint256 total = allHolders.length;
        
        if (_offset >= total) {
            return (new address[](0), new uint256[](0));
        }
        
        uint256 end = _offset + _limit;
        if (end > total) {
            end = total;
        }
        
        uint256 size = end - _offset;
        holders = new address[](size);
        balances = new uint256[](size);
        
        for (uint256 i = 0; i < size; i++) {
            address holder = allHolders[_offset + i];
            holders[i] = holder;
            balances[i] = balanceOf(holder, _tokenId);
        }
    }
    
    /**
     * @notice Calculate total value held by an address
     */
    function getTotalValue(address _holder) external view override returns (uint256 totalValue) {
        for (uint256 tokenId = 1; tokenId <= _currentTokenId; tokenId++) {
            uint256 balance = balanceOf(_holder, tokenId);
            if (balance > 0) {
                totalValue += balance * _batchMetadata[tokenId].unitValue;
            }
        }
    }
    
    /**
     * @notice Freeze/unfreeze a batch
     */
    function freezeBatch(uint256 _tokenId, bool _freeze) external override onlyRole(AGENT_ROLE) {
        require(_batchMetadata[_tokenId].isActive, "Batch not active");
        _batchFrozen[_tokenId] = _freeze;
        emit BatchFrozen(_tokenId, _freeze);
    }
    
    /**
     * @notice Freeze/unfreeze an address
     */
    function freezeAddress(address _account, bool _freeze) external override onlyRole(AGENT_ROLE) {
        require(_account != address(0), "Invalid address");
        _frozen[_account] = _freeze;
        emit AddressFrozen(_account, _freeze);
    }
    
    /**
     * @notice Check if address is frozen
     */
    function isFrozen(address _account) external view override returns (bool) {
        return _frozen[_account];
    }
    
    /**
     * @notice Check if batch is frozen
     */
    function isBatchFrozen(uint256 _tokenId) external view override returns (bool) {
        return _batchFrozen[_tokenId];
    }
    
    /**
     * @notice Update batch metadata URI
     */
    function updateBatchMetadata(
        uint256 _tokenId,
        string memory _metadataURI
    ) external override onlyRole(OWNER_ROLE) {
        require(_batchMetadata[_tokenId].isActive, "Batch not active");
        _batchMetadata[_tokenId].metadataURI = _metadataURI;
        emit BatchMetadataUpdated(_tokenId, _metadataURI);
    }
    
    /**
     * @notice Update batch unit value
     */
    function updateBatchValue(
        uint256 _tokenId,
        uint256 _newUnitValue
    ) external override onlyRole(OWNER_ROLE) {
        require(_batchMetadata[_tokenId].isActive, "Batch not active");
        require(_newUnitValue > 0, "Value must be > 0");
        _batchMetadata[_tokenId].unitValue = _newUnitValue;
        emit BatchValueUpdated(_tokenId, _newUnitValue);
    }
    
    /**
     * @notice Forced transfer for compliance/recovery
     */
    function forcedTransfer(
        uint256 _tokenId,
        address _from,
        address _to,
        uint256 _amount
    ) external override onlyRole(AGENT_ROLE) whenNotPaused nonReentrant {
        require(_from != address(0) && _to != address(0), "Invalid addresses");
        require(_from != _to, "Same addresses");
        require(_amount > 0, "Amount must be > 0");
        require(balanceOf(_from, _tokenId) >= _amount, "Insufficient balance");
        
        // Update holder tracking
        if (balanceOf(_from, _tokenId) == _amount) {
            _removeHolder(_tokenId, _from);
        }
        if (!_isHolder[_tokenId][_to] && _amount > 0) {
            _batchHolders[_tokenId].push(_to);
            _isHolder[_tokenId][_to] = true;
        }
        
        // Notify compliance
        BatchMetadata memory batch = _batchMetadata[_tokenId];
        _tokenCompliance.transferred(_from, _to, _amount * batch.unitValue);
        
        // Use internal transfer
        _safeTransferFrom(_from, _to, _tokenId, _amount, "");
    }
    
    /**
     * @notice Recovery function for lost wallets
     */
    function recoveryAddress(
        uint256 _tokenId,
        address _lostWallet,
        address _newWallet
    ) external onlyRole(AGENT_ROLE) whenNotPaused nonReentrant {
        require(_lostWallet != address(0) && _newWallet != address(0), "Invalid addresses");
        require(_lostWallet != _newWallet, "Same addresses");
        
        uint256 balance = balanceOf(_lostWallet, _tokenId);
        require(balance > 0, "No tokens to recover");
        
        // Freeze the lost wallet
        _frozen[_lostWallet] = true;
        
        // Register new wallet identity
        _identityRegistry.registerIdentity(
            _newWallet,
            _identityRegistry.identity(_lostWallet),
            _identityRegistry.investorCountry(_lostWallet)
        );
        
        // Update holder tracking
        if (balance == balanceOf(_lostWallet, _tokenId)) {
            _removeHolder(_tokenId, _lostWallet);
        }
        if (!_isHolder[_tokenId][_newWallet] && balance > 0) {
            _batchHolders[_tokenId].push(_newWallet);
            _isHolder[_tokenId][_newWallet] = true;
        }
        
        // Notify compliance
        BatchMetadata memory batch = _batchMetadata[_tokenId];
        _tokenCompliance.transferred(_lostWallet, _newWallet, balance * batch.unitValue);
        
        // Use internal transfer
        _safeTransferFrom(_lostWallet, _newWallet, _tokenId, balance, "");
        
        emit RecoverySuccess(_tokenId, _lostWallet, _newWallet);
    }
    
    // Pause functions
    function pause() external onlyRole(AGENT_ROLE) {
        _pause();
        emit TokensPaused(msg.sender);
    }
    
    function unpause() external onlyRole(AGENT_ROLE) {
        _unpause();
        emit TokensUnpaused(msg.sender);
    }
    
    // Registry setters
    function setIdentityRegistry(address _identityRegistryAddress) external onlyRole(OWNER_ROLE) {
        require(_identityRegistryAddress != address(0), "Invalid address");
        _identityRegistry = IIdentityRegistry(_identityRegistryAddress);
        emit IdentityRegistryAdded(_identityRegistryAddress);
    }
    
    function setCompliance(address _complianceAddress) external onlyRole(OWNER_ROLE) {
        require(_complianceAddress != address(0), "Invalid address");
        _tokenCompliance = ICompliance(_complianceAddress);
        emit ComplianceAdded(_complianceAddress);
    }
    
    /**
     * @notice Hook that is called before any token transfer
     * @dev Implements compliance checks
     */
    function _beforeTokenTransfer(
        address operator,
        address from,
        address to,
        uint256[] memory ids,
        uint256[] memory amounts,
        bytes memory data
    ) internal virtual override(ERC1155Upgradeable, ERC1155SupplyUpgradeable) whenNotPaused {
        super._beforeTokenTransfer(operator, from, to, ids, amounts, data);
        
        // Skip checks for minting and burning
        if (from == address(0) || to == address(0)) {
            return;
        }
        
        // Check frozen status
        if (_frozen[from]) revert AccountFrozen();
        if (_frozen[to]) revert AccountFrozen();
        
        // Check identity verification
        if (!_identityRegistry.isVerified(from)) revert IdentityNotVerified();
        if (!_identityRegistry.isVerified(to)) revert IdentityNotVerified();
        
        // Check batch-specific restrictions and compliance
        for (uint256 i = 0; i < ids.length; i++) {
            if (_batchFrozen[ids[i]]) revert BatchIsFrozen();
            
            BatchMetadata memory batch = _batchMetadata[ids[i]];
            uint256 value = amounts[i] * batch.unitValue;
            
            if (!_tokenCompliance.canTransfer(from, to, value)) {
                revert ComplianceCheckFailed();
            }
        }
    }
    
    /**
     * @notice Hook that is called after any token transfer
     * @dev Updates compliance state
     */
    function _afterTokenTransfer(
        address operator,
        address from,
        address to,
        uint256[] memory ids,
        uint256[] memory amounts,
        bytes memory data
    ) internal virtual override {
        super._afterTokenTransfer(operator, from, to, ids, amounts, data);
        
        // Skip for minting and burning
        if (from == address(0) || to == address(0)) {
            return;
        }
        
        // Update compliance state and holder tracking
        for (uint256 i = 0; i < ids.length; i++) {
            BatchMetadata memory batch = _batchMetadata[ids[i]];
            uint256 value = amounts[i] * batch.unitValue;
            
            _tokenCompliance.transferred(from, to, value);
            
            // Update holder tracking
            if (balanceOf(from, ids[i]) == 0) {
                _removeHolder(ids[i], from);
            }
            if (!_isHolder[ids[i]][to] && amounts[i] > 0) {
                _batchHolders[ids[i]].push(to);
                _isHolder[ids[i]][to] = true;
            }
        }
    }
    
    /**
     * @notice Remove holder from tracking
     */
    function _removeHolder(uint256 _tokenId, address _holder) private {
        if (!_isHolder[_tokenId][_holder]) return;
        
        address[] storage holders = _batchHolders[_tokenId];
        for (uint256 i = 0; i < holders.length; i++) {
            if (holders[i] == _holder) {
                holders[i] = holders[holders.length - 1];
                holders.pop();
                _isHolder[_tokenId][_holder] = false;
                break;
            }
        }
    }
    
    /**
     * @notice Returns the URI for a token ID
     */
    function uri(uint256 _tokenId) public view override returns (string memory) {
        BatchMetadata memory batch = _batchMetadata[_tokenId];
        if (bytes(batch.metadataURI).length > 0) {
            return batch.metadataURI;
        }
        return super.uri(_tokenId);
    }
    
    // Required overrides
    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC1155Upgradeable, AccessControlUpgradeable, IERC165Upgradeable)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
    
    function _authorizeUpgrade(address newImplementation) internal override onlyRole(UPGRADER_ROLE) {}
}