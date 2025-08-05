// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "../identity/IIdentityRegistry.sol";
import "../compliance/ICompliance.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC721/ERC721Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC721/extensions/ERC721EnumerableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC721/extensions/ERC721URIStorageUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/CountersUpgradeable.sol";

/**
 * @title FinatradesNFT
 * @notice ERC-721 compliant security token for non-fungible real-world assets
 * @dev Implements compliance and identity management for NFT-based RWAs
 * @custom:security-contact security@finatrades.com
 */
contract FinatradesNFT is
    Initializable,
    ERC721Upgradeable,
    ERC721EnumerableUpgradeable,
    ERC721URIStorageUpgradeable,
    PausableUpgradeable,
    AccessControlUpgradeable,
    ReentrancyGuardUpgradeable,
    UUPSUpgradeable
{
    using CountersUpgradeable for CountersUpgradeable.Counter;
    
    // Roles
    bytes32 public constant OWNER_ROLE = keccak256("OWNER_ROLE");
    bytes32 public constant AGENT_ROLE = keccak256("AGENT_ROLE");
    bytes32 public constant UPGRADER_ROLE = keccak256("UPGRADER_ROLE");
    
    // Token details
    string private _tokenName;
    string private _tokenSymbol;
    string private _tokenVersion;
    address private _tokenOnchainID;
    
    // Compliance and Identity
    IIdentityRegistry private _identityRegistry;
    ICompliance private _tokenCompliance;
    
    // NFT specific
    CountersUpgradeable.Counter private _tokenIdCounter;
    mapping(uint256 => uint256) private _tokenValues; // Token ID to value
    mapping(uint256 => bytes32) private _tokenAssetIds; // Token ID to asset ID
    mapping(address => bool) private _frozen;
    mapping(uint256 => bool) private _frozenTokens;
    
    // Events
    event UpdatedTokenInformation(string indexed name, string indexed symbol, string version, address indexed onchainID);
    event IdentityRegistryAdded(address indexed identityRegistry);
    event ComplianceAdded(address indexed compliance);
    event TokensPaused(address indexed agent);
    event TokensUnpaused(address indexed agent);
    event AddressFrozen(address indexed wallet, bool isFrozen);
    event TokenFrozen(uint256 indexed tokenId, bool isFrozen);
    event TokenMinted(address indexed to, uint256 indexed tokenId, uint256 value, bytes32 assetId);
    event TokenBurned(uint256 indexed tokenId);
    event RecoverySuccess(address indexed lostWallet, address indexed newWallet);
    event ForcedTransfer(address indexed from, address indexed to, uint256 indexed tokenId);
    
    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }
    
    function initialize(
        address _admin,
        string memory _name,
        string memory _symbol,
        address _identityRegistryAddress,
        address _complianceAddress
    ) public initializer {
        __ERC721_init(_name, _symbol);
        __ERC721Enumerable_init();
        __ERC721URIStorage_init();
        __Pausable_init();
        __AccessControl_init();
        __ReentrancyGuard_init();
        __UUPSUpgradeable_init();
        
        _tokenName = _name;
        _tokenSymbol = _symbol;
        _tokenVersion = "1.0.0";
        
        _identityRegistry = IIdentityRegistry(_identityRegistryAddress);
        _tokenCompliance = ICompliance(_complianceAddress);
        
        _grantRole(DEFAULT_ADMIN_ROLE, _admin);
        _grantRole(OWNER_ROLE, _admin);
        _grantRole(AGENT_ROLE, _admin);
        _grantRole(UPGRADER_ROLE, _admin);
        
        emit IdentityRegistryAdded(_identityRegistryAddress);
        emit ComplianceAdded(_complianceAddress);
    }
    
    // Token Information
    function name() public view override(ERC721Upgradeable) returns (string memory) {
        return _tokenName;
    }
    
    function symbol() public view override(ERC721Upgradeable) returns (string memory) {
        return _tokenSymbol;
    }
    
    function decimals() public pure returns (uint8) {
        return 0; // NFTs don't have decimals
    }
    
    function version() public view returns (string memory) {
        return _tokenVersion;
    }
    
    function onchainID() public view returns (address) {
        return _tokenOnchainID;
    }
    
    function identityRegistry() public view returns (IIdentityRegistry) {
        return _identityRegistry;
    }
    
    function compliance() public view returns (ICompliance) {
        return _tokenCompliance;
    }
    
    function paused() public view override(PausableUpgradeable) returns (bool) {
        return super.paused();
    }
    
    // Token Information Setters
    function setName(string calldata _name) external onlyRole(OWNER_ROLE) {
        _tokenName = _name;
        emit UpdatedTokenInformation(_name, _tokenSymbol, _tokenVersion, _tokenOnchainID);
    }
    
    function setSymbol(string calldata _symbol) external onlyRole(OWNER_ROLE) {
        _tokenSymbol = _symbol;
        emit UpdatedTokenInformation(_tokenName, _symbol, _tokenVersion, _tokenOnchainID);
    }
    
    function setOnchainID(address _onchainID) external onlyRole(OWNER_ROLE) {
        _tokenOnchainID = _onchainID;
        emit UpdatedTokenInformation(_tokenName, _tokenSymbol, _tokenVersion, _onchainID);
    }
    
    // Registry Setters
    function setIdentityRegistry(address _identityRegistryAddress) external onlyRole(OWNER_ROLE) {
        _identityRegistry = IIdentityRegistry(_identityRegistryAddress);
        emit IdentityRegistryAdded(_identityRegistryAddress);
    }
    
    function setCompliance(address _complianceAddress) external onlyRole(OWNER_ROLE) {
        _tokenCompliance = ICompliance(_complianceAddress);
        emit ComplianceAdded(_complianceAddress);
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
    
    // Freeze functions
    function isFrozen(address _wallet) public view returns (bool) {
        return _frozen[_wallet];
    }
    
    function isTokenFrozen(uint256 _tokenId) public view returns (bool) {
        return _frozenTokens[_tokenId];
    }
    
    function setAddressFrozen(address _userAddress, bool _freeze) external onlyRole(AGENT_ROLE) {
        _frozen[_userAddress] = _freeze;
        emit AddressFrozen(_userAddress, _freeze);
    }
    
    function freezeToken(uint256 _tokenId) external onlyRole(AGENT_ROLE) {
        require(_exists(_tokenId), "Token does not exist");
        _frozenTokens[_tokenId] = true;
        emit TokenFrozen(_tokenId, true);
    }
    
    function unfreezeToken(uint256 _tokenId) external onlyRole(AGENT_ROLE) {
        require(_exists(_tokenId), "Token does not exist");
        _frozenTokens[_tokenId] = false;
        emit TokenFrozen(_tokenId, false);
    }
    
    // Mint NFT with compliance
    function mint(
        address _to,
        uint256 _value,
        bytes32 _assetId,
        string memory _uri
    ) external onlyRole(AGENT_ROLE) returns (uint256) {
        require(_identityRegistry.isVerified(_to), "Identity not verified");
        
        uint256 tokenId = _tokenIdCounter.current();
        _tokenIdCounter.increment();
        
        _safeMint(_to, tokenId);
        _setTokenURI(tokenId, _uri);
        
        _tokenValues[tokenId] = _value;
        _tokenAssetIds[tokenId] = _assetId;
        
        emit TokenMinted(_to, tokenId, _value, _assetId);
        
        return tokenId;
    }
    
    // Burn NFT
    function burn(uint256 _tokenId) external onlyRole(AGENT_ROLE) {
        require(_exists(_tokenId), "Token does not exist");
        
        address owner = ownerOf(_tokenId);
        _burn(_tokenId);
        
        delete _tokenValues[_tokenId];
        delete _tokenAssetIds[_tokenId];
        delete _frozenTokens[_tokenId];
        
        emit TokenBurned(_tokenId);
    }
    
    // Get token value
    function tokenValue(uint256 _tokenId) external view returns (uint256) {
        require(_exists(_tokenId), "Token does not exist");
        return _tokenValues[_tokenId];
    }
    
    // Get token asset ID
    function tokenAssetId(uint256 _tokenId) external view returns (bytes32) {
        require(_exists(_tokenId), "Token does not exist");
        return _tokenAssetIds[_tokenId];
    }
    
    // Update token value
    function updateTokenValue(uint256 _tokenId, uint256 _newValue) external onlyRole(AGENT_ROLE) {
        require(_exists(_tokenId), "Token does not exist");
        _tokenValues[_tokenId] = _newValue;
    }
    
    // Forced transfer
    function forcedTransfer(
        address _from,
        address _to,
        uint256 _tokenId
    ) external onlyRole(AGENT_ROLE) {
        require(_from != address(0), "Invalid from address");
        require(_to != address(0), "Invalid to address");
        require(_exists(_tokenId), "Token does not exist");
        require(ownerOf(_tokenId) == _from, "From address does not own token");
        
        _safeTransfer(_from, _to, _tokenId, "");
        emit ForcedTransfer(_from, _to, _tokenId);
    }
    
    // Recovery function
    function recoveryAddress(
        address _lostWallet,
        address _newWallet,
        address _investorOnchainID
    ) external onlyRole(AGENT_ROLE) {
        require(_lostWallet != address(0), "Invalid lost wallet");
        require(_newWallet != address(0), "Invalid new wallet");
        require(_lostWallet != _newWallet, "Same wallet addresses");
        
        // Freeze the lost wallet
        _frozen[_lostWallet] = true;
        
        // Register new wallet identity
        _identityRegistry.registerIdentity(_newWallet, _identityRegistry.identity(_lostWallet), _identityRegistry.investorCountry(_lostWallet));
        
        // Transfer all tokens from lost wallet to new wallet
        uint256 balance = balanceOf(_lostWallet);
        for (uint256 i = 0; i < balance; i++) {
            uint256 tokenId = tokenOfOwnerByIndex(_lostWallet, 0); // Always get first token as array shrinks
            _safeTransfer(_lostWallet, _newWallet, tokenId, "");
        }
        
        emit RecoverySuccess(_lostWallet, _newWallet);
    }
    
    // Override transfer functions to add compliance
    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 tokenId,
        uint256 batchSize
    ) internal virtual override(ERC721Upgradeable, ERC721EnumerableUpgradeable) whenNotPaused {
        super._beforeTokenTransfer(from, to, tokenId, batchSize);
        
        // Check frozen status
        require(!_frozen[from], "From address is frozen");
        require(!_frozen[to], "To address is frozen");
        require(!_frozenTokens[tokenId], "Token is frozen");
        
        // Check identity registry (skip for minting and burning)
        if (from != address(0) && to != address(0)) {
            require(_identityRegistry.isVerified(from), "From address not verified");
            require(_identityRegistry.isVerified(to), "To address not verified");
            
            // For NFTs, we pass the token value as amount for compliance check
            uint256 value = _tokenValues[tokenId];
            require(_tokenCompliance.canTransfer(from, to, value), "Transfer not compliant");
        }
    }
    
    function _afterTokenTransfer(
        address from,
        address to,
        uint256 tokenId,
        uint256 batchSize
    ) internal virtual override(ERC721Upgradeable) {
        super._afterTokenTransfer(from, to, tokenId, batchSize);
        
        if (from != address(0) && to != address(0)) {
            uint256 value = _tokenValues[tokenId];
            _tokenCompliance.transferred(from, to, value);
        }
    }
    
    // Required overrides
    function _burn(uint256 tokenId) internal override(ERC721Upgradeable, ERC721URIStorageUpgradeable) {
        super._burn(tokenId);
    }
    
    function tokenURI(uint256 tokenId)
        public
        view
        override(ERC721Upgradeable, ERC721URIStorageUpgradeable)
        returns (string memory)
    {
        return super.tokenURI(tokenId);
    }
    
    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721Upgradeable, ERC721EnumerableUpgradeable, ERC721URIStorageUpgradeable, AccessControlUpgradeable)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
    
    function _authorizeUpgrade(address newImplementation) internal override onlyRole(UPGRADER_ROLE) {}
    
    // Batch operations for NFTs
    function batchMint(
        address[] calldata _toList,
        uint256[] calldata _values,
        bytes32[] calldata _assetIds,
        string[] calldata _uris
    ) external onlyRole(AGENT_ROLE) {
        require(_toList.length == _values.length, "Arrays length mismatch");
        require(_toList.length == _assetIds.length, "Arrays length mismatch");
        require(_toList.length == _uris.length, "Arrays length mismatch");
        require(_toList.length <= 100, "Batch too large");
        
        for (uint256 i = 0; i < _toList.length; i++) {
            require(_identityRegistry.isVerified(_toList[i]), "Identity not verified");
            
            uint256 tokenId = _tokenIdCounter.current();
            _tokenIdCounter.increment();
            
            _safeMint(_toList[i], tokenId);
            _setTokenURI(tokenId, _uris[i]);
            
            _tokenValues[tokenId] = _values[i];
            _tokenAssetIds[tokenId] = _assetIds[i];
            
            emit TokenMinted(_toList[i], tokenId, _values[i], _assetIds[i]);
        }
    }
}