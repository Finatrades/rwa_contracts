// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title UniversalAssetLib
 * @notice Library for managing ANY type of real-world asset
 * @dev Flexible structure supports real estate, gold, crypto, IP, art, commodities, etc.
 */
library UniversalAssetLib {
    // Asset categories covering all major RWA types
    enum AssetCategory { 
        NONE,
        REAL_ESTATE,          // Properties, land, buildings
        PRECIOUS_METALS,      // Gold, silver, platinum
        CRYPTOCURRENCY,       // Wrapped crypto assets
        ART_COLLECTIBLES,     // Art, NFTs, collectibles
        INTELLECTUAL_PROPERTY,// Patents, trademarks, copyrights
        EQUITY,              // Company shares, ownership stakes
        DEBT_INSTRUMENTS,    // Bonds, loans, receivables
        COMMODITIES,         // Oil, gas, agricultural products
        CARBON_CREDITS,      // Environmental credits
        LUXURY_GOODS,        // Watches, jewelry, vehicles
        FINANCIAL_INSTRUMENTS,// Derivatives, structured products
        INFRASTRUCTURE,      // Toll roads, utilities, energy projects
        OTHER               // Catch-all for new asset types
    }
    
    enum AssetStatus { 
        NONE,
        ACTIVE,              // Currently operational/held
        PENDING_VERIFICATION,// Awaiting audit/verification
        LOCKED,              // Temporarily restricted
        UNDER_MANAGEMENT,    // Being actively managed
        FOR_SALE,           // Listed for sale
        SOLD,               // Ownership transferred
        MATURED,            // For time-bound assets
        DEFAULTED,          // For debt/financial instruments
        RETIRED             // No longer active
    }

    // Core asset structure - minimal and flexible
    struct Asset {
        string name;                    // Human-readable name
        AssetCategory category;         // Asset type
        AssetStatus status;            // Current status
        uint256 valuationAmount;       // Current value in base currency
        uint256 valuationDate;         // When last valued
        string metadataURI;            // IPFS/external metadata link
        address custodian;             // Physical custodian if applicable
        uint256 createdAt;             // Creation timestamp
        uint256 lastUpdated;           // Last update timestamp
    }

    // Flexible attributes stored separately to avoid stack too deep
    struct AssetAttributes {
        mapping(string => string) textAttributes;      // e.g., "location" => "Singapore"
        mapping(string => uint256) numericAttributes; // e.g., "weight" => 1000 (grams)
        mapping(string => bool) booleanAttributes;    // e.g., "insured" => true
        mapping(string => address) addressAttributes; // e.g., "auditor" => 0x...
    }

    // Revenue/income information for yield-generating assets
    struct RevenueStream {
        uint256 amount;              // Revenue amount
        uint256 frequency;           // Payment frequency in seconds (0 for one-time)
        uint256 lastDistribution;    // Last distribution timestamp
        uint256 totalDistributed;    // Total distributed to date
        address revenueCollector;    // Who collects the revenue
        bool isActive;              // Whether revenue stream is active
    }

    // Events
    event AssetCreated(
        bytes32 indexed assetId,
        string name,
        AssetCategory indexed category,
        uint256 valuationAmount
    );
    
    event AssetValuationUpdated(
        bytes32 indexed assetId,
        uint256 oldValuation,
        uint256 newValuation,
        string valuationSource
    );
    
    event AssetStatusChanged(
        bytes32 indexed assetId,
        AssetStatus indexed oldStatus,
        AssetStatus indexed newStatus
    );
    
    event AssetAttributeSet(
        bytes32 indexed assetId,
        string key,
        string attributeType // "text", "numeric", "boolean", "address"
    );
    
    event RevenueStreamUpdated(
        bytes32 indexed assetId,
        uint256 amount,
        uint256 frequency
    );

    // Validation functions
    function validateAsset(Asset memory asset) internal pure {
        require(bytes(asset.name).length > 0, "Asset name required");
        require(asset.category != AssetCategory.NONE, "Invalid asset category");
        require(asset.valuationAmount > 0, "Invalid valuation amount");
    }

    // Helper functions for common asset attributes by category
    function getRealEstateAttributes() internal pure returns (string[] memory required, string[] memory optional) {
        required = new string[](3);
        required[0] = "address";
        required[1] = "legalDescription";
        required[2] = "titleDeed";
        
        optional = new string[](5);
        optional[0] = "yearBuilt";
        optional[1] = "totalArea";
        optional[2] = "zoning";
        optional[3] = "tenancy";
        optional[4] = "propertyType";
    }

    function getPreciousMetalAttributes() internal pure returns (string[] memory required, string[] memory optional) {
        required = new string[](4);
        required[0] = "metalType";
        required[1] = "weight";
        required[2] = "purity";
        required[3] = "storageLocation";
        
        optional = new string[](3);
        optional[0] = "serialNumber";
        optional[1] = "assayCertificate";
        optional[2] = "insurance";
    }

    function getCryptoAttributes() internal pure returns (string[] memory required, string[] memory optional) {
        required = new string[](3);
        required[0] = "blockchain";
        required[1] = "contractAddress";
        required[2] = "amount";
        
        optional = new string[](2);
        optional[0] = "lockPeriod";
        optional[1] = "yieldProtocol";
    }

    function getArtCollectibleAttributes() internal pure returns (string[] memory required, string[] memory optional) {
        required = new string[](3);
        required[0] = "artist";
        required[1] = "provenance";
        required[2] = "condition";
        
        optional = new string[](4);
        optional[0] = "yearCreated";
        optional[1] = "medium";
        optional[2] = "dimensions";
        optional[3] = "exhibition";
    }

    function getIPAttributes() internal pure returns (string[] memory required, string[] memory optional) {
        required = new string[](3);
        required[0] = "ipType"; // patent, trademark, copyright
        required[1] = "registrationNumber";
        required[2] = "jurisdiction";
        
        optional = new string[](3);
        optional[0] = "expiryDate";
        optional[1] = "royaltyRate";
        optional[2] = "licensees";
    }

    // Valuation update with source tracking
    function updateValuation(
        Asset storage asset,
        uint256 newValuation,
        string memory source
    ) internal returns (uint256 oldValuation) {
        require(newValuation > 0, "Invalid valuation amount");
        oldValuation = asset.valuationAmount;
        asset.valuationAmount = newValuation;
        asset.valuationDate = block.timestamp;
        asset.lastUpdated = block.timestamp;
    }

    // Status management
    function updateStatus(
        Asset storage asset,
        AssetStatus newStatus
    ) internal returns (AssetStatus oldStatus) {
        require(newStatus != AssetStatus.NONE, "Invalid status");
        oldStatus = asset.status;
        asset.status = newStatus;
        asset.lastUpdated = block.timestamp;
    }

    // Revenue recording for income-generating assets
    function recordRevenue(
        RevenueStream storage revenue,
        uint256 amount
    ) internal {
        require(amount > 0, "Invalid revenue amount");
        require(revenue.isActive, "Revenue stream not active");
        revenue.totalDistributed += amount;
        revenue.lastDistribution = block.timestamp;
    }
}