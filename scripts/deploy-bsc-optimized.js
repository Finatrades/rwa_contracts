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
  console.log("🚀 Deploying optimized contracts to BSC Testnet...\n");
  
  const [deployer] = await ethers.getSigners();
  console.log("Deploying with account:", deployer.address);
  
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("Account balance:", ethers.formatEther(balance), "tBNB\n");
  
  if (balance < ethers.parseEther("0.1")) {
    console.log("⚠️  Low balance! Get testnet BNB from: https://testnet.binance.org/faucet-smart");
    return;
  }
  
  const deploymentResults = {};
  const verificationResults = {};
  
  try {
    // 1. Deploy ClaimTopicsRegistry
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
    
    // 2. Deploy IdentityRegistry
    console.log("\n2. Deploying IdentityRegistry...");
    const IdentityRegistry = await ethers.getContractFactory("IdentityRegistry");
    const identityRegistry = await upgrades.deployProxy(
      IdentityRegistry,
      [deployer.address],
      { kind: "uups" }
    );
    await identityRegistry.waitForDeployment();
    deploymentResults.identityRegistry = await identityRegistry.getAddress();
    console.log("✅ IdentityRegistry:", deploymentResults.identityRegistry);
    
    // 3. Deploy ClaimIssuer
    console.log("\n3. Deploying ClaimIssuer...");
    const ClaimIssuer = await ethers.getContractFactory("ClaimIssuer");
    const claimIssuer = await upgrades.deployProxy(
      ClaimIssuer,
      [deployer.address],
      { kind: "uups" }
    );
    await claimIssuer.waitForDeployment();
    deploymentResults.claimIssuer = await claimIssuer.getAddress();
    console.log("✅ ClaimIssuer:", deploymentResults.claimIssuer);
    
    // 4. Deploy CountryRestrictModule
    console.log("\n4. Deploying CountryRestrictModule...");
    const CountryRestrictModule = await ethers.getContractFactory("CountryRestrictModule");
    const countryModule = await upgrades.deployProxy(
      CountryRestrictModule,
      [deployer.address],
      { kind: "uups" }
    );
    await countryModule.waitForDeployment();
    deploymentResults.countryModule = await countryModule.getAddress();
    console.log("✅ CountryRestrictModule:", deploymentResults.countryModule);
    
    // 5. Deploy TransferLimitModule
    console.log("\n5. Deploying TransferLimitModule...");
    const TransferLimitModule = await ethers.getContractFactory("TransferLimitModule");
    const defaultDailyLimit = ethers.parseEther("100000"); // 100k daily
    const defaultMonthlyLimit = ethers.parseEther("1000000"); // 1M monthly
    const transferLimitModule = await upgrades.deployProxy(
      TransferLimitModule,
      [deployer.address, defaultDailyLimit, defaultMonthlyLimit],
      { kind: "uups" }
    );
    await transferLimitModule.waitForDeployment();
    deploymentResults.transferLimitModule = await transferLimitModule.getAddress();
    console.log("✅ TransferLimitModule:", deploymentResults.transferLimitModule);
    
    // 6. Deploy MaxBalanceModule
    console.log("\n6. Deploying MaxBalanceModule...");
    const MaxBalanceModule = await ethers.getContractFactory("MaxBalanceModule");
    const defaultMaxBalance = ethers.parseEther("10000000"); // 10M max balance
    const maxBalanceModule = await upgrades.deployProxy(
      MaxBalanceModule,
      [deployer.address, defaultMaxBalance],
      { kind: "uups" }
    );
    await maxBalanceModule.waitForDeployment();
    deploymentResults.maxBalanceModule = await maxBalanceModule.getAddress();
    console.log("✅ MaxBalanceModule:", deploymentResults.maxBalanceModule);
    
    // 7. Deploy ModularCompliance
    console.log("\n7. Deploying ModularCompliance...");
    const ModularCompliance = await ethers.getContractFactory("ModularCompliance");
    const modularCompliance = await upgrades.deployProxy(
      ModularCompliance,
      [deployer.address],
      { kind: "uups" }
    );
    await modularCompliance.waitForDeployment();
    deploymentResults.modularCompliance = await modularCompliance.getAddress();
    console.log("✅ ModularCompliance:", deploymentResults.modularCompliance);
    
    // Note: Skipping main token deployment due to size constraints
    console.log("\n⚠️  Note: Main token contracts exceed BSC testnet size limits");
    console.log("Deployed 7 supporting contracts successfully");
    
    // Configure contracts
    console.log("\n📋 Configuring contracts...");
    
    // Set claim topics registry in identity registry
    await identityRegistry.setClaimTopicsRegistry(deploymentResults.claimTopicsRegistry);
    console.log("✅ Set claim topics registry in identity registry");
    
    // Add compliance modules
    await modularCompliance.addModule(deploymentResults.countryModule);
    await modularCompliance.addModule(deploymentResults.transferLimitModule);
    await modularCompliance.addModule(deploymentResults.maxBalanceModule);
    console.log("✅ Added all compliance modules");
    
    // Get implementation addresses for verification
    console.log("\n📍 Getting implementation addresses...");
    const implementations = {};
    
    for (const [name, proxyAddress] of Object.entries(deploymentResults)) {
      const implAddress = await upgrades.erc1967.getImplementationAddress(proxyAddress);
      implementations[name] = implAddress;
      console.log(`${name} implementation:`, implAddress);
    }
    
    // Verify all contracts
    console.log("\n🔍 Starting verification process...");
    
    // Verify implementations
    for (const [name, implAddress] of Object.entries(implementations)) {
      verificationResults[name] = await verifyContract(implAddress);
    }
    
    // Save deployment data
    const deploymentData = {
      network: "bsc_testnet",
      chainId: 97,
      deploymentDate: new Date().toISOString(),
      deployer: deployer.address,
      contracts: deploymentResults,
      implementations: implementations,
      verificationResults: verificationResults,
      note: "Main token contracts not deployed due to BSC testnet size constraints"
    };
    
    const deploymentsDir = path.join(__dirname, "../deployments");
    if (!fs.existsSync(deploymentsDir)) {
      fs.mkdirSync(deploymentsDir, { recursive: true });
    }
    
    fs.writeFileSync(
      path.join(deploymentsDir, "bsc_testnet_deployment.json"),
      JSON.stringify(deploymentData, null, 2)
    );
    
    // Print summary
    console.log("\n🎉 BSC Testnet Deployment Summary:");
    console.log("=".repeat(50));
    console.log("Network: BSC Testnet (Chain ID: 97)");
    console.log("Deployer:", deployer.address);
    console.log("\nContract Addresses:");
    for (const [name, address] of Object.entries(deploymentResults)) {
      console.log(`${name}: ${address}`);
      console.log(`View on BSCScan: https://testnet.bscscan.com/address/${address}`);
    }
    
    console.log("\nVerification Results:");
    const successCount = Object.values(verificationResults).filter(v => v).length;
    console.log(`✅ Successfully verified: ${successCount}/${Object.keys(verificationResults).length}`);
    
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