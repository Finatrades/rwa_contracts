const { run } = require("hardhat");

async function main() {
  console.log("Verifying AssetRegistry implementation...");
  
  try {
    await run("verify:verify", {
      address: "0x3eb39039b860Fc8476A28aF1d33d51562bcBaa6d",
      constructorArguments: [],
      contract: "contracts/registry/AssetRegistry.sol:AssetRegistry"
    });
    console.log("✅ AssetRegistry implementation verified!");
  } catch (error) {
    console.error("❌ Verification failed:", error.message);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });