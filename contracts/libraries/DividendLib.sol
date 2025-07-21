// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title DividendLib
 * @notice Library for dividend calculation and management
 * @dev Extracts dividend logic to reduce main contract size
 */
library DividendLib {
    /**
     * @notice Calculate dividend amount for an investor
     * @param dividendAmount Total dividend amount
     * @param investorBalance Investor's balance at snapshot
     * @param totalSupply Total supply at snapshot
     * @return amount Calculated dividend amount
     */
    function calculateDividendAmount(
        uint256 dividendAmount,
        uint256 investorBalance,
        uint256 totalSupply
    ) internal pure returns (uint256) {
        if (totalSupply == 0 || investorBalance == 0) {
            return 0;
        }
        return (dividendAmount * investorBalance) / totalSupply;
    }
    
    /**
     * @notice Validate dividend claim parameters
     * @param dividendIndex The dividend ID
     * @param currentDividendIndex Current max dividend ID
     * @param alreadyClaimed Whether already claimed
     * @param minAmount Minimum expected amount
     * @param calculatedAmount Actual calculated amount
     */
    function validateClaim(
        uint256 dividendIndex,
        uint256 currentDividendIndex,
        bool alreadyClaimed,
        uint256 minAmount,
        uint256 calculatedAmount
    ) internal pure {
        require(dividendIndex > 0 && dividendIndex <= currentDividendIndex, "Invalid dividend");
        require(!alreadyClaimed, "Already claimed");
        require(minAmount > 0, "Min amount must be greater than 0");
        require(calculatedAmount >= minAmount, "Amount less than minimum");
    }
    
    /**
     * @notice Transfer ETH safely
     * @param recipient Address to send ETH to
     * @param amount Amount to send
     */
    function safeTransferETH(address recipient, uint256 amount) internal {
        (bool success, ) = payable(recipient).call{value: amount}("");
        require(success, "Transfer failed");
    }
}