const hre = require("hardhat");
const { keccak256, toHex } = require("viem");

async function main() {
  console.log("=== Granting Factory Access to AssetRegistry ===\n");

  // Contract addresses
  const FACTORY_ADDRESS = "0x5aC1EB4BE5D56D0d0b37ac21E3A2362d028F7A70";
  const ASSET_REGISTRY_ADDRESS = "0x04aA90cAaAc423a5a1A858EE863482cAFd0fEb5F";

  // Get the AssetRegistry contract
  const AssetRegistry = await hre.ethers.getContractAt(
    "AssetRegistry",
    ASSET_REGISTRY_ADDRESS
  );

  // Calculate OWNER_ROLE hash
  const OWNER_ROLE = keccak256(toHex("OWNER_ROLE"));
  console.log("OWNER_ROLE hash:", OWNER_ROLE);

  // Check if factory already has the role
  const hasRole = await AssetRegistry.hasRole(OWNER_ROLE, FACTORY_ADDRESS);
  
  if (hasRole) {
    console.log("✅ Factory already has OWNER_ROLE on AssetRegistry");
    return;
  }

  console.log("❌ Factory does NOT have OWNER_ROLE on AssetRegistry");
  console.log("Factory address:", FACTORY_ADDRESS);
  console.log("AssetRegistry address:", ASSET_REGISTRY_ADDRESS);

  // Get the signer
  const [signer] = await hre.ethers.getSigners();
  console.log("Current signer:", signer.address);

  // Check if signer has DEFAULT_ADMIN_ROLE on AssetRegistry
  const DEFAULT_ADMIN_ROLE = await AssetRegistry.DEFAULT_ADMIN_ROLE();
  const signerIsAdmin = await AssetRegistry.hasRole(DEFAULT_ADMIN_ROLE, signer.address);

  if (!signerIsAdmin) {
    console.log("❌ Current signer does NOT have DEFAULT_ADMIN_ROLE on AssetRegistry");
    console.log("Cannot grant OWNER_ROLE without admin privileges");
    
    // Check who has admin role
    const roleAdminRole = await AssetRegistry.getRoleAdmin(OWNER_ROLE);
    console.log("\nRole admin for OWNER_ROLE:", roleAdminRole);
    
    console.log("\nPlease run this script with an account that has DEFAULT_ADMIN_ROLE on AssetRegistry");
    process.exit(1);
  }

  console.log("✅ Current signer has DEFAULT_ADMIN_ROLE on AssetRegistry");
  console.log("Granting OWNER_ROLE to factory contract...");

  // Grant the role
  const tx = await AssetRegistry.grantRole(OWNER_ROLE, FACTORY_ADDRESS);
  console.log("Transaction sent:", tx.hash);
  
  // Wait for confirmation
  await tx.wait();
  console.log("Transaction confirmed!");

  // Verify the role was granted
  const hasRoleAfter = await AssetRegistry.hasRole(OWNER_ROLE, FACTORY_ADDRESS);
  
  if (hasRoleAfter) {
    console.log("✅ OWNER_ROLE successfully granted to factory:", FACTORY_ADDRESS);
    console.log("\nThe FinatradesTokenFactory can now register assets on the AssetRegistry");
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