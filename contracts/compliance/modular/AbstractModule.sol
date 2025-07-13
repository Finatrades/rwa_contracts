// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "./IModule.sol";
import "../../token/IToken.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

/**
 * @title AbstractModule
 * @notice Base contract for compliance modules
 */
abstract contract AbstractModule is IModule, OwnableUpgradeable {
    IToken public token;
    
    modifier onlyCompliance() {
        require(msg.sender == address(token.compliance()), "Only compliance can call");
        _;
    }
    
    function bindCompliance(address _compliance) external {
        require(address(token) == address(0), "Already bound");
        token = IToken(msg.sender);
        require(address(token.compliance()) == _compliance, "Invalid compliance");
    }
    
    function unbindCompliance() external {
        require(msg.sender == address(token.compliance()), "Only compliance can unbind");
        token = IToken(address(0));
    }
}