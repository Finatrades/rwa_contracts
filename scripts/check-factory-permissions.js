const hre = require("hardhat");

async function main() {
  console.log("=== Checking Factory Permissions ===\n");

  // Contract addresses
  const FACTORY_ADDRESS = "0x5aC1EB4BE5D56D0d0b37ac21E3A2362d028F7A70";
  const ADMIN_WALLET = "0xCE982AC6bc316Cf9d875652B84C7626B62a899eA";
  
  const contracts = {
    AssetRegistry: "0x04aA90cAaAc423a5a1A858EE863482cAFd0fEb5F",
    IdentityRegistry: "0x25150414235289c688473340548698B5764651E3",
    ClaimTopicsRegistry: "0xb97E45F808369C0629667B1eCD67d7cB31755110",
    ModularCompliance: "0x123A014c135417b58BB3e04A5711C8F126cA95E8"
  };

  console.log("Factory address:", FACTORY_ADDRESS);
  console.log("Admin wallet:", ADMIN_WALLET);
  console.log("\n");

  // Check TOKEN_DEPLOYER_ROLE on factory
  console.log("=== Factory Roles ===");
  const Factory = await hre.ethers.getContractAt("FinatradesTokenFactory", FACTORY_ADDRESS);
  const TOKEN_DEPLOYER_ROLE = await Factory.TOKEN_DEPLOYER_ROLE();
  const hasDeployerRole = await Factory.hasRole(TOKEN_DEPLOYER_ROLE, ADMIN_WALLET);
  console.log(`Admin has TOKEN_DEPLOYER_ROLE on Factory: ${hasDeployerRole ? '✅' : '❌'}`);

  // Check all other contracts
  for (const [name, address] of Object.entries(contracts)) {
    console.log(`\n=== ${name} (${address}) ===`);
    
    try {
      const contract = await hre.ethers.getContractAt(name, address);
      
      // Check DEFAULT_ADMIN_ROLE
      const DEFAULT_ADMIN_ROLE = await contract.DEFAULT_ADMIN_ROLE();
      const hasDefaultAdmin = await contract.hasRole(DEFAULT_ADMIN_ROLE, FACTORY_ADDRESS);
      console.log(`Factory has DEFAULT_ADMIN_ROLE: ${hasDefaultAdmin ? '✅' : '❌'}`);
      
      // Check OWNER_ROLE if it exists
      try {
        const OWNER_ROLE = await contract.OWNER_ROLE();
        const hasOwnerRole = await contract.hasRole(OWNER_ROLE, FACTORY_ADDRESS);
        console.log(`Factory has OWNER_ROLE: ${hasOwnerRole ? '✅' : '❌'}`);
      } catch (e) {
        console.log(`OWNER_ROLE not found on ${name}`);
      }
      
    } catch (error) {
      console.log(`Error checking ${name}: ${error.message}`);
    }
  }

  // Check if AssetRegistry has the factory's current implementation address
  console.log("\n=== Checking AssetRegistry Specific Permissions ===");
  const AssetRegistry = await hre.ethers.getContractAt("AssetRegistry", contracts.AssetRegistry);
  
  // Check the implementation address too
  const IMPLEMENTATION_ADDRESS = "0x4E989F963B10cF417E16C58447E725fb34F6b09f";
  console.log("\nChecking implementation address:", IMPLEMENTATION_ADDRESS);
  
  const DEFAULT_ADMIN_ROLE_HASH = "0x0000000000000000000000000000000000000000000000000000000000000000";
  const implHasDefaultAdmin = await AssetRegistry.hasRole(DEFAULT_ADMIN_ROLE_HASH, IMPLEMENTATION_ADDRESS);
  
  console.log(`Implementation has DEFAULT_ADMIN_ROLE on AssetRegistry: ${implHasDefaultAdmin ? '✅' : '❌'}`);
  
  try {
    const OWNER_ROLE = await AssetRegistry.OWNER_ROLE();
    const implHasOwnerRole = await AssetRegistry.hasRole(OWNER_ROLE, IMPLEMENTATION_ADDRESS);
    console.log(`Implementation has OWNER_ROLE on AssetRegistry: ${implHasOwnerRole ? '✅' : '❌'}`);
  } catch (e) {
    console.log(`OWNER_ROLE not found on AssetRegistry`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });