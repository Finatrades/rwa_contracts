const hre = require("hardhat");
const { keccak256, toHex } = require("viem");

async function main() {
  console.log("=== Granting Factory Access to IdentityRegistry ===\n");

  // Contract addresses
  const FACTORY_ADDRESS = "0x5aC1EB4BE5D56D0d0b37ac21E3A2362d028F7A70";
  const IDENTITY_REGISTRY_ADDRESS = "0x25150414235289c688473340548698B5764651E3";

  // Get the IdentityRegistry contract
  const IdentityRegistry = await hre.ethers.getContractAt(
    "IdentityRegistry",
    IDENTITY_REGISTRY_ADDRESS
  );

  // Calculate OWNER_ROLE hash
  const OWNER_ROLE = keccak256(toHex("OWNER_ROLE"));
  console.log("OWNER_ROLE hash:", OWNER_ROLE);

  // Check if factory already has the role
  const hasRole = await IdentityRegistry.hasRole(OWNER_ROLE, FACTORY_ADDRESS);
  
  if (hasRole) {
    console.log("✅ Factory already has OWNER_ROLE on IdentityRegistry");
    return;
  }

  console.log("❌ Factory does NOT have OWNER_ROLE on IdentityRegistry");
  console.log("Factory address:", FACTORY_ADDRESS);
  console.log("IdentityRegistry address:", IDENTITY_REGISTRY_ADDRESS);

  // Get the signer
  const [signer] = await hre.ethers.getSigners();
  console.log("Current signer:", signer.address);

  // Check if signer has DEFAULT_ADMIN_ROLE on IdentityRegistry
  const DEFAULT_ADMIN_ROLE = await IdentityRegistry.DEFAULT_ADMIN_ROLE();
  const signerIsAdmin = await IdentityRegistry.hasRole(DEFAULT_ADMIN_ROLE, signer.address);

  if (!signerIsAdmin) {
    console.log("❌ Current signer does NOT have DEFAULT_ADMIN_ROLE on IdentityRegistry");
    console.log("Cannot grant OWNER_ROLE without admin privileges");
    
    // Check who has admin role
    const roleAdminRole = await IdentityRegistry.getRoleAdmin(OWNER_ROLE);
    console.log("\nRole admin for OWNER_ROLE:", roleAdminRole);
    
    console.log("\nPlease run this script with an account that has DEFAULT_ADMIN_ROLE on IdentityRegistry");
    process.exit(1);
  }

  console.log("✅ Current signer has DEFAULT_ADMIN_ROLE on IdentityRegistry");
  console.log("Granting OWNER_ROLE to factory contract...");

  // Grant the role
  const tx = await IdentityRegistry.grantRole(OWNER_ROLE, FACTORY_ADDRESS);
  console.log("Transaction sent:", tx.hash);
  
  // Wait for confirmation
  await tx.wait();
  console.log("Transaction confirmed!");

  // Verify the role was granted
  const hasRoleAfter = await IdentityRegistry.hasRole(OWNER_ROLE, FACTORY_ADDRESS);
  
  if (hasRoleAfter) {
    console.log("✅ OWNER_ROLE successfully granted to factory:", FACTORY_ADDRESS);
    console.log("\nThe FinatradesTokenFactory can now interact with the IdentityRegistry");
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