const hre = require("hardhat");
const { ethers, upgrades, run } = hre;
const fs = require("fs");
const path = require("path");

// CCIP Router addresses by network
const CCIP_ROUTERS = {
  polygon: "0x70499c328e1E2a3c41108bd3730F6670a44595D1",
  ethereum: "0xE561d5E02641f9D9A3B6f6c7220b3E5c5C5F6E3B",
  arbitrum: "0x88E492127709447A5ABEFdaB8788a15B4567589E",
  bsc: "0x536d7E53D0aDeB1F20E7c81fea45d02eC9dBD698"
};

// LINK Token addresses by network
const LINK_TOKENS = {
  polygon: "0x53E0bca35eC356BD5ddDFebbD1Fc0fD03FaBad39",
  ethereum: "0x514910771AF9Ca656af840dff83E8264EcF986CA",
  arbitrum: "0xf97f4df75117a78c1A5a0DBb814Af92458539FB4",
  bsc: "0x404460C6A5EdE2D891e8297795264fDe62ADBB75"
};

async function main() {
  const network = hre.network.name;
  console.log(`Deploying CCIP regulatory contracts to ${network}...`);

  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with account:", deployer.address);
  console.log("Account balance:", (await ethers.provider.getBalance(deployer.address)).toString());

  // Get chain ID for CCIP
  const chainIdMap = {
    polygon: 16281711391670634445n, // Polygon mainnet CCIP chain selector
    polygonAmoy: 16281711391670634445n, // Using polygon selector for now
    ethereum: 5009297550715157269n, // Ethereum mainnet CCIP chain selector
    arbitrum: 4949039107694359620n, // Arbitrum mainnet CCIP chain selector
    bsc: 11344663589394136015n // BSC mainnet CCIP chain selector
  };
  const currentChainId = chainIdMap[network] || 16281711391670634445n;

  // Get existing Identity Registry address from deployments
  const identityRegistryPath = path.join(__dirname, `../deployments/polygon.json`);
  let identityRegistryAddress = "0x0000000000000000000000000000000000000000"; // Default zero address
  
  if (fs.existsSync(identityRegistryPath)) {
    const deployment = JSON.parse(fs.readFileSync(identityRegistryPath, 'utf8'));
    if (deployment.IdentityRegistry) {
      identityRegistryAddress = deployment.IdentityRegistry;
      console.log("Using existing IdentityRegistry:", identityRegistryAddress);
    }
  }

  // Deploy RegulatoryIdentityRegistry (Upgradeable)
  console.log("\n1. Deploying RegulatoryIdentityRegistry...");
  const RegulatoryIdentityRegistry = await ethers.getContractFactory("RegulatoryIdentityRegistry");
  const registry = await upgrades.deployProxy(
    RegulatoryIdentityRegistry,
    [deployer.address, identityRegistryAddress, currentChainId],
    { initializer: "initialize" }
  );
  await registry.waitForDeployment();
  const registryAddress = await registry.getAddress();
  console.log("RegulatoryIdentityRegistry deployed to:", registryAddress);

  // Deploy RegulatoryAuditTrail (Upgradeable)
  console.log("\n2. Deploying RegulatoryAuditTrail...");
  const RegulatoryAuditTrail = await ethers.getContractFactory("RegulatoryAuditTrail");
  const auditTrail = await upgrades.deployProxy(
    RegulatoryAuditTrail,
    [deployer.address],
    { initializer: "initialize" }
  );
  await auditTrail.waitForDeployment();
  const auditTrailAddress = await auditTrail.getAddress();
  console.log("RegulatoryAuditTrail deployed to:", auditTrailAddress);

  // Deploy CCIPRegulatoryBridge
  console.log("\n3. Deploying CCIPRegulatoryBridge...");
  const ccipRouter = CCIP_ROUTERS[network];
  const linkToken = LINK_TOKENS[network];
  
  if (!ccipRouter || !linkToken) {
    throw new Error(`CCIP Router or LINK token not configured for network: ${network}`);
  }

  const CCIPRegulatoryBridge = await ethers.getContractFactory("CCIPRegulatoryBridge");
  const bridge = await upgrades.deployProxy(
    CCIPRegulatoryBridge,
    [deployer.address, ccipRouter, linkToken, registryAddress],
    { initializer: "initialize" }
  );
  await bridge.waitForDeployment();
  const bridgeAddress = await bridge.getAddress();
  console.log("CCIPRegulatoryBridge deployed to:", bridgeAddress);

  // Deploy CCIPIdentityReceiver
  console.log("\n4. Deploying CCIPIdentityReceiver...");
  const CCIPIdentityReceiver = await ethers.getContractFactory("CCIPIdentityReceiver");
  const receiver = await upgrades.deployProxy(
    CCIPIdentityReceiver,
    [deployer.address, ccipRouter, registryAddress],
    { initializer: "initialize" }
  );
  await receiver.waitForDeployment();
  const receiverAddress = await receiver.getAddress();
  console.log("CCIPIdentityReceiver deployed to:", receiverAddress);

  // Configure contracts
  console.log("\n5. Configuring contracts...");

  // Grant roles
  const COMPLIANCE_OFFICER_ROLE = await registry.COMPLIANCE_OFFICER_ROLE();
  await registry.grantRole(COMPLIANCE_OFFICER_ROLE, deployer.address);
  console.log("Granted compliance officer role to deployer");

  // Grant recorder role in audit trail to bridge
  const RECORDER_ROLE = await auditTrail.RECORDER_ROLE();
  await auditTrail.grantRole(RECORDER_ROLE, bridgeAddress);
  console.log("Granted recorder role to bridge in audit trail");

  // Grant recorder role to receiver as well
  await auditTrail.grantRole(RECORDER_ROLE, receiverAddress);
  console.log("Granted recorder role to receiver in audit trail");

  // Save deployment addresses
  const addresses = {
    RegulatoryIdentityRegistry: registryAddress,
    RegulatoryAuditTrail: auditTrailAddress,
    CCIPRegulatoryBridge: bridgeAddress,
    CCIPIdentityReceiver: receiverAddress,
    network: network,
    deployer: deployer.address,
    timestamp: new Date().toISOString()
  };

  const addressesPath = path.join(__dirname, `../deployments/ccip-${network}.json`);
  fs.mkdirSync(path.dirname(addressesPath), { recursive: true });
  fs.writeFileSync(addressesPath, JSON.stringify(addresses, null, 2));
  console.log(`\nDeployment addresses saved to: ${addressesPath}`);

  // Verify contracts on Etherscan/Polygonscan
  if (network !== "hardhat" && network !== "localhost") {
    console.log("\n6. Verifying contracts on explorer...");
    
    try {
      // Verify implementation contract (not proxy)
      const registryImpl = await upgrades.erc1967.getImplementationAddress(registryAddress);
      await run("verify:verify", {
        address: registryImpl,
        constructorArguments: []
      });
      console.log("RegulatoryIdentityRegistry implementation verified");

      // Verify audit trail implementation
      const auditTrailImpl = await upgrades.erc1967.getImplementationAddress(auditTrailAddress);
      await run("verify:verify", {
        address: auditTrailImpl,
        constructorArguments: []
      });
      console.log("RegulatoryAuditTrail implementation verified");

      // Verify bridge implementation
      const bridgeImpl = await upgrades.erc1967.getImplementationAddress(bridgeAddress);
      await run("verify:verify", {
        address: bridgeImpl,
        constructorArguments: []
      });
      console.log("CCIPRegulatoryBridge implementation verified");

      // Verify receiver implementation
      const receiverImpl = await upgrades.erc1967.getImplementationAddress(receiverAddress);
      await run("verify:verify", {
        address: receiverImpl,
        constructorArguments: []
      });
      console.log("CCIPIdentityReceiver implementation verified");
    } catch (error) {
      console.error("Verification failed:", error.message);
    }
  }

  console.log("\n✅ CCIP regulatory contracts deployed successfully!");
  console.log("\n📋 Contract Addresses:");
  console.log("RegulatoryIdentityRegistry:", registryAddress);
  console.log("RegulatoryAuditTrail:", auditTrailAddress);
  console.log("CCIPRegulatoryBridge:", bridgeAddress);
  console.log("CCIPIdentityReceiver:", receiverAddress);
  console.log("\n⚠️  IMPORTANT: Fund the CCIPRegulatoryBridge with LINK tokens for cross-chain messaging!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });