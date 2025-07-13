const { ethers, upgrades, run } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function verifyContract(address, constructorArguments = [], contractPath = "") {
  console.log(`⏳ Waiting 30 seconds before verifying ${address}...`);
  await delay(30000);
  
  try {
    const verifyOptions = {
      address: address,
      constructorArguments: constructorArguments
    };
    
    if (contractPath) {
      verifyOptions.contract = contractPath;
    }
    
    await run("verify:verify", verifyOptions);
    console.log(`✅ Verified: ${address}`);
    return true;
  } catch (error) {
    if (error.message.includes("Already Verified")) {
      console.log(`✅ Already verified: ${address}`);
      return true;
    }
    console.error(`❌ Verification failed for ${address}:`, error.message);
    return false;
  }
}

async function main() {
  console.log("🚀 Deploying remaining contracts to BSC Testnet...\n");
  
  const [deployer] = await ethers.getSigners();
  console.log("Deploying with account:", deployer.address);
  
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("Account balance:", ethers.formatEther(balance), "tBNB\n");
  
  // Load existing deployment
  const existingDeployment = JSON.parse(
    fs.readFileSync(path.join(__dirname, "../deployments/bsc_testnet_deployment.json"), "utf8")
  );
  
  const deploymentResults = { ...existingDeployment.contracts };
  const implementations = { ...existingDeployment.implementations };
  const verificationResults = {};
  
  try {
    // 8. Deploy Timelock (non-proxy contract)
    console.log("8. Deploying FinatradesTimelock...");
    const Timelock = await ethers.getContractFactory("FinatradesTimelock");
    const minDelay = 172800; // 2 days
    const proposers = [deployer.address, ethers.ZeroAddress];
    const executors = [deployer.address];
    const admin = deployer.address;
    
    const timelock = await Timelock.deploy(minDelay, proposers, executors, admin);
    await timelock.waitForDeployment();
    deploymentResults.timelock = await timelock.getAddress();
    console.log("✅ Timelock:", deploymentResults.timelock);
    
    // 9. Deploy AssetRegistry
    console.log("\n9. Deploying AssetRegistry...");
    const AssetRegistry = await ethers.getContractFactory("AssetRegistry");
    const assetRegistry = await upgrades.deployProxy(
      AssetRegistry,
      [deployer.address],
      { kind: "uups" }
    );
    await assetRegistry.waitForDeployment();
    deploymentResults.assetRegistry = await assetRegistry.getAddress();
    console.log("✅ AssetRegistry:", deploymentResults.assetRegistry);
    
    // Get AssetRegistry implementation
    const assetRegistryImpl = await upgrades.erc1967.getImplementationAddress(deploymentResults.assetRegistry);
    implementations.assetRegistry = assetRegistryImpl;
    console.log("AssetRegistry implementation:", assetRegistryImpl);
    
    // Note: Main token contract still can't be deployed due to size
    console.log("\n⚠️  Note: FinatradesRWA_ERC3643 token contract still exceeds BSC testnet size limits");
    console.log("✅ Successfully deployed 9 out of 9 possible contracts");
    
    // Verify contracts
    console.log("\n🔍 Starting verification process...");
    
    // Verify Timelock
    verificationResults.timelock = await verifyContract(
      deploymentResults.timelock,
      [minDelay, proposers, executors, admin]
    );
    
    // Verify AssetRegistry implementation
    verificationResults.assetRegistry = await verifyContract(assetRegistryImpl);
    
    // Update deployment data
    const updatedDeploymentData = {
      network: "bsc_testnet",
      chainId: 97,
      deploymentDate: existingDeployment.deploymentDate,
      lastUpdateDate: new Date().toISOString(),
      deployer: deployer.address,
      contracts: deploymentResults,
      implementations: implementations,
      verificationStatus: {
        ...existingDeployment.verificationStatus,
        timelock: verificationResults.timelock || false,
        assetRegistry: verificationResults.assetRegistry || false
      },
      note: "Deployed 9 contracts total. Main token contract (FinatradesRWA_ERC3643) cannot be deployed due to BSC testnet 24KB contract size limit."
    };
    
    fs.writeFileSync(
      path.join(__dirname, "../deployments/bsc_testnet_deployment.json"),
      JSON.stringify(updatedDeploymentData, null, 2)
    );
    
    // Print summary
    console.log("\n🎉 BSC Testnet Complete Deployment Summary:");
    console.log("=".repeat(50));
    console.log("Network: BSC Testnet (Chain ID: 97)");
    console.log("Total Contracts Deployed: 9");
    console.log("\nNewly Deployed Contracts:");
    console.log(`Timelock: ${deploymentResults.timelock}`);
    console.log(`View on BSCScan: https://testnet.bscscan.com/address/${deploymentResults.timelock}`);
    console.log(`AssetRegistry: ${deploymentResults.assetRegistry}`);
    console.log(`View on BSCScan: https://testnet.bscscan.com/address/${deploymentResults.assetRegistry}`);
    
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