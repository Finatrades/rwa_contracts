// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "./Token.sol";
import "../reporting/IRegulatoryReporting.sol";

/**
 * @title TokenWithReporting
 * @dev Extension of ERC-3643 Token with integrated regulatory reporting
 * @notice This contract adds reporting capabilities to the base Token implementation
 */
contract TokenWithReporting is Token {
    
    // Regulatory reporting contract
    IRegulatoryReporting public regulatoryReporting;
    
    // Events
    event RegulatoryReportingSet(address indexed reportingContract);
    event TransactionRecorded(address indexed from, address indexed to, uint256 amount, bool compliant);
    
    /**
     * @dev Set the regulatory reporting contract
     * @param _reportingContract Address of the regulatory reporting contract
     */
    function setRegulatoryReporting(address _reportingContract) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(_reportingContract != address(0), "Invalid reporting contract");
        regulatoryReporting = IRegulatoryReporting(_reportingContract);
        emit RegulatoryReportingSet(_reportingContract);
    }
    
    /**
     * @dev Override _beforeTokenTransfer to include reporting
     */
    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 amount
    ) internal virtual override {
        // Store compliance status before calling parent
        bool willBeCompliant = true;
        string memory violationReason = "";
        
        // Check if transfer will be compliant (without reverting)
        if (from != address(0) && to != address(0)) {
            if (isFrozen(from) || isFrozen(to)) {
                willBeCompliant = false;
                violationReason = "Address frozen";
            } else if (!identityRegistry().isVerified(from) || !identityRegistry().isVerified(to)) {
                willBeCompliant = false;
                violationReason = "Identity not verified";
            } else if (!compliance().canTransfer(from, to, amount)) {
                willBeCompliant = false;
                violationReason = "Compliance check failed";
            }
        }
        
        // Record violation if not compliant and reporting is enabled
        if (!willBeCompliant && address(regulatoryReporting) != address(0) && from != address(0)) {
            try regulatoryReporting.recordComplianceViolation(
                from,
                to,
                amount,
                violationReason,
                "Token Transfer"
            ) {} catch {}
        }
        
        // Call parent implementation (will revert if not compliant)
        super._beforeTokenTransfer(from, to, amount);
    }
    
    /**
     * @dev Override _afterTokenTransfer to record successful transactions
     */
    function _afterTokenTransfer(
        address from,
        address to,
        uint256 amount
    ) internal virtual override {
        super._afterTokenTransfer(from, to, amount);
        
        // Record successful transaction
        if (address(regulatoryReporting) != address(0) && from != address(0) && to != address(0)) {
            try regulatoryReporting.recordTransaction(
                from,
                to,
                amount,
                "", // Empty asset ID for general transfers
                true // Was compliant (since it succeeded)
            ) {} catch {
                // Don't revert on reporting failure
                emit TransactionRecorded(from, to, amount, false);
            }
        }
    }
    
    /**
     * @dev Get dividend info for reporting (placeholder for future implementation)
     */
    function getDividendInfo(uint256 _dividendIndex) external view returns (
        uint256 totalAmount,
        uint256 claimedAmount,
        uint256 claimDeadline,
        address dividendToken,
        uint256 snapshotId,
        uint256 totalRecipients
    ) {
        // This would be implemented in a dividend-enabled version
        return (0, 0, 0, address(0), 0, 0);
    }
}