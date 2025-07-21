const { ethers, upgrades } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
    console.log("🚀 Starting Local Deployment...\n");
    
    const [deployer] = await ethers.getSigners();
    const network = await ethers.provider.getNetwork();
    
    console.log("📍 Network:", network.name || "localhost");
    console.log("🔑 Deploying contracts with account:", deployer.address);
    console.log("💰 Account balance:", ethers.formatEther(await deployer.provider.getBalance(deployer.address)), "ETH\n");
    
    const deployment = {
        network: "localhost",
        chainId: network.chainId,
        deployer: deployer.address,
        timestamp: new Date().toISOString(),
        contracts: {}
    };
    
    try {
        // 1. Deploy ClaimTopicsRegistry
        console.log("1️⃣ Deploying ClaimTopicsRegistry...");
        const ClaimTopicsRegistry = await ethers.getContractFactory("ClaimTopicsRegistry");
        const claimTopicsRegistry = await upgrades.deployProxy(
            ClaimTopicsRegistry,
            [],
            { initializer: 'init' }
        );
        await claimTopicsRegistry.waitForDeployment();
        deployment.contracts.ClaimTopicsRegistry = await claimTopicsRegistry.getAddress();
        console.log("✅ ClaimTopicsRegistry deployed to:", deployment.contracts.ClaimTopicsRegistry);
        
        // 2. Deploy IdentityRegistry
        console.log("\n2️⃣ Deploying IdentityRegistry...");
        const IdentityRegistry = await ethers.getContractFactory("IdentityRegistry");
        const identityRegistry = await upgrades.deployProxy(
            IdentityRegistry,
            [],
            { initializer: 'init' }
        );
        await identityRegistry.waitForDeployment();
        deployment.contracts.IdentityRegistry = await identityRegistry.getAddress();
        console.log("✅ IdentityRegistry deployed to:", deployment.contracts.IdentityRegistry);
        
        // Set ClaimTopicsRegistry in IdentityRegistry
        console.log("   Setting ClaimTopicsRegistry...");
        await identityRegistry.setClaimTopicsRegistry(deployment.contracts.ClaimTopicsRegistry);
        
        // 3. Deploy Compliance Modules
        console.log("\n3️⃣ Deploying Compliance Modules...");
        
        // CountryRestrictModule
        const CountryRestrictModule = await ethers.getContractFactory("CountryRestrictModule");
        const countryRestrictModule = await upgrades.deployProxy(CountryRestrictModule);
        await countryRestrictModule.waitForDeployment();
        deployment.contracts.CountryRestrictModule = await countryRestrictModule.getAddress();
        console.log("✅ CountryRestrictModule deployed to:", deployment.contracts.CountryRestrictModule);
        
        // MaxBalanceModule
        const MaxBalanceModule = await ethers.getContractFactory("MaxBalanceModule");
        const maxBalanceModule = await upgrades.deployProxy(MaxBalanceModule);
        await maxBalanceModule.waitForDeployment();
        deployment.contracts.MaxBalanceModule = await maxBalanceModule.getAddress();
        console.log("✅ MaxBalanceModule deployed to:", deployment.contracts.MaxBalanceModule);
        
        // TransferLimitModule
        const TransferLimitModule = await ethers.getContractFactory("TransferLimitModule");
        const transferLimitModule = await upgrades.deployProxy(TransferLimitModule);
        await transferLimitModule.waitForDeployment();
        deployment.contracts.TransferLimitModule = await transferLimitModule.getAddress();
        console.log("✅ TransferLimitModule deployed to:", deployment.contracts.TransferLimitModule);
        
        // 4. Deploy ModularCompliance
        console.log("\n4️⃣ Deploying ModularCompliance...");
        const ModularCompliance = await ethers.getContractFactory("ModularCompliance");
        const modularCompliance = await upgrades.deployProxy(ModularCompliance);
        await modularCompliance.waitForDeployment();
        deployment.contracts.ModularCompliance = await modularCompliance.getAddress();
        console.log("✅ ModularCompliance deployed to:", deployment.contracts.ModularCompliance);
        
        // 5. Deploy AssetRegistry
        console.log("\n5️⃣ Deploying AssetRegistry...");
        const AssetRegistry = await ethers.getContractFactory("AssetRegistry");
        const assetRegistry = await upgrades.deployProxy(
            AssetRegistry,
            [],
            { initializer: 'initialize' }
        );
        await assetRegistry.waitForDeployment();
        deployment.contracts.AssetRegistry = await assetRegistry.getAddress();
        console.log("✅ AssetRegistry deployed to:", deployment.contracts.AssetRegistry);
        
        // 6. Deploy Timelock
        console.log("\n6️⃣ Deploying FinatradesTimelock...");
        const minDelay = 24 * 60 * 60; // 24 hours
        const proposers = [deployer.address];
        const executors = [deployer.address];
        
        const FinatradesTimelock = await ethers.getContractFactory("FinatradesTimelock");
        const timelock = await FinatradesTimelock.deploy(
            minDelay,
            proposers,
            executors,
            deployer.address
        );
        await timelock.waitForDeployment();
        deployment.contracts.FinatradesTimelock = await timelock.getAddress();
        console.log("✅ FinatradesTimelock deployed to:", deployment.contracts.FinatradesTimelock);
        
        // 7. Deploy Main Token Contract (Enterprise version)
        console.log("\n7️⃣ Deploying FinatradesRWA_Enterprise...");
        const FinatradesRWA = await ethers.getContractFactory("FinatradesRWA_Enterprise");
        const token = await upgrades.deployProxy(
            FinatradesRWA,
            [
                deployer.address,
                "Finatrades RWA Token",
                "FRWA",
                18,
                deployment.contracts.IdentityRegistry,
                deployment.contracts.ModularCompliance,
                deployment.contracts.AssetRegistry
            ],
            { initializer: 'initialize' }
        );
        await token.waitForDeployment();
        deployment.contracts.FinatradesRWA_Enterprise = await token.getAddress();
        console.log("✅ FinatradesRWA_Enterprise deployed to:", deployment.contracts.FinatradesRWA_Enterprise);
        
        // 8. Deploy RegulatoryReporting
        console.log("\n8️⃣ Deploying RegulatoryReportingOptimized...");
        const RegulatoryReporting = await ethers.getContractFactory("RegulatoryReportingOptimized");
        const regulatoryReporting = await upgrades.deployProxy(
            RegulatoryReporting,
            [
                deployment.contracts.FinatradesRWA_Enterprise,
                deployment.contracts.IdentityRegistry,
                deployment.contracts.AssetRegistry,
                deployment.contracts.ModularCompliance
            ],
            { initializer: 'initialize' }
        );
        await regulatoryReporting.waitForDeployment();
        deployment.contracts.RegulatoryReportingOptimized = await regulatoryReporting.getAddress();
        console.log("✅ RegulatoryReportingOptimized deployed to:", deployment.contracts.RegulatoryReportingOptimized);
        
        // 9. Configure contracts
        console.log("\n9️⃣ Configuring contracts...");
        
        // Set token in compliance
        console.log("   Setting token in ModularCompliance...");
        await modularCompliance.setTokenBound(deployment.contracts.FinatradesRWA_Enterprise);
        
        // Add compliance modules
        console.log("   Adding compliance modules...");
        await modularCompliance.addModule(deployment.contracts.CountryRestrictModule);
        await modularCompliance.addModule(deployment.contracts.MaxBalanceModule);
        await modularCompliance.addModule(deployment.contracts.TransferLimitModule);
        
        // Set regulatory reporting in token
        console.log("   Setting regulatory reporting in token...");
        await token.setRegulatoryReporting(deployment.contracts.RegulatoryReportingOptimized);
        
        // Grant roles
        console.log("   Granting roles...");
        const AGENT_ROLE = await token.AGENT_ROLE();
        const ASSET_MANAGER_ROLE = await token.ASSET_MANAGER_ROLE();
        await token.grantRole(AGENT_ROLE, deployer.address);
        await token.grantRole(ASSET_MANAGER_ROLE, deployer.address);
        
        // Save deployment info
        const deploymentPath = path.join(__dirname, '../deployments');
        if (!fs.existsSync(deploymentPath)) {
            fs.mkdirSync(deploymentPath, { recursive: true });
        }
        
        const filename = `localhost_deployment_${Date.now()}.json`;
        fs.writeFileSync(
            path.join(deploymentPath, filename),
            JSON.stringify(deployment, null, 2)
        );
        
        console.log("\n✅ Deployment completed successfully!");
        console.log("📁 Deployment info saved to:", filename);
        
        // Print summary
        console.log("\n📋 Deployment Summary:");
        console.log("═══════════════════════════════════════");
        Object.entries(deployment.contracts).forEach(([name, address]) => {
            console.log(`${name}: ${address}`);
        });
        
        // Export ABIs
        console.log("\n📄 Exporting ABIs...");
        const abiPath = path.join(__dirname, '../abis');
        if (!fs.existsSync(abiPath)) {
            fs.mkdirSync(abiPath, { recursive: true });
        }
        
        // Export each contract's ABI
        const contracts = [
            'ClaimTopicsRegistry',
            'IdentityRegistry',
            'CountryRestrictModule',
            'MaxBalanceModule',
            'TransferLimitModule',
            'ModularCompliance',
            'AssetRegistry',
            'FinatradesTimelock',
            'FinatradesRWA_Enterprise',
            'RegulatoryReportingOptimized'
        ];
        
        for (const contractName of contracts) {
            const artifact = await ethers.getContractFactory(contractName);
            const abi = artifact.interface.format(true);
            fs.writeFileSync(
                path.join(abiPath, `${contractName}.json`),
                JSON.stringify(abi, null, 2)
            );
        }
        
        console.log("✅ ABIs exported to ./abis/");
        
        return deployment;
        
    } catch (error) {
        console.error("\n❌ Deployment failed:", error);
        process.exit(1);
    }
}

// Deployment with error handling
main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });