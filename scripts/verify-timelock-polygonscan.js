const { ethers } = require("hardhat");

async function main() {
  console.log("🔍 Attempting to verify Timelock on Polygonscan...");
  
  // First, let's try with a new API key approach
  const contractAddress = "0xc929923D0d52Df0b72C8cf00C7c6156DB24232dE";
  
  // Constructor arguments
  const minDelay = 172800; // 2 days
  const proposers = ["0xCE982AC6bc316Cf9d875652B84C7626B62a899eA", "0x0000000000000000000000000000000000000000"];
  const executors = ["0xCE982AC6bc316Cf9d875652B84C7626B62a899eA"];
  const admin = "0xCE982AC6bc316Cf9d875652B84C7626B62a899eA";
  
  // Generate ABI encoded constructor arguments
  const abiCoder = ethers.utils.defaultAbiCoder;
  const encodedArgs = abiCoder.encode(
    ["uint256", "address[]", "address[]", "address"],
    [minDelay, proposers, executors, admin]
  );
  
  console.log("Contract Address:", contractAddress);
  console.log("Constructor Arguments (ABI encoded):");
  console.log(encodedArgs);
  
  // Try verification with etherscan API directly
  const axios = require('axios');
  const fs = require('fs');
  const path = require('path');
  
  // Read the flattened source
  let sourceCode;
  try {
    sourceCode = fs.readFileSync(path.join(__dirname, '../FinatradesTimelock_flattened.sol'), 'utf8');
    // Remove the first line if it contains dotenv output
    sourceCode = sourceCode.replace(/^\[dotenv.*\]\s*.*\n/, '');
  } catch (error) {
    console.log("Creating flattened source...");
    const { exec } = require('child_process');
    await new Promise((resolve, reject) => {
      exec('npx hardhat flatten contracts/governance/FinatradesTimelock.sol', (error, stdout, stderr) => {
        if (error) reject(error);
        sourceCode = stdout.replace(/^\[dotenv.*\]\s*.*\n/, '');
        fs.writeFileSync('FinatradesTimelock_flattened.sol', sourceCode);
        resolve();
      });
    });
  }
  
  // Manual verification data
  console.log("\n📋 Manual Verification Instructions:");
  console.log("1. Visit: https://polygonscan.com/verifyContract");
  console.log("2. Contract Address:", contractAddress);
  console.log("3. Compiler Type: Solidity (Single file)");
  console.log("4. Compiler Version: v0.8.19+commit.7dd6d404");
  console.log("5. Open Source License: MIT");
  console.log("6. Optimization: Yes, with 1 runs");
  console.log("7. Contract Name: FinatradesTimelock");
  console.log("\n8. Constructor Arguments (ABI-encoded):");
  console.log(encodedArgs);
  console.log("\n9. Use the flattened source code from: FinatradesTimelock_flattened.sol");
  
  // Alternative: Try direct API submission
  if (process.env.POLYGONSCAN_API_KEY) {
    console.log("\n🔄 Attempting direct API submission...");
    
    const data = {
      apikey: process.env.POLYGONSCAN_API_KEY,
      module: 'contract',
      action: 'verifysourcecode',
      contractaddress: contractAddress,
      sourceCode: sourceCode,
      codeformat: 'solidity-single-file',
      contractname: 'FinatradesTimelock',
      compilerversion: 'v0.8.19+commit.7dd6d404',
      optimizationUsed: '1',
      runs: '1',
      constructorArguements: encodedArgs.slice(2), // Remove 0x prefix
      licenseType: '3' // MIT
    };
    
    try {
      const response = await axios.post('https://api.polygonscan.com/api', null, { params: data });
      console.log("API Response:", response.data);
      
      if (response.data.status === '1') {
        console.log("✅ Verification request submitted successfully!");
        console.log("GUID:", response.data.result);
        
        // Check status
        setTimeout(async () => {
          const statusResponse = await axios.get('https://api.polygonscan.com/api', {
            params: {
              apikey: process.env.POLYGONSCAN_API_KEY,
              module: 'contract',
              action: 'checkverifystatus',
              guid: response.data.result
            }
          });
          console.log("Verification Status:", statusResponse.data);
        }, 10000);
      }
    } catch (error) {
      console.log("API submission failed:", error.message);
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });