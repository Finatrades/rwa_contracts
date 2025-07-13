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
  console.log("🚀 Deploying to BSC Testnet...\n");
  
  const [deployer] = await ethers.getSigners();
  console.log("Deploying with account:", deployer.address);
  
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("Account balance:", ethers.formatEther(balance), "tBNB\n");
  
  if (balance < ethers.parseEther("0.05")) {
    console.log("⚠️  Low balance! Get testnet BNB from: https://testnet.binance.org/faucet-smart");
    return;
  }
  
  const deploymentResults = {};
  
  try {
    // Just deploy one contract to test
    console.log("1. Deploying ClaimTopicsRegistry...");
    const ClaimTopicsRegistry = await ethers.getContractFactory("ClaimTopicsRegistry");
    const claimTopicsRegistry = await upgrades.deployProxy(
      ClaimTopicsRegistry,
      [deployer.address],
      { kind: "uups" }
    );
    await claimTopicsRegistry.waitForDeployment();
    deploymentResults.claimTopicsRegistry = await claimTopicsRegistry.getAddress();
    console.log("✅ ClaimTopicsRegistry:", deploymentResults.claimTopicsRegistry);
    
    // Get implementation address
    const implAddress = await upgrades.erc1967.getImplementationAddress(
      deploymentResults.claimTopicsRegistry
    );
    console.log("Implementation:", implAddress);
    
    // Try to verify
    console.log("\n🔍 Attempting verification...");
    const verified = await verifyContract(implAddress);
    
    if (verified) {
      console.log("\n🎉 Deployment and verification successful on BSC Testnet!");
      console.log("View on BSCScan: https://testnet.bscscan.com/address/" + deploymentResults.claimTopicsRegistry);
    }
    
    // Save deployment data
    const deploymentData = {
      network: "bsc_testnet",
      chainId: 97,
      deploymentDate: new Date().toISOString(),
      deployer: deployer.address,
      contracts: deploymentResults
    };
    
    fs.writeFileSync(
      path.join(__dirname, "../deployments/bsc_testnet_test.json"),
      JSON.stringify(deploymentData, null, 2)
    );
    
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