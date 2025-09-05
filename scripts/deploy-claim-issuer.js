const { ethers, upgrades } = require("hardhat");
require('dotenv').config({ path: '../../web/.env' });

const ADMIN_WALLET = process.env.ADMIN_WALLET_ADDRESS || "0xCE982AC6bc316Cf9d875652B84C7626B62a899eA";
const CLAIM_TOPICS_REGISTRY = process.env.NEXT_PUBLIC_CLAIM_TOPICS_REGISTRY_ADDRESS || "0x28db37Fc86e0Ca93ebCdDD1A24b3bA07a3F756F5";

async function main() {
  console.log("=== Deploying ClaimIssuer Contract ===");
  console.log(`Admin Wallet: ${ADMIN_WALLET}`);
  console.log(`ClaimTopicsRegistry: ${CLAIM_TOPICS_REGISTRY}`);
  console.log();

  const [signer] = await ethers.getSigners();
  console.log("Using signer:", signer.address);

  try {
    // Deploy ClaimIssuer as upgradeable proxy
    console.log("\n--- Deploying ClaimIssuer (Upgradeable) ---");
    const ClaimIssuer = await ethers.getContractFactory("ClaimIssuer");
    
    // Deploy as upgradeable proxy
    const claimIssuer = await upgrades.deployProxy(
      ClaimIssuer,
      [ADMIN_WALLET], // initialize with admin
      { initializer: 'initialize' }
    );
    
    console.log("ClaimIssuer deployment transaction sent...");
    await claimIssuer.waitForDeployment();
    
    const claimIssuerAddress = await claimIssuer.getAddress();
    console.log("✅ ClaimIssuer deployed at:", claimIssuerAddress);
    
    // Register ClaimIssuer in ClaimTopicsRegistry
    console.log("\n--- Registering ClaimIssuer in ClaimTopicsRegistry ---");
    const ClaimTopicsRegistry = await ethers.getContractFactory("ClaimTopicsRegistry");
    const claimTopicsRegistry = ClaimTopicsRegistry.attach(CLAIM_TOPICS_REGISTRY);
    
    try {
      // Add trusted issuer for KYC topic (topic 7)
      const KYC_TOPIC = 7;
      const addIssuerTx = await claimTopicsRegistry.addClaimTopic(KYC_TOPIC);
      console.log("Added KYC topic:", addIssuerTx.hash);
      await addIssuerTx.wait();
    } catch (e) {
      console.log("KYC topic might already exist:", e.message);
    }
    
    try {
      // Trust the ClaimIssuer
      const trustTx = await claimTopicsRegistry.addTrustedIssuer(claimIssuerAddress, [7]); // Trust for KYC topic
      console.log("Trust transaction:", trustTx.hash);
      await trustTx.wait();
      console.log("✅ ClaimIssuer trusted in ClaimTopicsRegistry");
    } catch (e) {
      console.log("Error trusting issuer (might already be trusted):", e.message);
    }
    
    console.log("\n=== IMPORTANT ===");
    console.log("Add this to your .env file:");
    console.log(`NEXT_PUBLIC_CLAIM_ISSUER_ADDRESS=${claimIssuerAddress}`);
    console.log("");
    console.log("Then update the TokenFactory to use this ClaimIssuer.");
    
    // Now update the token factory to use this claim issuer
    console.log("\n--- Updating TokenFactory with ClaimIssuer ---");
    const TOKEN_FACTORY_ADDRESS = process.env.NEXT_PUBLIC_TOKEN_FACTORY_ADDRESS || "0x365086b093Eb31CD32653271371892136FcAb254";
    const FinatradesTokenFactory = await ethers.getContractFactory("FinatradesTokenFactory");
    const factory = FinatradesTokenFactory.attach(TOKEN_FACTORY_ADDRESS);
    
    try {
      // Check if there's a method to set the claim issuer
      // This might be setClaimIssuer or similar
      const setClaimIssuerTx = await factory.setClaimIssuer(claimIssuerAddress);
      console.log("Set ClaimIssuer transaction:", setClaimIssuerTx.hash);
      await setClaimIssuerTx.wait();
      console.log("✅ ClaimIssuer set in TokenFactory");
    } catch (e) {
      console.log("Could not set ClaimIssuer in factory:", e.message);
      console.log("The factory might not have a setClaimIssuer method.");
      console.log("You may need to pass the ClaimIssuer during token deployment.");
    }
    
    return claimIssuerAddress;
    
  } catch (error) {
    console.error("\n❌ Error:", error);
    throw error;
  }
}

main()
  .then((address) => {
    console.log("\n✅ ClaimIssuer deployment complete!");
    console.log(`ClaimIssuer address: ${address}`);
    process.exit(0);
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });