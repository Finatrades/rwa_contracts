import { ethers, run, network } from "hardhat";
import chalk from "chalk";

async function main() {
  console.log(chalk.blue("\n🔍 Verifying FinatradesTimelock Contract...\n"));

  const TIMELOCK_ADDRESS = "0x90c02646D2aC337082b0058158954Cb8dFF62985";
  
  // Constructor arguments from deployment (from .env file)
  const TIMELOCK_DELAY = 2 * 24 * 60 * 60; // 2 days in seconds
  const MULTISIG_OWNERS = [
    "0xCE982AC6bc316Cf9d875652B84C7626B62a899eA",
    "0xCE982AC6bc316Cf9d875652B84C7626B62a899eA",
    "0xCE982AC6bc316Cf9d875652B84C7626B62a899eA"
  ];

  const constructorArguments = [
    TIMELOCK_DELAY,
    MULTISIG_OWNERS, // proposers
    MULTISIG_OWNERS, // executors
    ethers.ZeroAddress // admin (0 = self-administration)
  ];

  console.log(chalk.gray("Network:"), network.name);
  console.log(chalk.gray("Contract Address:"), TIMELOCK_ADDRESS);
  console.log(chalk.gray("Constructor Arguments:"));
  console.log(chalk.gray("- Min Delay:"), TIMELOCK_DELAY, "seconds (2 days)");
  console.log(chalk.gray("- Proposers:"), MULTISIG_OWNERS);
  console.log(chalk.gray("- Executors:"), MULTISIG_OWNERS);
  console.log(chalk.gray("- Admin:"), ethers.ZeroAddress);

  try {
    await run("verify:verify", {
      address: TIMELOCK_ADDRESS,
      constructorArguments: constructorArguments,
      contract: "contracts/governance/FinatradesTimelock.sol:FinatradesTimelock"
    });
    
    console.log(chalk.green("\n✅ FinatradesTimelock verified successfully!"));
  } catch (error: any) {
    if (error.message.includes("already verified")) {
      console.log(chalk.yellow("\n⚠️  Contract is already verified!"));
    } else {
      console.log(chalk.red("\n❌ Verification failed:"), error.message);
      console.log(chalk.gray("\nTry running with --show-stack-traces for more details"));
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });