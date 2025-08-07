// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import "../compliance/ICompliance.sol";
import "../registry/IAssetRegistry.sol";
import "../libraries/UniversalAssetLib.sol";

/**
 * @title ImprovedTokenFactory
 * @notice Factory contract that properly handles ERC20 and ERC721 deployments with dedicated compliance modules
 * @dev Each ERC20 token gets its own ModularCompliance instance to avoid conflicts
 * @custom:security-contact security@finatrades.com
 */
contract ImprovedTokenFactory is 
    Initializable,
    AccessControlUpgradeable,
    PausableUpgradeable,
    UUPSUpgradeable
{
    // Roles
    bytes32 public constant FACTORY_ADMIN_ROLE = keccak256("FACTORY_ADMIN_ROLE");
    bytes32 public constant TOKEN_DEPLOYER_ROLE = keccak256("TOKEN_DEPLOYER_ROLE");
    bytes32 public constant UPGRADER_ROLE = keccak256("UPGRADER_ROLE");
    
    // Token types
    enum TokenType { ERC20, ERC721 }
    
    // Struct to store token deployment info
    struct TokenDeployment {
        address tokenAddress;
        address complianceAddress;  // Each token has its own compliance
        TokenType tokenType;
        string name;
        string symbol;
        address deployer;
        uint256 deployedAt;
        bytes32 assetId;
        bool isActive;
    }
    
    // State variables
    mapping(address => TokenDeployment) public deployedTokens;
    mapping(bytes32 => address) public assetToToken;
    mapping(address => address) public tokenToCompliance;  // Maps token to its compliance module
    mapping(address => address[]) public deployerTokens;
    address[] public allTokens;
    
    // Implementation addresses (set by admin)
    address public erc20Implementation;
    address public erc721Implementation;
    address public complianceImplementation;  // Implementation for ModularCompliance
    
    // Registry addresses
    address public identityRegistry;
    address public assetRegistry;
    
    // Events
    event TokenDeployed(
        address indexed tokenAddress,
        address indexed complianceAddress,
        TokenType indexed tokenType,
        string name,
        string symbol,
        address deployer,
        bytes32 assetId
    );
    
    event TokenImplementationUpdated(
        TokenType tokenType,
        address oldImplementation,
        address newImplementation
    );
    
    event ComplianceImplementationUpdated(
        address oldImplementation,
        address newImplementation
    );
    
    event TokenDeactivated(address indexed tokenAddress);
    event TokenReactivated(address indexed tokenAddress);
    
    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }
    
    function initialize(
        address _admin,
        address _identityRegistry,
        address _complianceImplementation,
        address _assetRegistry,
        address _erc20Implementation,
        address _erc721Implementation
    ) public initializer {
        __AccessControl_init();
        __Pausable_init();
        __UUPSUpgradeable_init();
        
        _grantRole(DEFAULT_ADMIN_ROLE, _admin);
        _grantRole(FACTORY_ADMIN_ROLE, _admin);
        _grantRole(TOKEN_DEPLOYER_ROLE, _admin);
        _grantRole(UPGRADER_ROLE, _admin);
        
        identityRegistry = _identityRegistry;
        complianceImplementation = _complianceImplementation;
        assetRegistry = _assetRegistry;
        erc20Implementation = _erc20Implementation;
        erc721Implementation = _erc721Implementation;
    }
    
    /**
     * @notice Deploy a new token with its own compliance module
     * @param _tokenType Type of token to deploy (ERC20 or ERC721)
     * @param _name Token name
     * @param _symbol Token symbol
     * @param _assetId Asset ID from AssetRegistry
     * @param _tokenAdmin Admin address for the new token
     * @return tokenAddress Address of the deployed token
     * @return complianceAddress Address of the token's compliance module
     */
    function deployToken(
        TokenType _tokenType,
        string memory _name,
        string memory _symbol,
        bytes32 _assetId,
        address _tokenAdmin
    ) external onlyRole(TOKEN_DEPLOYER_ROLE) whenNotPaused returns (address tokenAddress, address complianceAddress) {
        require(bytes(_name).length > 0, "Name cannot be empty");
        require(bytes(_symbol).length > 0, "Symbol cannot be empty");
        require(_assetId != bytes32(0), "Invalid asset ID");
        require(_tokenAdmin != address(0), "Invalid admin address");
        require(assetToToken[_assetId] == address(0), "Token already exists for asset");
        
        // Verify asset exists in registry
        IAssetRegistry registry = IAssetRegistry(assetRegistry);
        try registry.getAsset(_assetId) returns (UniversalAssetLib.Asset memory) {
            // Asset exists, continue
        } catch {
            revert("Asset does not exist");
        }
        
        // Deploy a dedicated compliance module for this token
        complianceAddress = _deployCompliance(_tokenAdmin);
        
        // Deploy the appropriate token type
        if (_tokenType == TokenType.ERC20) {
            require(erc20Implementation != address(0), "ERC20 implementation not set");
            tokenAddress = _deployERC20Token(_name, _symbol, _tokenAdmin, complianceAddress);
        } else {
            require(erc721Implementation != address(0), "ERC721 implementation not set");
            tokenAddress = _deployERC721Token(_name, _symbol, _tokenAdmin, complianceAddress);
        }
        
        // Bind token to its compliance module
        ICompliance(complianceAddress).bindToken(tokenAddress);
        
        // Store deployment info
        deployedTokens[tokenAddress] = TokenDeployment({
            tokenAddress: tokenAddress,
            complianceAddress: complianceAddress,
            tokenType: _tokenType,
            name: _name,
            symbol: _symbol,
            deployer: msg.sender,
            deployedAt: block.timestamp,
            assetId: _assetId,
            isActive: true
        });
        
        assetToToken[_assetId] = tokenAddress;
        tokenToCompliance[tokenAddress] = complianceAddress;
        deployerTokens[msg.sender].push(tokenAddress);
        allTokens.push(tokenAddress);
        
        // Authorize token in AssetRegistry
        registry.authorizeTokenContract(tokenAddress, true);
        
        emit TokenDeployed(tokenAddress, complianceAddress, _tokenType, _name, _symbol, msg.sender, _assetId);
        
        return (tokenAddress, complianceAddress);
    }
    
    /**
     * @notice Deploy a new ModularCompliance proxy for a token
     */
    function _deployCompliance(address _admin) private returns (address) {
        require(complianceImplementation != address(0), "Compliance implementation not set");
        
        // Encode initialization data for ModularCompliance
        bytes memory initData = abi.encodeWithSignature(
            "initialize(address)",
            _admin
        );
        
        ERC1967Proxy proxy = new ERC1967Proxy(complianceImplementation, initData);
        
        return address(proxy);
    }
    
    /**
     * @notice Deploy ERC-20 token using proxy pattern
     */
    function _deployERC20Token(
        string memory _name,
        string memory _symbol,
        address _tokenAdmin,
        address _complianceAddress
    ) private returns (address) {
        // Encode initialization data for Token contract
        bytes memory initData = abi.encodeWithSignature(
            "initialize(address,string,string,uint8,address,address)",
            _tokenAdmin,
            _name,
            _symbol,
            uint8(18), // decimals
            identityRegistry,
            _complianceAddress  // Use the dedicated compliance for this token
        );
        
        ERC1967Proxy proxy = new ERC1967Proxy(erc20Implementation, initData);
        
        return address(proxy);
    }
    
    /**
     * @notice Deploy ERC-721 token using proxy pattern
     */
    function _deployERC721Token(
        string memory _name,
        string memory _symbol,
        address _tokenAdmin,
        address _complianceAddress
    ) private returns (address) {
        // Encode initialization data for FinatradesNFT contract
        bytes memory initData = abi.encodeWithSignature(
            "initialize(address,string,string,address,address)",
            _tokenAdmin,
            _name,
            _symbol,
            identityRegistry,
            _complianceAddress  // Use the dedicated compliance for this token
        );
        
        ERC1967Proxy proxy = new ERC1967Proxy(erc721Implementation, initData);
        
        return address(proxy);
    }
    
    /**
     * @notice Update implementation contract for future deployments
     * @param _tokenType Type of token implementation to update
     * @param _newImplementation New implementation address
     */
    function updateImplementation(
        TokenType _tokenType,
        address _newImplementation
    ) external onlyRole(FACTORY_ADMIN_ROLE) {
        require(_newImplementation != address(0), "Invalid implementation");
        
        address oldImplementation;
        
        if (_tokenType == TokenType.ERC20) {
            oldImplementation = erc20Implementation;
            erc20Implementation = _newImplementation;
        } else {
            oldImplementation = erc721Implementation;
            erc721Implementation = _newImplementation;
        }
        
        emit TokenImplementationUpdated(_tokenType, oldImplementation, _newImplementation);
    }
    
    /**
     * @notice Update compliance implementation for future deployments
     * @param _newImplementation New compliance implementation address
     */
    function updateComplianceImplementation(
        address _newImplementation
    ) external onlyRole(FACTORY_ADMIN_ROLE) {
        require(_newImplementation != address(0), "Invalid implementation");
        
        address oldImplementation = complianceImplementation;
        complianceImplementation = _newImplementation;
        
        emit ComplianceImplementationUpdated(oldImplementation, _newImplementation);
    }
    
    /**
     * @notice Deactivate a token (emergency function)
     * @param _tokenAddress Token address to deactivate
     */
    function deactivateToken(address _tokenAddress) external onlyRole(FACTORY_ADMIN_ROLE) {
        require(deployedTokens[_tokenAddress].tokenAddress != address(0), "Token not found");
        require(deployedTokens[_tokenAddress].isActive, "Token already deactivated");
        
        deployedTokens[_tokenAddress].isActive = false;
        
        // Remove authorization from AssetRegistry
        IAssetRegistry(assetRegistry).authorizeTokenContract(_tokenAddress, false);
        
        emit TokenDeactivated(_tokenAddress);
    }
    
    /**
     * @notice Reactivate a token
     * @param _tokenAddress Token address to reactivate
     */
    function reactivateToken(address _tokenAddress) external onlyRole(FACTORY_ADMIN_ROLE) {
        require(deployedTokens[_tokenAddress].tokenAddress != address(0), "Token not found");
        require(!deployedTokens[_tokenAddress].isActive, "Token already active");
        
        deployedTokens[_tokenAddress].isActive = true;
        
        // Re-authorize in AssetRegistry
        IAssetRegistry(assetRegistry).authorizeTokenContract(_tokenAddress, true);
        
        emit TokenReactivated(_tokenAddress);
    }
    
    // View functions
    
    /**
     * @notice Get token deployment info
     * @param _tokenAddress Token address
     * @return Token deployment details
     */
    function getTokenInfo(address _tokenAddress) external view returns (TokenDeployment memory) {
        return deployedTokens[_tokenAddress];
    }
    
    /**
     * @notice Get token address for an asset
     * @param _assetId Asset ID
     * @return Token address
     */
    function getTokenForAsset(bytes32 _assetId) external view returns (address) {
        return assetToToken[_assetId];
    }
    
    /**
     * @notice Get compliance address for a token
     * @param _tokenAddress Token address
     * @return Compliance module address
     */
    function getComplianceForToken(address _tokenAddress) external view returns (address) {
        return tokenToCompliance[_tokenAddress];
    }
    
    /**
     * @notice Get all tokens deployed by an address
     * @param _deployer Deployer address
     * @return Array of token addresses
     */
    function getTokensByDeployer(address _deployer) external view returns (address[] memory) {
        return deployerTokens[_deployer];
    }
    
    /**
     * @notice Get total number of deployed tokens
     * @return Total count
     */
    function getTotalTokens() external view returns (uint256) {
        return allTokens.length;
    }
    
    /**
     * @notice Get paginated list of all tokens
     * @param _offset Starting index
     * @param _limit Number of tokens to return
     * @return tokens Array of token addresses
     * @return total Total number of tokens
     */
    function getAllTokens(
        uint256 _offset,
        uint256 _limit
    ) external view returns (address[] memory tokens, uint256 total) {
        total = allTokens.length;
        
        if (_offset >= total) {
            return (new address[](0), total);
        }
        
        uint256 end = _offset + _limit;
        if (end > total) {
            end = total;
        }
        
        tokens = new address[](end - _offset);
        for (uint256 i = _offset; i < end; i++) {
            tokens[i - _offset] = allTokens[i];
        }
    }
    
    /**
     * @notice Update registry addresses
     * @param _identityRegistry New identity registry
     * @param _assetRegistry New asset registry
     */
    function updateRegistries(
        address _identityRegistry,
        address _assetRegistry
    ) external onlyRole(FACTORY_ADMIN_ROLE) {
        require(_identityRegistry != address(0), "Invalid identity registry");
        require(_assetRegistry != address(0), "Invalid asset registry");
        
        identityRegistry = _identityRegistry;
        assetRegistry = _assetRegistry;
    }
    
    // Emergency functions
    function pause() external onlyRole(FACTORY_ADMIN_ROLE) {
        _pause();
    }
    
    function unpause() external onlyRole(FACTORY_ADMIN_ROLE) {
        _unpause();
    }
    
    // UUPS upgrade authorization
    function _authorizeUpgrade(address newImplementation) internal override onlyRole(UPGRADER_ROLE) {}
}