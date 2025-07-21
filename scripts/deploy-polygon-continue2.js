const { ethers, upgrades } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
    console.log("🚀 Continuing Polygon Mainnet Deployment (Part 2)...\n");
    
    const [deployer] = await ethers.getSigners();
    const network = await ethers.provider.getNetwork();
    
    console.log("📍 Network:", network.name);
    console.log("🔑 Deploying contracts with account:", deployer.address);
    console.log("💰 Account balance:", ethers.formatEther(await deployer.provider.getBalance(deployer.address)), "MATIC\n");
    
    // Resume from existing deployment
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
    
    console.log("✅ ClaimTopicsRegistry already deployed at:", deployment.contracts.ClaimTopicsRegistry);
    console.log("✅ IdentityRegistry already deployed at:", deployment.contracts.IdentityRegistry);
    
    try {
        const deployOptions = { 
            initializer: 'initialize',
            kind: 'uups',
            unsafeAllow: ['constructor', 'state-variable-immutable', 'state-variable-assignment', 'delegatecall'],
            timeout: 0
        };
        
        // 3. Deploy Compliance Modules
        console.log("\n3️⃣ Deploying Compliance Modules...");
        
        // CountryRestrictModule (with owner parameter)
        const CountryRestrictModule = await ethers.getContractFactory("CountryRestrictModule");
        const countryRestrictModule = await upgrades.deployProxy(
            CountryRestrictModule, 
            [deployer.address], // owner parameter
            deployOptions
        );
        await countryRestrictModule.waitForDeployment();
        const countryAddr = await countryRestrictModule.getAddress();
        deployment.contracts.CountryRestrictModule = countryAddr;
        console.log("✅ CountryRestrictModule deployed to:", countryAddr);
        await countryRestrictModule.deploymentTransaction().wait(5);
        
        // MaxBalanceModule
        const MaxBalanceModule = await ethers.getContractFactory("MaxBalanceModule");
        const maxBalanceModule = await upgrades.deployProxy(
            MaxBalanceModule, 
            [deployer.address], // owner parameter
            deployOptions
        );
        await maxBalanceModule.waitForDeployment();
        const maxBalAddr = await maxBalanceModule.getAddress();
        deployment.contracts.MaxBalanceModule = maxBalAddr;
        console.log("✅ MaxBalanceModule deployed to:", maxBalAddr);
        await maxBalanceModule.deploymentTransaction().wait(5);
        
        // TransferLimitModule
        const TransferLimitModule = await ethers.getContractFactory("TransferLimitModule");
        const transferLimitModule = await upgrades.deployProxy(
            TransferLimitModule, 
            [deployer.address], // owner parameter
            deployOptions
        );
        await transferLimitModule.waitForDeployment();
        const transferAddr = await transferLimitModule.getAddress();
        deployment.contracts.TransferLimitModule = transferAddr;
        console.log("✅ TransferLimitModule deployed to:", transferAddr);
        await transferLimitModule.deploymentTransaction().wait(5);
        
        // 4. Deploy ModularCompliance
        console.log("\n4️⃣ Deploying ModularCompliance...");
        const ModularCompliance = await ethers.getContractFactory("ModularCompliance");
        const modularCompliance = await upgrades.deployProxy(
            ModularCompliance, 
            [], // no init params
            deployOptions
        );
        await modularCompliance.waitForDeployment();
        const complianceAddr = await modularCompliance.getAddress();
        deployment.contracts.ModularCompliance = complianceAddr;
        console.log("✅ ModularCompliance deployed to:", complianceAddr);
        await modularCompliance.deploymentTransaction().wait(5);
        
        // 5. Deploy AssetRegistry
        console.log("\n5️⃣ Deploying AssetRegistry...");
        const AssetRegistry = await ethers.getContractFactory("AssetRegistry");
        const assetRegistry = await upgrades.deployProxy(
            AssetRegistry,
            [], // no init params
            deployOptions
        );
        await assetRegistry.waitForDeployment();
        const assetAddr = await assetRegistry.getAddress();
        deployment.contracts.AssetRegistry = assetAddr;
        console.log("✅ AssetRegistry deployed to:", assetAddr);
        await assetRegistry.deploymentTransaction().wait(5);
        
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
        const timelockAddr = await timelock.getAddress();
        deployment.contracts.FinatradesTimelock = timelockAddr;
        console.log("✅ FinatradesTimelock deployed to:", timelockAddr);
        await timelock.deploymentTransaction().wait(5);
        
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
                complianceAddr,
                assetAddr
            ],
            deployOptions
        );
        await token.waitForDeployment();
        const tokenAddr = await token.getAddress();
        deployment.contracts.FinatradesRWA_Enterprise = tokenAddr;
        console.log("✅ FinatradesRWA_Enterprise deployed to:", tokenAddr);
        await token.deploymentTransaction().wait(5);
        
        // 8. Deploy RegulatoryReporting
        console.log("\n8️⃣ Deploying RegulatoryReportingOptimized...");
        const RegulatoryReporting = await ethers.getContractFactory("RegulatoryReportingOptimized");
        const regulatoryReporting = await upgrades.deployProxy(
            RegulatoryReporting,
            [
                tokenAddr,
                deployment.contracts.IdentityRegistry,
                assetAddr,
                complianceAddr
            ],
            deployOptions
        );
        await regulatoryReporting.waitForDeployment();
        const reportingAddr = await regulatoryReporting.getAddress();
        deployment.contracts.RegulatoryReportingOptimized = reportingAddr;
        console.log("✅ RegulatoryReportingOptimized deployed to:", reportingAddr);
        await regulatoryReporting.deploymentTransaction().wait(5);
        
        // 9. Configure contracts
        console.log("\n9️⃣ Configuring contracts...");
        
        // Set token in compliance
        console.log("   Setting token in ModularCompliance...");
        const setTokenTx = await modularCompliance.setTokenBound(tokenAddr);
        await setTokenTx.wait(5);
        console.log("   ✅ Token bound to compliance");
        
        // Add compliance modules
        console.log("   Adding compliance modules...");
        const addModule1 = await modularCompliance.addModule(countryAddr);
        await addModule1.wait(5);
        console.log("   ✅ CountryRestrictModule added");
        
        const addModule2 = await modularCompliance.addModule(maxBalAddr);
        await addModule2.wait(5);
        console.log("   ✅ MaxBalanceModule added");
        
        const addModule3 = await modularCompliance.addModule(transferAddr);
        await addModule3.wait(5);
        console.log("   ✅ TransferLimitModule added");
        
        // Set regulatory reporting in token
        console.log("   Setting regulatory reporting in token...");
        const setReportingTx = await token.setRegulatoryReporting(reportingAddr);
        await setReportingTx.wait(5);
        console.log("   ✅ Regulatory reporting set");
        
        // Grant roles
        console.log("   Granting roles...");
        const AGENT_ROLE = await token.AGENT_ROLE();
        const grantAgent = await token.grantRole(AGENT_ROLE, deployer.address);
        await grantAgent.wait(5);
        console.log("   ✅ AGENT_ROLE granted");
        
        const ASSET_MANAGER_ROLE = await token.ASSET_MANAGER_ROLE();
        const grantAssetManager = await token.grantRole(ASSET_MANAGER_ROLE, deployer.address);
        await grantAssetManager.wait(5);
        console.log("   ✅ ASSET_MANAGER_ROLE granted");
        
        // Save deployment info
        const deploymentPath = path.join(__dirname, '../deployments');
        if (!fs.existsSync(deploymentPath)) {
            fs.mkdirSync(deploymentPath, { recursive: true });
        }
        
        // Convert BigInt to string for JSON serialization
        const deploymentForSave = JSON.parse(JSON.stringify(deployment, (key, value) =>
            typeof value === 'bigint' ? value.toString() : value
        ));
        
        const filename = `polygon_mainnet_deployment_${Date.now()}.json`;
        fs.writeFileSync(
            path.join(deploymentPath, filename),
            JSON.stringify(deploymentForSave, null, 2)
        );
        
        // Also save as latest
        fs.writeFileSync(
            path.join(deploymentPath, 'polygon_mainnet_latest.json'),
            JSON.stringify(deploymentForSave, null, 2)
        );
        
        console.log("\n✅ Deployment completed successfully!");
        console.log("📁 Deployment info saved to:", filename);
        
        // Print summary
        console.log("\n📋 Deployment Summary:");
        console.log("═══════════════════════════════════════");
        Object.entries(deployment.contracts).forEach(([name, address]) => {
            console.log(`${name}: ${address}`);
        });
        
        // Calculate deployment cost
        const gasPrice = await ethers.provider.getGasPrice();
        const estimatedGas = BigInt(25000000); // Estimated total gas for all deployments
        const deploymentCost = estimatedGas * gasPrice;
        
        console.log("\n💸 Deployment Cost:");
        console.log("Estimated gas:", estimatedGas.toString());
        console.log("Gas price:", ethers.formatUnits(gasPrice, "gwei"), "gwei");
        console.log("Estimated total cost:", ethers.formatEther(deploymentCost), "MATIC");
        
        return deployment;
        
    } catch (error) {
        console.error("\n❌ Deployment failed:", error);
        // Save partial deployment if any contracts were deployed
        if (Object.keys(deployment.contracts).length > 0) {
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
        }
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