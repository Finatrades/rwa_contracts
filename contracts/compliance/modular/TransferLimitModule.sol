// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "./AbstractModule.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

/**
 * @title TransferLimitModule
 * @notice Module that enforces daily transfer limits per investor
 */
contract TransferLimitModule is AbstractModule, UUPSUpgradeable {
    struct TransferLimit {
        uint256 dailyLimit;
        uint256 monthlyLimit;
        uint256 lastDayReset;
        uint256 lastMonthReset;
        uint256 dailyTransferred;
        uint256 monthlyTransferred;
    }
    
    mapping(address => TransferLimit) public transferLimits;
    uint256 public defaultDailyLimit;
    uint256 public defaultMonthlyLimit;
    
    event LimitSet(address indexed investor, uint256 dailyLimit, uint256 monthlyLimit);
    event DefaultLimitsSet(uint256 dailyLimit, uint256 monthlyLimit);
    
    function initialize(address _owner, uint256 _defaultDailyLimit, uint256 _defaultMonthlyLimit) public initializer {
        __Ownable_init();
        transferOwnership(_owner);
        defaultDailyLimit = _defaultDailyLimit;
        defaultMonthlyLimit = _defaultMonthlyLimit;
    }
    
    function name() external pure override returns (string memory) {
        return "TransferLimitModule";
    }
    
    function setTransferLimit(address _investor, uint256 _dailyLimit, uint256 _monthlyLimit) external onlyOwner {
        transferLimits[_investor].dailyLimit = _dailyLimit;
        transferLimits[_investor].monthlyLimit = _monthlyLimit;
        emit LimitSet(_investor, _dailyLimit, _monthlyLimit);
    }
    
    function setDefaultLimits(uint256 _dailyLimit, uint256 _monthlyLimit) external onlyOwner {
        defaultDailyLimit = _dailyLimit;
        defaultMonthlyLimit = _monthlyLimit;
        emit DefaultLimitsSet(_dailyLimit, _monthlyLimit);
    }
    
    function isTransferValid(
        address _from,
        address /* _to */,
        uint256 _amount
    ) external view override returns (bool) {
        TransferLimit memory limit = _getLimit(_from);
        
        uint256 newDailyAmount = _getDailyTransferred(_from) + _amount;
        uint256 newMonthlyAmount = _getMonthlyTransferred(_from) + _amount;
        
        if (limit.dailyLimit > 0 && newDailyAmount > limit.dailyLimit) {
            return false;
        }
        
        if (limit.monthlyLimit > 0 && newMonthlyAmount > limit.monthlyLimit) {
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
        address _from,
        address /* _to */,
        uint256 _amount
    ) external override onlyCompliance {
        _updateTransferredAmount(_from, _amount);
    }
    
    function created(
        address /* _to */,
        uint256 /* _amount */
    ) external override onlyCompliance {
        // No action needed for minting
    }
    
    function destroyed(
        address /* _from */,
        uint256 /* _amount */
    ) external override onlyCompliance {
        // No action needed for burning
    }
    
    function _getLimit(address _investor) private view returns (TransferLimit memory) {
        TransferLimit memory limit = transferLimits[_investor];
        
        if (limit.dailyLimit == 0 && limit.monthlyLimit == 0) {
            limit.dailyLimit = defaultDailyLimit;
            limit.monthlyLimit = defaultMonthlyLimit;
        }
        
        return limit;
    }
    
    function _getDailyTransferred(address _investor) private view returns (uint256) {
        TransferLimit memory limit = transferLimits[_investor];
        
        if (block.timestamp >= limit.lastDayReset + 1 days) {
            return 0;
        }
        
        return limit.dailyTransferred;
    }
    
    function _getMonthlyTransferred(address _investor) private view returns (uint256) {
        TransferLimit memory limit = transferLimits[_investor];
        
        if (block.timestamp >= limit.lastMonthReset + 30 days) {
            return 0;
        }
        
        return limit.monthlyTransferred;
    }
    
    function _updateTransferredAmount(address _investor, uint256 _amount) private {
        TransferLimit storage limit = transferLimits[_investor];
        
        // Reset daily counter if needed
        if (block.timestamp >= limit.lastDayReset + 1 days) {
            limit.dailyTransferred = 0;
            limit.lastDayReset = block.timestamp;
        }
        
        // Reset monthly counter if needed
        if (block.timestamp >= limit.lastMonthReset + 30 days) {
            limit.monthlyTransferred = 0;
            limit.lastMonthReset = block.timestamp;
        }
        
        limit.dailyTransferred += _amount;
        limit.monthlyTransferred += _amount;
    }
    
    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}
}