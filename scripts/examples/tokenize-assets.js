const { ethers } = require("hardhat");

/**
 * Examples of tokenizing different types of real-world assets
 */

async function main() {
    const [deployer] = await ethers.getSigners();
    console.log("Asset tokenization examples by:", deployer.address);
    
    // Get deployed contracts
    const assetRegistry = await ethers.getContractAt(
        "AssetRegistry",
        "0x[REGISTRY_ADDRESS]" // Deploy and add address
    );
    
    const token = await ethers.getContractAt(
        "FinatradesRWA_ERC3643_V2",
        "0x[TOKEN_ADDRESS]" // Deploy and add address
    );
    
    // ========== Example 1: Tokenize Gold ==========
    console.log("\n1. Tokenizing Gold Bars...");
    
    const goldAssetId = ethers.keccak256(ethers.toUtf8Bytes("GOLD-BAR-2024-001"));
    
    // Register gold asset
    await assetRegistry.registerAsset(
        goldAssetId,
        "1kg Gold Bar - LBMA Certified",
        2, // PRECIOUS_METALS category
        65000 * 10**6, // $65,000 in 6 decimals
        "ipfs://QmGoldBarCertificate123",
        "0x[CUSTODIAN_ADDRESS]" // Brinks vault address
    );
    
    // Set gold-specific attributes
    await assetRegistry.setTextAttribute(goldAssetId, "metalType", "Gold");
    await assetRegistry.setNumericAttribute(goldAssetId, "weight", 1000); // grams
    await assetRegistry.setNumericAttribute(goldAssetId, "purity", 9999); // 99.99%
    await assetRegistry.setTextAttribute(goldAssetId, "storageLocation", "Brinks Singapore Vault");
    await assetRegistry.setTextAttribute(goldAssetId, "serialNumber", "LBMA-2024-001");
    await assetRegistry.setBooleanAttribute(goldAssetId, "insured", true);
    
    // Tokenize: 1000 tokens = 1kg gold (1 token = 1 gram)
    await token.tokenizeAsset(goldAssetId, ethers.parseEther("1000"), deployer.address);
    console.log("✅ Tokenized 1kg gold as 1000 FRWA tokens");
    
    // ========== Example 2: Tokenize Real Estate ==========
    console.log("\n2. Tokenizing Commercial Property...");
    
    const propertyAssetId = ethers.keccak256(ethers.toUtf8Bytes("PROPERTY-NYC-2024-001"));
    
    await assetRegistry.registerAsset(
        propertyAssetId,
        "Manhattan Office Building - 42nd Street",
        1, // REAL_ESTATE category
        50000000 * 10**6, // $50M
        "ipfs://QmPropertyDeed123",
        "0x[PROPERTY_MANAGER]"
    );
    
    // Set property attributes
    await assetRegistry.setTextAttribute(propertyAssetId, "address", "123 42nd St, NYC");
    await assetRegistry.setTextAttribute(propertyAssetId, "legalDescription", "Lot 42, Block 123");
    await assetRegistry.setNumericAttribute(propertyAssetId, "yearBuilt", 2010);
    await assetRegistry.setNumericAttribute(propertyAssetId, "totalArea", 50000); // sq ft
    await assetRegistry.setTextAttribute(propertyAssetId, "propertyType", "Commercial Office");
    
    // Create rental income stream
    await assetRegistry.createRevenueStream(
        propertyAssetId,
        250000 * 10**6, // $250k monthly rent
        30 * 24 * 60 * 60, // Monthly frequency
        "0x[RENT_COLLECTOR]"
    );
    
    // Tokenize: 1M tokens for $50M property
    await token.tokenizeAsset(propertyAssetId, ethers.parseEther("1000000"), deployer.address);
    console.log("✅ Tokenized $50M property as 1M FRWA tokens");
    
    // ========== Example 3: Tokenize Wrapped Bitcoin ==========
    console.log("\n3. Tokenizing Wrapped Bitcoin...");
    
    const btcAssetId = ethers.keccak256(ethers.toUtf8Bytes("WBTC-2024-001"));
    
    await assetRegistry.registerAsset(
        btcAssetId,
        "Wrapped Bitcoin Reserve",
        3, // CRYPTOCURRENCY category
        650000 * 10**6, // 10 BTC at $65k each
        "ipfs://QmBTCReserveProof",
        "0x[MULTISIG_CUSTODIAN]"
    );
    
    // Set crypto attributes
    await assetRegistry.setTextAttribute(btcAssetId, "blockchain", "Bitcoin");
    await assetRegistry.setTextAttribute(btcAssetId, "wrappingProtocol", "WBTC");
    await assetRegistry.setNumericAttribute(btcAssetId, "amount", 10 * 10**8); // 10 BTC in sats
    await assetRegistry.setAddressAttribute(btcAssetId, "btcAddress", "bc1q...");
    await assetRegistry.setAddressAttribute(btcAssetId, "wbtcContract", "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599");
    
    // Tokenize: 10,000 tokens for 10 BTC (1000 tokens per BTC)
    await token.tokenizeAsset(btcAssetId, ethers.parseEther("10000"), deployer.address);
    console.log("✅ Tokenized 10 BTC as 10,000 FRWA tokens");
    
    // ========== Example 4: Tokenize Art Collection ==========
    console.log("\n4. Tokenizing Art Collection...");
    
    const artAssetId = ethers.keccak256(ethers.toUtf8Bytes("ART-PICASSO-2024-001"));
    
    await assetRegistry.registerAsset(
        artAssetId,
        "Picasso - Blue Period Collection",
        4, // ART_COLLECTIBLES category
        25000000 * 10**6, // $25M
        "ipfs://QmArtProvenance",
        "0x[MUSEUM_CUSTODIAN]"
    );
    
    // Set art attributes
    await assetRegistry.setTextAttribute(artAssetId, "artist", "Pablo Picasso");
    await assetRegistry.setTextAttribute(artAssetId, "provenance", "Christie's Auction 2020");
    await assetRegistry.setTextAttribute(artAssetId, "condition", "Excellent");
    await assetRegistry.setNumericAttribute(artAssetId, "yearCreated", 1903);
    await assetRegistry.setTextAttribute(artAssetId, "medium", "Oil on Canvas");
    await assetRegistry.setBooleanAttribute(artAssetId, "authenticated", true);
    
    // Tokenize: 25,000 tokens for fractional ownership
    await token.tokenizeAsset(artAssetId, ethers.parseEther("25000"), deployer.address);
    console.log("✅ Tokenized $25M art collection as 25,000 FRWA tokens");
    
    // ========== Example 5: Tokenize Patent/IP ==========
    console.log("\n5. Tokenizing Intellectual Property...");
    
    const patentAssetId = ethers.keccak256(ethers.toUtf8Bytes("PATENT-US-2024-001"));
    
    await assetRegistry.registerAsset(
        patentAssetId,
        "AI Drug Discovery Patent Portfolio",
        5, // INTELLECTUAL_PROPERTY category
        10000000 * 10**6, // $10M valuation
        "ipfs://QmPatentDocuments",
        deployer.address // Owner as custodian
    );
    
    // Set IP attributes
    await assetRegistry.setTextAttribute(patentAssetId, "ipType", "Patent");
    await assetRegistry.setTextAttribute(patentAssetId, "registrationNumber", "US10,123,456");
    await assetRegistry.setTextAttribute(patentAssetId, "jurisdiction", "United States");
    await assetRegistry.setNumericAttribute(patentAssetId, "expiryDate", 1893456000); // 2030
    await assetRegistry.setNumericAttribute(patentAssetId, "royaltyRate", 500); // 5%
    
    // Create royalty revenue stream
    await assetRegistry.createRevenueStream(
        patentAssetId,
        50000 * 10**6, // $50k monthly royalties
        30 * 24 * 60 * 60, // Monthly
        deployer.address
    );
    
    // Tokenize: 10,000 tokens for IP ownership
    await token.tokenizeAsset(patentAssetId, ethers.parseEther("10000"), deployer.address);
    console.log("✅ Tokenized patent portfolio as 10,000 FRWA tokens");
    
    // ========== Example 6: Tokenize Carbon Credits ==========
    console.log("\n6. Tokenizing Carbon Credits...");
    
    const carbonAssetId = ethers.keccak256(ethers.toUtf8Bytes("CARBON-VERRA-2024-001"));
    
    await assetRegistry.registerAsset(
        carbonAssetId,
        "Amazon Rainforest Protection Credits",
        9, // CARBON_CREDITS category
        1000000 * 10**6, // $1M for 10,000 tonnes
        "ipfs://QmCarbonRegistry",
        "0x[VERRA_REGISTRY]"
    );
    
    // Set carbon credit attributes
    await assetRegistry.setTextAttribute(carbonAssetId, "registry", "Verra");
    await assetRegistry.setTextAttribute(carbonAssetId, "projectType", "REDD+");
    await assetRegistry.setNumericAttribute(carbonAssetId, "vintage", 2024);
    await assetRegistry.setNumericAttribute(carbonAssetId, "tonnes", 10000);
    await assetRegistry.setTextAttribute(carbonAssetId, "location", "Brazil - Acre State");
    await assetRegistry.setBooleanAttribute(carbonAssetId, "retired", false);
    
    // Tokenize: 10,000 tokens (1 token = 1 tonne CO2)
    await token.tokenizeAsset(carbonAssetId, ethers.parseEther("10000"), deployer.address);
    console.log("✅ Tokenized 10,000 carbon credits as 10,000 FRWA tokens");
    
    // ========== Summary ==========
    console.log("\n=== Tokenization Summary ===");
    console.log("Total assets registered: 6");
    console.log("Asset categories: Gold, Real Estate, Crypto, Art, IP, Carbon Credits");
    console.log("Total value locked: $161M");
    console.log("\nThe platform can tokenize ANY real-world asset!");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });