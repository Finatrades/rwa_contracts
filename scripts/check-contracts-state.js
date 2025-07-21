const { ethers } = require("hardhat");

async function main() {
    console.log("🔍 CHECKING CONTRACT STATES\n");
    
    const [deployer] = await ethers.getSigners();
    console.log("🔑 Deployer:", deployer.address);
    
    const contracts = {
        ModularCompliance: "0x123A014c135417b58BB3e04A5711C8F126cA95E8",
        Token: "0xED1c85A48EcD10654eD075F63F554cB3ac7faf6c",
        AssetRegistry: "0x4717bED7008bc5aF62b3b91a29aaa24Bab034038"
    };
    
    try {
        // Check ModularCompliance
        console.log("\n=== ModularCompliance ===");
        const compliance = await ethers.getContractAt("ModularCompliance", contracts.ModularCompliance);
        
        try {
            const token = await compliance.token();
            console.log("Token bound:", token);
        } catch (e) {
            console.log("Error reading token:", e.message);
        }
        
        try {
            const hasOwnerRole = await compliance.hasRole(await compliance.OWNER_ROLE(), deployer.address);
            console.log("Deployer has OWNER_ROLE:", hasOwnerRole);
        } catch (e) {
            console.log("Error checking OWNER_ROLE:", e.message);
        }
        
        // Check Token
        console.log("\n=== Token ===");
        const token = await ethers.getContractAt("Token", contracts.Token);
        
        try {
            const name = await token.name();
            const symbol = await token.symbol();
            const decimals = await token.decimals();
            console.log(`Token: ${name} (${symbol}), decimals: ${decimals}`);
        } catch (e) {
            console.log("Error reading token info:", e.message);
        }
        
        try {
            const identityRegistry = await token.identityRegistry();
            console.log("Identity Registry:", identityRegistry);
        } catch (e) {
            console.log("Error reading identity registry:", e.message);
        }
        
        try {
            const compliance = await token.compliance();
            console.log("Compliance:", compliance);
        } catch (e) {
            console.log("Error reading compliance:", e.message);
        }
        
        // Check AssetRegistry
        console.log("\n=== AssetRegistry ===");
        const assetRegistry = await ethers.getContractAt("AssetRegistry", contracts.AssetRegistry);
        
        try {
            const hasAssetRole = await assetRegistry.hasRole(await assetRegistry.ASSET_MANAGER_ROLE(), deployer.address);
            console.log("Deployer has ASSET_MANAGER_ROLE:", hasAssetRole);
        } catch (e) {
            console.log("Error checking ASSET_MANAGER_ROLE:", e.message);
        }
        
        try {
            const totalAssets = await assetRegistry.totalAssets();
            console.log("Total assets:", totalAssets.toString());
        } catch (e) {
            console.log("Error reading total assets:", e.message);
        }
        
    } catch (error) {
        console.error("\n❌ Error:", error.message);
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });