const hre = require("hardhat");

async function main() {
  console.log("=== Checking ALL Registry Addresses and Permissions ===\n");

  const FACTORY_ADDRESS = "0x5aC1EB4BE5D56D0d0b37ac21E3A2362d028F7A70";
  
  // Get factory contract
  const Factory = await hre.ethers.getContractAt("FinatradesTokenFactory", FACTORY_ADDRESS);
  
  // Get all configured addresses
  const assetRegistry = await Factory.assetRegistry();
  const identityRegistry = await Factory.identityRegistry();
  const modularCompliance = await Factory.modularCompliance();
  
  // Also check ClaimTopicsRegistry from IdentityRegistry
  const IdentityRegistry = await hre.ethers.getContractAt("IdentityRegistry", identityRegistry);
  let claimTopicsRegistry;
  try {
    claimTopicsRegistry = await IdentityRegistry.topicsRegistry();
  } catch (e) {
    console.log("Could not get ClaimTopicsRegistry from IdentityRegistry");
  }
  
  console.log("Addresses configured in contracts:");
  console.log("AssetRegistry:", assetRegistry);
  console.log("IdentityRegistry:", identityRegistry);
  console.log("ModularCompliance:", modularCompliance);
  console.log("ClaimTopicsRegistry:", claimTopicsRegistry || "Unknown");
  
  // Now check permissions
  console.log("\n=== Checking Permissions ===");
  
  // Check AssetRegistry
  console.log("\nAssetRegistry:");
  const AssetRegistry = await hre.ethers.getContractAt("AssetRegistry", assetRegistry);
  const assetAdminRole = await AssetRegistry.DEFAULT_ADMIN_ROLE();
  const hasAssetAdmin = await AssetRegistry.hasRole(assetAdminRole, FACTORY_ADDRESS);
  console.log(`Factory has DEFAULT_ADMIN_ROLE: ${hasAssetAdmin ? '✅' : '❌'}`);
  
  // Check IdentityRegistry
  console.log("\nIdentityRegistry:");
  const identityAdminRole = await IdentityRegistry.DEFAULT_ADMIN_ROLE();
  const hasIdentityAdmin = await IdentityRegistry.hasRole(identityAdminRole, FACTORY_ADDRESS);
  console.log(`Factory has DEFAULT_ADMIN_ROLE: ${hasIdentityAdmin ? '✅' : '❌'}`);
  
  try {
    const identityOwnerRole = await IdentityRegistry.OWNER_ROLE();
    const hasIdentityOwner = await IdentityRegistry.hasRole(identityOwnerRole, FACTORY_ADDRESS);
    console.log(`Factory has OWNER_ROLE: ${hasIdentityOwner ? '✅' : '❌'}`);
  } catch (e) {
    console.log("OWNER_ROLE not found");
  }
  
  // Check ModularCompliance
  console.log("\nModularCompliance:");
  const ModularCompliance = await hre.ethers.getContractAt("ModularCompliance", modularCompliance);
  const complianceAdminRole = await ModularCompliance.DEFAULT_ADMIN_ROLE();
  const hasComplianceAdmin = await ModularCompliance.hasRole(complianceAdminRole, FACTORY_ADDRESS);
  console.log(`Factory has DEFAULT_ADMIN_ROLE: ${hasComplianceAdmin ? '✅' : '❌'}`);
  
  const complianceOwnerRole = await ModularCompliance.OWNER_ROLE();
  const hasComplianceOwner = await ModularCompliance.hasRole(complianceOwnerRole, FACTORY_ADDRESS);
  console.log(`Factory has OWNER_ROLE: ${hasComplianceOwner ? '✅' : '❌'}`);
  
  // Check ClaimTopicsRegistry if we found it
  if (claimTopicsRegistry && claimTopicsRegistry !== "0x0000000000000000000000000000000000000000") {
    console.log("\nClaimTopicsRegistry:");
    const ClaimTopicsRegistry = await hre.ethers.getContractAt("ClaimTopicsRegistry", claimTopicsRegistry);
    const claimsAdminRole = await ClaimTopicsRegistry.DEFAULT_ADMIN_ROLE();
    const hasClaimsAdmin = await ClaimTopicsRegistry.hasRole(claimsAdminRole, FACTORY_ADDRESS);
    console.log(`Factory has DEFAULT_ADMIN_ROLE: ${hasClaimsAdmin ? '✅' : '❌'}`);
    
    try {
      const claimsOwnerRole = await ClaimTopicsRegistry.OWNER_ROLE();
      const hasClaimsOwner = await ClaimTopicsRegistry.hasRole(claimsOwnerRole, FACTORY_ADDRESS);
      console.log(`Factory has OWNER_ROLE: ${hasClaimsOwner ? '✅' : '❌'}`);
    } catch (e) {
      console.log("OWNER_ROLE not found");
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });