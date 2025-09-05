const { ethers } = require("hardhat");

async function main() {
  console.log("=== Creating and Deploying Asset Directly ===");
  console.log("This will create a new asset and deploy its token");
  console.log();
  
  const [signer] = await ethers.getSigners();
  console.log("Using signer:", signer.address);
  
  // Contract addresses
  const ASSET_REGISTRY = "0x83413e2C668c9249331Bc88D370655bb44527867";
  const FACTORY_ADDRESS = "0x365086b093Eb31CD32653271371892136FcAb254";
  
  // Create a unique asset ID
  const timestamp = Date.now();
  const assetIdString = `test_asset_${timestamp}`;
  const assetId = ethers.keccak256(ethers.toUtf8Bytes(assetIdString));
  console.log(`Generated Asset ID: ${assetId}`);
  
  // Asset details
  const assetDetails = {
    name: "Test Gold Token",
    symbol: "TGT",
    category: 7, // Others
    valuationAmount: ethers.parseEther("1000000"), // 1M tokens
    metadataURI: "ipfs://QmTest123", // Dummy IPFS hash
    custodian: signer.address
  };
  
  console.log("\n--- Step 1: Register Asset ---");
  
  const AssetRegistry = await ethers.getContractFactory("AssetRegistry");
  const registry = AssetRegistry.attach(ASSET_REGISTRY);
  
  try {
    console.log("Registering asset...");
    const registerTx = await registry.registerAsset(
      assetId,
      assetDetails.name,
      assetDetails.category,
      assetDetails.valuationAmount,
      assetDetails.metadataURI,
      assetDetails.custodian
    );
    
    console.log(`Transaction: ${registerTx.hash}`);
    const receipt = await registerTx.wait();
    console.log(`✅ Asset registered at block ${receipt.blockNumber}`);
    
    // Verify registration
    const registeredAsset = await registry.getAsset(assetId);
    console.log(`Asset name: ${registeredAsset.name}`);
    console.log(`Asset status: ${registeredAsset.status}`);
    
  } catch (error) {
    console.error("Failed to register asset:", error.message);
    
    // Check if asset already exists
    try {
      const existing = await registry.getAsset(assetId);
      if (existing.createdAt > 0) {
        console.log("Asset already exists, continuing...");
      }
    } catch {
      console.log("Asset doesn't exist and couldn't be created");
      return;
    }
  }
  
  console.log("\n--- Step 2: Deploy Token ---");
  
  const FinatradesTokenFactory = await ethers.getContractFactory("FinatradesTokenFactory");
  const factory = FinatradesTokenFactory.attach(FACTORY_ADDRESS);
  
  try {
    console.log("Deploying token through factory...");
    console.log(`Token type: 0 (ERC20)`);
    console.log(`Name: ${assetDetails.name}`);
    console.log(`Symbol: ${assetDetails.symbol}`);
    console.log(`Asset ID: ${assetId}`);
    console.log(`Token Admin: ${signer.address}`);
    
    const deployTx = await factory.deployToken(
      0, // ERC20
      assetDetails.name,
      assetDetails.symbol,
      assetId,
      signer.address,
      { gasLimit: 5000000 } // High gas limit to avoid out of gas
    );
    
    console.log(`Transaction: ${deployTx.hash}`);
    console.log("Waiting for confirmation...");
    
    const receipt = await deployTx.wait();
    console.log(`✅ Token deployed! Gas used: ${receipt.gasUsed}`);
    
    // Get token address from event
    const event = receipt.logs.find(log => {
      try {
        const decoded = factory.interface.parseLog(log);
        return decoded && decoded.name === "TokenDeployed";
      } catch {
        return false;
      }
    });
    
    if (event) {
      const decoded = factory.interface.parseLog(event);
      console.log(`\n🎉 SUCCESS! Token deployed at: ${decoded.args.tokenAddress}`);
      console.log(`Token name: ${decoded.args.name}`);
      console.log(`Token symbol: ${decoded.args.symbol}`);
    }
    
  } catch (error) {
    console.error("\n❌ Token deployment failed!");
    console.error("Error:", error.message);
    
    if (error.reason) {
      console.error("Reason:", error.reason);
    }
    
    // More detailed error analysis
    if (error.message.includes("delegate call failed")) {
      console.log("\n--- Analyzing Delegate Call Failure ---");
      
      // Check each implementation
      const implementations = {
        erc20: await factory.erc20Implementation(),
        compliance: await factory.complianceImplementation()
      };
      
      console.log("Implementations:");
      console.log(`  ERC20: ${implementations.erc20}`);
      console.log(`  Compliance: ${implementations.compliance}`);
      
      // Check if compliance implementation is initialized
      const ModularCompliance = await ethers.getContractFactory("ModularCompliance");
      const compliance = ModularCompliance.attach(implementations.compliance);
      
      try {
        const DEFAULT_ADMIN_ROLE = "0x0000000000000000000000000000000000000000000000000000000000000000";
        const zeroHasRole = await compliance.hasRole(DEFAULT_ADMIN_ROLE, ethers.ZeroAddress);
        const signerHasRole = await compliance.hasRole(DEFAULT_ADMIN_ROLE, signer.address);
        
        console.log(`\nCompliance implementation state:`);
        console.log(`  Zero address has admin: ${zeroHasRole}`);
        console.log(`  Signer has admin: ${signerHasRole}`);
        
        if (zeroHasRole || signerHasRole) {
          console.log("  ❌ PROBLEM: Implementation is initialized!");
          console.log("     This prevents proxy initialization");
        }
      } catch (e) {
        console.log("  Could not check roles (might be uninitialized - good)");
      }
    }
  }
}

main()
  .then(() => {
    console.log("\n✅ Script complete");
    process.exit(0);
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });