const hre = require("hardhat");

async function main() {
  console.log("=== Granting DEFAULT_ADMIN_ROLE to Factory on ModularCompliance ===\n");

  // Contract addresses
  const FACTORY_ADDRESS = "0x5aC1EB4BE5D56D0d0b37ac21E3A2362d028F7A70";
  const MODULAR_COMPLIANCE_ADDRESS = "0x123A014c135417b58BB3e04A5711C8F126cA95E8";

  // Get the ModularCompliance contract
  const ModularCompliance = await hre.ethers.getContractAt(
    "ModularCompliance",
    MODULAR_COMPLIANCE_ADDRESS
  );

  // Get DEFAULT_ADMIN_ROLE hash (it's 0x00000...)
  const DEFAULT_ADMIN_ROLE = await ModularCompliance.DEFAULT_ADMIN_ROLE();
  console.log("DEFAULT_ADMIN_ROLE hash:", DEFAULT_ADMIN_ROLE);

  // Check if factory already has the role
  const hasRole = await ModularCompliance.hasRole(DEFAULT_ADMIN_ROLE, FACTORY_ADDRESS);
  
  if (hasRole) {
    console.log("✅ Factory already has DEFAULT_ADMIN_ROLE on ModularCompliance");
    return;
  }

  console.log("❌ Factory does NOT have DEFAULT_ADMIN_ROLE on ModularCompliance");
  console.log("Factory address:", FACTORY_ADDRESS);
  console.log("ModularCompliance address:", MODULAR_COMPLIANCE_ADDRESS);

  // Get the signer
  const [signer] = await hre.ethers.getSigners();
  console.log("Current signer:", signer.address);

  // Check if signer has DEFAULT_ADMIN_ROLE
  const signerIsAdmin = await ModularCompliance.hasRole(DEFAULT_ADMIN_ROLE, signer.address);

  if (!signerIsAdmin) {
    console.log("❌ Current signer does NOT have DEFAULT_ADMIN_ROLE on ModularCompliance");
    console.log("Cannot grant DEFAULT_ADMIN_ROLE without admin privileges");
    
    console.log("\nPlease run this script with an account that has DEFAULT_ADMIN_ROLE");
    process.exit(1);
  }

  console.log("✅ Current signer has DEFAULT_ADMIN_ROLE on ModularCompliance");
  console.log("Granting DEFAULT_ADMIN_ROLE to factory contract...");

  // Grant the role
  const tx = await ModularCompliance.grantRole(DEFAULT_ADMIN_ROLE, FACTORY_ADDRESS);
  console.log("Transaction sent:", tx.hash);
  
  // Wait for confirmation
  await tx.wait();
  console.log("Transaction confirmed!");

  // Verify the role was granted
  const hasRoleAfter = await ModularCompliance.hasRole(DEFAULT_ADMIN_ROLE, FACTORY_ADDRESS);
  
  if (hasRoleAfter) {
    console.log("✅ DEFAULT_ADMIN_ROLE successfully granted to factory:", FACTORY_ADDRESS);
    console.log("\nThe FinatradesTokenFactory now has admin access to ModularCompliance");
  } else {
    console.log("❌ Failed to grant DEFAULT_ADMIN_ROLE");
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });