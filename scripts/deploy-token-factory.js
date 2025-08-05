const { ethers, upgrades, run } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
    console.log("\n=== TokenFactory Deployment Script ===");
    console.log("Network:", network.name);
    console.log("=====================================\n");

    const [deployer] = await ethers.getSigners();
    console.log("Deployer address:", deployer.address);
    
    const balance = await ethers.provider.getBalance(deployer.address);
    console.log("Deployer balance:", ethers.formatEther(balance), "MATIC\n");

    if (balance < ethers.parseEther("2")) {
        throw new Error("Insufficient balance. Need at least 2 MATIC for deployment");
    }

    // Load existing deployment to get registry addresses
    const deploymentFile = path.join(__dirname, "..", "deployments", "polygon_mainnet_final.json");
    let existingDeployment;
    
    try {
        existingDeployment = JSON.parse(fs.readFileSync(deploymentFile, 'utf8'));
        console.log("Loaded existing deployment data");
    } catch (error) {
        console.error("Could not load existing deployment. Please ensure main contracts are deployed first.");
        throw error;
    }

    const deployment = {
        network: network.name,
        deployer: deployer.address,
        timestamp: new Date().toISOString(),
        tokenFactory: {},
        existingContracts: existingDeployment.contracts
    };

    try {
        // Deploy TokenFactory
        console.log("\n[1/2] Deploying TokenFactory...");
        const TokenFactory = await ethers.getContractFactory("TokenFactory");
        
        const tokenFactory = await upgrades.deployProxy(TokenFactory, [
            deployer.address,
            existingDeployment.contracts.IdentityRegistry,
            existingDeployment.contracts.ModularCompliance,
            existingDeployment.contracts.AssetRegistry
        ]);
        
        await tokenFactory.waitForDeployment();
        
        deployment.tokenFactory.proxy = await tokenFactory.getAddress();
        deployment.tokenFactory.implementation = await upgrades.erc1967.getImplementationAddress(deployment.tokenFactory.proxy);
        
        console.log("✅ TokenFactory deployed at:", deployment.tokenFactory.proxy);
        console.log("   Implementation at:", deployment.tokenFactory.implementation);

        // Get implementation addresses from factory
        console.log("\n[2/2] Getting implementation addresses...");
        const erc20Impl = await tokenFactory.erc20Implementation();
        const erc721Impl = await tokenFactory.erc721Implementation();
        
        deployment.tokenFactory.erc20Implementation = erc20Impl;
        deployment.tokenFactory.erc721Implementation = erc721Impl;
        
        console.log("✅ ERC-20 Implementation:", erc20Impl);
        console.log("✅ ERC-721 Implementation:", erc721Impl);

        // Grant deployer role to backend wallet if provided
        if (process.env.BACKEND_WALLET_ADDRESS) {
            console.log("\nGranting TOKEN_DEPLOYER_ROLE to backend wallet...");
            const TOKEN_DEPLOYER_ROLE = await tokenFactory.TOKEN_DEPLOYER_ROLE();
            await tokenFactory.grantRole(TOKEN_DEPLOYER_ROLE, process.env.BACKEND_WALLET_ADDRESS);
            console.log("✅ Role granted to:", process.env.BACKEND_WALLET_ADDRESS);
        }

        // Save deployment data
        const factoryDeploymentPath = path.join(__dirname, "..", "deployments", `token-factory-${network.name}.json`);
        fs.writeFileSync(factoryDeploymentPath, JSON.stringify(deployment, null, 2));
        console.log("\n✅ Deployment data saved to:", factoryDeploymentPath);

        // Update main deployment file
        existingDeployment.contracts.TokenFactory = deployment.tokenFactory.proxy;
        existingDeployment.implementations.TokenFactory = deployment.tokenFactory.implementation;
        existingDeployment.tokenFactoryImplementations = {
            ERC20: deployment.tokenFactory.erc20Implementation,
            ERC721: deployment.tokenFactory.erc721Implementation
        };
        
        const updatedDeploymentPath = path.join(__dirname, "..", "deployments", `polygon_mainnet_with_factory.json`);
        fs.writeFileSync(updatedDeploymentPath, JSON.stringify(existingDeployment, null, 2));
        console.log("✅ Updated deployment saved to:", updatedDeploymentPath);

        // Verify contracts if on polygon
        if (network.name === "polygon") {
            console.log("\n=== Verifying Contracts ===");
            await verifyContracts(deployment);
        }

        console.log("\n=== Deployment Complete ===");
        console.log("\nTokenFactory deployed successfully!");
        console.log("\nNext steps:");
        console.log("1. Use TokenFactory to deploy ERC-20 or ERC-721 tokens for assets");
        console.log("2. Grant TOKEN_DEPLOYER_ROLE to authorized addresses");
        console.log("3. Update frontend to use TokenFactory for token deployment");

    } catch (error) {
        console.error("\n❌ Deployment failed:", error);
        throw error;
    }
}

async function verifyContracts(deployment) {
    // Wait for etherscan to index
    console.log("Waiting 30 seconds for Polygonscan to index contracts...");
    await new Promise(resolve => setTimeout(resolve, 30000));

    const verificationTasks = [
        {
            name: "TokenFactory Implementation",
            address: deployment.tokenFactory.implementation,
            args: [],
            contract: "contracts/factory/TokenFactory.sol:TokenFactory"
        },
        {
            name: "Token (ERC-20) Implementation",
            address: deployment.tokenFactory.erc20Implementation,
            args: [],
            contract: "contracts/token/Token.sol:Token"
        },
        {
            name: "TokenNFT (ERC-721) Implementation",
            address: deployment.tokenFactory.erc721Implementation,
            args: [],
            contract: "contracts/token/TokenNFT.sol:TokenNFT"
        }
    ];

    for (const task of verificationTasks) {
        try {
            console.log(`\nVerifying ${task.name}...`);
            await run("verify:verify", {
                address: task.address,
                constructorArguments: task.args,
                contract: task.contract
            });
            console.log(`✅ ${task.name} verified`);
        } catch (error) {
            if (error.message.includes("already verified")) {
                console.log(`✅ ${task.name} already verified`);
            } else {
                console.log(`❌ Failed to verify ${task.name}:`, error.message);
            }
        }
    }
}

// Example usage function to demonstrate token deployment
async function exampleTokenDeployment() {
    console.log("\n=== Example Token Deployment ===");
    console.log(`
// Deploy an ERC-20 token for fractional ownership
const assetId = ethers.id("PROPERTY-001");
const tx1 = await tokenFactory.deployToken(
    0, // TokenType.ERC20
    "Manhattan Office Building Token",
    "MOB",
    assetId,
    ownerAddress
);

// Deploy an ERC-721 token for unique assets
const assetId2 = ethers.id("ART-001");
const tx2 = await tokenFactory.deployToken(
    1, // TokenType.ERC721
    "Rare Art Collection",
    "RAC",
    assetId2,
    ownerAddress
);
`);
}

main()
    .then(() => {
        exampleTokenDeployment();
        process.exit(0);
    })
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });