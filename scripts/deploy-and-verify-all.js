const { ethers, upgrades, run } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function verifyContract(address, constructorArguments = [], contractPath = "") {
  console.log(`⏳ Waiting 30 seconds before verifying ${address}...`);
  await delay(30000); // Wait for Polygonscan to index
  
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
  console.log("🚀 Starting fresh deployment and verification on Polygon mainnet...\n");
  
  const [deployer] = await ethers.getSigners();
  console.log("Deploying with account:", deployer.address);
  
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("Account balance:", ethers.formatEther(balance), "MATIC\n");
  
  const deploymentResults = {};
  
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
    
    // 4. Deploy Compliance Modules
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
    
    // 8. Deploy Main Token
    console.log("\n8. Deploying FinatradesRWA_ERC3643...");
    const Token = await ethers.getContractFactory("FinatradesRWA_ERC3643");
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
    console.log("✅ FinatradesRWA_ERC3643:", deploymentResults.token);
    
    // 9. Deploy Timelock
    console.log("\n9. Deploying Timelock...");
    const Timelock = await ethers.getContractFactory("FinatradesTimelock");
    const minDelay = 172800; // 2 days
    const proposers = [deployer.address, ethers.ZeroAddress];
    const executors = [deployer.address];
    const admin = deployer.address;
    
    const timelock = await Timelock.deploy(minDelay, proposers, executors, admin);
    await timelock.waitForDeployment();
    deploymentResults.timelock = await timelock.getAddress();
    console.log("✅ Timelock:", deploymentResults.timelock);
    
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
    
    // Bind token to compliance
    await modularCompliance.bindToken(deploymentResults.token);
    console.log("✅ Bound token to compliance");
    
    // Save deployment addresses
    const deploymentData = {
      network: "polygon_mainnet",
      chainId: 137,
      deploymentDate: new Date().toISOString(),
      deployer: deployer.address,
      contracts: deploymentResults
    };
    
    fs.writeFileSync(
      path.join(__dirname, "../deployments/polygon_mainnet_fresh.json"),
      JSON.stringify(deploymentData, null, 2)
    );
    
    console.log("\n🔍 Starting verification process...\n");
    
    // Verify all contracts
    const verificationResults = {};
    
    // Get implementation addresses for proxy contracts
    const implAddresses = {};
    for (const [name, proxyAddress] of Object.entries(deploymentResults)) {
      if (name !== 'timelock') {
        try {
          const implAddress = await upgrades.erc1967.getImplementationAddress(proxyAddress);
          implAddresses[name] = implAddress;
          console.log(`${name} implementation:`, implAddress);
        } catch (e) {
          console.log(`Failed to get implementation for ${name}`);
        }
      }
    }
    
    // Verify proxies and implementations
    console.log("\nVerifying contracts on Polygonscan...\n");
    
    // Verify implementations first
    verificationResults.claimTopicsRegistryImpl = await verifyContract(implAddresses.claimTopicsRegistry);
    verificationResults.identityRegistryImpl = await verifyContract(implAddresses.identityRegistry);
    verificationResults.claimIssuerImpl = await verifyContract(implAddresses.claimIssuer);
    verificationResults.countryModuleImpl = await verifyContract(implAddresses.countryModule);
    verificationResults.transferLimitModuleImpl = await verifyContract(implAddresses.transferLimitModule);
    verificationResults.maxBalanceModuleImpl = await verifyContract(implAddresses.maxBalanceModule);
    verificationResults.modularComplianceImpl = await verifyContract(implAddresses.modularCompliance);
    verificationResults.tokenImpl = await verifyContract(
      implAddresses.token,
      []  // Implementation contracts don't have constructor args
    );
    
    // Verify Timelock (not a proxy)
    verificationResults.timelock = await verifyContract(
      deploymentResults.timelock,
      [minDelay, proposers, executors, admin],
      "contracts/governance/FinatradesTimelock.sol:FinatradesTimelock"
    );
    
    // Summary
    console.log("\n📊 Deployment Summary:");
    console.log("====================");
    for (const [name, address] of Object.entries(deploymentResults)) {
      console.log(`${name}: ${address}`);
    }
    
    console.log("\n✅ Verification Summary:");
    console.log("======================");
    for (const [name, result] of Object.entries(verificationResults)) {
      console.log(`${name}: ${result ? '✅' : '❌'}`);
    }
    
    console.log("\n✅ Deployment and verification complete!");
    
  } catch (error) {
    console.error("\n❌ Deployment failed:", error);
    
    // Save partial deployment
    fs.writeFileSync(
      path.join(__dirname, "../deployments/polygon_mainnet_fresh_partial.json"),
      JSON.stringify(deploymentResults, null, 2)
    );
    
    throw error;
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });