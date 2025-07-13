// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "./IToken.sol";
import "../identity/IIdentityRegistry.sol";
import "../compliance/ICompliance.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/ERC20SnapshotUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

/**
 * @title Token
 * @notice ERC-3643 compliant security token for real-world asset tokenization
 * @dev Implements the T-REX standard with identity and compliance management
 */
contract Token is
    Initializable,
    ERC20SnapshotUpgradeable,
    PausableUpgradeable,
    AccessControlUpgradeable,
    ReentrancyGuardUpgradeable,
    UUPSUpgradeable,
    IToken
{
    // Roles
    bytes32 public constant OWNER_ROLE = keccak256("OWNER_ROLE");
    bytes32 public constant AGENT_ROLE = keccak256("AGENT_ROLE");
    bytes32 public constant UPGRADER_ROLE = keccak256("UPGRADER_ROLE");
    
    // Token details
    string private _tokenName;
    string private _tokenSymbol;
    uint8 private _tokenDecimals;
    string private _tokenVersion;
    address private _tokenOnchainID;
    
    // Compliance and Identity
    IIdentityRegistry private _identityRegistry;
    ICompliance private _tokenCompliance;
    
    // Frozen tokens
    mapping(address => bool) private _frozen;
    mapping(address => uint256) private _frozenTokens;
    
    // Events
    event UpdatedTokenInformation(string indexed name, string indexed symbol, uint8 decimals, string version, address indexed onchainID);
    
    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }
    
    function initialize(
        address _admin,
        string memory _name,
        string memory _symbol,
        uint8 _decimals,
        address _identityRegistryAddress,
        address _complianceAddress
    ) public virtual initializer {
        __ERC20_init(_name, _symbol);
        __ERC20Snapshot_init();
        __Pausable_init();
        __AccessControl_init();
        __ReentrancyGuard_init();
        __UUPSUpgradeable_init();
        
        _tokenName = _name;
        _tokenSymbol = _symbol;
        _tokenDecimals = _decimals;
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
    function name() public view override(ERC20Upgradeable, IToken) returns (string memory) {
        return _tokenName;
    }
    
    function symbol() public view override(ERC20Upgradeable, IToken) returns (string memory) {
        return _tokenSymbol;
    }
    
    function decimals() public view override(ERC20Upgradeable, IToken) returns (uint8) {
        return _tokenDecimals;
    }
    
    function version() public view override returns (string memory) {
        return _tokenVersion;
    }
    
    function onchainID() public view override returns (address) {
        return _tokenOnchainID;
    }
    
    function identityRegistry() public view override returns (IIdentityRegistry) {
        return _identityRegistry;
    }
    
    function compliance() public view override returns (ICompliance) {
        return _tokenCompliance;
    }
    
    function paused() public view override(PausableUpgradeable, IToken) returns (bool) {
        return super.paused();
    }
    
    // Token Information Setters
    function setName(string calldata _name) external override onlyRole(OWNER_ROLE) {
        _tokenName = _name;
        emit UpdatedTokenInformation(_name, _tokenSymbol, _tokenDecimals, _tokenVersion, _tokenOnchainID);
    }
    
    function setSymbol(string calldata _symbol) external override onlyRole(OWNER_ROLE) {
        _tokenSymbol = _symbol;
        emit UpdatedTokenInformation(_tokenName, _symbol, _tokenDecimals, _tokenVersion, _tokenOnchainID);
    }
    
    function setOnchainID(address _onchainID) external override onlyRole(OWNER_ROLE) {
        _tokenOnchainID = _onchainID;
        emit UpdatedTokenInformation(_tokenName, _tokenSymbol, _tokenDecimals, _tokenVersion, _onchainID);
    }
    
    // Registry Setters
    function setIdentityRegistry(address _identityRegistryAddress) external override onlyRole(OWNER_ROLE) {
        _identityRegistry = IIdentityRegistry(_identityRegistryAddress);
        emit IdentityRegistryAdded(_identityRegistryAddress);
    }
    
    function setCompliance(address _complianceAddress) external override onlyRole(OWNER_ROLE) {
        _tokenCompliance = ICompliance(_complianceAddress);
        emit ComplianceAdded(_complianceAddress);
    }
    
    // Pause functions
    function pause() external override onlyRole(AGENT_ROLE) {
        _pause();
        emit TokensPaused(msg.sender);
    }
    
    function unpause() external override onlyRole(AGENT_ROLE) {
        _unpause();
        emit TokensUnpaused(msg.sender);
    }
    
    // Freeze functions
    function isFrozen(address _wallet) public view override returns (bool) {
        return _frozen[_wallet];
    }
    
    function getFrozenTokens(address _wallet) public view override returns (uint256) {
        return _frozenTokens[_wallet];
    }
    
    function setAddressFrozen(address _userAddress, bool _freeze) external override onlyRole(AGENT_ROLE) {
        _frozen[_userAddress] = _freeze;
        emit AddressFrozen(_userAddress, _freeze);
    }
    
    function freezePartialTokens(address _userAddress, uint256 _amount) external override onlyRole(AGENT_ROLE) {
        require(balanceOf(_userAddress) >= _frozenTokens[_userAddress] + _amount, "Insufficient balance");
        _frozenTokens[_userAddress] += _amount;
    }
    
    function unfreezePartialTokens(address _userAddress, uint256 _amount) external override onlyRole(AGENT_ROLE) {
        require(_frozenTokens[_userAddress] >= _amount, "Insufficient frozen tokens");
        _frozenTokens[_userAddress] -= _amount;
    }
    
    // Transfer functions with compliance
    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 amount
    ) internal override(ERC20SnapshotUpgradeable) whenNotPaused {
        super._beforeTokenTransfer(from, to, amount);
        
        // Check frozen status
        require(!_frozen[from], "From address is frozen");
        require(!_frozen[to], "To address is frozen");
        
        // Check frozen tokens
        if (from != address(0)) {
            require(balanceOf(from) - _frozenTokens[from] >= amount, "Insufficient unfrozen balance");
        }
        
        // Check identity registry
        if (from != address(0) && to != address(0)) {
            require(_identityRegistry.isVerified(from), "From address not verified");
            require(_identityRegistry.isVerified(to), "To address not verified");
            
            // Check compliance
            require(_tokenCompliance.canTransfer(from, to, amount), "Transfer not compliant");
        }
    }
    
    function _afterTokenTransfer(
        address from,
        address to,
        uint256 amount
    ) internal override {
        super._afterTokenTransfer(from, to, amount);
        
        if (from != address(0) && to != address(0)) {
            _tokenCompliance.transferred(from, to, amount);
        }
    }
    
    // Mint and Burn
    function mint(address _to, uint256 _amount) external override onlyRole(AGENT_ROLE) {
        require(_identityRegistry.isVerified(_to), "Identity not verified");
        
        _tokenCompliance.created(_to, _amount);
        _mint(_to, _amount);
    }
    
    function burn(address _from, uint256 _amount) external override onlyRole(AGENT_ROLE) {
        _tokenCompliance.destroyed(_from, _amount);
        _burn(_from, _amount);
    }
    
    // Forced transfers
    function forcedTransfer(
        address _from,
        address _to,
        uint256 _amount
    ) external override onlyRole(AGENT_ROLE) returns (bool) {
        require(balanceOf(_from) >= _amount, "Insufficient balance");
        
        _tokenCompliance.transferred(_from, _to, _amount);
        _transfer(_from, _to, _amount);
        
        return true;
    }
    
    // Recovery
    function recoveryAddress(
        address _lostWallet,
        address _newWallet,
        address _investorOnchainID
    ) external override onlyRole(AGENT_ROLE) {
        require(balanceOf(_lostWallet) > 0, "No tokens to recover");
        
        uint256 amount = balanceOf(_lostWallet);
        _frozen[_lostWallet] = true;
        _identityRegistry.registerIdentity(_newWallet, _identityRegistry.identity(_lostWallet), _identityRegistry.investorCountry(_lostWallet));
        
        this.forcedTransfer(_lostWallet, _newWallet, amount);
        
        emit RecoverySuccess(_lostWallet, _newWallet);
    }
    
    // Batch operations
    function batchTransfer(address[] calldata _toList, uint256[] calldata _amounts) external override {
        require(_toList.length == _amounts.length, "Arrays length mismatch");
        
        for (uint256 i = 0; i < _toList.length; i++) {
            transfer(_toList[i], _amounts[i]);
        }
    }
    
    function batchForcedTransfer(
        address[] calldata _fromList,
        address[] calldata _toList,
        uint256[] calldata _amounts
    ) external override onlyRole(AGENT_ROLE) {
        require(_fromList.length == _toList.length && _fromList.length == _amounts.length, "Arrays length mismatch");
        
        for (uint256 i = 0; i < _fromList.length; i++) {
            this.forcedTransfer(_fromList[i], _toList[i], _amounts[i]);
        }
    }
    
    function batchMint(address[] calldata _toList, uint256[] calldata _amounts) external override onlyRole(AGENT_ROLE) {
        require(_toList.length == _amounts.length, "Arrays length mismatch");
        
        for (uint256 i = 0; i < _toList.length; i++) {
            this.mint(_toList[i], _amounts[i]);
        }
    }
    
    function batchBurn(address[] calldata _fromList, uint256[] calldata _amounts) external override onlyRole(AGENT_ROLE) {
        require(_fromList.length == _amounts.length, "Arrays length mismatch");
        
        for (uint256 i = 0; i < _fromList.length; i++) {
            this.burn(_fromList[i], _amounts[i]);
        }
    }
    
    function batchSetAddressFrozen(address[] calldata _userAddresses, bool[] calldata _freeze) external override onlyRole(AGENT_ROLE) {
        require(_userAddresses.length == _freeze.length, "Arrays length mismatch");
        
        for (uint256 i = 0; i < _userAddresses.length; i++) {
            this.setAddressFrozen(_userAddresses[i], _freeze[i]);
        }
    }
    
    function batchFreezePartialTokens(address[] calldata _userAddresses, uint256[] calldata _amounts) external override onlyRole(AGENT_ROLE) {
        require(_userAddresses.length == _amounts.length, "Arrays length mismatch");
        
        for (uint256 i = 0; i < _userAddresses.length; i++) {
            this.freezePartialTokens(_userAddresses[i], _amounts[i]);
        }
    }
    
    function batchUnfreezePartialTokens(address[] calldata _userAddresses, uint256[] calldata _amounts) external override onlyRole(AGENT_ROLE) {
        require(_userAddresses.length == _amounts.length, "Arrays length mismatch");
        
        for (uint256 i = 0; i < _userAddresses.length; i++) {
            this.unfreezePartialTokens(_userAddresses[i], _amounts[i]);
        }
    }
    
    // Snapshot functionality
    function snapshot() external onlyRole(AGENT_ROLE) returns (uint256) {
        return _snapshot();
    }
    
    // Required overrides
    function _authorizeUpgrade(address newImplementation) internal override onlyRole(UPGRADER_ROLE) {}
}