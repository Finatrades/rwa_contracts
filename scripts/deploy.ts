import { ethers, upgrades, run } from "hardhat";
import dotenv from "dotenv";

dotenv.config();

async function main() {
  console.log("Starting deployment...");

  // Get deployment parameters from environment
  const INITIAL_ADMIN = process.env.INITIAL_ADMIN || "";
  const MULTISIG_OWNERS = process.env.MULTISIG_OWNERS ? JSON.parse(process.env.MULTISIG_OWNERS) : [];
  const MULTISIG_THRESHOLD = parseInt(process.env.MULTISIG_THRESHOLD || "2");
  const TIMELOCK_DELAY = parseInt(process.env.TIMELOCK_DELAY || "172800"); // 2 days

  if (!INITIAL_ADMIN || MULTISIG_OWNERS.length < 2) {
    throw new Error("Please configure INITIAL_ADMIN and MULTISIG_OWNERS in .env file");
  }

  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with the account:", deployer.address);
  console.log("Account balance:", (await ethers.provider.getBalance(deployer.address)).toString());

  // Deploy Timelock Controller
  console.log("\n1. Deploying Timelock Controller...");
  const TimelockFactory = await ethers.getContractFactory("FinatradesTimelock");
  const timelock = await TimelockFactory.deploy(
    TIMELOCK_DELAY,
    MULTISIG_OWNERS, // proposers
    MULTISIG_OWNERS, // executors
    ethers.ZeroAddress // admin (self-administered)
  );
  await timelock.waitForDeployment();
  const timelockAddress = await timelock.getAddress();
  console.log("Timelock deployed to:", timelockAddress);

  // Deploy FinatradesRWA (Upgradeable)
  console.log("\n2. Deploying FinatradesRWA (Upgradeable)...");
  const FinatradesRWAFactory = await ethers.getContractFactory("FinatradesRWA_Final");
  const finatradesRWA = await upgrades.deployProxy(
    FinatradesRWAFactory,
    [
      "Finatrades RWA Token",
      "FRWA",
      INITIAL_ADMIN,
      timelockAddress
    ],
    {
      initializer: 'initialize',
      kind: 'uups'
    }
  );
  await finatradesRWA.waitForDeployment();
  const rwaAddress = await finatradesRWA.getAddress();
  console.log("FinatradesRWA deployed to:", rwaAddress);

  // Get implementation address for verification
  const implementationAddress = await upgrades.erc1967.getImplementationAddress(rwaAddress);
  console.log("Implementation deployed to:", implementationAddress);

  // Wait for blocks to be mined
  console.log("\n3. Waiting for blocks to be mined...");
  await new Promise(resolve => setTimeout(resolve, 30000)); // 30 seconds

  // Verify contracts
  if (process.env.ETHERSCAN_API_KEY) {
    console.log("\n4. Verifying contracts...");
    
    try {
      // Verify Timelock
      await run("verify:verify", {
        address: timelockAddress,
        constructorArguments: [
          TIMELOCK_DELAY,
          MULTISIG_OWNERS,
          MULTISIG_OWNERS,
          ethers.ZeroAddress
        ],
      });
      console.log("Timelock verified!");
    } catch (error: any) {
      console.log("Timelock verification failed:", error.message);
    }

    try {
      // Verify Implementation
      await run("verify:verify", {
        address: implementationAddress,
        constructorArguments: [],
      });
      console.log("Implementation verified!");
    } catch (error: any) {
      console.log("Implementation verification failed:", error.message);
    }
  }

  // Save deployment addresses
  const deployment = {
    network: (await ethers.provider.getNetwork()).name,
    chainId: (await ethers.provider.getNetwork()).chainId.toString(),
    deploymentDate: new Date().toISOString(),
    contracts: {
      timelock: {
        address: timelockAddress,
        minDelay: TIMELOCK_DELAY,
        proposers: MULTISIG_OWNERS,
        executors: MULTISIG_OWNERS
      },
      finatradesRWA: {
        proxy: rwaAddress,
        implementation: implementationAddress,
        admin: INITIAL_ADMIN,
        name: "Finatrades RWA Token",
        symbol: "FRWA"
      }
    }
  };

  const fs = await import('fs');
  const deploymentPath = `./deployments/${deployment.network}-${Date.now()}.json`;
  fs.writeFileSync(deploymentPath, JSON.stringify(deployment, null, 2));
  console.log(`\n5. Deployment info saved to ${deploymentPath}`);

  console.log("\n✅ Deployment completed successfully!");
  console.log("\n📋 Summary:");
  console.log("- Timelock:", timelockAddress);
  console.log("- FinatradesRWA Proxy:", rwaAddress);
  console.log("- FinatradesRWA Implementation:", implementationAddress);
  console.log("\n🔐 Next steps:");
  console.log("1. Transfer any remaining admin roles to the timelock");
  console.log("2. Configure compliance settings");
  console.log("3. Register initial investors");
  console.log("4. Begin token issuance");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });