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
  console.log("🚀 Starting complete fresh deployment on Polygon mainnet...\n");
  
  const [deployer] = await ethers.getSigners();
  console.log("Deploying with account:", deployer.address);
  
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("Account balance:", ethers.formatEther(balance), "MATIC\n");
  
  const deploymentResults = {};
  const implementations = {};
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
    const defaultDailyLimit = ethers.parseEther("100000");
    const defaultMonthlyLimit = ethers.parseEther("1000000");
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
    const defaultMaxBalance = ethers.parseEther("10000000");
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
        deployer.address,
        "Finatrades RWA Token",
        "FRWA",
        18,
        deploymentResults.identityRegistry,
        deploymentResults.modularCompliance
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
    
    // 10. Deploy AssetRegistry
    console.log("\n10. Deploying AssetRegistry...");
    const AssetRegistry = await ethers.getContractFactory("AssetRegistry");
    const assetRegistry = await upgrades.deployProxy(
      AssetRegistry,
      [deployer.address],
      { kind: "uups" }
    );
    await assetRegistry.waitForDeployment();
    deploymentResults.assetRegistry = await assetRegistry.getAddress();
    console.log("✅ AssetRegistry:", deploymentResults.assetRegistry);
    
    // 11. Deploy TokenV2
    console.log("\n11. Deploying FinatradesRWA_ERC3643_V2...");
    const TokenV2 = await ethers.getContractFactory("FinatradesRWA_ERC3643_V2");
    const tokenV2 = await upgrades.deployProxy(
      TokenV2,
      [
        deployer.address,
        "Finatrades Universal RWA Token",
        "FURWA",
        18,
        deploymentResults.identityRegistry,
        deploymentResults.modularCompliance,
        deploymentResults.assetRegistry
      ],
      { kind: "uups" }
    );
    await tokenV2.waitForDeployment();
    deploymentResults.tokenV2 = await tokenV2.getAddress();
    console.log("✅ FinatradesRWA_ERC3643_V2:", deploymentResults.tokenV2);
    
    // Configure contracts
    console.log("\n📋 Configuring contracts...");
    
    await identityRegistry.setClaimTopicsRegistry(deploymentResults.claimTopicsRegistry);
    console.log("✅ Set claim topics registry in identity registry");
    
    await modularCompliance.addModule(deploymentResults.countryModule);
    await modularCompliance.addModule(deploymentResults.transferLimitModule);
    await modularCompliance.addModule(deploymentResults.maxBalanceModule);
    console.log("✅ Added all compliance modules");
    
    await modularCompliance.bindToken(deploymentResults.token);
    console.log("✅ Bound token to compliance");
    
    await assetRegistry.authorizeTokenContract(deploymentResults.tokenV2, true);
    console.log("✅ Authorized TokenV2 in AssetRegistry");
    
    // Get implementation addresses
    console.log("\n📍 Getting implementation addresses...");
    for (const [name, proxyAddress] of Object.entries(deploymentResults)) {
      if (name !== "timelock") {
        const implAddress = await upgrades.erc1967.getImplementationAddress(proxyAddress);
        implementations[name] = implAddress;
        console.log(`${name} implementation:`, implAddress);
      }
    }
    
    // Save deployment data
    const deploymentData = {
      network: "polygon_mainnet",
      chainId: 137,
      deploymentDate: new Date().toISOString(),
      deployer: deployer.address,
      contracts: deploymentResults,
      implementations: implementations,
      verificationStatus: {}
    };
    
    const deploymentsDir = path.join(__dirname, "../deployments");
    if (!fs.existsSync(deploymentsDir)) {
      fs.mkdirSync(deploymentsDir, { recursive: true });
    }
    
    fs.writeFileSync(
      path.join(deploymentsDir, "polygon_mainnet_fresh_complete.json"),
      JSON.stringify(deploymentData, null, 2)
    );
    
    // Verify all contracts
    console.log("\n🔍 Starting verification process...");
    
    // Verify implementations
    for (const [name, implAddress] of Object.entries(implementations)) {
      verificationResults[name] = await verifyContract(implAddress);
    }
    
    // Verify timelock
    verificationResults.timelock = await verifyContract(
      deploymentResults.timelock,
      [minDelay, proposers, executors, admin]
    );
    
    // Update deployment data with verification results
    deploymentData.verificationStatus = verificationResults;
    deploymentData.verificationDate = new Date().toISOString();
    
    fs.writeFileSync(
      path.join(deploymentsDir, "polygon_mainnet_fresh_complete.json"),
      JSON.stringify(deploymentData, null, 2)
    );
    
    // Print summary
    console.log("\n🎉 Polygon Mainnet Deployment Summary:");
    console.log("=".repeat(50));
    console.log("Total Contracts Deployed: 11");
    console.log("\nContract Addresses:");
    for (const [name, address] of Object.entries(deploymentResults)) {
      console.log(`${name}: ${address}`);
      console.log(`View on Polygonscan: https://polygonscan.com/address/${address}`);
    }
    
    console.log("\nVerification Results:");
    const successCount = Object.values(verificationResults).filter(v => v).length;
    console.log(`✅ Successfully verified: ${successCount}/${Object.keys(verificationResults).length}`);
    
    console.log("\n✅ All 11 contracts deployed fresh to Polygon mainnet!");
    console.log("✅ Ready for audit and web development!");
    
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