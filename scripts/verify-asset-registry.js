const { run } = require("hardhat");

async function main() {
  console.log("🔍 Verifying AssetRegistry implementation contract...\n");
  
  const contractAddress = "0x3eb39039b860Fc8476A28aF1d33d51562bcBaa6d";
  
  try {
    await run("verify:verify", {
      address: contractAddress,
      constructorArguments: [],
      contract: "contracts/registry/AssetRegistry.sol:AssetRegistry"
    });
    
    console.log("✅ AssetRegistry implementation verified successfully!");
  } catch (error) {
    if (error.message.includes("Already Verified")) {
      console.log("✅ Contract is already verified!");
    } else if (error.message.includes("Invalid API Key")) {
      console.log("❌ API Key issue. Trying with Sourcify...");
      
      // Try with explicit network
      try {
        await run("verify:verify", {
          address: contractAddress,
          constructorArguments: [],
          contract: "contracts/registry/AssetRegistry.sol:AssetRegistry",
          network: "polygon"
        });
        console.log("✅ Verified with Sourcify!");
      } catch (sourcifyError) {
        console.log("❌ Verification failed:", sourcifyError.message);
        console.log("\n📝 Manual verification instructions:");
        console.log("1. Visit: https://polygonscan.com/verifyContract");
        console.log("2. Contract Address:", contractAddress);
        console.log("3. Compiler: v0.8.19+commit.7dd6d404");
        console.log("4. Optimization: Yes (1 run)");
        console.log("5. Contract Name: AssetRegistry");
        console.log("6. No constructor arguments (implementation contract)");
      }
    } else {
      console.error("❌ Verification failed:", error.message);
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });