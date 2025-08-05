// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title ITokenFactory
 * @notice Interface for the TokenFactory contract
 */
interface ITokenFactory {
    enum TokenType { ERC20, ERC721 }
    
    struct TokenDeployment {
        address tokenAddress;
        TokenType tokenType;
        string name;
        string symbol;
        address deployer;
        uint256 deployedAt;
        bytes32 assetId;
        bool isActive;
    }
    
    event TokenDeployed(
        address indexed tokenAddress,
        TokenType indexed tokenType,
        string name,
        string symbol,
        address indexed deployer,
        bytes32 assetId
    );
    
    event TokenImplementationUpdated(
        TokenType tokenType,
        address oldImplementation,
        address newImplementation
    );
    
    event TokenDeactivated(address indexed tokenAddress);
    event TokenReactivated(address indexed tokenAddress);
    
    function deployToken(
        TokenType _tokenType,
        string memory _name,
        string memory _symbol,
        bytes32 _assetId,
        address _tokenAdmin
    ) external returns (address tokenAddress);
    
    function updateImplementation(TokenType _tokenType, address _newImplementation) external;
    
    function deactivateToken(address _tokenAddress) external;
    
    function reactivateToken(address _tokenAddress) external;
    
    function getTokenInfo(address _tokenAddress) external view returns (TokenDeployment memory);
    
    function getTokenForAsset(bytes32 _assetId) external view returns (address);
    
    function getTokensByDeployer(address _deployer) external view returns (address[] memory);
    
    function getTotalTokens() external view returns (uint256);
    
    function getAllTokens(uint256 _offset, uint256 _limit) external view returns (address[] memory tokens, uint256 total);
}