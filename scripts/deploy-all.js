const { ethers, upgrades, run } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
    console.log("\n=== Finatrades RWA Deployment Script ===");
    console.log("Network:", network.name);
    console.log("=========================================\n");

    const [deployer] = await ethers.getSigners();
    console.log("Deployer address:", deployer.address);
    
    const balance = await ethers.provider.getBalance(deployer.address);
    console.log("Deployer balance:", ethers.formatEther(balance), "MATIC\n");

    if (balance < ethers.parseEther("5")) {
        throw new Error("Insufficient balance. Need at least 5 MATIC for deployment");
    }

    const deployment = {
        network: network.name,
        deployer: deployer.address,
        timestamp: new Date().toISOString(),
        contracts: {},
        implementations: {}
    };

    try {
        // 1. Deploy ClaimTopicsRegistry
        console.log("\n[1/10] Deploying ClaimTopicsRegistry...");
        const ClaimTopicsRegistry = await ethers.getContractFactory("ClaimTopicsRegistry");
        const claimTopicsRegistry = await upgrades.deployProxy(ClaimTopicsRegistry, [deployer.address]);
        await claimTopicsRegistry.waitForDeployment();
        deployment.contracts.ClaimTopicsRegistry = await claimTopicsRegistry.getAddress();
        deployment.implementations.ClaimTopicsRegistry = await upgrades.erc1967.getImplementationAddress(deployment.contracts.ClaimTopicsRegistry);
        console.log("✅ ClaimTopicsRegistry deployed at:", deployment.contracts.ClaimTopicsRegistry);

        // 2. Deploy IdentityRegistry
        console.log("\n[2/10] Deploying IdentityRegistry...");
        const IdentityRegistry = await ethers.getContractFactory("IdentityRegistry");
        const identityRegistry = await upgrades.deployProxy(IdentityRegistry, [deployer.address]);
        await identityRegistry.waitForDeployment();
        deployment.contracts.IdentityRegistry = await identityRegistry.getAddress();
        deployment.implementations.IdentityRegistry = await upgrades.erc1967.getImplementationAddress(deployment.contracts.IdentityRegistry);
        console.log("✅ IdentityRegistry deployed at:", deployment.contracts.IdentityRegistry);

        // 3. Deploy ModularCompliance
        console.log("\n[3/10] Deploying ModularCompliance...");
        const ModularCompliance = await ethers.getContractFactory("ModularCompliance");
        const modularCompliance = await upgrades.deployProxy(ModularCompliance, [deployer.address]);
        await modularCompliance.waitForDeployment();
        deployment.contracts.ModularCompliance = await modularCompliance.getAddress();
        deployment.implementations.ModularCompliance = await upgrades.erc1967.getImplementationAddress(deployment.contracts.ModularCompliance);
        console.log("✅ ModularCompliance deployed at:", deployment.contracts.ModularCompliance);

        // 4. Deploy AssetRegistry
        console.log("\n[4/10] Deploying AssetRegistry...");
        const AssetRegistry = await ethers.getContractFactory("AssetRegistry");
        const assetRegistry = await upgrades.deployProxy(AssetRegistry, [deployer.address]);
        await assetRegistry.waitForDeployment();
        deployment.contracts.AssetRegistry = await assetRegistry.getAddress();
        deployment.implementations.AssetRegistry = await upgrades.erc1967.getImplementationAddress(deployment.contracts.AssetRegistry);
        console.log("✅ AssetRegistry deployed at:", deployment.contracts.AssetRegistry);

        // 5. Deploy FinatradesRWA_Enterprise
        console.log("\n[5/10] Deploying FinatradesRWA_Enterprise...");
        const FinatradesRWAEnterprise = await ethers.getContractFactory("FinatradesRWA_Enterprise");
        const token = await upgrades.deployProxy(FinatradesRWAEnterprise, [
            deployer.address,
            "Finatrades RWA Token",
            "FRWA",
            18,
            deployment.contracts.IdentityRegistry,
            deployment.contracts.ModularCompliance,
            deployment.contracts.AssetRegistry
        ], { 
            unsafeAllow: ['missing-initializer'],
            initializer: 'initialize(address,string,string,uint8,address,address,address)'
        });
        await token.waitForDeployment();
        deployment.contracts.FinatradesRWA_Enterprise = await token.getAddress();
        deployment.implementations.FinatradesRWA_Enterprise = await upgrades.erc1967.getImplementationAddress(deployment.contracts.FinatradesRWA_Enterprise);
        console.log("✅ FinatradesRWA_Enterprise deployed at:", deployment.contracts.FinatradesRWA_Enterprise);

        // 6. Deploy RegulatoryReportingOptimized
        console.log("\n[6/10] Deploying RegulatoryReportingOptimized...");
        const RegulatoryReporting = await ethers.getContractFactory("RegulatoryReportingOptimized");
        const regulatoryReporting = await upgrades.deployProxy(RegulatoryReporting, [
            deployment.contracts.FinatradesRWA_Enterprise,
            deployment.contracts.IdentityRegistry,
            deployment.contracts.AssetRegistry,
            deployment.contracts.ModularCompliance
        ]);
        await regulatoryReporting.waitForDeployment();
        deployment.contracts.RegulatoryReportingOptimized = await regulatoryReporting.getAddress();
        deployment.implementations.RegulatoryReportingOptimized = await upgrades.erc1967.getImplementationAddress(deployment.contracts.RegulatoryReportingOptimized);
        console.log("✅ RegulatoryReportingOptimized deployed at:", deployment.contracts.RegulatoryReportingOptimized);

        // 7. Deploy Compliance Modules
        console.log("\n[7/10] Deploying CountryRestrictModule...");
        const CountryRestrictModule = await ethers.getContractFactory("CountryRestrictModule");
        const countryRestrictModule = await upgrades.deployProxy(CountryRestrictModule, [deployer.address]);
        await countryRestrictModule.waitForDeployment();
        deployment.contracts.CountryRestrictModule = await countryRestrictModule.getAddress();
        deployment.implementations.CountryRestrictModule = await upgrades.erc1967.getImplementationAddress(deployment.contracts.CountryRestrictModule);
        console.log("✅ CountryRestrictModule deployed at:", deployment.contracts.CountryRestrictModule);

        console.log("\n[8/10] Deploying MaxBalanceModule...");
        const MaxBalanceModule = await ethers.getContractFactory("MaxBalanceModule");
        const maxBalanceModule = await upgrades.deployProxy(MaxBalanceModule, 
            [deployer.address, ethers.parseEther("10000000")] // 10M token default max
        );
        await maxBalanceModule.waitForDeployment();
        deployment.contracts.MaxBalanceModule = await maxBalanceModule.getAddress();
        deployment.implementations.MaxBalanceModule = await upgrades.erc1967.getImplementationAddress(deployment.contracts.MaxBalanceModule);
        console.log("✅ MaxBalanceModule deployed at:", deployment.contracts.MaxBalanceModule);

        console.log("\n[9/10] Deploying TransferLimitModule...");
        const TransferLimitModule = await ethers.getContractFactory("TransferLimitModule");
        const transferLimitModule = await upgrades.deployProxy(TransferLimitModule, 
            [deployer.address, ethers.parseEther("1000000"), ethers.parseEther("10000000")] // 1M daily, 10M monthly
        );
        await transferLimitModule.waitForDeployment();
        deployment.contracts.TransferLimitModule = await transferLimitModule.getAddress();
        deployment.implementations.TransferLimitModule = await upgrades.erc1967.getImplementationAddress(deployment.contracts.TransferLimitModule);
        console.log("✅ TransferLimitModule deployed at:", deployment.contracts.TransferLimitModule);

        // 8. Deploy FinatradesTimelock
        console.log("\n[10/10] Deploying FinatradesTimelock...");
        const FinatradesTimelock = await ethers.getContractFactory("FinatradesTimelock");
        const timelock = await FinatradesTimelock.deploy(
            172800, // 48 hours delay
            [deployer.address], // proposers
            [deployer.address], // executors
            deployer.address // admin
        );
        await timelock.waitForDeployment();
        deployment.contracts.FinatradesTimelock = await timelock.getAddress();
        console.log("✅ FinatradesTimelock deployed at:", deployment.contracts.FinatradesTimelock);

        // Configuration
        console.log("\n=== Configuring Contracts ===");
        
        // Bind token to compliance
        console.log("Binding token to compliance...");
        await modularCompliance.bindToken(deployment.contracts.FinatradesRWA_Enterprise);
        console.log("✅ Token bound to compliance");

        // Set regulatory reporting on token
        console.log("Setting regulatory reporting...");
        await token.setRegulatoryReporting(deployment.contracts.RegulatoryReportingOptimized);
        console.log("✅ Regulatory reporting set");

        // Add compliance modules
        console.log("Adding compliance modules...");
        await modularCompliance.addModule(deployment.contracts.CountryRestrictModule);
        await modularCompliance.addModule(deployment.contracts.MaxBalanceModule);
        await modularCompliance.addModule(deployment.contracts.TransferLimitModule);
        console.log("✅ Compliance modules added");

        // Save deployment data
        const deploymentPath = path.join(__dirname, "..", "deployments", `${network.name}_deployment.json`);
        fs.writeFileSync(deploymentPath, JSON.stringify(deployment, null, 2));
        console.log("\n✅ Deployment data saved to:", deploymentPath);

        // Verify contracts if on polygon
        if (network.name === "polygon") {
            console.log("\n=== Verifying Contracts ===");
            await verifyContracts(deployment);
        }

        console.log("\n=== Deployment Complete ===");
        console.log("All contracts deployed successfully!");

    } catch (error) {
        console.error("\n❌ Deployment failed:", error);
        throw error;
    }
}

async function verifyContracts(deployment) {
    // Wait a bit for etherscan to index
    console.log("Waiting 30 seconds for Polygonscan to index contracts...");
    await new Promise(resolve => setTimeout(resolve, 30000));

    const verificationTasks = [
        // Verify implementations
        { name: "ClaimTopicsRegistry Implementation", address: deployment.implementations.ClaimTopicsRegistry, args: [] },
        { name: "IdentityRegistry Implementation", address: deployment.implementations.IdentityRegistry, args: [] },
        { name: "ModularCompliance Implementation", address: deployment.implementations.ModularCompliance, args: [] },
        { name: "AssetRegistry Implementation", address: deployment.implementations.AssetRegistry, args: [] },
        { name: "FinatradesRWA_Enterprise Implementation", address: deployment.implementations.FinatradesRWA_Enterprise, args: [] },
        { name: "RegulatoryReportingOptimized Implementation", address: deployment.implementations.RegulatoryReportingOptimized, args: [] },
        { name: "CountryRestrictModule Implementation", address: deployment.implementations.CountryRestrictModule, args: [] },
        { name: "MaxBalanceModule Implementation", address: deployment.implementations.MaxBalanceModule, args: [] },
        { name: "TransferLimitModule Implementation", address: deployment.implementations.TransferLimitModule, args: [] },
        
        // Verify timelock (non-proxy)
        {
            name: "FinatradesTimelock",
            address: deployment.contracts.FinatradesTimelock,
            args: [172800, [deployment.deployer], [deployment.deployer], deployment.deployer],
            contract: "contracts/governance/FinatradesTimelock.sol:FinatradesTimelock"
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