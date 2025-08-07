const hre = require("hardhat");

async function main() {
  console.log("=== Granting Factory Access to ModularCompliance ===\n");

  // Contract addresses
  const FACTORY_ADDRESS = "0x5aC1EB4BE5D56D0d0b37ac21E3A2362d028F7A70";
  const MODULAR_COMPLIANCE_ADDRESS = "0x123A014c135417b58BB3e04A5711C8F126cA95E8";

  // Get the ModularCompliance contract
  const ModularCompliance = await hre.ethers.getContractAt(
    "ModularCompliance",
    MODULAR_COMPLIANCE_ADDRESS
  );

  // Get OWNER_ROLE hash
  const OWNER_ROLE = await ModularCompliance.OWNER_ROLE();
  console.log("OWNER_ROLE hash:", OWNER_ROLE);

  // Check if factory already has the role
  const hasRole = await ModularCompliance.hasRole(OWNER_ROLE, FACTORY_ADDRESS);
  
  if (hasRole) {
    console.log("✅ Factory already has OWNER_ROLE on ModularCompliance");
    return;
  }

  console.log("❌ Factory does NOT have OWNER_ROLE on ModularCompliance");
  console.log("Factory address:", FACTORY_ADDRESS);
  console.log("ModularCompliance address:", MODULAR_COMPLIANCE_ADDRESS);

  // Get the signer
  const [signer] = await hre.ethers.getSigners();
  console.log("Current signer:", signer.address);

  // Check if signer has DEFAULT_ADMIN_ROLE
  const DEFAULT_ADMIN_ROLE = await ModularCompliance.DEFAULT_ADMIN_ROLE();
  const signerIsAdmin = await ModularCompliance.hasRole(DEFAULT_ADMIN_ROLE, signer.address);

  if (!signerIsAdmin) {
    console.log("❌ Current signer does NOT have DEFAULT_ADMIN_ROLE on ModularCompliance");
    console.log("Cannot grant OWNER_ROLE without admin privileges");
    
    // Check who has admin role
    const roleAdminRole = await ModularCompliance.getRoleAdmin(OWNER_ROLE);
    console.log("\nRole admin for OWNER_ROLE:", roleAdminRole);
    
    console.log("\nPlease run this script with an account that has DEFAULT_ADMIN_ROLE");
    process.exit(1);
  }

  console.log("✅ Current signer has DEFAULT_ADMIN_ROLE on ModularCompliance");
  console.log("Granting OWNER_ROLE to factory contract...");

  // Grant the role
  const tx = await ModularCompliance.grantRole(OWNER_ROLE, FACTORY_ADDRESS);
  console.log("Transaction sent:", tx.hash);
  
  // Wait for confirmation
  await tx.wait();
  console.log("Transaction confirmed!");

  // Verify the role was granted
  const hasRoleAfter = await ModularCompliance.hasRole(OWNER_ROLE, FACTORY_ADDRESS);
  
  if (hasRoleAfter) {
    console.log("✅ OWNER_ROLE successfully granted to factory:", FACTORY_ADDRESS);
    console.log("\nThe FinatradesTokenFactory can now bind tokens to ModularCompliance");
  } else {
    console.log("❌ Failed to grant OWNER_ROLE");
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });