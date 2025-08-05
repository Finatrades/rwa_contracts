const { ethers, upgrades, run } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
    console.log("\n=== Finatrades Token Factory Deployment Script ===");
    console.log("Network:", network.name);
    console.log("=================================================\n");

    const [deployer] = await ethers.getSigners();
    console.log("Deployer address:", deployer.address);
    
    const balance = await ethers.provider.getBalance(deployer.address);
    console.log("Deployer balance:", ethers.formatEther(balance), "MATIC\n");

    if (balance < ethers.parseEther("3")) {
        throw new Error("Insufficient balance. Need at least 3 MATIC for deployment");
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
        implementations: {},
        tokenFactory: {},
        existingContracts: existingDeployment.contracts
    };

    try {
        // Step 1: Deploy Token (ERC-20) Implementation - Using existing Token contract
        console.log("\n[1/3] Deploying Finatrades Token (ERC-20) Implementation...");
        const Token = await ethers.getContractFactory("Token");
        const tokenImpl = await Token.deploy();
        await tokenImpl.waitForDeployment();
        deployment.implementations.FinatradesToken = await tokenImpl.getAddress();
        console.log("✅ Finatrades Token Implementation deployed at:", deployment.implementations.FinatradesToken);

        // Step 2: Deploy FinatradesNFT (ERC-721) Implementation
        console.log("\n[2/3] Deploying FinatradesNFT (ERC-721) Implementation...");
        const FinatradesNFT = await ethers.getContractFactory("FinatradesNFT");
        const nftImpl = await FinatradesNFT.deploy();
        await nftImpl.waitForDeployment();
        deployment.implementations.FinatradesNFT = await nftImpl.getAddress();
        console.log("✅ FinatradesNFT Implementation deployed at:", deployment.implementations.FinatradesNFT);

        // Step 3: Deploy FinatradesTokenFactory
        console.log("\n[3/3] Deploying FinatradesTokenFactory...");
        const FinatradesTokenFactory = await ethers.getContractFactory("FinatradesTokenFactory");
        
        const tokenFactory = await upgrades.deployProxy(FinatradesTokenFactory, [
            deployer.address,
            existingDeployment.contracts.IdentityRegistry,
            existingDeployment.contracts.ModularCompliance,
            existingDeployment.contracts.AssetRegistry,
            deployment.implementations.FinatradesToken,
            deployment.implementations.FinatradesNFT
        ]);
        
        await tokenFactory.waitForDeployment();
        
        deployment.tokenFactory.proxy = await tokenFactory.getAddress();
        deployment.tokenFactory.implementation = await upgrades.erc1967.getImplementationAddress(deployment.tokenFactory.proxy);
        
        console.log("✅ FinatradesTokenFactory deployed at:", deployment.tokenFactory.proxy);
        console.log("   Implementation at:", deployment.tokenFactory.implementation);

        // Grant deployer role to backend wallet if provided
        if (process.env.BACKEND_WALLET_ADDRESS) {
            console.log("\nGranting TOKEN_DEPLOYER_ROLE to backend wallet...");
            const TOKEN_DEPLOYER_ROLE = await tokenFactory.TOKEN_DEPLOYER_ROLE();
            await tokenFactory.grantRole(TOKEN_DEPLOYER_ROLE, process.env.BACKEND_WALLET_ADDRESS);
            console.log("✅ Role granted to:", process.env.BACKEND_WALLET_ADDRESS);
        }

        // Save deployment data
        const factoryDeploymentPath = path.join(__dirname, "..", "deployments", `finatrades-factory-${network.name}.json`);
        fs.writeFileSync(factoryDeploymentPath, JSON.stringify(deployment, null, 2));
        console.log("\n✅ Deployment data saved to:", factoryDeploymentPath);

        // Update main deployment file
        existingDeployment.contracts.FinatradesTokenFactory = deployment.tokenFactory.proxy;
        existingDeployment.implementations.FinatradesTokenFactory = deployment.tokenFactory.implementation;
        existingDeployment.tokenImplementations = {
            FinatradesToken: deployment.implementations.FinatradesToken,
            FinatradesNFT: deployment.implementations.FinatradesNFT
        };
        
        const updatedDeploymentPath = path.join(__dirname, "..", "deployments", `${network.name}_with_finatrades_factory.json`);
        fs.writeFileSync(updatedDeploymentPath, JSON.stringify(existingDeployment, null, 2));
        console.log("✅ Updated deployment saved to:", updatedDeploymentPath);

        // Verify contracts if on polygon
        if (network.name === "polygon" || network.name === "polygonMumbai") {
            console.log("\n=== Verifying Contracts ===");
            await verifyContracts(deployment);
        }

        console.log("\n=== Deployment Complete ===");
        console.log("\nFinatrades Token Factory deployed successfully!");
        console.log("\nDeployment Summary:");
        console.log("- FinatradesTokenFactory:", deployment.tokenFactory.proxy);
        console.log("- Finatrades Token (ERC-20) Implementation:", deployment.implementations.FinatradesToken);
        console.log("- FinatradesNFT (ERC-721) Implementation:", deployment.implementations.FinatradesNFT);
        console.log("\nAll contracts now have the Finatrades branding!");

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
            name: "Finatrades Token (ERC-20) Implementation",
            address: deployment.implementations.FinatradesToken,
            args: [],
            contract: "contracts/token/Token.sol:Token"
        },
        {
            name: "FinatradesNFT (ERC-721) Implementation",
            address: deployment.implementations.FinatradesNFT,
            args: [],
            contract: "contracts/token/FinatradesNFT.sol:FinatradesNFT"
        },
        {
            name: "FinatradesTokenFactory Implementation",
            address: deployment.tokenFactory.implementation,
            args: [],
            contract: "contracts/factory/FinatradesTokenFactory.sol:FinatradesTokenFactory"
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

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });