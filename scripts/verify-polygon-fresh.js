const { run } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function verifyContract(address, constructorArguments = [], contractPath = "") {
  console.log(`⏳ Verifying ${address}...`);
  await delay(10000);
  
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
  console.log("🔍 Verifying freshly deployed Polygon mainnet contracts...\n");
  
  const deployerAddress = "0xCE982AC6bc316Cf9d875652B84C7626B62a899eA";
  
  // Deployed contracts
  const contracts = {
    claimTopicsRegistry: "0xeCf537CADeBd2951776f3AC3c1e9b76218d6ecE4",
    identityRegistry: "0x59A1923E694061b9A49b2eC92AeeF99077f42532",
    claimIssuer: "0x625986DD1A10859C7F6326eE50B9901D5AD82170",
    countryModule: "0x620818526106cc35ab598D2500632A62e0176619",
    transferLimitModule: "0xbb109a19000dF7ca3062161794405DAC026DB4E5",
    maxBalanceModule: "0x64BC91aba0EF92F4565b076Ea1382B2d82d418cD",
    modularCompliance: "0x115f87dC7bB192924069b4291DAF0Dcd39C0A76b",
    token: "0x414A484985771C2CFDA215FB20C48ed037eE409b",
    timelock: "0xCF3FA612F1eF813e31Af012B2D77eA8f3d191F82",
    assetRegistry: "0xB678e16e773790B0FD56D36a516731dfA8761b77"
  };
  
  // Implementation addresses (from deployment logs)
  const implementations = {
    claimTopicsRegistry: "0xF3e5D0f2d6bE87DA0AeA7da96c5c97Fe36D3C55E",
    identityRegistry: "0x5a77D37e5c3B3EC2DCcE82F8DE2D4F9FD2b88329",
    claimIssuer: "0xAcE2FA0Aec33A3a0B685f7ce90d8851E7d91AeD8",
    countryModule: "0x0B2ce8afFdcBCb3dd5d614f973Fc2d2f4Df3c3E1",
    transferLimitModule: "0x4b96a3c3B37A3d0A10aDb0Be9cb45E2d55F9DDd0",
    maxBalanceModule: "0x6cEA7336c0F8E1F95B67Ed88c8a59E46E9Ce569A",
    modularCompliance: "0x87e7eA8F688e1ec417a0d4C95BA8d43F49Fa3e5B",
    token: "0x907e31Fe52dE3C48C4c07F436a7d1e25D9FDCc70",
    assetRegistry: "0xED5b1FC638f18D7AEa0DC24c7E3fa96D73AB4E23"
  };
  
  const verificationResults = {};
  
  // Verify implementations
  console.log("Verifying implementation contracts...\n");
  for (const [name, implAddress] of Object.entries(implementations)) {
    verificationResults[name] = await verifyContract(implAddress);
  }
  
  // Verify timelock (non-proxy)
  console.log("\nVerifying Timelock contract...");
  const minDelay = 172800; // 2 days
  const proposers = [deployerAddress, "0x0000000000000000000000000000000000000000"];
  const executors = [deployerAddress];
  const admin = deployerAddress;
  
  verificationResults.timelock = await verifyContract(
    contracts.timelock,
    [minDelay, proposers, executors, admin]
  );
  
  // Save results
  const deploymentData = {
    network: "polygon_mainnet",
    chainId: 137,
    deploymentDate: new Date().toISOString(),
    deployer: deployerAddress,
    contracts: contracts,
    implementations: implementations,
    verificationStatus: verificationResults,
    note: "Fresh deployment of 10 contracts (TokenV2 skipped due to initialization ambiguity)"
  };
  
  const deploymentsDir = path.join(__dirname, "../deployments");
  if (!fs.existsSync(deploymentsDir)) {
    fs.mkdirSync(deploymentsDir, { recursive: true });
  }
  
  fs.writeFileSync(
    path.join(deploymentsDir, "polygon_mainnet_fresh_verified_final.json"),
    JSON.stringify(deploymentData, null, 2)
  );
  
  // Summary
  console.log("\n🎉 Polygon Mainnet Fresh Deployment Summary:");
  console.log("=".repeat(50));
  console.log("Network: Polygon Mainnet (Chain ID: 137)");
  console.log("\nContract Addresses:");
  for (const [name, address] of Object.entries(contracts)) {
    console.log(`${name}: ${address}`);
    console.log(`View on Polygonscan: https://polygonscan.com/address/${address}`);
  }
  
  console.log("\nVerification Results:");
  const successCount = Object.values(verificationResults).filter(v => v).length;
  console.log(`✅ Successfully verified: ${successCount}/${Object.keys(verificationResults).length}`);
  
  console.log("\n✅ 10 contracts freshly deployed to Polygon mainnet!");
  console.log("✅ Ready for audit!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });