const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

async function verifyTimelock() {
  console.log("Attempting to verify Timelock contract using flattened source...\n");
  
  try {
    // First, try to flatten the contract
    console.log("1. Flattening the FinatradesTimelock contract...");
    execSync('npx hardhat flatten contracts/governance/FinatradesTimelock.sol > FinatradesTimelock_flattened.sol', { stdio: 'inherit' });
    
    console.log("\n2. Flattened file created: FinatradesTimelock_flattened.sol");
    console.log("\n3. Manual verification steps:");
    console.log("   a. Go to: https://polygonscan.com/address/0xc929923D0d52Df0b72C8cf00C7c6156DB24232dE#code");
    console.log("   b. Click 'Verify and Publish'");
    console.log("   c. Select:");
    console.log("      - Compiler Type: Solidity (Single file)");
    console.log("      - Compiler Version: v0.8.19+commit.7dd6d404");
    console.log("      - Open Source License: MIT");
    console.log("   d. Copy the contents of FinatradesTimelock_flattened.sol");
    console.log("   e. Enable optimization with 1 run");
    console.log("   f. Constructor Arguments (ABI-encoded):");
    console.log("      000000000000000000000000000000000000000000000000000000000002a300");
    console.log("      0000000000000000000000000000000000000000000000000000000000000080");
    console.log("      00000000000000000000000000000000000000000000000000000000000000e0");
    console.log("      000000000000000000000000ce982ac6bc316cf9d875652b84c7626b62a899ea");
    console.log("      0000000000000000000000000000000000000000000000000000000000000002");
    console.log("      000000000000000000000000ce982ac6bc316cf9d875652b84c7626b62a899ea");
    console.log("      0000000000000000000000000000000000000000000000000000000000000000");
    console.log("      0000000000000000000000000000000000000000000000000000000000000001");
    console.log("      000000000000000000000000ce982ac6bc316cf9d875652b84c7626b62a899ea");
    
    console.log("\n4. Constructor argument details:");
    console.log("   - minDelay: 172800 (2 days in seconds)");
    console.log("   - proposers: [0xCE982AC6bc316Cf9d875652B84C7626B62a899eA, 0x0000000000000000000000000000000000000000]");
    console.log("   - executors: [0xCE982AC6bc316Cf9d875652B84C7626B62a899eA]");
    console.log("   - admin: 0xCE982AC6bc316Cf9d875652B84C7626B62a899eA");
    
    // Check if the flattened file was created
    if (fs.existsSync('FinatradesTimelock_flattened.sol')) {
      console.log("\n✅ Flattened source file created successfully!");
      console.log("   You can now proceed with manual verification on Polygonscan.");
    }
    
  } catch (error) {
    console.error("Error during flattening:", error.message);
  }
}

verifyTimelock();