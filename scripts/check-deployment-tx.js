const hre = require("hardhat");

async function main() {
  console.log("=== Checking Token Deployment Transaction ===\n");

  const txHash = "0xa5af4b8e1aaa06ba399713dbfe7eae6535d4dcabe64edb0e2c4f2b0a2ec61285";
  
  // Get the transaction receipt
  const receipt = await hre.ethers.provider.getTransactionReceipt(txHash);
  
  if (!receipt) {
    console.log("Transaction not found!");
    return;
  }
  
  console.log("Transaction Receipt:");
  console.log("Status:", receipt.status === 1 ? "✅ Success" : "❌ Failed");
  console.log("Block Number:", receipt.blockNumber);
  console.log("Gas Used:", receipt.gasUsed.toString());
  console.log("Contract Address:", receipt.contractAddress);
  console.log("\nLogs found:", receipt.logs.length);
  
  // Get the factory contract to decode events
  const FACTORY_ADDRESS = "0x5aC1EB4BE5D56D0d0b37ac21E3A2362d028F7A70";
  const Factory = await hre.ethers.getContractAt("FinatradesTokenFactory", FACTORY_ADDRESS);
  
  console.log("\n=== Decoding Events ===");
  
  // Try to parse logs
  for (let i = 0; i < receipt.logs.length; i++) {
    const log = receipt.logs[i];
    console.log(`\nLog ${i}:`);
    console.log("Address:", log.address);
    console.log("Topics:", log.topics.length);
    
    try {
      // Try to parse as factory event
      const parsed = Factory.interface.parseLog({
        topics: log.topics,
        data: log.data
      });
      
      if (parsed) {
        console.log("Event Name:", parsed.name);
        console.log("Args:", parsed.args);
        
        if (parsed.name === "TokenDeployed") {
          console.log("\n🎉 TokenDeployed Event Found!");
          console.log("Token Address:", parsed.args.tokenAddress);
          console.log("Token Type:", parsed.args.tokenType);
          console.log("Name:", parsed.args.name);
          console.log("Symbol:", parsed.args.symbol);
          console.log("Deployer:", parsed.args.deployer);
          console.log("Asset ID:", parsed.args.assetId);
        }
      }
    } catch (e) {
      // Not a factory event, might be from another contract
      console.log("Not a factory event or parsing error");
    }
  }
  
  // Also check if any contracts were created
  if (receipt.logs.length > 0) {
    console.log("\n=== Checking for Contract Creation ===");
    for (const log of receipt.logs) {
      if (log.topics[0] === "0x8be0079c531659141344cd1fd0a4f28419497f9722a3daafe3b4186f6b6457e0") {
        console.log("Ownership transfer detected at:", log.address);
      }
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });