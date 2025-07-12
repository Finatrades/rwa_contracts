import { run } from "hardhat";
import chalk from "chalk";

async function main() {
  const PROXY_ADDRESS = "0xd8Fd81832daFd721ac5f1Ab21b8e78e1AaaaAE4c";
  const IMPLEMENTATION_ADDRESS = "0x3eAf6dC0C7D7C82C6f650b407F899E85Ea880487";

  console.log(chalk.blue("Verifying proxy relationship on BscScan..."));

  try {
    await run("verify:verify", {
      address: PROXY_ADDRESS,
      contract: "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol:ERC1967Proxy",
    });
    console.log(chalk.green("✓ Proxy verified!"));
  } catch (error: any) {
    if (error.message.includes("already verified")) {
      console.log(chalk.yellow("Proxy already verified"));
    } else {
      console.log(chalk.red("Proxy verification failed:"), error.message);
    }
  }

  console.log(chalk.yellow("\nNOTE: It may take a few minutes for BscScan to detect the proxy relationship."));
  console.log(chalk.cyan("Once detected, you'll see 'Read as Proxy' and 'Write as Proxy' tabs."));
  console.log(chalk.cyan(`\nProxy: https://testnet.bscscan.com/address/${PROXY_ADDRESS}#writeProxyContract`));
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });