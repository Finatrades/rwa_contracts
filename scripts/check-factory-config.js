const hre = require("hardhat");

async function main() {
  console.log("=== Checking Factory Configuration ===\n");

  const FACTORY_ADDRESS = "0x5aC1EB4BE5D56D0d0b37ac21E3A2362d028F7A70";
  
  const Factory = await hre.ethers.getContractAt("FinatradesTokenFactory", FACTORY_ADDRESS);
  
  // Get all registry addresses from factory
  const assetRegistry = await Factory.assetRegistry();
  const identityRegistry = await Factory.identityRegistry();
  const modularCompliance = await Factory.modularCompliance();
  
  console.log("Factory configured registries:");
  console.log("AssetRegistry:", assetRegistry);
  console.log("IdentityRegistry:", identityRegistry);
  console.log("ModularCompliance:", modularCompliance);
  
  console.log("\nExpected registries from polygon_mainnet_final.json:");
  console.log("AssetRegistry: 0x4717bED7008bc5aF62b3b91a29aaa24Bab034038");
  console.log("IdentityRegistry: 0x25150414235289c688473340548698B5764651E3");
  console.log("ModularCompliance: 0x123A014c135417b58BB3e04A5711C8F126cA95E8");
  
  // Check if the AssetRegistry matches
  if (assetRegistry.toLowerCase() !== "0x4717bED7008bc5aF62b3b91a29aaa24Bab034038".toLowerCase()) {
    console.log("\n⚠️  WARNING: AssetRegistry address mismatch!");
    console.log("Factory is using:", assetRegistry);
    console.log("Expected:", "0x4717bED7008bc5aF62b3b91a29aaa24Bab034038");
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });