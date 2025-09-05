const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");
const chalk = require("chalk");

/**
 * Example: Deploy and manage a multi-ownership asset using ERC1155
 * Use case: Gold mining operation with fractional ownership
 */
async function main() {
    console.log(chalk.blue("========================================"));
    console.log(chalk.blue("Multi-Ownership Asset Deployment Example"));
    console.log(chalk.blue("Use Case: Gold Mining Batch"));
    console.log(chalk.blue("========================================\n"));

    const [deployer, investor1, investor2, investor3] = await ethers.getSigners();
    
    console.log(chalk.yellow("Deployer:"), deployer.address);
    console.log(chalk.yellow("Investor 1:"), investor1.address);
    console.log(chalk.yellow("Investor 2:"), investor2.address);
    console.log(chalk.yellow("Investor 3:"), investor3.address);
    
    // Load deployment data
    const deploymentFile = path.join(__dirname, "../../deployments", "polygon_deployment.json");
    const deploymentData = JSON.parse(fs.readFileSync(deploymentFile, "utf8"));
    
    // Get contract instances
    const factoryAddress = deploymentData.FinatradesTokenFactory.proxy;
    const assetRegistryAddress = deploymentData.AssetRegistry.proxy;
    const identityRegistryAddress = deploymentData.IdentityRegistry.proxy;
    
    const factory = await ethers.getContractAt("FinatradesTokenFactory", factoryAddress);
    const assetRegistry = await ethers.getContractAt("AssetRegistry", assetRegistryAddress);
    const identityRegistry = await ethers.getContractAt("IdentityRegistry", identityRegistryAddress);
    
    console.log(chalk.cyan("\n1. Registering Asset in AssetRegistry..."));
    
    // Create asset ID for gold batch
    const assetId = ethers.keccak256(ethers.toUtf8Bytes("GOLD-BATCH-Q1-2024"));
    
    // Register the gold mining batch as an asset
    const assetTx = await assetRegistry.registerAsset(
        assetId,
        "Gold Mining Batch Q1 2024",
        1, // COMMODITIES category
        ethers.parseEther("5000000"), // $5M total valuation
        "ipfs://QmGoldBatchMetadata",
        deployer.address // Custodian
    );
    await assetTx.wait();
    console.log(chalk.green("✓ Asset registered with ID:"), assetId);
    
    console.log(chalk.cyan("\n2. Registering Investors' Identities..."));
    
    // In production, this would involve proper KYC/AML verification
    // For this example, we'll simulate identity registration
    const identities = [investor1.address, investor2.address, investor3.address];
    
    for (let i = 0; i < identities.length; i++) {
        // Deploy a mock identity contract (simplified for example)
        const Identity = await ethers.getContractFactory("Identity");
        const identity = await Identity.deploy(identities[i], false);
        await identity.waitForDeployment();
        
        // Register in IdentityRegistry
        const regTx = await identityRegistry.registerIdentity(
            identities[i],
            await identity.getAddress(),
            840 // USA country code
        );
        await regTx.wait();
        console.log(chalk.green(`✓ Identity registered for Investor ${i + 1}`));
    }
    
    console.log(chalk.cyan("\n3. Deploying ERC1155 Token via Factory..."));
    
    // Deploy ERC1155 token for multiple ownership
    const deployTx = await factory.deployToken(
        2, // TokenType.ERC1155
        "Gold Mining Batch Q1 2024",
        "GOLD24Q1", // Symbol (not used by ERC1155 but required)
        assetId,
        deployer.address // Admin
    );
    
    const deployReceipt = await deployTx.wait();
    const tokenDeployedEvent = deployReceipt.logs.find(
        log => log.fragment && log.fragment.name === "TokenDeployed"
    );
    const tokenAddress = tokenDeployedEvent.args.tokenAddress;
    console.log(chalk.green("✓ ERC1155 Token deployed at:"), tokenAddress);
    
    // Get the deployed multi-token contract
    const multiToken = await ethers.getContractAt("FinatradesMultiToken", tokenAddress);
    
    console.log(chalk.cyan("\n4. Creating Gold Batch with Metadata..."));
    
    // Create the batch with detailed metadata
    const batchTx = await multiToken.createBatch(
        assetId,
        "Gold Batch Q1 2024 - Mine Location Alpha",
        "100 ounces of gold extracted from Mine Location Alpha in Q1 2024. Purity: 99.9%, Weight: 100 oz, Extraction Date: March 31, 2024",
        100000, // Total supply: 100,000 tokens (1 token = 0.001 ounce)
        ethers.parseEther("50"), // $50 per token (0.001 ounce)
        "ipfs://QmDetailedGoldBatchMetadata"
    );
    
    const batchReceipt = await batchTx.wait();
    const batchCreatedEvent = batchReceipt.logs.find(
        log => log.fragment && log.fragment.name === "BatchCreated"
    );
    const tokenId = batchCreatedEvent.args.tokenId;
    console.log(chalk.green("✓ Batch created with Token ID:"), tokenId.toString());
    
    console.log(chalk.cyan("\n5. Distributing Fractional Ownership..."));
    
    // Mint fractional shares to investors based on their investment
    const distributions = [
        { investor: investor1.address, tokens: 30000, ounces: 30 }, // 30% ownership (30 ounces)
        { investor: investor2.address, tokens: 45000, ounces: 45 }, // 45% ownership (45 ounces)
        { investor: investor3.address, tokens: 25000, ounces: 25 }, // 25% ownership (25 ounces)
    ];
    
    for (let i = 0; i < distributions.length; i++) {
        const mintTx = await multiToken.mintBatch(
            tokenId,
            distributions[i].investor,
            distributions[i].tokens
        );
        await mintTx.wait();
        console.log(chalk.green(`✓ Minted ${distributions[i].tokens} tokens (${distributions[i].ounces} oz) to Investor ${i + 1}`));
    }
    
    console.log(chalk.cyan("\n6. Verifying Ownership Distribution..."));
    
    // Check balances
    for (let i = 0; i < distributions.length; i++) {
        const balance = await multiToken.balanceOf(distributions[i].investor, tokenId);
        const percentage = (Number(balance) / 100000) * 100;
        console.log(chalk.white(`Investor ${i + 1}:`), 
            `${balance.toString()} tokens (${percentage}% ownership)`);
    }
    
    // Get batch metadata
    const batchMetadata = await multiToken.getBatchMetadata(tokenId);
    console.log(chalk.cyan("\n7. Batch Information:"));
    console.log(chalk.white("Name:"), batchMetadata.name);
    console.log(chalk.white("Total Supply:"), batchMetadata.totalSupply.toString());
    console.log(chalk.white("Minted Supply:"), batchMetadata.mintedSupply.toString());
    console.log(chalk.white("Unit Value:"), ethers.formatEther(batchMetadata.unitValue), "USD");
    console.log(chalk.white("Total Value:"), 
        ethers.formatEther(batchMetadata.unitValue * batchMetadata.totalSupply), "USD");
    
    // Calculate total portfolio value for each investor
    console.log(chalk.cyan("\n8. Investor Portfolio Values:"));
    for (let i = 0; i < distributions.length; i++) {
        const totalValue = await multiToken.getTotalValue(distributions[i].investor);
        console.log(chalk.white(`Investor ${i + 1} Total Value:`), 
            ethers.formatEther(totalValue), "USD");
    }
    
    console.log(chalk.cyan("\n9. Demonstrating Secondary Market Transfer..."));
    
    // Investor 1 sells 10% of their holdings to Investor 2
    const transferAmount = 10000; // 10,000 tokens (10 ounces)
    
    // First, Investor 1 needs to approve the transfer (if using safeTransferFrom)
    const multiTokenAsInvestor1 = multiToken.connect(investor1);
    const transferTx = await multiTokenAsInvestor1.safeTransferFrom(
        investor1.address,
        investor2.address,
        tokenId,
        transferAmount,
        "0x"
    );
    await transferTx.wait();
    console.log(chalk.green(`✓ Investor 1 transferred ${transferAmount} tokens to Investor 2`));
    
    // Verify new balances
    console.log(chalk.cyan("\n10. Updated Ownership Distribution:"));
    const newBalances = [
        await multiToken.balanceOf(investor1.address, tokenId),
        await multiToken.balanceOf(investor2.address, tokenId),
        await multiToken.balanceOf(investor3.address, tokenId)
    ];
    
    for (let i = 0; i < newBalances.length; i++) {
        const percentage = (Number(newBalances[i]) / 100000) * 100;
        console.log(chalk.white(`Investor ${i + 1}:`), 
            `${newBalances[i].toString()} tokens (${percentage}% ownership)`);
    }
    
    console.log(chalk.green("\n✅ Multi-ownership asset deployment completed successfully!"));
    
    // Display summary
    console.log(chalk.blue("\n========================================"));
    console.log(chalk.blue("Deployment Summary"));
    console.log(chalk.blue("========================================"));
    console.log(chalk.white("Asset Type:"), "Gold Mining Batch");
    console.log(chalk.white("Token Standard:"), "ERC1155");
    console.log(chalk.white("Token Address:"), tokenAddress);
    console.log(chalk.white("Batch Token ID:"), tokenId.toString());
    console.log(chalk.white("Total Supply:"), "100,000 tokens (100 ounces)");
    console.log(chalk.white("Unit Representation:"), "1 token = 0.001 ounce");
    console.log(chalk.white("Number of Owners:"), "3");
    
    console.log(chalk.blue("\nKey Benefits of ERC1155:"));
    console.log(chalk.gray("• Single contract for multiple asset batches"));
    console.log(chalk.gray("• Efficient gas costs for batch operations"));
    console.log(chalk.gray("• Flexible ownership models (fungible within batch)"));
    console.log(chalk.gray("• Built-in metadata support per batch"));
    console.log(chalk.gray("• Easy tracking of ownership distribution"));
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(chalk.red("\n❌ Deployment failed:"));
        console.error(error);
        process.exit(1);
    });