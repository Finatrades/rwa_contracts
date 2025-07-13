const { ethers, upgrades } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  console.log("🚀 Deploying V2 Universal Asset System contracts...\n");
  
  const [deployer] = await ethers.getSigners();
  console.log("Deploying with account:", deployer.address);
  
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("Account balance:", ethers.formatEther(balance), "MATIC\n");
  
  // Load existing deployment data
  const existingDeployment = JSON.parse(
    fs.readFileSync(path.join(__dirname, "../deployments/polygon_mainnet_fresh.json"))
  );
  
  try {
    // 1. Deploy AssetRegistry
    console.log("1. Deploying AssetRegistry...");
    const AssetRegistry = await ethers.getContractFactory("AssetRegistry");
    const assetRegistry = await upgrades.deployProxy(
      AssetRegistry,
      [deployer.address],
      { kind: "uups" }
    );
    await assetRegistry.waitForDeployment();
    const assetRegistryAddress = await assetRegistry.getAddress();
    console.log("✅ AssetRegistry deployed to:", assetRegistryAddress);
    
    // 2. Deploy FinatradesRWA_ERC3643_V2
    console.log("\n2. Deploying FinatradesRWA_ERC3643_V2...");
    const TokenV2 = await ethers.getContractFactory("FinatradesRWA_ERC3643_V2");
    const tokenV2 = await upgrades.deployProxy(
      TokenV2,
      [
        deployer.address, // admin
        "Finatrades Universal RWA Token", // name
        "FURWA", // symbol
        18, // decimals
        existingDeployment.contracts.identityRegistry, // identity registry
        existingDeployment.contracts.modularCompliance, // compliance
        assetRegistryAddress // asset registry
      ],
      { 
        kind: "uups",
        unsafeAllow: ["delegatecall"]
      }
    );
    await tokenV2.waitForDeployment();
    const tokenV2Address = await tokenV2.getAddress();
    console.log("✅ FinatradesRWA_ERC3643_V2 deployed to:", tokenV2Address);
    
    // 3. Configure AssetRegistry
    console.log("\n📋 Configuring AssetRegistry...");
    await assetRegistry.authorizeTokenContract(tokenV2Address, true);
    console.log("✅ Authorized TokenV2 in AssetRegistry");
    
    // Get implementation addresses
    const assetRegistryImpl = await upgrades.erc1967.getImplementationAddress(assetRegistryAddress);
    const tokenV2Impl = await upgrades.erc1967.getImplementationAddress(tokenV2Address);
    
    console.log("\n📄 Implementation Addresses:");
    console.log("AssetRegistry implementation:", assetRegistryImpl);
    console.log("TokenV2 implementation:", tokenV2Impl);
    
    // Save deployment data
    const v2DeploymentData = {
      ...existingDeployment,
      v2Contracts: {
        assetRegistry: assetRegistryAddress,
        tokenV2: tokenV2Address
      },
      v2Implementations: {
        assetRegistry: assetRegistryImpl,
        tokenV2: tokenV2Impl
      },
      v2DeploymentDate: new Date().toISOString()
    };
    
    fs.writeFileSync(
      path.join(__dirname, "../deployments/polygon_mainnet_complete.json"),
      JSON.stringify(v2DeploymentData, null, 2)
    );
    
    console.log("\n✅ V2 Deployment Complete!");
    console.log("=======================");
    console.log("AssetRegistry:", assetRegistryAddress);
    console.log("FinatradesRWA_ERC3643_V2:", tokenV2Address);
    console.log("\n📁 Deployment data saved to deployments/polygon_mainnet_complete.json");
    
  } catch (error) {
    console.error("\n❌ V2 Deployment failed:", error);
    throw error;
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });