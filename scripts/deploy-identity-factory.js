const { ethers, upgrades } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  console.log("=".repeat(60));
  console.log("IDENTITY FACTORY DEPLOYMENT");
  console.log("=".repeat(60));
  
  const [deployer] = await ethers.getSigners();
  console.log("Deploying with account:", deployer.address);
  
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("Account balance:", ethers.formatEther(balance), "ETH");
  
  // Check for existing deployment
  const deploymentPath = path.join(__dirname, `../deployments/${network.name}-deployment.json`);
  let deployment = {};
  
  if (fs.existsSync(deploymentPath)) {
    deployment = JSON.parse(fs.readFileSync(deploymentPath, "utf8"));
    console.log("\nFound existing deployment");
  }
  
  // Get IdentityRegistry address
  const identityRegistryAddress = deployment.IdentityRegistry?.address || process.env.IDENTITY_REGISTRY_ADDRESS;
  
  if (!identityRegistryAddress) {
    throw new Error("IdentityRegistry address not found. Deploy main contracts first or set IDENTITY_REGISTRY_ADDRESS");
  }
  
  console.log("\nUsing IdentityRegistry:", identityRegistryAddress);
  
  try {
    // Deploy IdentityFactory
    console.log("\nDeploying IdentityFactory...");
    const IdentityFactory = await ethers.getContractFactory("IdentityFactory");
    const identityFactory = await upgrades.deployProxy(
      IdentityFactory,
      [deployer.address, identityRegistryAddress],
      { kind: 'uups' }
    );
    
    await identityFactory.waitForDeployment();
    const factoryAddress = await identityFactory.getAddress();
    console.log("IdentityFactory deployed to:", factoryAddress);
    
    // Get implementation address
    const implementationAddress = await upgrades.erc1967.getImplementationAddress(factoryAddress);
    console.log("Implementation deployed to:", implementationAddress);
    
    // Grant AGENT_ROLE on IdentityRegistry to the factory
    console.log("\nGranting AGENT_ROLE to IdentityFactory...");
    const IdentityRegistry = await ethers.getContractFactory("IdentityRegistry");
    const identityRegistry = IdentityRegistry.attach(identityRegistryAddress);
    
    const AGENT_ROLE = await identityRegistry.AGENT_ROLE();
    const hasRole = await identityRegistry.hasRole(AGENT_ROLE, factoryAddress);
    
    if (!hasRole) {
      const tx = await identityRegistry.grantRole(AGENT_ROLE, factoryAddress);
      await tx.wait();
      console.log("AGENT_ROLE granted to IdentityFactory");
    } else {
      console.log("IdentityFactory already has AGENT_ROLE");
    }
    
    // Update deployment file
    deployment.IdentityFactory = {
      address: factoryAddress,
      implementation: implementationAddress,
      deployedAt: new Date().toISOString(),
      deployer: deployer.address
    };
    
    fs.writeFileSync(deploymentPath, JSON.stringify(deployment, null, 2));
    console.log("\nDeployment file updated");
    
    // Verify on Etherscan/Polygonscan
    if (network.name !== "hardhat" && network.name !== "localhost") {
      console.log("\nWaiting for block confirmations before verification...");
      await new Promise(resolve => setTimeout(resolve, 30000)); // Wait 30 seconds
      
      try {
        await hre.run("verify:verify", {
          address: implementationAddress,
          constructorArguments: []
        });
        console.log("IdentityFactory implementation verified");
      } catch (error) {
        console.log("Verification error:", error.message);
      }
    }
    
    console.log("\n=== Deployment Summary ===");
    console.log("Network:", network.name);
    console.log("IdentityFactory:", factoryAddress);
    console.log("Implementation:", implementationAddress);
    console.log("IdentityRegistry:", identityRegistryAddress);
    console.log("\n✅ IdentityFactory deployed successfully!");
    
    // Test deployment
    console.log("\n=== Testing Deployment ===");
    const version = await identityFactory.version();
    console.log("Contract version:", version);
    
    const registry = await identityFactory.identityRegistry();
    console.log("Registry configured:", registry);
    
    console.log("\n📝 Next steps:");
    console.log("1. Grant IDENTITY_DEPLOYER_ROLE to addresses that should deploy identities");
    console.log("2. Update your backend to use the IdentityFactory");
    console.log("3. Example grant command:");
    console.log(`   await identityFactory.grantRole(await identityFactory.IDENTITY_DEPLOYER_ROLE(), "0xYourBackendWallet");`);
    
  } catch (error) {
    console.error("\n❌ Deployment failed:", error);
    throw error;
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });