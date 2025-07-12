import { ethers, upgrades, run } from "hardhat";
import dotenv from "dotenv";
import chalk from "chalk";

dotenv.config();

async function main() {
  console.log(chalk.blue.bold("\n🚀 Starting BSC Deployment...\n"));

  // Get deployment parameters from environment
  const INITIAL_ADMIN = process.env.INITIAL_ADMIN || "";
  const MULTISIG_OWNERS = process.env.MULTISIG_OWNERS ? JSON.parse(process.env.MULTISIG_OWNERS) : [];
  const MULTISIG_THRESHOLD = parseInt(process.env.MULTISIG_THRESHOLD || "2");
  const TIMELOCK_DELAY = parseInt(process.env.TIMELOCK_DELAY || "172800"); // 2 days

  if (!INITIAL_ADMIN || MULTISIG_OWNERS.length < 2) {
    throw new Error("Please configure INITIAL_ADMIN and MULTISIG_OWNERS in .env file");
  }

  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with account:", deployer.address);
  console.log("Account balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "BNB");

  // Deploy Timelock Controller
  console.log(chalk.yellow("\n1. Deploying Timelock Controller..."));
  const TimelockFactory = await ethers.getContractFactory("FinatradesTimelock");
  const timelock = await TimelockFactory.deploy(
    TIMELOCK_DELAY,
    MULTISIG_OWNERS, // proposers
    MULTISIG_OWNERS, // executors
    ethers.ZeroAddress // admin (self-administered)
  );
  await timelock.waitForDeployment();
  const timelockAddress = await timelock.getAddress();
  console.log(chalk.green("✓ Timelock deployed to:"), timelockAddress);

  // Deploy FinatradesRWA (Upgradeable) with higher gas limit for BSC
  console.log(chalk.yellow("\n2. Deploying FinatradesRWA (Upgradeable)..."));
  console.log("Note: BSC supports larger contracts than Ethereum mainnet");
  
  try {
    const FinatradesRWAFactory = await ethers.getContractFactory("FinatradesRWAOptimized");
    
    // Deploy with explicit gas limit for BSC
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
        kind: 'uups',
        txOverrides: {
          gasLimit: 8000000 // Higher gas limit for BSC
        }
      }
    );
    
    await finatradesRWA.waitForDeployment();
    const rwaAddress = await finatradesRWA.getAddress();
    console.log(chalk.green("✓ FinatradesRWA deployed to:"), rwaAddress);

    // Get implementation address for verification
    const implementationAddress = await upgrades.erc1967.getImplementationAddress(rwaAddress);
    console.log(chalk.green("✓ Implementation deployed to:"), implementationAddress);

    // Initialize jurisdictions
    console.log(chalk.yellow("\n3. Setting up jurisdictions..."));
    // Map jurisdiction codes: 1=SG, 2=MY, 3=ID, etc.
    const jurisdictionCodes = [
      1, 2, 3, 4, 5, 6, 7, 8, 9, 10, // Asian countries
      11, 12, 13, 14, 15, 16, 17, 18, 19, 20, // African countries
    ];
    const allowed = new Array(jurisdictionCodes.length).fill(true);
    
    const tx = await finatradesRWA.setJurisdictions(jurisdictionCodes, allowed);
    await tx.wait();
    console.log(chalk.green("✓ Jurisdictions configured"));

    // Wait for blocks to be mined
    console.log(chalk.yellow("\n4. Waiting for confirmations..."));
    await new Promise(resolve => setTimeout(resolve, 20000)); // 20 seconds for BSC

    // Verify contracts on BscScan
    if (process.env.BSCSCAN_API_KEY) {
      console.log(chalk.yellow("\n5. Verifying contracts on BscScan..."));
      
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
        console.log(chalk.green("✓ Timelock verified!"));
      } catch (error: any) {
        console.log(chalk.yellow("⚠️  Timelock verification failed:"), error.message);
      }

      try {
        // Verify Implementation
        await run("verify:verify", {
          address: implementationAddress,
          constructorArguments: [],
        });
        console.log(chalk.green("✓ Implementation verified!"));
      } catch (error: any) {
        console.log(chalk.yellow("⚠️  Implementation verification failed:"), error.message);
      }
    }

    // Save deployment addresses
    const deployment = {
      network: "BSC Testnet",
      chainId: "97",
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
      },
      explorerLinks: {
        timelock: `https://testnet.bscscan.com/address/${timelockAddress}`,
        proxy: `https://testnet.bscscan.com/address/${rwaAddress}`,
        implementation: `https://testnet.bscscan.com/address/${implementationAddress}`
      }
    };

    const fs = await import('fs');
    const deploymentPath = `./deployments/bsc-testnet-${Date.now()}.json`;
    await fs.promises.mkdir('./deployments', { recursive: true });
    await fs.promises.writeFile(deploymentPath, JSON.stringify(deployment, null, 2));
    
    console.log(chalk.green(`\n✅ Deployment completed successfully!`));
    console.log(chalk.blue(`\n📋 Deployment info saved to: ${deploymentPath}`));
    
    console.log(chalk.cyan("\n🔗 Contract Addresses:"));
    console.log(`   Timelock: ${timelockAddress}`);
    console.log(`   RWA Token: ${rwaAddress}`);
    console.log(`   Implementation: ${implementationAddress}`);
    
    console.log(chalk.cyan("\n🌐 View on BscScan:"));
    console.log(`   ${deployment.explorerLinks.timelock}`);
    console.log(`   ${deployment.explorerLinks.proxy}`);
    
    console.log(chalk.yellow("\n🔐 Next Steps:"));
    console.log("1. Verify contracts are working correctly");
    console.log("2. Transfer remaining admin roles to timelock");
    console.log("3. Configure compliance settings");
    console.log("4. Register initial investors");
    
  } catch (error: any) {
    console.error(chalk.red("\n❌ Deployment failed:"), error.message);
    if (error.message.includes("max code size exceeded")) {
      console.log(chalk.yellow("\n💡 Contract is too large. Consider:"));
      console.log("   - Splitting functionality into multiple contracts");
      console.log("   - Using libraries for common functions");
      console.log("   - Removing non-essential features");
      console.log("   - Deploying to a network that supports larger contracts");
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