const hre = require("hardhat");

async function main() {
  console.log("=== Granting TOKEN_DEPLOYER_ROLE ===\n");

  // Contract addresses
  const FACTORY_ADDRESS = "0x5aC1EB4BE5D56D0d0b37ac21E3A2362d028F7A70";
  const ADMIN_WALLET = "0xCE982AC6bc316Cf9d875652B84C7626B62a899eA";

  // Get the factory contract
  const FinatradesTokenFactory = await hre.ethers.getContractAt(
    "FinatradesTokenFactory",
    FACTORY_ADDRESS
  );

  // Get TOKEN_DEPLOYER_ROLE hash
  const TOKEN_DEPLOYER_ROLE = await FinatradesTokenFactory.TOKEN_DEPLOYER_ROLE();
  console.log("TOKEN_DEPLOYER_ROLE hash:", TOKEN_DEPLOYER_ROLE);

  // Check if admin wallet already has the role
  const hasRole = await FinatradesTokenFactory.hasRole(TOKEN_DEPLOYER_ROLE, ADMIN_WALLET);
  
  if (hasRole) {
    console.log("✅ Admin wallet already has TOKEN_DEPLOYER_ROLE");
    return;
  }

  console.log("❌ Admin wallet does NOT have TOKEN_DEPLOYER_ROLE");
  console.log("Admin wallet address:", ADMIN_WALLET);

  // Get the signer
  const [signer] = await hre.ethers.getSigners();
  console.log("Current signer:", signer.address);

  // Check if signer has DEFAULT_ADMIN_ROLE
  const DEFAULT_ADMIN_ROLE = await FinatradesTokenFactory.DEFAULT_ADMIN_ROLE();
  const signerIsAdmin = await FinatradesTokenFactory.hasRole(DEFAULT_ADMIN_ROLE, signer.address);

  if (!signerIsAdmin) {
    console.log("❌ Current signer does NOT have DEFAULT_ADMIN_ROLE");
    console.log("Cannot grant TOKEN_DEPLOYER_ROLE without admin privileges");
    
    // Check who has admin role
    const roleAdminRole = await FinatradesTokenFactory.getRoleAdmin(TOKEN_DEPLOYER_ROLE);
    console.log("\nRole admin for TOKEN_DEPLOYER_ROLE:", roleAdminRole);
    
    console.log("\nPlease run this script with an account that has DEFAULT_ADMIN_ROLE");
    process.exit(1);
  }

  console.log("✅ Current signer has DEFAULT_ADMIN_ROLE");
  console.log("Granting TOKEN_DEPLOYER_ROLE to admin wallet...");

  // Grant the role
  const tx = await FinatradesTokenFactory.grantRole(TOKEN_DEPLOYER_ROLE, ADMIN_WALLET);
  console.log("Transaction sent:", tx.hash);
  
  // Wait for confirmation
  await tx.wait();
  console.log("Transaction confirmed!");

  // Verify the role was granted
  const hasRoleAfter = await FinatradesTokenFactory.hasRole(TOKEN_DEPLOYER_ROLE, ADMIN_WALLET);
  
  if (hasRoleAfter) {
    console.log("✅ TOKEN_DEPLOYER_ROLE successfully granted to:", ADMIN_WALLET);
  } else {
    console.log("❌ Failed to grant TOKEN_DEPLOYER_ROLE");
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });