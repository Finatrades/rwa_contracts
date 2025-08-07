const hre = require("hardhat");

async function main() {
  console.log("=== Granting Permissions to Factory on CORRECT ClaimTopicsRegistry ===\n");

  // Contract addresses
  const FACTORY_ADDRESS = "0x5aC1EB4BE5D56D0d0b37ac21E3A2362d028F7A70";
  const CLAIM_TOPICS_REGISTRY_ADDRESS = "0x6Ec58c34DF899Ff9d67FD088Cd339bB75508Dd79"; // The correct one!

  // Get the ClaimTopicsRegistry contract
  const ClaimTopicsRegistry = await hre.ethers.getContractAt(
    "ClaimTopicsRegistry",
    CLAIM_TOPICS_REGISTRY_ADDRESS
  );

  // Get the signer
  const [signer] = await hre.ethers.getSigners();
  console.log("Current signer:", signer.address);

  // Grant DEFAULT_ADMIN_ROLE
  const DEFAULT_ADMIN_ROLE = await ClaimTopicsRegistry.DEFAULT_ADMIN_ROLE();
  console.log("DEFAULT_ADMIN_ROLE hash:", DEFAULT_ADMIN_ROLE);

  const hasDefaultAdmin = await ClaimTopicsRegistry.hasRole(DEFAULT_ADMIN_ROLE, FACTORY_ADDRESS);
  if (!hasDefaultAdmin) {
    console.log("Granting DEFAULT_ADMIN_ROLE to factory...");
    const tx1 = await ClaimTopicsRegistry.grantRole(DEFAULT_ADMIN_ROLE, FACTORY_ADDRESS);
    console.log("Transaction sent:", tx1.hash);
    await tx1.wait();
    console.log("✅ DEFAULT_ADMIN_ROLE granted!");
  } else {
    console.log("✅ Factory already has DEFAULT_ADMIN_ROLE");
  }

  // Grant OWNER_ROLE
  const OWNER_ROLE = await ClaimTopicsRegistry.OWNER_ROLE();
  console.log("\nOWNER_ROLE hash:", OWNER_ROLE);

  const hasOwnerRole = await ClaimTopicsRegistry.hasRole(OWNER_ROLE, FACTORY_ADDRESS);
  if (!hasOwnerRole) {
    console.log("Granting OWNER_ROLE to factory...");
    const tx2 = await ClaimTopicsRegistry.grantRole(OWNER_ROLE, FACTORY_ADDRESS);
    console.log("Transaction sent:", tx2.hash);
    await tx2.wait();
    console.log("✅ OWNER_ROLE granted!");
  } else {
    console.log("✅ Factory already has OWNER_ROLE");
  }

  console.log("\nAll permissions granted to factory on ClaimTopicsRegistry!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });