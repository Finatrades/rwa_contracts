const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  console.log("Checking verification status of all deployed contracts on Polygon...\n");

  // Read deployment file
  const deploymentPath = path.join(__dirname, "../deployments/polygon_deployment.json");
  const deployment = JSON.parse(fs.readFileSync(deploymentPath, "utf8"));

  const allContracts = [];

  // Add proxy contracts
  for (const [name, address] of Object.entries(deployment.contracts)) {
    allContracts.push({ name, address, type: "proxy" });
  }

  // Add implementation contracts
  for (const [name, address] of Object.entries(deployment.implementations)) {
    allContracts.push({ name: `${name} (Implementation)`, address, type: "implementation" });
  }

  // Add token implementations
  for (const [name, address] of Object.entries(deployment.tokenImplementations)) {
    allContracts.push({ name: `${name} (Token Implementation)`, address, type: "tokenImpl" });
  }

  // Add FinatradesMultiToken implementation
  if (deployment.FinatradesMultiToken?.implementation) {
    allContracts.push({ 
      name: "FinatradesMultiToken (Direct Implementation)", 
      address: deployment.FinatradesMultiToken.implementation, 
      type: "multiTokenImpl" 
    });
  }

  console.log(`Total contracts to check: ${allContracts.length}\n`);

  const unverifiedContracts = [];

  for (const contract of allContracts) {
    try {
      const url = `https://polygonscan.com/address/${contract.address}#code`;
      
      // Check if contract is verified using etherscan API
      const apiKey = process.env.POLYGONSCAN_API_KEY;
      const apiUrl = `https://api.polygonscan.com/api?module=contract&action=getsourcecode&address=${contract.address}&apikey=${apiKey}`;
      
      const response = await fetch(apiUrl);
      const data = await response.json();
      
      const isVerified = data.result[0].SourceCode !== "";
      
      if (isVerified) {
        console.log(`✅ ${contract.name}: ${contract.address} - VERIFIED`);
      } else {
        console.log(`❌ ${contract.name}: ${contract.address} - NOT VERIFIED`);
        unverifiedContracts.push(contract);
      }
    } catch (error) {
      console.log(`⚠️  ${contract.name}: ${contract.address} - Could not check (${error.message})`);
      unverifiedContracts.push(contract);
    }
  }

  console.log("\n" + "=".repeat(80));
  console.log(`\nSummary:`);
  console.log(`Total contracts: ${allContracts.length}`);
  console.log(`Verified: ${allContracts.length - unverifiedContracts.length}`);
  console.log(`Unverified: ${unverifiedContracts.length}`);

  if (unverifiedContracts.length > 0) {
    console.log(`\nUnverified contracts that need verification:`);
    for (const contract of unverifiedContracts) {
      console.log(`  - ${contract.name}: ${contract.address}`);
    }
  } else {
    console.log(`\n✅ All contracts are verified!`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });