const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
    console.log("⚙️ CONFIGURING DEPLOYED CONTRACTS\n");
    
    const [deployer] = await ethers.getSigners();
    console.log("🔑 Deployer:", deployer.address);
    
    // Load deployment data
    const deployment = {
        contracts: {
            ClaimTopicsRegistry: "0x6Ec58c34DF899Ff9d67FD088Cd339bB75508Dd79",
            IdentityRegistry: "0x25150414235289c688473340548698B5764651E3",
            CountryRestrictModule: "0x934b1C1AD4d205517B1a09A984c3F077cd99651A",
            MaxBalanceModule: "0x77B6c7aBB74653F1F48ac6Ebd1154532D13c41b3",
            TransferLimitModule: "0x6887c6c45B64C6E6D55dFADb2a4857C5DAD63D57",
            ModularCompliance: "0x123A014c135417b58BB3e04A5711C8F126cA95E8",
            AssetRegistry: "0x4717bED7008bc5aF62b3b91a29aaa24Bab034038",
            FinatradesTimelock: "0xf98Ee2EE41Ee008AEc3A17a87E06Aa0Dc4Cd38e4",
            Token: "0xED1c85A48EcD10654eD075F63F554cB3ac7faf6c",
            RegulatoryReportingOptimized: "0xcd5fC2E20D697394d66e30475981bA5F37fD160e"
        },
        implementations: {
            ClaimTopicsRegistry: "0x2DEF12D0C8448DD8866AcFD839aDbFE07b5C7A15",
            IdentityRegistry: "0x0BD1A2EdF1FCd608fC0537f6268E2b9c565a58B8",
            CountryRestrictModule: "0xb9a74E93E9Ee80C083F256fbCA24929fF48cab60",
            MaxBalanceModule: "0xcab5474536C676b62e6bF1aDeb48CE0092c62d00",
            TransferLimitModule: "0x9fF75c5cE984849224a865f44e0d5bE9BeA12e0A",
            ModularCompliance: "0xca244a40FEd494075195b9632c75377ccFB7C8ff",
            AssetRegistry: "0xBe125EFCBCeB60EC5Bf38e00158999E8Eb359347",
            Token: "0x8C5DA9118B70A23b01451Bc6f0baEc9A41Aa6A12",
            RegulatoryReportingOptimized: "0xe4da869B9C55120aeAFc3c1e21d2C413531F18B2"
        }
    };
    
    try {
        // Get contract instances
        const modularCompliance = await ethers.getContractAt("ModularCompliance", deployment.contracts.ModularCompliance);
        const token = await ethers.getContractAt("Token", deployment.contracts.Token);
        const assetRegistry = await ethers.getContractAt("AssetRegistry", deployment.contracts.AssetRegistry);
        
        // Check if token is already bound
        const boundToken = await modularCompliance.token();
        console.log("Current bound token:", boundToken);
        
        if (boundToken === ethers.ZeroAddress) {
            console.log("\n📌 Binding token to compliance...");
            await (await modularCompliance.bindToken(deployment.contracts.Token)).wait(3);
            console.log("✅ Token bound to compliance");
        } else {
            console.log("⚠️ Token already bound");
        }
        
        // Check if modules are already added
        console.log("\n📌 Checking compliance modules...");
        const countryModuleBound = await modularCompliance.moduleBound(deployment.contracts.CountryRestrictModule);
        const balanceModuleBound = await modularCompliance.moduleBound(deployment.contracts.MaxBalanceModule);
        const transferModuleBound = await modularCompliance.moduleBound(deployment.contracts.TransferLimitModule);
        
        if (!countryModuleBound) {
            console.log("Adding CountryRestrictModule...");
            await (await modularCompliance.addModule(deployment.contracts.CountryRestrictModule)).wait(3);
            console.log("✅ CountryRestrictModule added");
        } else {
            console.log("✅ CountryRestrictModule already added");
        }
        
        if (!balanceModuleBound) {
            console.log("Adding MaxBalanceModule...");
            await (await modularCompliance.addModule(deployment.contracts.MaxBalanceModule)).wait(3);
            console.log("✅ MaxBalanceModule added");
        } else {
            console.log("✅ MaxBalanceModule already added");
        }
        
        if (!transferModuleBound) {
            console.log("Adding TransferLimitModule...");
            await (await modularCompliance.addModule(deployment.contracts.TransferLimitModule)).wait(3);
            console.log("✅ TransferLimitModule added");
        } else {
            console.log("✅ TransferLimitModule already added");
        }
        
        // Grant roles
        console.log("\n📌 Checking roles...");
        
        // Token roles
        const AGENT_ROLE = ethers.id("AGENT_ROLE");
        const hasAgentRole = await token.hasRole(AGENT_ROLE, deployer.address);
        if (!hasAgentRole) {
            console.log("Granting AGENT_ROLE on Token...");
            await (await token.grantRole(AGENT_ROLE, deployer.address)).wait(3);
            console.log("✅ AGENT_ROLE granted");
        } else {
            console.log("✅ AGENT_ROLE already granted");
        }
        
        // AssetRegistry roles
        const ASSET_MANAGER_ROLE = await assetRegistry.ASSET_MANAGER_ROLE();
        const hasAssetRole = await assetRegistry.hasRole(ASSET_MANAGER_ROLE, deployer.address);
        if (!hasAssetRole) {
            console.log("Granting ASSET_MANAGER_ROLE on AssetRegistry...");
            await (await assetRegistry.grantRole(ASSET_MANAGER_ROLE, deployer.address)).wait(3);
            console.log("✅ ASSET_MANAGER_ROLE granted");
        } else {
            console.log("✅ ASSET_MANAGER_ROLE already granted");
        }
        
        // Authorize token in asset registry
        console.log("\n📌 Checking token authorization...");
        const isTokenAuthorized = await assetRegistry.authorizedTokenContracts(deployment.contracts.Token);
        if (!isTokenAuthorized) {
            console.log("Authorizing token in AssetRegistry...");
            await (await assetRegistry.authorizeTokenContract(deployment.contracts.Token, true)).wait(3);
            console.log("✅ Token authorized");
        } else {
            console.log("✅ Token already authorized");
        }
        
        // Save complete deployment
        const deploymentPath = path.join(__dirname, '../deployments');
        deployment.network = "polygon";
        deployment.chainId = 137;
        deployment.deployer = deployer.address;
        deployment.timestamp = new Date().toISOString();
        deployment.status = "COMPLETE";
        deployment.configuration = {
            tokenBoundToCompliance: true,
            modulesAdded: ["CountryRestrictModule", "MaxBalanceModule", "TransferLimitModule"],
            rolesGranted: ["AGENT_ROLE", "ASSET_MANAGER_ROLE"],
            tokenAuthorizedInAssetRegistry: true
        };
        
        fs.writeFileSync(
            path.join(deploymentPath, 'polygon_mainnet_final.json'),
            JSON.stringify(deployment, null, 2)
        );
        
        console.log("\n✅ CONFIGURATION COMPLETE!");
        console.log("\n📋 DEPLOYMENT SUMMARY:");
        console.log("════════════════════════════════════════");
        console.log("Total Contracts Deployed: 10");
        console.log("Network: Polygon Mainnet");
        console.log("Status: FULLY DEPLOYED AND CONFIGURED");
        console.log("════════════════════════════════════════");
        
        console.log("\n📋 CONTRACT ADDRESSES:");
        Object.entries(deployment.contracts).forEach(([name, address]) => {
            console.log(`${name.padEnd(35)} ${address}`);
        });
        
        console.log("\n🎉 ALL CONTRACTS ARE NOW READY FOR USE!");
        console.log("\n🔍 Next steps:");
        console.log("1. Run verification script to verify all contracts");
        console.log("2. Test token minting and transfers");
        console.log("3. Register identities in IdentityRegistry");
        console.log("4. Configure compliance rules in modules");
        
    } catch (error) {
        console.error("\n❌ Configuration failed:", error.message);
        process.exit(1);
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });