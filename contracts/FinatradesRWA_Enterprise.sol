// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "./FinatradesRWA_Extended.sol";
import "./reporting/IRegulatoryReporting.sol";

/**
 * @title FinatradesRWA_Enterprise
 * @author Finatrades
 * @notice Enterprise-grade ERC-3643 security token with integrated regulatory reporting
 * @dev Complete RWA tokenization solution with automated compliance and reporting
 * 
 * @custom:security-contact security@finatrades.com
 * 
 * This enterprise contract provides:
 * - All features from FinatradesRWA_Extended
 * - Integrated regulatory reporting system
 * - Automated transaction recording
 * - Compliance violation tracking
 * - Real-time reporting capabilities
 * - Audit trail generation
 * 
 * Designed for institutional use cases requiring:
 * - Regulatory compliance reporting
 * - Detailed transaction analytics
 * - Automated audit trails
 * - Compliance monitoring
 * 
 * Optimized for Polygon deployment with no size constraints.
 * Perfect for institutional RWA tokenization with full compliance.
 */
contract FinatradesRWA_Enterprise is FinatradesRWA_Extended {
    
    // Regulatory reporting contract
    IRegulatoryReporting public regulatoryReporting;
    
    // Events
    event RegulatoryReportingSet(address indexed reportingContract);
    
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
            ) {} catch {}
        }
    }
    
    /**
     * @dev Enhanced transferWithAsset to include reporting
     */
    function transferWithAsset(
        address to,
        uint256 amount,
        bytes32 assetId
    ) external virtual override returns (bool) {
        // Execute transfer using external call to avoid super issues
        bool success = this.transferWithAsset(to, amount, assetId);
        
        // Check if we're in a recursive call
        if (success && msg.sender == address(this)) {
            return true; // Avoid double reporting
        }
        
        // Record asset-specific transaction
        if (success && address(regulatoryReporting) != address(0)) {
            try regulatoryReporting.recordTransaction(
                msg.sender,
                to,
                amount,
                _bytes32ToString(assetId),
                true
            ) {} catch {}
        }
        
        return success;
    }
    
    /**
     * @dev Get dividend info for reporting
     */
    function getDividendInfo(uint256 _dividendIndex) external view returns (
        uint256 totalAmount,
        uint256 claimedAmount,
        uint256 claimDeadline,
        address dividendToken,
        uint256 snapshotId,
        uint256 totalRecipients
    ) {
        require(_dividendIndex > 0 && _dividendIndex <= dividendIndex, "Invalid dividend index");
        
        totalAmount = dividendAmounts[_dividendIndex];
        claimDeadline = block.timestamp + 365 days; // Approximation
        dividendToken = address(0); // ETH
        snapshotId = dividendSnapshots[_dividendIndex];
        
        // Calculate recipients (simplified)
        uint256 totalSupplyAtSnapshot = totalSupplyAt(snapshotId);
        if (totalSupplyAtSnapshot > 0) {
            claimedAmount = 0; // Would need to track actual claims
            totalRecipients = _countHoldersAtSnapshot(snapshotId);
        }
    }
    
    /**
     * @dev Count holders at a specific snapshot
     */
    function _countHoldersAtSnapshot(uint256 snapshotId) internal view returns (uint256) {
        uint256 holders = 0;
        address[] memory investors = identityRegistry().getInvestorsList();
        
        for (uint256 i = 0; i < investors.length; i++) {
            if (balanceOfAt(investors[i], snapshotId) > 0) {
                holders++;
            }
        }
        
        return holders;
    }
    
    /**
     * @dev Convert bytes32 to string
     */
    function _bytes32ToString(bytes32 _bytes32) internal pure returns (string memory) {
        uint8 i = 0;
        while(i < 32 && _bytes32[i] != 0) {
            i++;
        }
        bytes memory bytesArray = new bytes(i);
        for (i = 0; i < 32 && _bytes32[i] != 0; i++) {
            bytesArray[i] = _bytes32[i];
        }
        return string(bytesArray);
    }
}