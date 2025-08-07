const hre = require("hardhat");

async function main() {
  console.log("=== Granting Factory DEFAULT_ADMIN_ROLE on Itself ===\n");

  // Contract addresses
  const FACTORY_ADDRESS = "0x5aC1EB4BE5D56D0d0b37ac21E3A2362d028F7A70";

  // Get the FinatradesTokenFactory contract
  const FinatradesTokenFactory = await hre.ethers.getContractAt(
    "FinatradesTokenFactory",
    FACTORY_ADDRESS
  );

  // Get DEFAULT_ADMIN_ROLE (should be 0x0000...0000)
  const DEFAULT_ADMIN_ROLE = await FinatradesTokenFactory.DEFAULT_ADMIN_ROLE();
  console.log("DEFAULT_ADMIN_ROLE:", DEFAULT_ADMIN_ROLE);

  // Check if factory already has DEFAULT_ADMIN_ROLE on itself
  const hasRole = await FinatradesTokenFactory.hasRole(DEFAULT_ADMIN_ROLE, FACTORY_ADDRESS);
  
  if (hasRole) {
    console.log("✅ Factory already has DEFAULT_ADMIN_ROLE on itself");
    return;
  }

  console.log("❌ Factory does NOT have DEFAULT_ADMIN_ROLE on itself");
  console.log("Factory address:", FACTORY_ADDRESS);

  // Get the signer
  const [signer] = await hre.ethers.getSigners();
  console.log("Current signer:", signer.address);

  // Check if signer has DEFAULT_ADMIN_ROLE on Factory
  const signerIsAdmin = await FinatradesTokenFactory.hasRole(DEFAULT_ADMIN_ROLE, signer.address);

  if (!signerIsAdmin) {
    console.log("❌ Current signer does NOT have DEFAULT_ADMIN_ROLE on Factory");
    console.log("Cannot grant DEFAULT_ADMIN_ROLE without admin privileges");
    process.exit(1);
  }

  console.log("✅ Current signer has DEFAULT_ADMIN_ROLE on Factory");
  console.log("Granting DEFAULT_ADMIN_ROLE to factory itself...");

  // Grant the role
  const tx = await FinatradesTokenFactory.grantRole(DEFAULT_ADMIN_ROLE, FACTORY_ADDRESS);
  console.log("Transaction sent:", tx.hash);
  
  // Wait for confirmation
  await tx.wait();
  console.log("Transaction confirmed!");

  // Verify the role was granted
  const hasRoleAfter = await FinatradesTokenFactory.hasRole(DEFAULT_ADMIN_ROLE, FACTORY_ADDRESS);
  
  if (hasRoleAfter) {
    console.log("✅ DEFAULT_ADMIN_ROLE successfully granted to factory on itself:", FACTORY_ADDRESS);
    console.log("\nThis allows the factory to perform administrative operations during token deployment");
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