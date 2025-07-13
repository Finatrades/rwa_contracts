// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "./IIdentity.sol";

/**
 * @title IIdentityRegistry
 * @notice Interface for the Identity Registry contract in ERC-3643
 */
interface IIdentityRegistry {
    event IdentityRegistered(address indexed investorAddress, IIdentity indexed identity);
    event IdentityRemoved(address indexed investorAddress, IIdentity indexed identity);
    event IdentityUpdated(address indexed investorAddress, IIdentity indexed oldIdentity, IIdentity indexed newIdentity);
    event CountryUpdated(address indexed investorAddress, uint16 indexed country);
    event IdentityRegistryBound(address indexed _identityRegistry);
    event IdentityRegistryUnbound(address indexed _identityRegistry);
    
    function registerIdentity(address _userAddress, IIdentity _identity, uint16 _country) external;
    function deleteIdentity(address _userAddress) external;
    function updateIdentity(address _userAddress, IIdentity _identity) external;
    function updateCountry(address _userAddress, uint16 _country) external;
    function batchRegisterIdentity(address[] calldata _userAddresses, IIdentity[] calldata _identities, uint16[] calldata _countries) external;
    function contains(address _userAddress) external view returns (bool);
    function identity(address _userAddress) external view returns (IIdentity);
    function investorCountry(address _userAddress) external view returns (uint16);
    function isVerified(address _userAddress) external view returns (bool);
    function getInvestorsList() external view returns (address[] memory);
}