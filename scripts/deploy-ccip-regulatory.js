const hre = require("hardhat");
const { ethers, upgrades } = require("hardhat");
const fs = require("fs");
const path = require("path");

// Chainlink CCIP Configuration for different networks
const CCIP_CONFIG = {
  polygon: {
    router: "0x849c5ED5a80F5B408Dd4969b78c2C8fdf0565Bfe", // Polygon mainnet CCIP router
    linkToken: "0xb0897686c545045aFc77CF20eC7A532E3120E0F1", // LINK token on Polygon
    chainSelector: "4051577828743386545", // Polygon chain selector
  },
  ethereum: {
    router: "0x80226fc0Ee2b096224EeAc085Bb9a8cba1146f7D", // Ethereum mainnet CCIP router
    linkToken: "0x514910771AF9Ca656af840dff83E8264EcF986CA", // LINK token on Ethereum
    chainSelector: "5009297550715157269", // Ethereum chain selector
  },
  arbitrum: {
    router: "0x141fa059441E0ca23ce184B6A78bafD2A517DdE8", // Arbitrum mainnet CCIP router
    linkToken: "0xf97f4df75117a78c1A5a0DBb814Af92458539FB4", // LINK token on Arbitrum
    chainSelector: "4949039107694359620", // Arbitrum chain selector
  },
  bsc: {
    router: "0x34B03Cb9086d7D758AC55af71584F81A598759FE", // BSC mainnet CCIP router
    linkToken: "0x404460C6A5EdE2D891e8297795264fDe62ADBB75", // LINK token on BSC
    chainSelector: "11344663589394136015", // BSC chain selector
  },
  // Test networks
  polygonAmoy: {
    router: "0x9C32fCB86BF0f4a1A8921a9Fe46de3198bb884B2", // Polygon Amoy testnet
    linkToken: "0x0Fd9e8d3aF1aaee056EB9e802c3A762a667b1904", // LINK on Amoy
    chainSelector: "16281711391670634445", // Amoy chain selector
  }
};

async function main() {
  console.log("Starting CCIP Regulatory Compliance deployment...");
  
  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with account:", deployer.address);
  
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("Account balance:", ethers.formatEther(balance));
  
  // Get network configuration
  const network = hre.network.name;
  const ccipConfig = CCIP_CONFIG[network];
  
  if (!ccipConfig) {
    throw new Error(`CCIP configuration not found for network: ${network}`);
  }
  
  console.log("Using CCIP configuration:", ccipConfig);
  
  // Get existing deployment addresses
  const deploymentPath = path.join(__dirname, "..", "deployments", `${network}_ccip_regulatory.json`);
  let deployment = {};
  
  if (fs.existsSync(deploymentPath)) {
    deployment = JSON.parse(fs.readFileSync(deploymentPath, "utf8"));
    console.log("Found existing deployment:", deployment);
  }
  
  // Get existing identity registry address from main deployment
  const mainDeploymentPath = path.join(__dirname, "..", "deployments", `${network}_latest.json`);
  let identityRegistryAddress;
  
  if (fs.existsSync(mainDeploymentPath)) {
    const mainDeployment = JSON.parse(fs.readFileSync(mainDeploymentPath, "utf8"));
    identityRegistryAddress = mainDeployment.IdentityRegistry?.address;
    console.log("Found existing IdentityRegistry:", identityRegistryAddress);
  }
  
  if (!identityRegistryAddress) {
    console.log("Warning: IdentityRegistry not found. Deploying without ERC-3643 integration.");
    identityRegistryAddress = ethers.ZeroAddress; // Will need to update later
  }
  
  try {
    // 1. Deploy RegulatoryIdentityRegistry
    console.log("\n1. Deploying RegulatoryIdentityRegistry...");
    const RegulatoryIdentityRegistry = await ethers.getContractFactory("RegulatoryIdentityRegistry");
    const regulatoryIdentityRegistry = await upgrades.deployProxy(
      RegulatoryIdentityRegistry,
      [
        deployer.address,
        identityRegistryAddress,
        BigInt(ccipConfig.chainSelector)
      ],
      { kind: 'uups' }
    );
    await regulatoryIdentityRegistry.waitForDeployment();
    const regulatoryIdentityRegistryAddress = await regulatoryIdentityRegistry.getAddress();
    console.log("RegulatoryIdentityRegistry deployed to:", regulatoryIdentityRegistryAddress);
    
    deployment.RegulatoryIdentityRegistry = {
      address: regulatoryIdentityRegistryAddress,
      implementation: await upgrades.erc1967.getImplementationAddress(regulatoryIdentityRegistryAddress)
    };
    
    // 2. Deploy RegulatoryAuditTrail
    console.log("\n2. Deploying RegulatoryAuditTrail...");
    const RegulatoryAuditTrail = await ethers.getContractFactory("RegulatoryAuditTrail");
    const regulatoryAuditTrail = await upgrades.deployProxy(
      RegulatoryAuditTrail,
      [deployer.address],
      { kind: 'uups' }
    );
    await regulatoryAuditTrail.waitForDeployment();
    const regulatoryAuditTrailAddress = await regulatoryAuditTrail.getAddress();
    console.log("RegulatoryAuditTrail deployed to:", regulatoryAuditTrailAddress);
    
    deployment.RegulatoryAuditTrail = {
      address: regulatoryAuditTrailAddress,
      implementation: await upgrades.erc1967.getImplementationAddress(regulatoryAuditTrailAddress)
    };
    
    // 3. Deploy CCIPRegulatoryBridge
    console.log("\n3. Deploying CCIPRegulatoryBridge...");
    const CCIPRegulatoryBridge = await ethers.getContractFactory("CCIPRegulatoryBridge");
    const ccipRegulatoryBridge = await upgrades.deployProxy(
      CCIPRegulatoryBridge,
      [
        deployer.address,
        ccipConfig.router,
        ccipConfig.linkToken,
        regulatoryIdentityRegistryAddress
      ],
      { kind: 'uups' }
    );
    await ccipRegulatoryBridge.waitForDeployment();
    const ccipRegulatoryBridgeAddress = await ccipRegulatoryBridge.getAddress();
    console.log("CCIPRegulatoryBridge deployed to:", ccipRegulatoryBridgeAddress);
    
    deployment.CCIPRegulatoryBridge = {
      address: ccipRegulatoryBridgeAddress,
      implementation: await upgrades.erc1967.getImplementationAddress(ccipRegulatoryBridgeAddress)
    };
    
    // 4. Deploy CCIPIdentityReceiver
    console.log("\n4. Deploying CCIPIdentityReceiver...");
    const CCIPIdentityReceiver = await ethers.getContractFactory("CCIPIdentityReceiver");
    const ccipIdentityReceiver = await upgrades.deployProxy(
      CCIPIdentityReceiver,
      [
        deployer.address,
        ccipConfig.router,
        regulatoryIdentityRegistryAddress
      ],
      { kind: 'uups' }
    );
    await ccipIdentityReceiver.waitForDeployment();
    const ccipIdentityReceiverAddress = await ccipIdentityReceiver.getAddress();
    console.log("CCIPIdentityReceiver deployed to:", ccipIdentityReceiverAddress);
    
    deployment.CCIPIdentityReceiver = {
      address: ccipIdentityReceiverAddress,
      implementation: await upgrades.erc1967.getImplementationAddress(ccipIdentityReceiverAddress)
    };
    
    // 5. Configure contracts
    console.log("\n5. Configuring contracts...");
    
    // Grant CCIP_ROLE to receiver in identity registry
    console.log("Granting CCIP_ROLE to receiver...");
    await regulatoryIdentityRegistry.grantRole(
      await regulatoryIdentityRegistry.CCIP_ROLE(),
      ccipIdentityReceiverAddress
    );
    
    // Grant RECORDER_ROLE to bridge in audit trail
    console.log("Granting RECORDER_ROLE to bridge...");
    await regulatoryAuditTrail.addRecorder(ccipRegulatoryBridgeAddress);
    
    // Grant OPERATOR_ROLE to deployer in bridge (for testing)
    console.log("Granting OPERATOR_ROLE to deployer...");
    await ccipRegulatoryBridge.grantRole(
      await ccipRegulatoryBridge.OPERATOR_ROLE(),
      deployer.address
    );
    
    // 6. Configure cross-chain connections (example for Polygon <-> Ethereum)
    if (network === "polygon" && deployment.CCIPRegulatoryBridge) {
      console.log("\n6. Configuring cross-chain connections...");
      
      // Enable Ethereum as destination
      const ethereumChainSelector = CCIP_CONFIG.ethereum.chainSelector;
      console.log("Enabling Ethereum chain...");
      
      // Note: You'll need to deploy on Ethereum and get the receiver address
      // For now, using a placeholder
      const ethereumReceiverAddress = ethers.ZeroAddress; // Update with actual address
      
      if (ethereumReceiverAddress !== ethers.ZeroAddress) {
        await ccipRegulatoryBridge.enableChain(
          BigInt(ethereumChainSelector),
          ethereumReceiverAddress
        );
        console.log("Enabled Ethereum chain");
      }
    }
    
    // Save deployment info
    deployment.network = network;
    deployment.deployedAt = new Date().toISOString();
    deployment.deployer = deployer.address;
    deployment.ccipConfig = ccipConfig;
    
    fs.writeFileSync(deploymentPath, JSON.stringify(deployment, null, 2));
    console.log("\nDeployment info saved to:", deploymentPath);
    
    // Display summary
    console.log("\n=== Deployment Summary ===");
    console.log("Network:", network);
    console.log("RegulatoryIdentityRegistry:", deployment.RegulatoryIdentityRegistry.address);
    console.log("RegulatoryAuditTrail:", deployment.RegulatoryAuditTrail.address);
    console.log("CCIPRegulatoryBridge:", deployment.CCIPRegulatoryBridge.address);
    console.log("CCIPIdentityReceiver:", deployment.CCIPIdentityReceiver.address);
    console.log("\nCCIP Configuration:");
    console.log("Router:", ccipConfig.router);
    console.log("LINK Token:", ccipConfig.linkToken);
    console.log("Chain Selector:", ccipConfig.chainSelector);
    
    console.log("\n=== Next Steps ===");
    console.log("1. Fund CCIPRegulatoryBridge with LINK tokens for CCIP fees");
    console.log("2. Deploy contracts on destination chains");
    console.log("3. Configure cross-chain connections with enableChain()");
    console.log("4. Authorize source chains in receivers with authorizeSourceChain()");
    console.log("5. Update the web application to use new identity registry");
    console.log("6. Test cross-chain identity propagation");
    
    // Verify contracts if on mainnet or testnet
    if (network !== "localhost" && network !== "hardhat") {
      console.log("\n=== Verifying Contracts ===");
      
      await hre.run("verify:verify", {
        address: deployment.RegulatoryIdentityRegistry.implementation,
        constructorArguments: []
      });
      
      await hre.run("verify:verify", {
        address: deployment.RegulatoryAuditTrail.implementation,
        constructorArguments: []
      });
      
      await hre.run("verify:verify", {
        address: deployment.CCIPRegulatoryBridge.implementation,
        constructorArguments: []
      });
      
      await hre.run("verify:verify", {
        address: deployment.CCIPIdentityReceiver.implementation,
        constructorArguments: []
      });
      
      console.log("All contracts verified!");
    }
    
  } catch (error) {
    console.error("Deployment failed:", error);
    
    // Save partial deployment
    if (Object.keys(deployment).length > 0) {
      deployment.status = "partial";
      deployment.error = error.message;
      fs.writeFileSync(deploymentPath, JSON.stringify(deployment, null, 2));
      console.log("Partial deployment saved to:", deploymentPath);
    }
    
    throw error;
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });