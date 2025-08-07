const hre = require("hardhat");
const { keccak256, toHex } = require("viem");

async function main() {
  console.log("=== Granting Factory Access to ClaimTopicsRegistry ===\n");

  // Contract addresses
  const FACTORY_ADDRESS = "0x5aC1EB4BE5D56D0d0b37ac21E3A2362d028F7A70";
  const CLAIMS_REGISTRY_ADDRESS = "0xb97E45F808369C0629667B1eCD67d7cB31755110";

  // Get the ClaimTopicsRegistry contract
  const ClaimTopicsRegistry = await hre.ethers.getContractAt(
    "ClaimTopicsRegistry",
    CLAIMS_REGISTRY_ADDRESS
  );

  // Calculate OWNER_ROLE hash
  const OWNER_ROLE = keccak256(toHex("OWNER_ROLE"));
  console.log("OWNER_ROLE hash:", OWNER_ROLE);

  // Check if factory already has the role
  const hasRole = await ClaimTopicsRegistry.hasRole(OWNER_ROLE, FACTORY_ADDRESS);
  
  if (hasRole) {
    console.log("✅ Factory already has OWNER_ROLE on ClaimTopicsRegistry");
    return;
  }

  console.log("❌ Factory does NOT have OWNER_ROLE on ClaimTopicsRegistry");
  console.log("Factory address:", FACTORY_ADDRESS);
  console.log("ClaimTopicsRegistry address:", CLAIMS_REGISTRY_ADDRESS);

  // Get the signer
  const [signer] = await hre.ethers.getSigners();
  console.log("Current signer:", signer.address);

  // Check if signer has DEFAULT_ADMIN_ROLE on ClaimTopicsRegistry
  const DEFAULT_ADMIN_ROLE = await ClaimTopicsRegistry.DEFAULT_ADMIN_ROLE();
  const signerIsAdmin = await ClaimTopicsRegistry.hasRole(DEFAULT_ADMIN_ROLE, signer.address);

  if (!signerIsAdmin) {
    console.log("❌ Current signer does NOT have DEFAULT_ADMIN_ROLE on ClaimTopicsRegistry");
    console.log("Cannot grant OWNER_ROLE without admin privileges");
    
    // Check who has admin role
    const roleAdminRole = await ClaimTopicsRegistry.getRoleAdmin(OWNER_ROLE);
    console.log("\nRole admin for OWNER_ROLE:", roleAdminRole);
    
    console.log("\nPlease run this script with an account that has DEFAULT_ADMIN_ROLE on ClaimTopicsRegistry");
    process.exit(1);
  }

  console.log("✅ Current signer has DEFAULT_ADMIN_ROLE on ClaimTopicsRegistry");
  console.log("Granting OWNER_ROLE to factory contract...");

  // Grant the role
  const tx = await ClaimTopicsRegistry.grantRole(OWNER_ROLE, FACTORY_ADDRESS);
  console.log("Transaction sent:", tx.hash);
  
  // Wait for confirmation
  await tx.wait();
  console.log("Transaction confirmed!");

  // Verify the role was granted
  const hasRoleAfter = await ClaimTopicsRegistry.hasRole(OWNER_ROLE, FACTORY_ADDRESS);
  
  if (hasRoleAfter) {
    console.log("✅ OWNER_ROLE successfully granted to factory:", FACTORY_ADDRESS);
    console.log("\nThe FinatradesTokenFactory can now interact with the ClaimTopicsRegistry");
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