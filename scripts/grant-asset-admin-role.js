const { ethers } = require("hardhat");

const ASSET_REGISTRY = "0x83413e2C668c9249331Bc88D370655bb44527867";
const ADMIN_WALLET = "0xCE982AC6bc316Cf9d875652B84C7626B62a899eA";

async function main() {
  console.log("=== Granting ASSET_ADMIN_ROLE ===");
  console.log(`AssetRegistry: ${ASSET_REGISTRY}`);
  console.log(`Admin Wallet: ${ADMIN_WALLET}`);
  console.log();
  
  const [signer] = await ethers.getSigners();
  console.log("Using signer:", signer.address);
  
  const AssetRegistry = await ethers.getContractFactory("AssetRegistry");
  const registry = AssetRegistry.attach(ASSET_REGISTRY);
  
  // Define the role
  const ASSET_ADMIN_ROLE = ethers.keccak256(ethers.toUtf8Bytes("ASSET_ADMIN_ROLE"));
  console.log("ASSET_ADMIN_ROLE:", ASSET_ADMIN_ROLE);
  
  // Check current status
  const hasBefore = await registry.hasRole(ASSET_ADMIN_ROLE, ADMIN_WALLET);
  console.log(`\nAdmin wallet has ASSET_ADMIN_ROLE: ${hasBefore ? 'YES' : 'NO'}`);
  
  if (!hasBefore) {
    console.log("\n--- Granting Role ---");
    try {
      const tx = await registry.grantRole(ASSET_ADMIN_ROLE, ADMIN_WALLET);
      console.log(`Transaction sent: ${tx.hash}`);
      await tx.wait();
      console.log("✅ Role granted!");
      
      // Verify
      const hasAfter = await registry.hasRole(ASSET_ADMIN_ROLE, ADMIN_WALLET);
      console.log(`\nVerification: Admin wallet now has ASSET_ADMIN_ROLE: ${hasAfter ? 'YES' : 'NO'}`);
      
      if (hasAfter) {
        console.log("\n🎉 SUCCESS! The admin wallet can now register assets.");
        console.log("Try approving the asset again - it should work now!");
      }
    } catch (error) {
      console.error("Failed to grant role:", error.message);
      
      if (error.message.includes("missing role")) {
        console.log("\nThe current signer doesn't have permission to grant roles.");
        console.log("You need DEFAULT_ADMIN_ROLE to grant other roles.");
        
        // Check if signer has DEFAULT_ADMIN_ROLE
        const DEFAULT_ADMIN_ROLE = "0x0000000000000000000000000000000000000000000000000000000000000000";
        const signerHasAdmin = await registry.hasRole(DEFAULT_ADMIN_ROLE, signer.address);
        console.log(`Signer has DEFAULT_ADMIN_ROLE: ${signerHasAdmin ? 'YES' : 'NO'}`);
        
        if (!signerHasAdmin && signer.address === ADMIN_WALLET) {
          console.log("\n⚠️  The admin wallet has DEFAULT_ADMIN_ROLE but not ASSET_ADMIN_ROLE.");
          console.log("This means the admin wallet can grant itself the ASSET_ADMIN_ROLE.");
          console.log("The transaction should have worked. Check if there's another issue.");
        }
      }
    }
  } else {
    console.log("✅ Admin wallet already has ASSET_ADMIN_ROLE!");
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });