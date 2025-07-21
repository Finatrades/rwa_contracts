// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title BatchOperationsLib
 * @notice Library for batch operation validations and utilities
 * @dev Helps reduce main contract size by extracting common batch logic
 */
library BatchOperationsLib {
    uint256 public constant MAX_BATCH_SIZE = 100;
    
    /**
     * @notice Validate batch operation arrays
     * @param array1Length Length of first array
     * @param array2Length Length of second array
     */
    function validateBatchArrays(uint256 array1Length, uint256 array2Length) internal pure {
        require(array1Length == array2Length, "Arrays length mismatch");
        require(array1Length <= MAX_BATCH_SIZE, "Batch size too large");
    }
    
    /**
     * @notice Validate batch operation arrays (3 arrays)
     * @param array1Length Length of first array
     * @param array2Length Length of second array
     * @param array3Length Length of third array
     */
    function validateBatchArrays3(
        uint256 array1Length, 
        uint256 array2Length, 
        uint256 array3Length
    ) internal pure {
        require(
            array1Length == array2Length && array1Length == array3Length, 
            "Arrays length mismatch"
        );
        require(array1Length <= MAX_BATCH_SIZE, "Batch size too large");
    }
    
    /**
     * @notice Validate address is not zero
     * @param addr Address to validate
     * @param errorMessage Error message if validation fails
     */
    function validateAddress(address addr, string memory errorMessage) internal pure {
        require(addr != address(0), errorMessage);
    }
    
    /**
     * @notice Validate amount is greater than zero
     * @param amount Amount to validate
     */
    function validateAmount(uint256 amount) internal pure {
        require(amount > 0, "Amount must be greater than 0");
    }
}