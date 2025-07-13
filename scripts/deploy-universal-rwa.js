const { ethers, upgrades } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
    console.log("🚀 Deploying Universal RWA System to Polygon Mainnet...\n");
    
    const [deployer] = await ethers.getSigners();
    const balance = await ethers.provider.getBalance(deployer.address);
    
    console.log("Deployer:", deployer.address);
    console.log("Balance:", ethers.formatEther(balance), "POL\n");
    
    // Load existing deployment
    const existingDeployment = JSON.parse(
        fs.readFileSync(path.join(__dirname, "../deployments/polygon_mainnet_complete.json"), "utf8")
    );
    
    const deployment = {
        ...existingDeployment,
        v2Contracts: {}
    };
    
    try {
        // ========== 1. Deploy AssetRegistry ==========
        console.log("1. Deploying AssetRegistry...");
        const AssetRegistry = await ethers.getContractFactory("AssetRegistry");
        const assetRegistry = await upgrades.deployProxy(
            AssetRegistry,
            [deployer.address],
            {
                initializer: "initialize",
                kind: "uups"
            }
        );
        await assetRegistry.waitForDeployment();
        const assetRegistryAddress = await assetRegistry.getAddress();
        deployment.v2Contracts.AssetRegistry = assetRegistryAddress;
        console.log("✅ AssetRegistry:", assetRegistryAddress);
        console.log("   View on Polygonscan: https://polygonscan.com/address/" + assetRegistryAddress);
        
        // ========== 2. Deploy FinatradesRWA_ERC3643_V2 ==========
        console.log("\n2. Deploying FinatradesRWA_ERC3643_V2...");
        const TokenV2 = await ethers.getContractFactory("FinatradesRWA_ERC3643_V2");
        const tokenV2 = await upgrades.deployProxy(
            TokenV2,
            [
                deployer.address,
                "Finatrades Universal RWA Token",
                "FURWA",
                18,
                deployment.contracts.IdentityRegistry,
                deployment.contracts.ModularCompliance,
                assetRegistryAddress
            ],
            {
                initializer: "initialize",
                kind: "uups"
            }
        );
        await tokenV2.waitForDeployment();
        const tokenV2Address = await tokenV2.getAddress();
        deployment.v2Contracts.FinatradesRWA_ERC3643_V2 = tokenV2Address;
        console.log("✅ FinatradesRWA_ERC3643_V2:", tokenV2Address);
        console.log("   View on Polygonscan: https://polygonscan.com/address/" + tokenV2Address);
        
        // ========== 3. Configure AssetRegistry ==========
        console.log("\n3. Configuring AssetRegistry...");
        
        // Authorize token contract
        await assetRegistry.authorizeTokenContract(tokenV2Address, true);
        console.log("✅ Authorized TokenV2 in AssetRegistry");
        
        // Grant roles
        await assetRegistry.grantRole(
            await assetRegistry.ASSET_MANAGER_ROLE(),
            deployer.address
        );
        console.log("✅ Granted ASSET_MANAGER_ROLE to deployer");
        
        // ========== 4. Configure Token V2 ==========
        console.log("\n4. Configuring Token V2...");
        
        // Bind to existing compliance
        const compliance = await ethers.getContractAt(
            "ModularCompliance",
            deployment.contracts.ModularCompliance
        );
        
        try {
            await compliance.bindToken(tokenV2Address);
            console.log("✅ Token V2 bound to compliance");
        } catch (e) {
            console.log("ℹ️ Token binding failed - may need to update compliance");
        }
        
        // ========== 5. Deploy Identity Contract (for examples) ==========
        console.log("\n5. Deploying example Identity contract...");
        const Identity = await ethers.getContractFactory("Identity");
        const identity = await Identity.deploy(deployer.address, true);
        await identity.waitForDeployment();
        const identityAddress = await identity.getAddress();
        deployment.v2Contracts.ExampleIdentity = identityAddress;
        console.log("✅ Example Identity:", identityAddress);
        
        // ========== 6. Save Deployment ==========
        const deploymentData = {
            ...deployment,
            v2DeploymentDate: new Date().toISOString(),
            v2DeploymentBlock: await ethers.provider.getBlockNumber()
        };
        
        fs.writeFileSync(
            path.join(__dirname, "../deployments/polygon_mainnet_v2.json"),
            JSON.stringify(deploymentData, null, 2)
        );
        
        // ========== 7. Display Summary ==========
        console.log("\n🎉 UNIVERSAL RWA SYSTEM DEPLOYED!");
        console.log("\n=== V2 Contract Addresses ===");
        console.log("AssetRegistry:", assetRegistryAddress);
        console.log("FinatradesRWA_ERC3643_V2:", tokenV2Address);
        console.log("Example Identity:", identityAddress);
        
        console.log("\n=== Integration with Existing System ===");
        console.log("Identity Registry:", deployment.contracts.IdentityRegistry);
        console.log("Modular Compliance:", deployment.contracts.ModularCompliance);
        console.log("Claim Topics Registry:", deployment.contracts.ClaimTopicsRegistry);
        
        const finalBalance = await ethers.provider.getBalance(deployer.address);
        console.log("\n=== Deployment Cost ===");
        console.log("POL used:", ethers.formatEther(balance - finalBalance));
        console.log("Remaining balance:", ethers.formatEther(finalBalance), "POL");
        
        console.log("\n=== Next Steps ===");
        console.log("1. Register your first universal asset");
        console.log("2. Set up claim topics if not already done");
        console.log("3. Configure compliance modules for your jurisdiction");
        console.log("4. Start tokenizing ANY real-world asset!");
        
    } catch (error) {
        console.error("\n❌ Deployment failed:", error.message);
        
        // Save partial deployment
        fs.writeFileSync(
            path.join(__dirname, "../deployments/polygon_mainnet_v2_partial.json"),
            JSON.stringify(deployment, null, 2)
        );
        
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