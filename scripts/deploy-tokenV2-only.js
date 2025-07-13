const { ethers, upgrades } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  console.log("🚀 Deploying FinatradesRWA_ERC3643_V2...\n");
  
  const [deployer] = await ethers.getSigners();
  console.log("Deploying with account:", deployer.address);
  
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("Account balance:", ethers.formatEther(balance), "MATIC\n");
  
  // Load existing deployment data
  const existingDeployment = JSON.parse(
    fs.readFileSync(path.join(__dirname, "../deployments/polygon_mainnet_fresh.json"))
  );
  
  // AssetRegistry address
  const assetRegistryAddress = "0x30fabB0f59927f5508F7a3b8bfDcf3a60478649F";
  
  try {
    // Deploy FinatradesRWA_ERC3643_V2 with explicit initializer
    console.log("Deploying FinatradesRWA_ERC3643_V2...");
    const TokenV2 = await ethers.getContractFactory("FinatradesRWA_ERC3643_V2");
    
    // Deploy using upgrades plugin with specific initializer
    const tokenV2 = await upgrades.deployProxy(
      TokenV2,
      [
        deployer.address, // admin
        "Finatrades Universal RWA Token", // name
        "FURWA", // symbol
        18, // decimals
        existingDeployment.contracts.identityRegistry, // identity registry
        existingDeployment.contracts.modularCompliance, // compliance
        assetRegistryAddress // asset registry (7th parameter for V2)
      ],
      { 
        kind: "uups",
        unsafeAllow: ["delegatecall"],
        initializer: "initialize(address,string,string,uint8,address,address,address)"
      }
    );
    
    await tokenV2.waitForDeployment();
    const tokenV2Address = await tokenV2.getAddress();
    console.log("✅ FinatradesRWA_ERC3643_V2 deployed to:", tokenV2Address);
    
    // Configure AssetRegistry
    console.log("\nConfiguring AssetRegistry...");
    const assetRegistry = await ethers.getContractAt("AssetRegistry", assetRegistryAddress);
    await assetRegistry.authorizeTokenContract(tokenV2Address, true);
    console.log("✅ Authorized TokenV2 in AssetRegistry");
    
    // Get implementation addresses
    const tokenV2Impl = await upgrades.erc1967.getImplementationAddress(tokenV2Address);
    const assetRegistryImpl = await upgrades.erc1967.getImplementationAddress(assetRegistryAddress);
    
    console.log("\n📄 Contract Addresses:");
    console.log("AssetRegistry:", assetRegistryAddress);
    console.log("AssetRegistry implementation:", assetRegistryImpl);
    console.log("TokenV2:", tokenV2Address);
    console.log("TokenV2 implementation:", tokenV2Impl);
    
    // Create complete deployment data with ALL contracts
    const completeDeployment = {
      network: "polygon_mainnet",
      chainId: 137,
      deploymentDate: existingDeployment.deploymentDate,
      v2DeploymentDate: new Date().toISOString(),
      deployer: deployer.address,
      contracts: {
        // Core V1 Contracts
        claimTopicsRegistry: existingDeployment.contracts.claimTopicsRegistry,
        identityRegistry: existingDeployment.contracts.identityRegistry,
        claimIssuer: existingDeployment.contracts.claimIssuer,
        countryModule: existingDeployment.contracts.countryModule,
        transferLimitModule: existingDeployment.contracts.transferLimitModule,
        maxBalanceModule: existingDeployment.contracts.maxBalanceModule,
        modularCompliance: existingDeployment.contracts.modularCompliance,
        token: existingDeployment.contracts.token,
        timelock: existingDeployment.contracts.timelock,
        // V2 Contracts
        assetRegistry: assetRegistryAddress,
        tokenV2: tokenV2Address
      },
      implementations: {
        assetRegistry: assetRegistryImpl,
        tokenV2: tokenV2Impl
      }
    };
    
    fs.writeFileSync(
      path.join(__dirname, "../deployments/polygon_mainnet_complete.json"),
      JSON.stringify(completeDeployment, null, 2)
    );
    
    console.log("\n✅ ALL CONTRACTS DEPLOYED!");
    console.log("========================");
    console.log("\n📁 Complete deployment data saved to deployments/polygon_mainnet_complete.json");
    console.log("\n🎉 Total contracts deployed: 11");
    console.log("  - 9 Core V1 contracts");
    console.log("  - 2 V2 Universal Asset contracts");
    
  } catch (error) {
    console.error("\n❌ Deployment failed:", error);
    throw error;
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });