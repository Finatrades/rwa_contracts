const { ethers, upgrades } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
    console.log("🚀 Final Polygon Mainnet Deployment...\n");
    
    const [deployer] = await ethers.getSigners();
    const network = await ethers.provider.getNetwork();
    
    console.log("📍 Network:", network.name);
    console.log("🔑 Deploying contracts with account:", deployer.address);
    console.log("💰 Account balance:", ethers.formatEther(await deployer.provider.getBalance(deployer.address)), "MATIC\n");
    
    // Clear the upgrades manifest to start fresh
    try {
        await upgrades.forceImport("0x6Ec58c34DF899Ff9d67FD088Cd339bB75508Dd79", await ethers.getContractFactory("ClaimTopicsRegistry"));
        await upgrades.forceImport("0x25150414235289c688473340548698B5764651E3", await ethers.getContractFactory("IdentityRegistry"));
    } catch (e) {
        console.log("Skipping force import...");
    }
    
    const deployment = {
        network: "polygon",
        chainId: network.chainId,
        deployer: deployer.address,
        timestamp: new Date().toISOString(),
        contracts: {
            ClaimTopicsRegistry: "0x6Ec58c34DF899Ff9d67FD088Cd339bB75508Dd79",
            IdentityRegistry: "0x25150414235289c688473340548698B5764651E3"
        },
        gasUsed: {}
    };
    
    console.log("✅ Using existing contracts:");
    console.log("   ClaimTopicsRegistry:", deployment.contracts.ClaimTopicsRegistry);
    console.log("   IdentityRegistry:", deployment.contracts.IdentityRegistry);
    
    try {
        // Deploy with minimal options
        const deployOptions = { 
            initializer: 'initialize',
            kind: 'uups'
        };
        
        // 3. Deploy Compliance Modules one by one
        console.log("\n3️⃣ Deploying CountryRestrictModule...");
        const CountryRestrictModule = await ethers.getContractFactory("CountryRestrictModule");
        const countryRestrictModule = await upgrades.deployProxy(
            CountryRestrictModule, 
            [deployer.address],
            deployOptions
        );
        await countryRestrictModule.waitForDeployment();
        deployment.contracts.CountryRestrictModule = await countryRestrictModule.getAddress();
        console.log("✅ CountryRestrictModule deployed to:", deployment.contracts.CountryRestrictModule);
        
        console.log("\n   Deploying MaxBalanceModule...");
        const MaxBalanceModule = await ethers.getContractFactory("MaxBalanceModule");
        const maxBalanceModule = await upgrades.deployProxy(
            MaxBalanceModule, 
            [deployer.address],
            deployOptions
        );
        await maxBalanceModule.waitForDeployment();
        deployment.contracts.MaxBalanceModule = await maxBalanceModule.getAddress();
        console.log("✅ MaxBalanceModule deployed to:", deployment.contracts.MaxBalanceModule);
        
        console.log("\n   Deploying TransferLimitModule...");
        const TransferLimitModule = await ethers.getContractFactory("TransferLimitModule");
        const transferLimitModule = await upgrades.deployProxy(
            TransferLimitModule, 
            [deployer.address],
            deployOptions
        );
        await transferLimitModule.waitForDeployment();
        deployment.contracts.TransferLimitModule = await transferLimitModule.getAddress();
        console.log("✅ TransferLimitModule deployed to:", deployment.contracts.TransferLimitModule);
        
        // 4. Deploy ModularCompliance
        console.log("\n4️⃣ Deploying ModularCompliance...");
        const ModularCompliance = await ethers.getContractFactory("ModularCompliance");
        const modularCompliance = await upgrades.deployProxy(
            ModularCompliance, 
            [],
            deployOptions
        );
        await modularCompliance.waitForDeployment();
        deployment.contracts.ModularCompliance = await modularCompliance.getAddress();
        console.log("✅ ModularCompliance deployed to:", deployment.contracts.ModularCompliance);
        
        // 5. Deploy AssetRegistry
        console.log("\n5️⃣ Deploying AssetRegistry...");
        const AssetRegistry = await ethers.getContractFactory("AssetRegistry");
        const assetRegistry = await upgrades.deployProxy(
            AssetRegistry,
            [],
            deployOptions
        );
        await assetRegistry.waitForDeployment();
        deployment.contracts.AssetRegistry = await assetRegistry.getAddress();
        console.log("✅ AssetRegistry deployed to:", deployment.contracts.AssetRegistry);
        
        // 6. Deploy Timelock (not upgradeable)
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
        
        // Wait for confirmations
        await timelock.deploymentTransaction().wait(3);
        
        // 7. Deploy Main Token Contract
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
            deployOptions
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
            deployOptions
        );
        await regulatoryReporting.waitForDeployment();
        deployment.contracts.RegulatoryReportingOptimized = await regulatoryReporting.getAddress();
        console.log("✅ RegulatoryReportingOptimized deployed to:", deployment.contracts.RegulatoryReportingOptimized);
        
        // 9. Configure contracts
        console.log("\n9️⃣ Configuring contracts...");
        
        // Set token in compliance
        console.log("   Setting token in ModularCompliance...");
        const setTokenTx = await modularCompliance.setTokenBound(deployment.contracts.FinatradesRWA_Enterprise);
        await setTokenTx.wait(3);
        console.log("   ✅ Token bound");
        
        // Add compliance modules
        console.log("   Adding compliance modules...");
        await (await modularCompliance.addModule(deployment.contracts.CountryRestrictModule)).wait(3);
        console.log("   ✅ CountryRestrictModule added");
        
        await (await modularCompliance.addModule(deployment.contracts.MaxBalanceModule)).wait(3);
        console.log("   ✅ MaxBalanceModule added");
        
        await (await modularCompliance.addModule(deployment.contracts.TransferLimitModule)).wait(3);
        console.log("   ✅ TransferLimitModule added");
        
        // Set regulatory reporting
        console.log("   Setting regulatory reporting...");
        await (await token.setRegulatoryReporting(deployment.contracts.RegulatoryReportingOptimized)).wait(3);
        console.log("   ✅ Regulatory reporting set");
        
        // Grant roles
        console.log("   Granting roles...");
        const AGENT_ROLE = await token.AGENT_ROLE();
        await (await token.grantRole(AGENT_ROLE, deployer.address)).wait(3);
        console.log("   ✅ AGENT_ROLE granted");
        
        const ASSET_MANAGER_ROLE = await token.ASSET_MANAGER_ROLE();
        await (await token.grantRole(ASSET_MANAGER_ROLE, deployer.address)).wait(3);
        console.log("   ✅ ASSET_MANAGER_ROLE granted");
        
        // Save deployment
        const deploymentPath = path.join(__dirname, '../deployments');
        if (!fs.existsSync(deploymentPath)) {
            fs.mkdirSync(deploymentPath, { recursive: true });
        }
        
        const deploymentForSave = JSON.parse(JSON.stringify(deployment, (key, value) =>
            typeof value === 'bigint' ? value.toString() : value
        ));
        
        const filename = `polygon_mainnet_deployment_${Date.now()}.json`;
        fs.writeFileSync(
            path.join(deploymentPath, filename),
            JSON.stringify(deploymentForSave, null, 2)
        );
        
        fs.writeFileSync(
            path.join(deploymentPath, 'polygon_mainnet_latest.json'),
            JSON.stringify(deploymentForSave, null, 2)
        );
        
        console.log("\n✅ DEPLOYMENT COMPLETED SUCCESSFULLY!");
        console.log("📁 Deployment saved to:", filename);
        
        // Print summary
        console.log("\n📋 FINAL DEPLOYMENT SUMMARY:");
        console.log("════════════════════════════════════════════════════════");
        Object.entries(deployment.contracts).forEach(([name, address]) => {
            console.log(`${name.padEnd(35)} : ${address}`);
        });
        console.log("════════════════════════════════════════════════════════");
        
        // Get implementation addresses for proxies
        console.log("\n📦 PROXY IMPLEMENTATION ADDRESSES:");
        console.log("════════════════════════════════════════════════════════");
        const proxiedContracts = [
            'ClaimTopicsRegistry',
            'IdentityRegistry', 
            'CountryRestrictModule',
            'MaxBalanceModule',
            'TransferLimitModule',
            'ModularCompliance',
            'AssetRegistry',
            'FinatradesRWA_Enterprise',
            'RegulatoryReportingOptimized'
        ];
        
        for (const contractName of proxiedContracts) {
            try {
                const implAddr = await upgrades.erc1967.getImplementationAddress(deployment.contracts[contractName]);
                console.log(`${contractName.padEnd(35)} : ${implAddr}`);
            } catch (e) {
                console.log(`${contractName.padEnd(35)} : (unable to fetch)`);
            }
        }
        console.log("════════════════════════════════════════════════════════");
        
        return deployment;
        
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
        
        // Print what was deployed
        if (Object.keys(deployment.contracts).length > 2) {
            console.log("\n📋 Contracts deployed before failure:");
            Object.entries(deployment.contracts).forEach(([name, address]) => {
                console.log(`${name}: ${address}`);
            });
        }
        
        process.exit(1);
    }
}

// Run deployment
main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });