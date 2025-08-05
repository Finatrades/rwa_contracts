const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
    console.log("\n=== Token Deployment via Factory Example ===");
    
    const [deployer] = await ethers.getSigners();
    console.log("Deployer:", deployer.address);

    // Load deployment data
    const deploymentFile = path.join(__dirname, "..", "..", "deployments", "polygon_mainnet_with_factory.json");
    const deployment = JSON.parse(fs.readFileSync(deploymentFile, 'utf8'));

    // Get contract instances
    const tokenFactory = await ethers.getContractAt("TokenFactory", deployment.contracts.TokenFactory);
    const assetRegistry = await ethers.getContractAt("AssetRegistry", deployment.contracts.AssetRegistry);

    console.log("\n=== Example 1: Deploy ERC-20 Token for Real Estate ===");
    
    // First, register an asset
    const realEstateAssetId = ethers.id("RE-MANHATTAN-001");
    
    console.log("1. Registering real estate asset...");
    await assetRegistry.registerAsset(
        realEstateAssetId,
        "Manhattan Commercial Building",
        0, // AssetCategory.REAL_ESTATE
        ethers.parseEther("10000000"), // $10M valuation
        "ipfs://QmRealEstateMetadata",
        deployer.address // custodian
    );
    console.log("✅ Asset registered with ID:", realEstateAssetId);

    // Deploy ERC-20 token for fractional ownership
    console.log("\n2. Deploying ERC-20 token for fractional ownership...");
    const tx1 = await tokenFactory.deployToken(
        0, // TokenType.ERC20
        "Manhattan Office Building Token",
        "MOB",
        realEstateAssetId,
        deployer.address
    );
    
    const receipt1 = await tx1.wait();
    const tokenDeployedEvent1 = receipt1.events.find(e => e.event === "TokenDeployed");
    const erc20TokenAddress = tokenDeployedEvent1.args.tokenAddress;
    
    console.log("✅ ERC-20 Token deployed at:", erc20TokenAddress);

    // Get token instance and mint some tokens
    const erc20Token = await ethers.getContractAt("Token", erc20TokenAddress);
    
    console.log("\n3. Minting tokens to investors...");
    // Note: Investors must be KYC verified first
    const mintAmount = ethers.parseEther("1000000"); // 1M tokens
    // await erc20Token.mint(investorAddress, mintAmount);
    console.log("   (Would mint tokens to verified investors)");

    console.log("\n=== Example 2: Deploy ERC-721 Token for Art ===");
    
    // Register an art asset
    const artAssetId = ethers.id("ART-PICASSO-001");
    
    console.log("1. Registering art asset...");
    await assetRegistry.registerAsset(
        artAssetId,
        "Picasso Original - Blue Period",
        2, // AssetCategory.ART_COLLECTIBLES
        ethers.parseEther("50000000"), // $50M valuation
        "ipfs://QmArtMetadata",
        deployer.address
    );
    console.log("✅ Asset registered with ID:", artAssetId);

    // Deploy ERC-721 token for unique asset
    console.log("\n2. Deploying ERC-721 token for unique artwork...");
    const tx2 = await tokenFactory.deployToken(
        1, // TokenType.ERC721
        "Picasso Blue Period Collection",
        "PBC",
        artAssetId,
        deployer.address
    );
    
    const receipt2 = await tx2.wait();
    const tokenDeployedEvent2 = receipt2.events.find(e => e.event === "TokenDeployed");
    const erc721TokenAddress = tokenDeployedEvent2.args.tokenAddress;
    
    console.log("✅ ERC-721 Token deployed at:", erc721TokenAddress);

    // Get NFT token instance
    const nftToken = await ethers.getContractAt("TokenNFT", erc721TokenAddress);
    
    console.log("\n3. Minting NFT...");
    // await nftToken.mint(
    //     collectorAddress,
    //     ethers.parseEther("50000000"), // $50M value
    //     artAssetId,
    //     "ipfs://QmNFTMetadata"
    // );
    console.log("   (Would mint NFT to verified collector)");

    console.log("\n=== Example 3: Query Deployed Tokens ===");
    
    // Get token info
    const tokenInfo1 = await tokenFactory.getTokenInfo(erc20TokenAddress);
    console.log("\nERC-20 Token Info:");
    console.log("- Name:", tokenInfo1.name);
    console.log("- Symbol:", tokenInfo1.symbol);
    console.log("- Type:", tokenInfo1.tokenType === 0 ? "ERC-20" : "ERC-721");
    console.log("- Asset ID:", tokenInfo1.assetId);

    const tokenInfo2 = await tokenFactory.getTokenInfo(erc721TokenAddress);
    console.log("\nERC-721 Token Info:");
    console.log("- Name:", tokenInfo2.name);
    console.log("- Symbol:", tokenInfo2.symbol);
    console.log("- Type:", tokenInfo2.tokenType === 0 ? "ERC-20" : "ERC-721");
    console.log("- Asset ID:", tokenInfo2.assetId);

    // Get all tokens by deployer
    const deployerTokens = await tokenFactory.getTokensByDeployer(deployer.address);
    console.log("\nTokens deployed by", deployer.address);
    console.log("Total:", deployerTokens.length);

    console.log("\n=== Deployment Summary ===");
    console.log("TokenFactory:", deployment.contracts.TokenFactory);
    console.log("ERC-20 Example:", erc20TokenAddress);
    console.log("ERC-721 Example:", erc721TokenAddress);

    // Save example deployment
    const exampleDeployment = {
        timestamp: new Date().toISOString(),
        examples: {
            erc20: {
                address: erc20TokenAddress,
                assetId: realEstateAssetId,
                name: "Manhattan Office Building Token",
                symbol: "MOB"
            },
            erc721: {
                address: erc721TokenAddress,
                assetId: artAssetId,
                name: "Picasso Blue Period Collection",
                symbol: "PBC"
            }
        }
    };

    const examplePath = path.join(__dirname, "..", "..", "deployments", "token-factory-examples.json");
    fs.writeFileSync(examplePath, JSON.stringify(exampleDeployment, null, 2));
    console.log("\n✅ Example deployment saved to:", examplePath);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });