const { ethers, upgrades } = require("hardhat");
const fs = require("fs");
const path = require("path");
const chalk = require("chalk");

async function main() {
    console.log(chalk.blue("========================================"));
    console.log(chalk.blue("Deploying ERC1155 Multi-Token Implementation"));
    console.log(chalk.blue("========================================\n"));

    const [deployer] = await ethers.getSigners();
    console.log(chalk.yellow("Deployer address:"), deployer.address);
    
    const balance = await ethers.provider.getBalance(deployer.address);
    console.log(chalk.yellow("Deployer balance:"), ethers.formatEther(balance), "MATIC\n");

    // Load existing deployment data
    const deploymentFile = path.join(__dirname, "../deployments", "polygon_deployment.json");
    let deploymentData = {};
    
    if (fs.existsSync(deploymentFile)) {
        deploymentData = JSON.parse(fs.readFileSync(deploymentFile, "utf8"));
        console.log(chalk.green("✓ Loaded existing deployment data"));
    }

    // Deploy FinatradesMultiTokenOptimized implementation
    console.log(chalk.cyan("\n1. Deploying FinatradesMultiTokenOptimized Implementation..."));
    const FinatradesMultiTokenOptimized = await ethers.getContractFactory("FinatradesMultiTokenOptimized");
    const multiTokenImpl = await FinatradesMultiTokenOptimized.deploy();
    await multiTokenImpl.waitForDeployment();
    const multiTokenImplAddress = await multiTokenImpl.getAddress();
    console.log(chalk.green("✓ FinatradesMultiTokenOptimized Implementation deployed at:"), multiTokenImplAddress);

    // Update FinatradesTokenFactory with ERC1155 implementation
    if (deploymentData.FinatradesTokenFactory?.proxy) {
        console.log(chalk.cyan("\n2. Updating FinatradesTokenFactory with ERC1155 implementation..."));
        
        const factory = await ethers.getContractAt(
            "FinatradesTokenFactory",
            deploymentData.FinatradesTokenFactory.proxy
        );
        
        // Set ERC1155 implementation
        const tx = await factory.setERC1155Implementation(multiTokenImplAddress);
        await tx.wait();
        console.log(chalk.green("✓ ERC1155 implementation set in factory"));
        
        // Verify it was set correctly
        const erc1155Impl = await factory.erc1155Implementation();
        console.log(chalk.green("✓ Verified ERC1155 implementation:"), erc1155Impl);
    } else {
        console.log(chalk.yellow("⚠ FinatradesTokenFactory not found, skipping update"));
    }

    // Update deployment data
    deploymentData.FinatradesMultiToken = {
        implementation: multiTokenImplAddress,
        deployedAt: new Date().toISOString(),
        network: network.name,
        deployer: deployer.address
    };

    // Save deployment data
    fs.writeFileSync(deploymentFile, JSON.stringify(deploymentData, null, 2));
    console.log(chalk.green("\n✓ Deployment data saved to:"), deploymentFile);

    // Display summary
    console.log(chalk.blue("\n========================================"));
    console.log(chalk.blue("ERC1155 Deployment Summary"));
    console.log(chalk.blue("========================================"));
    console.log(chalk.white("FinatradesMultiToken Implementation:"), multiTokenImplAddress);
    
    if (deploymentData.FinatradesTokenFactory?.proxy) {
        console.log(chalk.white("Factory Updated:"), deploymentData.FinatradesTokenFactory.proxy);
    }

    console.log(chalk.green("\n✅ ERC1155 deployment completed successfully!"));
    
    // Provide example usage
    console.log(chalk.blue("\n========================================"));
    console.log(chalk.blue("Example Usage"));
    console.log(chalk.blue("========================================"));
    console.log(chalk.yellow("\nTo deploy an ERC1155 token via factory:"));
    console.log(chalk.gray(`
    const factory = await ethers.getContractAt("FinatradesTokenFactory", "${deploymentData.FinatradesTokenFactory?.proxy || "FACTORY_ADDRESS"}");
    
    // Deploy ERC1155 for multiple ownership assets (e.g., gold batch)
    const tx = await factory.deployToken(
        2, // TokenType.ERC1155
        "Gold Batch Q1 2024",
        "GOLD24Q1", // Symbol (not used by ERC1155 but required by factory)
        assetId, // bytes32 asset ID from AssetRegistry
        adminAddress
    );
    
    const receipt = await tx.wait();
    const tokenAddress = receipt.events.find(e => e.event === "TokenDeployed").args.tokenAddress;
    
    // Get the deployed multi-token contract
    const multiToken = await ethers.getContractAt("FinatradesMultiToken", tokenAddress);
    
    // Create a batch for the gold mining operation
    const batchTx = await multiToken.createBatch(
        assetId,
        "Gold Batch Q1 2024",
        "100 ounces of gold mined in Q1 2024, 99.9% purity",
        100000, // Total supply: 100,000 tokens (1 token = 0.001 ounce)
        ethers.parseEther("50"), // $50 per token
        "ipfs://QmBatchMetadata"
    );
    
    const batchReceipt = await batchTx.wait();
    const tokenId = batchReceipt.events.find(e => e.event === "BatchCreated").args.tokenId;
    
    // Mint fractional shares to multiple investors
    await multiToken.mintBatchMultiple(
        tokenId,
        [investor1, investor2, investor3],
        [10000, 25000, 15000] // Different amounts for each investor
    );
    `));
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(chalk.red("\n❌ Deployment failed:"));
        console.error(error);
        process.exit(1);
    });