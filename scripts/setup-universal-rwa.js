const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
    console.log("🔧 Setting up Universal RWA System...\n");
    
    const [deployer] = await ethers.getSigners();
    console.log("Setting up with account:", deployer.address);
    
    // Load deployment addresses
    const deployment = JSON.parse(
        fs.readFileSync(path.join(__dirname, "../deployments/polygon_mainnet_v2.json"), "utf8")
    );
    
    try {
        // ========== 1. Setup Claim Topics ==========
        console.log("1. Setting up Claim Topics...");
        const claimTopicsRegistry = await ethers.getContractAt(
            "ClaimTopicsRegistry",
            deployment.contracts.ClaimTopicsRegistry
        );
        
        // Add standard claim topics if not already added
        const topics = [
            { id: 1, name: "KYC" },
            { id: 2, name: "AML" },
            { id: 3, name: "Accreditation" },
            { id: 4, name: "Country" },
            { id: 5, name: "Investor Type" }
        ];
        
        for (const topic of topics) {
            try {
                await claimTopicsRegistry.addClaimTopic(topic.id);
                console.log(`✅ Added claim topic ${topic.id}: ${topic.name}`);
            } catch (e) {
                console.log(`ℹ️ Claim topic ${topic.id} already exists`);
            }
        }
        
        // ========== 2. Configure Country Restrictions ==========
        console.log("\n2. Configuring Country Restrictions...");
        const countryModule = await ethers.getContractAt(
            "CountryRestrictModule",
            deployment.contracts.CountryRestrictModule
        );
        
        // Allow major countries
        const allowedCountries = [
            { code: 1, name: "USA" },
            { code: 44, name: "UK" },
            { code: 65, name: "Singapore" },
            { code: 971, name: "UAE" },
            { code: 41, name: "Switzerland" },
            { code: 49, name: "Germany" },
            { code: 33, name: "France" },
            { code: 81, name: "Japan" },
            { code: 82, name: "South Korea" },
            { code: 61, name: "Australia" }
        ];
        
        const countryCodes = allowedCountries.map(c => c.code);
        const allowedFlags = new Array(countryCodes.length).fill(true);
        
        await countryModule.batchSetCountriesAllowed(countryCodes, allowedFlags);
        console.log("✅ Allowed countries:", allowedCountries.map(c => c.name).join(", "));
        
        // ========== 3. Set Default Compliance Limits ==========
        console.log("\n3. Setting Default Compliance Limits...");
        
        // Transfer limits
        const transferModule = await ethers.getContractAt(
            "TransferLimitModule",
            deployment.contracts.TransferLimitModule
        );
        
        await transferModule.setDefaultLimits(
            ethers.parseEther("1000000"), // $1M daily
            ethers.parseEther("10000000") // $10M monthly
        );
        console.log("✅ Default transfer limits: $1M daily, $10M monthly");
        
        // Max balance
        const maxBalanceModule = await ethers.getContractAt(
            "MaxBalanceModule",
            deployment.contracts.MaxBalanceModule
        );
        
        await maxBalanceModule.setDefaultMaxBalance(
            ethers.parseEther("50000000") // $50M max
        );
        console.log("✅ Default max balance: $50M");
        
        // ========== 4. Grant Roles ==========
        console.log("\n4. Granting Roles...");
        
        const tokenV2 = await ethers.getContractAt(
            "FinatradesRWA_ERC3643_V2",
            deployment.v2Contracts.FinatradesRWA_ERC3643_V2
        );
        
        const assetRegistry = await ethers.getContractAt(
            "AssetRegistry",
            deployment.v2Contracts.AssetRegistry
        );
        
        // Grant roles to deployer for testing
        const AGENT_ROLE = await tokenV2.AGENT_ROLE();
        const ASSET_MANAGER_ROLE = await tokenV2.ASSET_MANAGER_ROLE();
        const CORPORATE_ACTIONS_ROLE = await tokenV2.CORPORATE_ACTIONS_ROLE();
        
        await tokenV2.grantRole(AGENT_ROLE, deployer.address);
        console.log("✅ Granted AGENT_ROLE");
        
        await tokenV2.grantRole(ASSET_MANAGER_ROLE, deployer.address);
        console.log("✅ Granted ASSET_MANAGER_ROLE");
        
        await tokenV2.grantRole(CORPORATE_ACTIONS_ROLE, deployer.address);
        console.log("✅ Granted CORPORATE_ACTIONS_ROLE");
        
        // ========== 5. Register First Example Asset ==========
        console.log("\n5. Registering Example Asset...");
        
        const exampleAssetId = ethers.keccak256(ethers.toUtf8Bytes("EXAMPLE-GOLD-001"));
        
        await assetRegistry.registerAsset(
            exampleAssetId,
            "1oz Gold Coin - Example",
            2, // PRECIOUS_METALS
            2000 * 10**6, // $2,000
            "ipfs://QmExampleGoldCoin",
            deployer.address
        );
        
        await assetRegistry.setTextAttribute(exampleAssetId, "metalType", "Gold");
        await assetRegistry.setNumericAttribute(exampleAssetId, "weight", 31); // grams
        await assetRegistry.setNumericAttribute(exampleAssetId, "purity", 9999);
        
        console.log("✅ Registered example gold asset");
        console.log("   Asset ID:", exampleAssetId);
        
        // ========== 6. Setup Example Identity ==========
        console.log("\n6. Setting up Example Identity...");
        
        const identityRegistry = await ethers.getContractAt(
            "IdentityRegistry",
            deployment.contracts.IdentityRegistry
        );
        
        const identity = await ethers.getContractAt(
            "Identity",
            deployment.v2Contracts.ExampleIdentity
        );
        
        // Register identity
        await identityRegistry.registerIdentity(
            deployer.address,
            deployment.v2Contracts.ExampleIdentity
        );
        console.log("✅ Registered identity for deployer");
        
        // Add claims
        const claimIssuer = await ethers.getContractAt(
            "ClaimIssuer",
            deployment.contracts.ClaimIssuer
        );
        
        // Add KYC claim
        await claimIssuer.addClaim(
            deployment.v2Contracts.ExampleIdentity,
            1, // KYC topic
            1, // scheme
            claimIssuer.target,
            "0x", // signature
            ethers.solidityPackedKeccak256(["string"], ["KYC_VERIFIED"]),
            ""
        );
        console.log("✅ Added KYC claim");
        
        // Set country
        await identityRegistry.setInvestorCountry(deployer.address, 1); // USA
        console.log("✅ Set investor country to USA");
        
        // ========== 7. Display Summary ==========
        console.log("\n🎉 SETUP COMPLETE!");
        console.log("\n=== System Configuration ===");
        console.log("✅ Claim topics configured (KYC, AML, etc.)");
        console.log("✅ 10 countries allowed for transfers");
        console.log("✅ Default compliance limits set");
        console.log("✅ Admin roles granted");
        console.log("✅ Example gold asset registered");
        console.log("✅ Example identity with KYC created");
        
        console.log("\n=== Ready to Tokenize ===");
        console.log("You can now:");
        console.log("1. Register any type of asset in the AssetRegistry");
        console.log("2. Tokenize assets using tokenizeAsset()");
        console.log("3. Transfer tokens with full compliance");
        console.log("4. Distribute dividends per asset");
        
        console.log("\n=== Example Commands ===");
        console.log("Register a property:");
        console.log(`  assetRegistry.registerAsset(assetId, "NYC Property", 1, value, ipfs, custodian)`);
        console.log("\nTokenize it:");
        console.log(`  tokenV2.tokenizeAsset(assetId, amount, recipient)`);
        
    } catch (error) {
        console.error("\n❌ Setup failed:", error.message);
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