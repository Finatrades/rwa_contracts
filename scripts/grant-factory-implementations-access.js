const hre = require("hardhat");
const { keccak256, toHex } = require("viem");

async function main() {
  console.log("=== Granting Factory Access to Token Implementations ===\n");

  // Contract addresses from README
  const FACTORY_ADDRESS = "0x5aC1EB4BE5D56D0d0b37ac21E3A2362d028F7A70";
  const TOKEN_ERC20_IMPL = "0x5900027BbdA1A833C9f93F3bcE76b9E4eCf8D341"; // Finatrades Token
  const TOKEN_ERC721_IMPL = "0xF23688617C09B89d13F625a0670D8Ba64a2c065A"; // FinatradesNFT

  // Calculate OWNER_ROLE hash
  const OWNER_ROLE = keccak256(toHex("OWNER_ROLE"));
  console.log("OWNER_ROLE hash:", OWNER_ROLE);

  // Check and grant for ERC20 implementation
  console.log("\n=== Checking Finatrades Token (ERC-20) ===");
  try {
    const TokenERC20 = await hre.ethers.getContractAt("Token", TOKEN_ERC20_IMPL);
    
    const hasRole = await TokenERC20.hasRole(OWNER_ROLE, FACTORY_ADDRESS);
    console.log(`Factory has OWNER_ROLE on ERC20 impl: ${hasRole ? '✅ YES' : '❌ NO'}`);
    
    if (!hasRole) {
      const [signer] = await hre.ethers.getSigners();
      const DEFAULT_ADMIN_ROLE = await TokenERC20.DEFAULT_ADMIN_ROLE();
      const signerIsAdmin = await TokenERC20.hasRole(DEFAULT_ADMIN_ROLE, signer.address);
      
      if (signerIsAdmin) {
        console.log("Granting OWNER_ROLE to factory on ERC20 implementation...");
        const tx = await TokenERC20.grantRole(OWNER_ROLE, FACTORY_ADDRESS);
        await tx.wait();
        console.log("✅ OWNER_ROLE granted on ERC20 implementation");
      } else {
        console.log("❌ Signer doesn't have admin role on ERC20 implementation");
      }
    }
  } catch (e) {
    console.log("Error with ERC20 implementation:", e.message);
  }

  // Check and grant for ERC721 implementation
  console.log("\n=== Checking FinatradesNFT (ERC-721) ===");
  try {
    const TokenERC721 = await hre.ethers.getContractAt("FinatradesNFT", TOKEN_ERC721_IMPL);
    
    const hasRole = await TokenERC721.hasRole(OWNER_ROLE, FACTORY_ADDRESS);
    console.log(`Factory has OWNER_ROLE on ERC721 impl: ${hasRole ? '✅ YES' : '❌ NO'}`);
    
    if (!hasRole) {
      const [signer] = await hre.ethers.getSigners();
      const DEFAULT_ADMIN_ROLE = await TokenERC721.DEFAULT_ADMIN_ROLE();
      const signerIsAdmin = await TokenERC721.hasRole(DEFAULT_ADMIN_ROLE, signer.address);
      
      if (signerIsAdmin) {
        console.log("Granting OWNER_ROLE to factory on ERC721 implementation...");
        const tx = await TokenERC721.grantRole(OWNER_ROLE, FACTORY_ADDRESS);
        await tx.wait();
        console.log("✅ OWNER_ROLE granted on ERC721 implementation");
      } else {
        console.log("❌ Signer doesn't have admin role on ERC721 implementation");
      }
    }
  } catch (e) {
    console.log("Error with ERC721 implementation:", e.message);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });