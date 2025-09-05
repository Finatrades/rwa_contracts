const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
    console.log("\n=== Granting Factory Permissions ===");
    console.log("Network:", network.name);
    console.log("====================================\n");

    const [deployer] = await ethers.getSigners();
    console.log("Deployer address:", deployer.address);

    // Load deployment data
    const deploymentFile = path.join(__dirname, "..", "deployments", "polygon_deployment.json");
    const deployment = JSON.parse(fs.readFileSync(deploymentFile, 'utf8'));
    
    const factoryAddress = deployment.contracts.FinatradesTokenFactory;
    const assetRegistryAddress = deployment.contracts.AssetRegistry;
    
    console.log("Factory address:", factoryAddress);
    console.log("AssetRegistry address:", assetRegistryAddress);

    // Get contract instances
    const factory = await ethers.getContractAt("FinatradesTokenFactory", factoryAddress);
    const assetRegistry = await ethers.getContractAt("AssetRegistry", assetRegistryAddress);

    try {
        // Check if deployer has TOKEN_DEPLOYER_ROLE
        console.log("\n1. Checking TOKEN_DEPLOYER_ROLE...");
        const TOKEN_DEPLOYER_ROLE = await factory.TOKEN_DEPLOYER_ROLE();
        const hasDeployerRole = await factory.hasRole(TOKEN_DEPLOYER_ROLE, deployer.address);
        console.log("   Deployer has TOKEN_DEPLOYER_ROLE:", hasDeployerRole);

        // Check if deployer has ASSET_MANAGER_ROLE
        console.log("\n2. Checking ASSET_MANAGER_ROLE on AssetRegistry...");
        const ASSET_MANAGER_ROLE = await assetRegistry.ASSET_MANAGER_ROLE();
        const hasAssetManagerRole = await assetRegistry.hasRole(ASSET_MANAGER_ROLE, deployer.address);
        console.log("   Deployer has ASSET_MANAGER_ROLE:", hasAssetManagerRole);

        if (!hasAssetManagerRole) {
            console.log("\n3. Granting ASSET_MANAGER_ROLE to deployer...");
            const grantTx = await assetRegistry.grantRole(ASSET_MANAGER_ROLE, deployer.address);
            await grantTx.wait();
            console.log("   ✅ ASSET_MANAGER_ROLE granted");
        }

        // Grant factory permission to authorize tokens (needs DEFAULT_ADMIN_ROLE)
        console.log("\n4. Checking if factory can authorize tokens...");
        const DEFAULT_ADMIN_ROLE = "0x0000000000000000000000000000000000000000000000000000000000000000";
        const factoryHasAdminRole = await assetRegistry.hasRole(DEFAULT_ADMIN_ROLE, factoryAddress);
        console.log("   Factory has DEFAULT_ADMIN_ROLE:", factoryHasAdminRole);

        if (!factoryHasAdminRole) {
            console.log("\n5. Granting DEFAULT_ADMIN_ROLE to factory...");
            const grantFactoryTx = await assetRegistry.grantRole(DEFAULT_ADMIN_ROLE, factoryAddress);
            await grantFactoryTx.wait();
            console.log("   ✅ DEFAULT_ADMIN_ROLE granted to factory");
        }

        // Also grant ASSET_MANAGER_ROLE to factory so it can check assets
        const factoryHasAssetRole = await assetRegistry.hasRole(ASSET_MANAGER_ROLE, factoryAddress);
        console.log("\n6. Factory has ASSET_MANAGER_ROLE:", factoryHasAssetRole);
        
        if (!factoryHasAssetRole) {
            console.log("   Granting ASSET_MANAGER_ROLE to factory...");
            const grantFactoryAssetTx = await assetRegistry.grantRole(ASSET_MANAGER_ROLE, factoryAddress);
            await grantFactoryAssetTx.wait();
            console.log("   ✅ ASSET_MANAGER_ROLE granted to factory");
        }

        console.log("\n=== Permissions Granted Successfully ===");

    } catch (error) {
        console.error("\n❌ Error granting permissions:", error.message);
        throw error;
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });