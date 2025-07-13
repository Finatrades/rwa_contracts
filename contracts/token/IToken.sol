// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "../identity/IIdentityRegistry.sol";
import "../compliance/ICompliance.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";

/**
 * @title IToken
 * @notice Interface for ERC-3643 compliant security token
 */
interface IToken is IERC20Upgradeable {
    event IdentityRegistryAdded(address indexed identityRegistry);
    event ComplianceAdded(address indexed compliance);
    event RecoverySuccess(address indexed wallet, address indexed newWallet);
    event AddressFrozen(address indexed wallet, bool isFrozen);
    event TokensPaused(address indexed agent);
    event TokensUnpaused(address indexed agent);
    // Paused and Unpaused events are inherited from PausableUpgradeable
    
    function identityRegistry() external view returns (IIdentityRegistry);
    function compliance() external view returns (ICompliance);
    function paused() external view returns (bool);
    function isFrozen(address wallet) external view returns (bool);
    function getFrozenTokens(address wallet) external view returns (uint256);
    function decimals() external view returns (uint8);
    function name() external view returns (string memory);
    function symbol() external view returns (string memory);
    function version() external view returns (string memory);
    function onchainID() external view returns (address);
    
    function setIdentityRegistry(address _identityRegistry) external;
    function setCompliance(address _compliance) external;
    function setName(string calldata _name) external;
    function setSymbol(string calldata _symbol) external;
    function setOnchainID(address _onchainID) external;
    
    function pause() external;
    function unpause() external;
    function freezePartialTokens(address _userAddress, uint256 _amount) external;
    function unfreezePartialTokens(address _userAddress, uint256 _amount) external;
    function setAddressFrozen(address _userAddress, bool _freeze) external;
    function recoveryAddress(address _lostWallet, address _newWallet, address _investorOnchainID) external;
    
    function mint(address _to, uint256 _amount) external;
    function burn(address _from, uint256 _amount) external;
    function forcedTransfer(address _from, address _to, uint256 _amount) external returns (bool);
    function batchTransfer(address[] calldata _toList, uint256[] calldata _amounts) external;
    function batchForcedTransfer(address[] calldata _fromList, address[] calldata _toList, uint256[] calldata _amounts) external;
    function batchMint(address[] calldata _toList, uint256[] calldata _amounts) external;
    function batchBurn(address[] calldata _fromList, uint256[] calldata _amounts) external;
    function batchSetAddressFrozen(address[] calldata _userAddresses, bool[] calldata _freeze) external;
    function batchFreezePartialTokens(address[] calldata _userAddresses, uint256[] calldata _amounts) external;
    function batchUnfreezePartialTokens(address[] calldata _userAddresses, uint256[] calldata _amounts) external;
}