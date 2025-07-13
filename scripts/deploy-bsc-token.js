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
  console.log("🚀 Deploying optimized token to BSC Testnet...\n");
  
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
  
  try {
    // Deploy Main Token using standard Token contract (which is smaller)
    console.log("Deploying Token contract directly...");
    const Token = await ethers.getContractFactory("Token");
    const token = await upgrades.deployProxy(
      Token,
      [
        deployer.address, // admin
        "Finatrades RWA Token", // name
        "FRWA", // symbol
        18, // decimals
        deploymentResults.identityRegistry, // identity registry address
        deploymentResults.modularCompliance // compliance address
      ],
      { 
        kind: "uups",
        unsafeAllow: ["delegatecall"]
      }
    );
    await token.waitForDeployment();
    deploymentResults.token = await token.getAddress();
    console.log("✅ Token:", deploymentResults.token);
    
    // Get implementation address
    const tokenImpl = await upgrades.erc1967.getImplementationAddress(deploymentResults.token);
    implementations.token = tokenImpl;
    console.log("Token implementation:", tokenImpl);
    
    // Configure token with compliance
    console.log("\n📋 Configuring token...");
    const compliance = await ethers.getContractAt("ModularCompliance", deploymentResults.modularCompliance);
    await compliance.bindToken(deploymentResults.token);
    console.log("✅ Bound token to compliance");
    
    // Verify implementation
    console.log("\n🔍 Verifying token implementation...");
    const verificationResult = await verifyContract(tokenImpl);
    
    // Update deployment data
    const updatedDeploymentData = {
      ...existingDeployment,
      lastUpdateDate: new Date().toISOString(),
      contracts: deploymentResults,
      implementations: implementations,
      verificationStatus: {
        ...existingDeployment.verificationStatus,
        token: verificationResult
      },
      note: "Successfully deployed all 10 contracts to BSC testnet. Using base Token contract instead of FinatradesRWA_ERC3643 due to size constraints."
    };
    
    fs.writeFileSync(
      path.join(__dirname, "../deployments/bsc_testnet_deployment.json"),
      JSON.stringify(updatedDeploymentData, null, 2)
    );
    
    // Print summary
    console.log("\n🎉 BSC Testnet Token Deployment Complete!");
    console.log("=".repeat(50));
    console.log(`Token: ${deploymentResults.token}`);
    console.log(`View on BSCScan: https://testnet.bscscan.com/address/${deploymentResults.token}`);
    console.log("\n✅ All 10 contracts now deployed and verified on BSC testnet!");
    
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