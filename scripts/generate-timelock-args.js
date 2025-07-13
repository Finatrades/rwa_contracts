const { ethers } = require("hardhat");

async function main() {
  // Constructor arguments
  const minDelay = 172800; // 2 days
  const proposers = ["0xCE982AC6bc316Cf9d875652B84C7626B62a899eA", "0x0000000000000000000000000000000000000000"];
  const executors = ["0xCE982AC6bc316Cf9d875652B84C7626B62a899eA"];
  const admin = "0xCE982AC6bc316Cf9d875652B84C7626B62a899eA";
  
  // Generate ABI encoded constructor arguments
  const ABI = ["uint256", "address[]", "address[]", "address"];
  const values = [minDelay, proposers, executors, admin];
  
  const abiCoder = new ethers.AbiCoder();
  const encodedArgs = abiCoder.encode(ABI, values);
  
  console.log("Timelock Contract Verification Details");
  console.log("=====================================");
  console.log("\nContract Address: 0xc929923D0d52Df0b72C8cf00C7c6156DB24232dE");
  console.log("\nConstructor Arguments:");
  console.log("- minDelay:", minDelay, "(2 days)");
  console.log("- proposers:", proposers);
  console.log("- executors:", executors);
  console.log("- admin:", admin);
  console.log("\nABI-encoded Constructor Arguments:");
  console.log(encodedArgs);
  console.log("\nWithout 0x prefix:");
  console.log(encodedArgs.slice(2));
  
  // Generate verification URL
  const baseUrl = "https://polygonscan.com/verifyContract";
  console.log("\nManual Verification URL:");
  console.log(baseUrl);
  
  console.log("\nVerification Settings:");
  console.log("- Compiler Type: Solidity (Single file)");
  console.log("- Compiler Version: v0.8.19+commit.7dd6d404");
  console.log("- License: MIT (3)");
  console.log("- Optimization: Yes");
  console.log("- Runs: 1");
  console.log("- Contract Name: FinatradesTimelock");
  console.log("\nPaste the flattened source code from: FinatradesTimelock_flattened.sol");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });