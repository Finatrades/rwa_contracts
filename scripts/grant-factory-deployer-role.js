const hre = require("hardhat");

async function main() {
  console.log("=== Granting Token Deployer Role ===\n");

  // Contract addresses
  const FACTORY_ADDRESS = "0x5aC1EB4BE5D56D0d0b37ac21E3A2362d028F7A70";
  const ADMIN_WALLET = "0xCE982AC6bc316Cf9d875652B84C7626B62a899eA";

  // Get the factory contract
  const FinatradesTokenFactory = await hre.ethers.getContractAt(
    "FinatradesTokenFactory",
    FACTORY_ADDRESS
  );

  // Get DEPLOYER_ROLE hash
  const DEPLOYER_ROLE = await FinatradesTokenFactory.DEPLOYER_ROLE();
  console.log("DEPLOYER_ROLE hash:", DEPLOYER_ROLE);

  // Check if admin wallet already has the role
  const hasRole = await FinatradesTokenFactory.hasRole(DEPLOYER_ROLE, ADMIN_WALLET);
  
  if (hasRole) {
    console.log("✅ Admin wallet already has DEPLOYER_ROLE");
    return;
  }

  console.log("❌ Admin wallet does NOT have DEPLOYER_ROLE");
  console.log("Admin wallet address:", ADMIN_WALLET);

  // Get the signer
  const [signer] = await hre.ethers.getSigners();
  console.log("Current signer:", signer.address);

  // Check if signer has DEFAULT_ADMIN_ROLE
  const DEFAULT_ADMIN_ROLE = await FinatradesTokenFactory.DEFAULT_ADMIN_ROLE();
  const signerIsAdmin = await FinatradesTokenFactory.hasRole(DEFAULT_ADMIN_ROLE, signer.address);

  if (!signerIsAdmin) {
    console.log("❌ Current signer does NOT have DEFAULT_ADMIN_ROLE");
    console.log("Cannot grant DEPLOYER_ROLE without admin privileges");
    
    // Check who has admin role
    const roleAdminRole = await FinatradesTokenFactory.getRoleAdmin(DEPLOYER_ROLE);
    console.log("\nRole admin for DEPLOYER_ROLE:", roleAdminRole);
    
    console.log("\nPlease run this script with an account that has DEFAULT_ADMIN_ROLE");
    process.exit(1);
  }

  console.log("✅ Current signer has DEFAULT_ADMIN_ROLE");
  console.log("Granting DEPLOYER_ROLE to admin wallet...");

  // Grant the role
  const tx = await FinatradesTokenFactory.grantRole(DEPLOYER_ROLE, ADMIN_WALLET);
  console.log("Transaction sent:", tx.hash);
  
  // Wait for confirmation
  await tx.wait();
  console.log("Transaction confirmed!");

  // Verify the role was granted
  const hasRoleAfter = await FinatradesTokenFactory.hasRole(DEPLOYER_ROLE, ADMIN_WALLET);
  
  if (hasRoleAfter) {
    console.log("✅ DEPLOYER_ROLE successfully granted to:", ADMIN_WALLET);
  } else {
    console.log("❌ Failed to grant DEPLOYER_ROLE");
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });