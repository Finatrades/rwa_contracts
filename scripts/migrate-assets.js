const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

/**
 * Script to migrate assets from V1 to V2 system
 * Only run this if you have existing assets in the V1 contract
 */
async function main() {
    console.log("🔄 Migrating Assets from V1 to V2...\n");
    
    const [deployer] = await ethers.getSigners();
    console.log("Migrating with account:", deployer.address);
    
    // Load deployment
    const deployment = JSON.parse(
        fs.readFileSync(path.join(__dirname, "../deployments/polygon_mainnet_v2.json"), "utf8")
    );
    
    try {
        // Get V1 contract
        const tokenV1 = await ethers.getContractAt(
            "FinatradesRWA_ERC3643",
            deployment.contracts.FinatradesRWA_ERC3643
        );
        
        // Get V2 contracts
        const assetRegistry = await ethers.getContractAt(
            "AssetRegistry",
            deployment.v2Contracts.AssetRegistry
        );
        
        const tokenV2 = await ethers.getContractAt(
            "FinatradesRWA_ERC3643_V2",
            deployment.v2Contracts.FinatradesRWA_ERC3643_V2
        );
        
        // Check if there are any assets in V1
        const totalAssetsV1 = await tokenV1.totalAssets();
        console.log("Total assets in V1:", totalAssetsV1.toString());
        
        if (totalAssetsV1 == 0) {
            console.log("No assets to migrate!");
            return;
        }
        
        // Migrate each asset
        for (let i = 0; i < totalAssetsV1; i++) {
            const assetId = await tokenV1.assetIds(i);
            console.log(`\nMigrating asset ${i + 1}/${totalAssetsV1}: ${assetId}`);
            
            // Get asset data from V1
            const assetV1 = await tokenV1.assets(assetId);
            const rentalInfo = await tokenV1.rentalInfo(assetId);
            
            // Map old asset type to new category
            const categoryMap = {
                1: 1, // RESIDENTIAL -> REAL_ESTATE
                2: 1, // COMMERCIAL -> REAL_ESTATE
                3: 1, // INDUSTRIAL -> REAL_ESTATE
                4: 1, // AGRICULTURAL -> REAL_ESTATE
                5: 1  // MIXED_USE -> REAL_ESTATE
            };
            
            // Register in new registry
            await assetRegistry.registerAsset(
                assetId,
                `Migrated Asset ${i + 1}`, // You may want to improve naming
                categoryMap[assetV1.assetType] || 1,
                assetV1.valuationAmount,
                assetV1.ipfsHash,
                rentalInfo.rentCollector || ethers.ZeroAddress
            );
            
            // Set attributes
            await assetRegistry.setTextAttribute(assetId, "address", assetV1.assetAddress);
            await assetRegistry.setTextAttribute(assetId, "legalDescription", assetV1.legalDescription);
            await assetRegistry.setNumericAttribute(assetId, "yearBuilt", assetV1.yearBuilt);
            await assetRegistry.setNumericAttribute(assetId, "totalArea", assetV1.totalArea);
            
            // Set property type based on old asset type
            const propertyTypes = {
                1: "Residential",
                2: "Commercial", 
                3: "Industrial",
                4: "Agricultural",
                5: "Mixed Use"
            };
            await assetRegistry.setTextAttribute(
                assetId, 
                "propertyType", 
                propertyTypes[assetV1.assetType] || "Unknown"
            );
            
            // Create revenue stream if rental property
            if (rentalInfo.monthlyRent > 0) {
                await assetRegistry.createRevenueStream(
                    assetId,
                    rentalInfo.monthlyRent,
                    30 * 24 * 60 * 60, // Monthly
                    rentalInfo.rentCollector
                );
                
                // Set rental attributes
                await assetRegistry.setNumericAttribute(assetId, "monthlyRent", rentalInfo.monthlyRent);
                await assetRegistry.setNumericAttribute(assetId, "occupancyRate", rentalInfo.occupancyRate);
            }
            
            console.log(`✅ Asset ${assetId} migrated to V2`);
            
            // Note: Token balances need to be migrated separately
            // This would typically involve:
            // 1. Snapshot V1 balances
            // 2. Mint equivalent V2 tokens
            // 3. Possibly burn or lock V1 tokens
        }
        
        console.log("\n✅ Asset migration complete!");
        console.log("\n⚠️  IMPORTANT: Token balances have NOT been migrated");
        console.log("You need to:");
        console.log("1. Take a snapshot of V1 token holders");
        console.log("2. Mint equivalent V2 tokens to holders");
        console.log("3. Consider locking or pausing V1 contract");
        
    } catch (error) {
        console.error("\n❌ Migration failed:", error.message);
        throw error;
    }
}

// Handle errors
if (require.main === module) {
    main()
        .then(() => process.exit(0))
        .catch((error) => {
            console.error(error);
            process.exit(1);
        });
}

module.exports = { main };