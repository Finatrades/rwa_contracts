const { ethers } = require("hardhat");
require('dotenv').config({ path: '../../web/.env.local' });

// Reload environment to get the new ClaimIssuer address
const envPath = require('path').join(__dirname, '../../web/.env');
require('dotenv').config({ path: envPath, override: true });

// Raw addresses
const RAW_CLAIM_ISSUER = process.env.NEXT_PUBLIC_CLAIM_ISSUER_ADDRESS || "0x07bd3CD62FE7203E22B89DC3Ec51491a45254494";
const RAW_CLAIM_TOPICS_REGISTRY = process.env.NEXT_PUBLIC_CLAIM_TOPICS_REGISTRY_ADDRESS || "0xAF0f25ac810a13486354586E5ADF8FB4a83d8ADc";
const RAW_ADMIN_WALLET = process.env.ADMIN_WALLET_ADDRESS || "0xCE982AC6bc316Cf9d875652B84C7626B62a899eA";

async function main() {
  // Get checksummed addresses
  const CLAIM_ISSUER = ethers.getAddress(RAW_CLAIM_ISSUER);
  const CLAIM_TOPICS_REGISTRY = ethers.getAddress(RAW_CLAIM_TOPICS_REGISTRY.toLowerCase());
  const ADMIN_WALLET = ethers.getAddress(RAW_ADMIN_WALLET);
  
  console.log("=== Configuring ClaimIssuer in ClaimTopicsRegistry ===");
  console.log(`ClaimIssuer: ${CLAIM_ISSUER}`);
  console.log(`ClaimTopicsRegistry: ${CLAIM_TOPICS_REGISTRY}`);
  console.log(`Admin Wallet: ${ADMIN_WALLET}`);
  console.log();

  const [signer] = await ethers.getSigners();
  console.log("Using signer:", signer.address);

  try {
    // Get ClaimTopicsRegistry contract
    console.log("\n--- Getting ClaimTopicsRegistry Contract ---");
    const ClaimTopicsRegistry = await ethers.getContractFactory("ClaimTopicsRegistry");
    const claimTopicsRegistry = ClaimTopicsRegistry.attach(CLAIM_TOPICS_REGISTRY);
    
    // Check if ClaimIssuer is already trusted for KYC topic (7)
    console.log("\n--- Checking if ClaimIssuer is Trusted for KYC Topic ---");
    const isTrusted = await claimTopicsRegistry.isTrustedIssuer(CLAIM_ISSUER, 7);
    console.log(`Is ClaimIssuer trusted for KYC (topic 7)? ${isTrusted ? '✅ YES' : '❌ NO'}`);
    
    if (!isTrusted) {
      console.log("\n--- Trusting ClaimIssuer for KYC Topic ---");
      
      // First make sure KYC topic (7) exists
      try {
        const addTopicTx = await claimTopicsRegistry.addClaimTopic(7);
        console.log(`Adding KYC topic TX: ${addTopicTx.hash}`);
        await addTopicTx.wait();
        console.log("✅ KYC topic added");
      } catch (e) {
        console.log("KYC topic already exists or error:", e.message.substring(0, 100));
      }
      
      // Trust the ClaimIssuer for KYC topic
      const trustTx = await claimTopicsRegistry.addTrustedIssuer(CLAIM_ISSUER, [7]);
      console.log(`Trust TX: ${trustTx.hash}`);
      await trustTx.wait();
      console.log("✅ ClaimIssuer is now trusted for KYC topic");
      
      // Verify
      const isTrustedNow = await claimTopicsRegistry.isTrustedIssuer(CLAIM_ISSUER, 7);
      console.log(`Verification - Is trusted now for KYC? ${isTrustedNow ? '✅ YES' : '❌ NO'}`);
    } else {
      console.log("✅ ClaimIssuer is already trusted");
    }
    
    // Get all trusted issuers
    console.log("\n--- Getting All Trusted Issuers ---");
    try {
      const trustedIssuers = await claimTopicsRegistry.getTrustedIssuers();
      console.log("All trusted issuers:", trustedIssuers);
      
      // Check topics for each issuer
      for (const issuer of trustedIssuers) {
        const topics = await claimTopicsRegistry.getTrustedIssuerClaimTopics(issuer);
        console.log(`  ${issuer}: topics ${topics}`);
      }
    } catch (e) {
      console.log("Could not get trusted issuers:", e.message);
    }
    
    console.log("\n✅ ClaimIssuer configuration complete!");
    console.log("Token deployment should now work properly.");
    
  } catch (error) {
    console.error("\n❌ Error:", error);
    throw error;
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });