// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/governance/TimelockController.sol";

/**
 * @title FinatradesTimelock
 * @notice Custom timelock controller for Finatrades RWA governance
 * @dev Extends OpenZeppelin's TimelockController with additional safety features
 */
contract FinatradesTimelock is TimelockController {
    // Events
    event TimelockDeployment(
        uint256 minDelay,
        address[] proposers,
        address[] executors,
        address admin
    );

    /**
     * @dev Initializes the timelock with a given minimum delay and roles
     * @param minDelay Initial minimum delay for operations
     * @param proposers Accounts to be granted proposer role
     * @param executors Accounts to be granted executor role
     * @param admin Optional admin account (0 = self-administration)
     */
    constructor(
        uint256 minDelay,
        address[] memory proposers,
        address[] memory executors,
        address admin
    ) TimelockController(minDelay, proposers, executors, admin) {
        require(minDelay >= 2 days, "Delay too short");
        require(proposers.length >= 2, "Need at least 2 proposers");
        require(executors.length >= 1, "Need at least 1 executor");
        
        emit TimelockDeployment(minDelay, proposers, executors, admin);
    }
}