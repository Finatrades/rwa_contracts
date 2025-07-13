// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title IModule
 * @notice Interface for individual compliance modules
 */
interface IModule {
    function name() external view returns (string memory);
    function isTransferValid(address _from, address _to, uint256 _amount) external view returns (bool);
    function canTransfer(address _from, address _to, uint256 _amount) external view returns (bool);
    function transferred(address _from, address _to, uint256 _amount) external;
    function created(address _to, uint256 _amount) external;
    function destroyed(address _from, uint256 _amount) external;
}