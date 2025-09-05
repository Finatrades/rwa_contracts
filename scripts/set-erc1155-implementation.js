const { ethers } = require("hardhat");
const chalk = require("chalk");

async function main() {
    console.log(chalk.blue("========================================"));
    console.log(chalk.blue("Setting ERC1155 Implementation in Factory"));
    console.log(chalk.blue("========================================\n"));

    const [deployer] = await ethers.getSigners();
    console.log(chalk.yellow("Deployer address:"), deployer.address);
    
    const balance = await ethers.provider.getBalance(deployer.address);
    console.log(chalk.yellow("Deployer balance:"), ethers.formatEther(balance), "MATIC\n");

    // Factory and implementation addresses
    const FACTORY_ADDRESS = "0xb0d5D0a17F8f6B31ED2D4ae11BD487872653FB08";
    const ERC1155_IMPLEMENTATION = "0x04D8484191fe1a691d1e893C7ce37a98F1669f2E";

    console.log(chalk.cyan("Factory Address:"), FACTORY_ADDRESS);
    console.log(chalk.cyan("ERC1155 Implementation:"), ERC1155_IMPLEMENTATION);

    // Get factory contract
    const factory = await ethers.getContractAt("FinatradesTokenFactory", FACTORY_ADDRESS);
    
    // Check current ERC1155 implementation
    const currentImpl = await factory.erc1155Implementation();
    console.log(chalk.yellow("\nCurrent ERC1155 Implementation:"), currentImpl);
    
    if (currentImpl === ERC1155_IMPLEMENTATION) {
        console.log(chalk.green("✓ ERC1155 implementation already set correctly!"));
        return;
    }

    if (currentImpl !== ethers.ZeroAddress) {
        console.log(chalk.yellow("⚠ ERC1155 implementation already set to different address"));
        console.log(chalk.yellow("  Updating to new implementation..."));
    }

    // Set ERC1155 implementation
    console.log(chalk.cyan("\nSetting ERC1155 implementation..."));
    const tx = await factory.setERC1155Implementation(ERC1155_IMPLEMENTATION);
    console.log(chalk.yellow("Transaction hash:"), tx.hash);
    
    const receipt = await tx.wait();
    console.log(chalk.green("✓ Transaction confirmed in block:"), receipt.blockNumber);
    
    // Verify it was set correctly
    const newImpl = await factory.erc1155Implementation();
    console.log(chalk.green("\n✓ ERC1155 Implementation set to:"), newImpl);
    
    if (newImpl === ERC1155_IMPLEMENTATION) {
        console.log(chalk.green("\n✅ ERC1155 implementation successfully configured!"));
    } else {
        console.log(chalk.red("\n❌ Failed to set ERC1155 implementation"));
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(chalk.red("Error:"), error);
        process.exit(1);
    });