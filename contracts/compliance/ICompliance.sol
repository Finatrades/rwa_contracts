// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title ICompliance
 * @notice Interface for compliance modules in ERC-3643
 */
interface ICompliance {
    event TokenBound(address indexed _token);
    event TokenUnbound(address indexed _token);
    
    function bindToken(address _token) external;
    function unbindToken(address _token) external;
    function isTransferValid(address _from, address _to, uint256 _amount) external view returns (bool);
    function transferred(address _from, address _to, uint256 _amount) external;
    function created(address _to, uint256 _amount) external;
    function destroyed(address _from, uint256 _amount) external;
    function canTransfer(address _from, address _to, uint256 _amount) external view returns (bool);
}