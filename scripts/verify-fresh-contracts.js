const { ethers, upgrades, run } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function verifyContract(address, constructorArguments = [], contractPath = "") {
  console.log(`\n🔍 Verifying ${address}...`);
  
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
    console.error(`❌ Verification failed: ${error.message}`);
    return false;
  }
}

async function main() {
  console.log("🚀 Starting verification of fresh contracts...\n");
  
  // Load deployment data
  const deploymentData = JSON.parse(
    fs.readFileSync(path.join(__dirname, "../deployments/polygon_mainnet_fresh.json"))
  );
  
  const contracts = deploymentData.contracts;
  const [deployer] = await ethers.getSigners();
  
  console.log("Deployed contracts:");
  console.log("==================");
  for (const [name, address] of Object.entries(contracts)) {
    console.log(`${name}: ${address}`);
  }
  
  console.log("\n📋 Getting implementation addresses...");
  
  // Get implementation addresses for proxy contracts
  const implementations = {};
  
  // Get all implementation addresses
  for (const [name, proxyAddress] of Object.entries(contracts)) {
    if (name !== 'timelock') {
      try {
        const implAddress = await upgrades.erc1967.getImplementationAddress(proxyAddress);
        implementations[name] = implAddress;
        console.log(`${name} implementation: ${implAddress}`);
      } catch (e) {
        console.log(`Failed to get implementation for ${name}`);
      }
    }
  }
  
  console.log("\n🔍 Verifying all contracts...");
  
  const verificationResults = {};
  
  // Wait a bit for contracts to be indexed
  console.log("⏳ Waiting 10 seconds for indexing...");
  await delay(10000);
  
  // Verify proxy contracts (they verify automatically when implementation is verified)
  console.log("\n📦 Verifying implementation contracts...");
  
  // 1. ClaimTopicsRegistry
  verificationResults.claimTopicsRegistry = await verifyContract(
    implementations.claimTopicsRegistry,
    [],
    "contracts/identity/ClaimTopicsRegistry.sol:ClaimTopicsRegistry"
  );
  await delay(3000);
  
  // 2. IdentityRegistry
  verificationResults.identityRegistry = await verifyContract(
    implementations.identityRegistry,
    [],
    "contracts/identity/IdentityRegistry.sol:IdentityRegistry"
  );
  await delay(3000);
  
  // 3. ClaimIssuer
  verificationResults.claimIssuer = await verifyContract(
    implementations.claimIssuer,
    [],
    "contracts/identity/ClaimIssuer.sol:ClaimIssuer"
  );
  await delay(3000);
  
  // 4. CountryRestrictModule
  verificationResults.countryModule = await verifyContract(
    implementations.countryModule,
    [],
    "contracts/compliance/modular/CountryRestrictModule.sol:CountryRestrictModule"
  );
  await delay(3000);
  
  // 5. TransferLimitModule
  verificationResults.transferLimitModule = await verifyContract(
    implementations.transferLimitModule,
    [],
    "contracts/compliance/modular/TransferLimitModule.sol:TransferLimitModule"
  );
  await delay(3000);
  
  // 6. MaxBalanceModule
  verificationResults.maxBalanceModule = await verifyContract(
    implementations.maxBalanceModule,
    [],
    "contracts/compliance/modular/MaxBalanceModule.sol:MaxBalanceModule"
  );
  await delay(3000);
  
  // 7. ModularCompliance
  verificationResults.modularCompliance = await verifyContract(
    implementations.modularCompliance,
    [],
    "contracts/compliance/ModularCompliance.sol:ModularCompliance"
  );
  await delay(3000);
  
  // 8. Token
  verificationResults.token = await verifyContract(
    implementations.token,
    [],
    "contracts/FinatradesRWA_ERC3643.sol:FinatradesRWA_ERC3643"
  );
  await delay(3000);
  
  // 9. Timelock (not a proxy)
  console.log("\n📦 Verifying Timelock contract...");
  const minDelay = 172800; // 2 days
  const proposers = [deployer.address, ethers.ZeroAddress];
  const executors = [deployer.address];
  const admin = deployer.address;
  
  verificationResults.timelock = await verifyContract(
    contracts.timelock,
    [minDelay, proposers, executors, admin],
    "contracts/governance/FinatradesTimelock.sol:FinatradesTimelock"
  );
  
  // Summary
  console.log("\n✅ Verification Summary:");
  console.log("======================");
  let allVerified = true;
  for (const [name, result] of Object.entries(verificationResults)) {
    console.log(`${name}: ${result ? '✅' : '❌'}`);
    if (!result) allVerified = false;
  }
  
  if (!allVerified) {
    console.log("\n⚠️  Some contracts failed verification. They may already be verified or need manual verification.");
    console.log("\nFor manual verification, visit:");
    console.log("https://polygonscan.com/verifyContract");
  } else {
    console.log("\n🎉 All contracts verified successfully!");
  }
  
  // Save verification status
  const verificationData = {
    ...deploymentData,
    implementations: implementations,
    verificationStatus: verificationResults,
    verificationDate: new Date().toISOString()
  };
  
  fs.writeFileSync(
    path.join(__dirname, "../deployments/polygon_mainnet_fresh_verified.json"),
    JSON.stringify(verificationData, null, 2)
  );
  
  console.log("\n📁 Verification data saved to deployments/polygon_mainnet_fresh_verified.json");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });