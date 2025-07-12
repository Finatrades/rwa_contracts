// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title PropertyLib
 * @notice Library for property management functions
 */
library PropertyLib {
    enum PropertyType { NONE, RESIDENTIAL, COMMERCIAL, INDUSTRIAL, AGRICULTURAL, MIXED_USE }
    enum PropertyStatus { NONE, ACTIVE, UNDER_MANAGEMENT, FOR_SALE, SOLD, DEFAULTED }
    
    struct Property {
        PropertyType propertyType;
        string propertyAddress;
        string legalDescription;
        uint256 valuationAmount;
        uint256 valuationDate;
        uint256 yearBuilt;
        uint256 totalArea;
        PropertyStatus propertyStatus;
        string ipfsHash;
    }
    
    struct RentalInfo {
        uint256 monthlyRent;
        uint256 lastRentCollection;
        uint256 totalRentCollected;
        uint256 occupancyRate;
        address rentCollector;
    }
    
    event PropertyAdded(bytes32 indexed propertyId, PropertyType propertyType, uint256 valuationAmount);
    event PropertyValuationUpdated(bytes32 indexed propertyId, uint256 oldValuation, uint256 newValuation);
    event PropertyStatusChanged(bytes32 indexed propertyId, PropertyStatus oldStatus, PropertyStatus newStatus);
    event RentalIncomeDeposited(bytes32 indexed propertyId, uint256 amount, uint256 timestamp);
    
    function validateProperty(Property memory property) internal pure {
        require(property.propertyType != PropertyType.NONE, "Invalid property type");
        require(bytes(property.propertyAddress).length > 0, "Property address required");
        require(property.valuationAmount > 0, "Invalid valuation amount");
        require(property.yearBuilt > 1800 && property.yearBuilt <= 2100, "Invalid year built");
        require(property.totalArea > 0, "Invalid total area");
    }
    
    function updateValuation(
        Property storage property,
        uint256 newValuation
    ) internal returns (uint256 oldValuation) {
        require(newValuation > 0, "Invalid valuation amount");
        oldValuation = property.valuationAmount;
        property.valuationAmount = newValuation;
        property.valuationDate = block.timestamp;
    }
    
    function updateStatus(
        Property storage property,
        PropertyStatus newStatus
    ) internal returns (PropertyStatus oldStatus) {
        require(newStatus != PropertyStatus.NONE, "Invalid status");
        oldStatus = property.propertyStatus;
        property.propertyStatus = newStatus;
    }
    
    function recordRent(
        RentalInfo storage rental,
        uint256 amount
    ) internal {
        require(amount > 0, "Invalid rent amount");
        rental.totalRentCollected += amount;
        rental.lastRentCollection = block.timestamp;
    }
}