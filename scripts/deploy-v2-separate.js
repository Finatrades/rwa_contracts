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
    // AssetRegistry is already deployed, get its address
    const assetRegistryAddress = "0x30fabB0f59927f5508F7a3b8bfDcf3a60478649F";
    console.log("✅ Using AssetRegistry at:", assetRegistryAddress);
    
    // Deploy FinatradesRWA_ERC3643_V2 using regular deployment (not proxy for now)
    console.log("\n2. Deploying FinatradesRWA_ERC3643_V2...");
    const TokenV2 = await ethers.getContractFactory("FinatradesRWA_ERC3643_V2");
    
    // First deploy the implementation
    const tokenV2Impl = await TokenV2.deploy();
    await tokenV2Impl.waitForDeployment();
    const tokenV2ImplAddress = await tokenV2Impl.getAddress();
    console.log("✅ TokenV2 implementation deployed to:", tokenV2ImplAddress);
    
    // Deploy proxy manually
    const ERC1967Proxy = await ethers.getContractFactory("ERC1967Proxy");
    
    // Encode initializer
    const initData = TokenV2.interface.encodeFunctionData("initialize", [
      deployer.address, // admin
      "Finatrades Universal RWA Token", // name
      "FURWA", // symbol
      18, // decimals
      existingDeployment.contracts.identityRegistry, // identity registry
      existingDeployment.contracts.modularCompliance, // compliance
      assetRegistryAddress // asset registry
    ]);
    
    const proxy = await ERC1967Proxy.deploy(tokenV2ImplAddress, initData);
    await proxy.waitForDeployment();
    const tokenV2Address = await proxy.getAddress();
    console.log("✅ FinatradesRWA_ERC3643_V2 proxy deployed to:", tokenV2Address);
    
    // 3. Configure AssetRegistry
    console.log("\n📋 Configuring AssetRegistry...");
    const assetRegistry = await ethers.getContractAt("AssetRegistry", assetRegistryAddress);
    await assetRegistry.authorizeTokenContract(tokenV2Address, true);
    console.log("✅ Authorized TokenV2 in AssetRegistry");
    
    // Get implementation address for AssetRegistry
    const assetRegistryImpl = await upgrades.erc1967.getImplementationAddress(assetRegistryAddress);
    
    console.log("\n📄 Implementation Addresses:");
    console.log("AssetRegistry implementation:", assetRegistryImpl);
    console.log("TokenV2 implementation:", tokenV2ImplAddress);
    
    // Save deployment data
    const v2DeploymentData = {
      ...existingDeployment,
      v2Contracts: {
        assetRegistry: assetRegistryAddress,
        tokenV2: tokenV2Address
      },
      v2Implementations: {
        assetRegistry: assetRegistryImpl,
        tokenV2: tokenV2ImplAddress
      },
      v2DeploymentDate: new Date().toISOString()
    };
    
    // Create complete deployment with all contracts
    const completeDeployment = {
      network: "polygon_mainnet",
      chainId: 137,
      deploymentDate: existingDeployment.deploymentDate,
      v2DeploymentDate: new Date().toISOString(),
      deployer: deployer.address,
      contracts: {
        // V1 Contracts
        ...existingDeployment.contracts,
        // V2 Contracts
        assetRegistry: assetRegistryAddress,
        tokenV2: tokenV2Address
      }
    };
    
    fs.writeFileSync(
      path.join(__dirname, "../deployments/polygon_mainnet_complete.json"),
      JSON.stringify(v2DeploymentData, null, 2)
    );
    
    fs.writeFileSync(
      path.join(__dirname, "../deployments/polygon_mainnet_all.json"),
      JSON.stringify(completeDeployment, null, 2)
    );
    
    console.log("\n✅ V2 Deployment Complete!");
    console.log("=======================");
    console.log("AssetRegistry:", assetRegistryAddress);
    console.log("FinatradesRWA_ERC3643_V2:", tokenV2Address);
    console.log("\n📁 Deployment data saved");
    
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