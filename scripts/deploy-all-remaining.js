const { ethers, upgrades } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function deployWithRetry(deployFunc, retries = 3) {
    for (let i = 0; i < retries; i++) {
        try {
            return await deployFunc();
        } catch (error) {
            console.log(`Attempt ${i + 1} failed: ${error.message}`);
            if (i === retries - 1) throw error;
            console.log(`Retrying in 5 seconds...`);
            await new Promise(resolve => setTimeout(resolve, 5000));
        }
    }
}

async function main() {
    console.log("🚀 Deploying ALL remaining contracts to Polygon Mainnet...\n");
    
    const [deployer] = await ethers.getSigners();
    const network = await ethers.provider.getNetwork();
    
    console.log("📍 Network:", network.name);
    console.log("🔑 Deploying contracts with account:", deployer.address);
    console.log("💰 Account balance:", ethers.formatEther(await deployer.provider.getBalance(deployer.address)), "MATIC\n");
    
    // Start with existing deployments
    const deployment = {
        network: "polygon",
        chainId: network.chainId,
        deployer: deployer.address,
        timestamp: new Date().toISOString(),
        contracts: {
            ClaimTopicsRegistry: "0x6Ec58c34DF899Ff9d67FD088Cd339bB75508Dd79",
            IdentityRegistry: "0x25150414235289c688473340548698B5764651E3"
        },
        implementations: {
            ClaimTopicsRegistry: "0x2DEF12D0C8448DD8866AcFD839aDbFE07b5C7A15",
            IdentityRegistry: "0x0BD1A2EdF1FCd608fC0537f6268E2b9c565a58B8"
        }
    };
    
    console.log("✅ Using existing deployments:");
    console.log("   ClaimTopicsRegistry:", deployment.contracts.ClaimTopicsRegistry);
    console.log("   IdentityRegistry:", deployment.contracts.IdentityRegistry);
    
    try {
        // Force import existing contracts to avoid manifest issues
        try {
            await upgrades.forceImport(deployment.contracts.ClaimTopicsRegistry, await ethers.getContractFactory("ClaimTopicsRegistry"));
            await upgrades.forceImport(deployment.contracts.IdentityRegistry, await ethers.getContractFactory("IdentityRegistry"));
        } catch (e) {
            console.log("Force import skipped");
        }
        
        // 1. Deploy CountryRestrictModule
        console.log("\n1️⃣ Deploying CountryRestrictModule...");
        const CountryRestrictModule = await ethers.getContractFactory("CountryRestrictModule");
        const countryModule = await deployWithRetry(async () => {
            return await upgrades.deployProxy(CountryRestrictModule, [deployer.address], {
                initializer: 'initialize',
                kind: 'uups',
                timeout: 0
            });
        });
        await countryModule.waitForDeployment();
        deployment.contracts.CountryRestrictModule = await countryModule.getAddress();
        deployment.implementations.CountryRestrictModule = await upgrades.erc1967.getImplementationAddress(deployment.contracts.CountryRestrictModule);
        console.log("✅ CountryRestrictModule:", deployment.contracts.CountryRestrictModule);
        
        // 2. Deploy MaxBalanceModule
        console.log("\n2️⃣ Deploying MaxBalanceModule...");
        const MaxBalanceModule = await ethers.getContractFactory("MaxBalanceModule");
        const maxModule = await deployWithRetry(async () => {
            return await upgrades.deployProxy(MaxBalanceModule, [deployer.address], {
                initializer: 'initialize',
                kind: 'uups',
                timeout: 0
            });
        });
        await maxModule.waitForDeployment();
        deployment.contracts.MaxBalanceModule = await maxModule.getAddress();
        deployment.implementations.MaxBalanceModule = await upgrades.erc1967.getImplementationAddress(deployment.contracts.MaxBalanceModule);
        console.log("✅ MaxBalanceModule:", deployment.contracts.MaxBalanceModule);
        
        // 3. Deploy TransferLimitModule
        console.log("\n3️⃣ Deploying TransferLimitModule...");
        const TransferLimitModule = await ethers.getContractFactory("TransferLimitModule");
        const transferModule = await deployWithRetry(async () => {
            return await upgrades.deployProxy(TransferLimitModule, [deployer.address], {
                initializer: 'initialize',
                kind: 'uups',
                timeout: 0
            });
        });
        await transferModule.waitForDeployment();
        deployment.contracts.TransferLimitModule = await transferModule.getAddress();
        deployment.implementations.TransferLimitModule = await upgrades.erc1967.getImplementationAddress(deployment.contracts.TransferLimitModule);
        console.log("✅ TransferLimitModule:", deployment.contracts.TransferLimitModule);
        
        // 4. Deploy ModularCompliance
        console.log("\n4️⃣ Deploying ModularCompliance...");
        const ModularCompliance = await ethers.getContractFactory("ModularCompliance");
        const compliance = await deployWithRetry(async () => {
            return await upgrades.deployProxy(ModularCompliance, [], {
                initializer: 'initialize',
                kind: 'uups',
                timeout: 0
            });
        });
        await compliance.waitForDeployment();
        deployment.contracts.ModularCompliance = await compliance.getAddress();
        deployment.implementations.ModularCompliance = await upgrades.erc1967.getImplementationAddress(deployment.contracts.ModularCompliance);
        console.log("✅ ModularCompliance:", deployment.contracts.ModularCompliance);
        
        // 5. Deploy AssetRegistry
        console.log("\n5️⃣ Deploying AssetRegistry...");
        const AssetRegistry = await ethers.getContractFactory("AssetRegistry");
        const assetRegistry = await deployWithRetry(async () => {
            return await upgrades.deployProxy(AssetRegistry, [], {
                initializer: 'initialize',
                kind: 'uups',
                timeout: 0
            });
        });
        await assetRegistry.waitForDeployment();
        deployment.contracts.AssetRegistry = await assetRegistry.getAddress();
        deployment.implementations.AssetRegistry = await upgrades.erc1967.getImplementationAddress(deployment.contracts.AssetRegistry);
        console.log("✅ AssetRegistry:", deployment.contracts.AssetRegistry);
        
        // 6. Deploy Timelock (not upgradeable)
        console.log("\n6️⃣ Deploying FinatradesTimelock...");
        const FinatradesTimelock = await ethers.getContractFactory("FinatradesTimelock");
        const timelock = await deployWithRetry(async () => {
            const minDelay = 24 * 60 * 60; // 24 hours
            return await FinatradesTimelock.deploy(
                minDelay,
                [deployer.address],
                [deployer.address],
                deployer.address
            );
        });
        await timelock.waitForDeployment();
        deployment.contracts.FinatradesTimelock = await timelock.getAddress();
        console.log("✅ FinatradesTimelock:", deployment.contracts.FinatradesTimelock);
        
        // 7. Deploy Main Token
        console.log("\n7️⃣ Deploying FinatradesRWA_Enterprise...");
        const FinatradesRWA = await ethers.getContractFactory("FinatradesRWA_Enterprise");
        const token = await deployWithRetry(async () => {
            return await upgrades.deployProxy(FinatradesRWA, [
                deployer.address,
                "Finatrades RWA Token",
                "FRWA",
                18,
                deployment.contracts.IdentityRegistry,
                deployment.contracts.ModularCompliance,
                deployment.contracts.AssetRegistry
            ], {
                initializer: 'initialize',
                kind: 'uups',
                timeout: 0
            });
        });
        await token.waitForDeployment();
        deployment.contracts.FinatradesRWA_Enterprise = await token.getAddress();
        deployment.implementations.FinatradesRWA_Enterprise = await upgrades.erc1967.getImplementationAddress(deployment.contracts.FinatradesRWA_Enterprise);
        console.log("✅ FinatradesRWA_Enterprise:", deployment.contracts.FinatradesRWA_Enterprise);
        
        // 8. Deploy RegulatoryReporting
        console.log("\n8️⃣ Deploying RegulatoryReportingOptimized...");
        const RegulatoryReporting = await ethers.getContractFactory("RegulatoryReportingOptimized");
        const reporting = await deployWithRetry(async () => {
            return await upgrades.deployProxy(RegulatoryReporting, [
                deployment.contracts.FinatradesRWA_Enterprise,
                deployment.contracts.IdentityRegistry,
                deployment.contracts.AssetRegistry,
                deployment.contracts.ModularCompliance
            ], {
                initializer: 'initialize',
                kind: 'uups',
                timeout: 0
            });
        });
        await reporting.waitForDeployment();
        deployment.contracts.RegulatoryReportingOptimized = await reporting.getAddress();
        deployment.implementations.RegulatoryReportingOptimized = await upgrades.erc1967.getImplementationAddress(deployment.contracts.RegulatoryReportingOptimized);
        console.log("✅ RegulatoryReportingOptimized:", deployment.contracts.RegulatoryReportingOptimized);
        
        // Configure contracts
        console.log("\n⚙️ Configuring contracts...");
        
        // Set token in compliance
        console.log("   Setting token in ModularCompliance...");
        await (await compliance.setTokenBound(deployment.contracts.FinatradesRWA_Enterprise)).wait(2);
        console.log("   ✅ Token bound");
        
        // Add modules
        console.log("   Adding compliance modules...");
        await (await compliance.addModule(deployment.contracts.CountryRestrictModule)).wait(2);
        console.log("   ✅ CountryRestrictModule added");
        
        await (await compliance.addModule(deployment.contracts.MaxBalanceModule)).wait(2);
        console.log("   ✅ MaxBalanceModule added");
        
        await (await compliance.addModule(deployment.contracts.TransferLimitModule)).wait(2);
        console.log("   ✅ TransferLimitModule added");
        
        // Set regulatory reporting
        console.log("   Setting regulatory reporting...");
        await (await token.setRegulatoryReporting(deployment.contracts.RegulatoryReportingOptimized)).wait(2);
        console.log("   ✅ Regulatory reporting set");
        
        // Grant roles
        console.log("   Granting roles...");
        const AGENT_ROLE = await token.AGENT_ROLE();
        await (await token.grantRole(AGENT_ROLE, deployer.address)).wait(2);
        console.log("   ✅ AGENT_ROLE granted");
        
        const ASSET_MANAGER_ROLE = await token.ASSET_MANAGER_ROLE();
        await (await token.grantRole(ASSET_MANAGER_ROLE, deployer.address)).wait(2);
        console.log("   ✅ ASSET_MANAGER_ROLE granted");
        
        // Save deployment
        const deploymentPath = path.join(__dirname, '../deployments');
        const deploymentForSave = JSON.parse(JSON.stringify(deployment, (key, value) =>
            typeof value === 'bigint' ? value.toString() : value
        ));
        
        const filename = `polygon_mainnet_complete_${Date.now()}.json`;
        fs.writeFileSync(
            path.join(deploymentPath, filename),
            JSON.stringify(deploymentForSave, null, 2)
        );
        
        fs.writeFileSync(
            path.join(deploymentPath, 'polygon_mainnet_latest.json'),
            JSON.stringify(deploymentForSave, null, 2)
        );
        
        console.log("\n🎉 ALL CONTRACTS DEPLOYED SUCCESSFULLY!");
        console.log("📁 Deployment saved to:", filename);
        
        // Print final summary
        console.log("\n📋 COMPLETE DEPLOYMENT SUMMARY:");
        console.log("════════════════════════════════════════════════════════════════");
        console.log("CONTRACT NAME                           PROXY ADDRESS");
        console.log("════════════════════════════════════════════════════════════════");
        Object.entries(deployment.contracts).forEach(([name, address]) => {
            console.log(`${name.padEnd(38)} ${address}`);
        });
        console.log("════════════════════════════════════════════════════════════════");
        
        console.log("\n📦 IMPLEMENTATION ADDRESSES:");
        console.log("════════════════════════════════════════════════════════════════");
        Object.entries(deployment.implementations).forEach(([name, address]) => {
            console.log(`${name.padEnd(38)} ${address}`);
        });
        console.log("════════════════════════════════════════════════════════════════");
        
        // Verify all contracts
        console.log("\n🔍 Starting automatic verification on Polygonscan...");
        const { run } = require("hardhat");
        
        for (const [name, address] of Object.entries(deployment.implementations)) {
            console.log(`\nVerifying ${name} at ${address}...`);
            try {
                await run("verify:verify", {
                    address: address,
                    constructorArguments: [],
                });
                console.log(`✅ ${name} verified!`);
            } catch (error) {
                if (error.message.includes("Already Verified")) {
                    console.log(`✅ ${name} already verified`);
                } else {
                    console.log(`⚠️ ${name} verification failed:`, error.message);
                }
            }
        }
        
        // Verify timelock
        console.log(`\nVerifying FinatradesTimelock...`);
        try {
            await run("verify:verify", {
                address: deployment.contracts.FinatradesTimelock,
                constructorArguments: [24 * 60 * 60, [deployer.address], [deployer.address], deployer.address],
            });
            console.log(`✅ FinatradesTimelock verified!`);
        } catch (error) {
            if (error.message.includes("Already Verified")) {
                console.log(`✅ FinatradesTimelock already verified`);
            } else {
                console.log(`⚠️ FinatradesTimelock verification failed:`, error.message);
            }
        }
        
        console.log("\n✅ DEPLOYMENT AND VERIFICATION COMPLETE!");
        
        // Final balance check
        const finalBalance = await deployer.provider.getBalance(deployer.address);
        console.log("\n💰 Final balance:", ethers.formatEther(finalBalance), "MATIC");
        
    } catch (error) {
        console.error("\n❌ Deployment failed:", error.message);
        
        // Save partial deployment
        const deploymentPath = path.join(__dirname, '../deployments');
        const deploymentForSave = JSON.parse(JSON.stringify(deployment, (key, value) =>
            typeof value === 'bigint' ? value.toString() : value
        ));
        const filename = `polygon_mainnet_partial_${Date.now()}.json`;
        fs.writeFileSync(
            path.join(deploymentPath, filename),
            JSON.stringify(deploymentForSave, null, 2)
        );
        console.log("📁 Partial deployment saved to:", filename);
        
        process.exit(1);
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });