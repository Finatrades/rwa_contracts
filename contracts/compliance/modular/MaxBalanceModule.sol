// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "./AbstractModule.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

/**
 * @title MaxBalanceModule
 * @notice Module that enforces maximum balance restrictions per investor
 */
contract MaxBalanceModule is AbstractModule, UUPSUpgradeable {
    mapping(address => uint256) public maxBalances;
    uint256 public defaultMaxBalance;
    
    event MaxBalanceSet(address indexed investor, uint256 maxBalance);
    event DefaultMaxBalanceSet(uint256 maxBalance);
    
    function initialize(address _owner, uint256 _defaultMaxBalance) public initializer {
        __Ownable_init();
        transferOwnership(_owner);
        defaultMaxBalance = _defaultMaxBalance;
    }
    
    function name() external pure override returns (string memory) {
        return "MaxBalanceModule";
    }
    
    function setMaxBalance(address _investor, uint256 _maxBalance) external onlyOwner {
        maxBalances[_investor] = _maxBalance;
        emit MaxBalanceSet(_investor, _maxBalance);
    }
    
    function batchSetMaxBalance(address[] calldata _investors, uint256[] calldata _maxBalances) external onlyOwner {
        require(_investors.length == _maxBalances.length, "Arrays length mismatch");
        
        for (uint256 i = 0; i < _investors.length; i++) {
            maxBalances[_investors[i]] = _maxBalances[i];
            emit MaxBalanceSet(_investors[i], _maxBalances[i]);
        }
    }
    
    function setDefaultMaxBalance(uint256 _maxBalance) external onlyOwner {
        defaultMaxBalance = _maxBalance;
        emit DefaultMaxBalanceSet(_maxBalance);
    }
    
    function isTransferValid(
        address /* _from */,
        address _to,
        uint256 _amount
    ) external view override returns (bool) {
        uint256 maxBalance = _getMaxBalance(_to);
        
        if (maxBalance == 0) {
            return true; // No restriction
        }
        
        uint256 currentBalance = token.balanceOf(_to);
        return currentBalance + _amount <= maxBalance;
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
        address _to,
        uint256 _amount
    ) external view override onlyCompliance {
        uint256 maxBalance = _getMaxBalance(_to);
        
        if (maxBalance > 0) {
            uint256 currentBalance = token.balanceOf(_to);
            require(currentBalance + _amount <= maxBalance, "Exceeds max balance");
        }
    }
    
    function destroyed(
        address /* _from */,
        uint256 /* _amount */
    ) external override onlyCompliance {
        // No action needed for burning
    }
    
    function _getMaxBalance(address _investor) private view returns (uint256) {
        uint256 specificMax = maxBalances[_investor];
        return specificMax > 0 ? specificMax : defaultMaxBalance;
    }
    
    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}
}