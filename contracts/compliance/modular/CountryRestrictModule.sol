// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "./AbstractModule.sol";
import "../../identity/IIdentityRegistry.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

/**
 * @title CountryRestrictModule
 * @notice Module that restricts transfers based on investor countries
 */
contract CountryRestrictModule is AbstractModule, UUPSUpgradeable {
    mapping(uint16 => bool) public allowedCountries;
    mapping(uint16 => mapping(uint16 => bool)) public countryPairRestrictions;
    
    event CountryAllowed(uint16 indexed country, bool allowed);
    event CountryPairRestrictionSet(uint16 indexed fromCountry, uint16 indexed toCountry, bool restricted);
    
    function initialize(address _owner) public initializer {
        __Ownable_init();
        transferOwnership(_owner);
    }
    
    function name() external pure override returns (string memory) {
        return "CountryRestrictModule";
    }
    
    function setCountryAllowed(uint16 _country, bool _allowed) external onlyOwner {
        allowedCountries[_country] = _allowed;
        emit CountryAllowed(_country, _allowed);
    }
    
    function batchSetCountriesAllowed(uint16[] calldata _countries, bool[] calldata _allowed) external onlyOwner {
        require(_countries.length == _allowed.length, "Arrays length mismatch");
        
        for (uint256 i = 0; i < _countries.length; i++) {
            allowedCountries[_countries[i]] = _allowed[i];
            emit CountryAllowed(_countries[i], _allowed[i]);
        }
    }
    
    function setCountryPairRestriction(uint16 _fromCountry, uint16 _toCountry, bool _restricted) external onlyOwner {
        countryPairRestrictions[_fromCountry][_toCountry] = _restricted;
        emit CountryPairRestrictionSet(_fromCountry, _toCountry, _restricted);
    }
    
    function isTransferValid(
        address _from,
        address _to,
        uint256 /* _amount */
    ) external view override returns (bool) {
        IIdentityRegistry registry = token.identityRegistry();
        
        // Check if countries are allowed
        uint16 fromCountry = registry.investorCountry(_from);
        uint16 toCountry = registry.investorCountry(_to);
        
        if (fromCountry != 0 && !allowedCountries[fromCountry]) {
            return false;
        }
        
        if (toCountry != 0 && !allowedCountries[toCountry]) {
            return false;
        }
        
        // Check country pair restrictions
        if (countryPairRestrictions[fromCountry][toCountry]) {
            return false;
        }
        
        return true;
    }
    
    function canTransfer(
        address _from,
        address _to,
        uint256 _amount
    ) external view override returns (bool) {
        return this.isTransferValid(_from, _to, _amount);
    }
    
    function transferred(
        address /* _from */,
        address /* _to */,
        uint256 /* _amount */
    ) external override onlyCompliance {
        // No action needed for this module
    }
    
    function created(
        address /* _to */,
        uint256 /* _amount */
    ) external override onlyCompliance {
        // No action needed for this module
    }
    
    function destroyed(
        address /* _from */,
        uint256 /* _amount */
    ) external override onlyCompliance {
        // No action needed for this module
    }
    
    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}
}