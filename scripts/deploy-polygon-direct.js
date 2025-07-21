const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
    console.log("🚀 Starting Direct Polygon Mainnet Deployment...\n");
    
    const [deployer] = await ethers.getSigners();
    const network = await ethers.provider.getNetwork();
    
    console.log("📍 Network:", network.name);
    console.log("🔑 Deploying contracts with account:", deployer.address);
    console.log("💰 Account balance:", ethers.formatEther(await deployer.provider.getBalance(deployer.address)), "MATIC\n");
    
    // Use existing deployments where available
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
        // 3. Deploy remaining contracts without upgrades for now
        console.log("\n3️⃣ Deploying remaining contracts...");
        
        // Deploy implementations first
        console.log("   Deploying CountryRestrictModule implementation...");
        const CountryRestrictModule = await ethers.getContractFactory("CountryRestrictModule");
        const countryRestrictImpl = await CountryRestrictModule.deploy();
        await countryRestrictImpl.waitForDeployment();
        const countryImplAddr = await countryRestrictImpl.getAddress();
        console.log("   ✅ Implementation at:", countryImplAddr);
        
        // Deploy proxy
        const ERC1967Proxy = await ethers.getContractFactory("ERC1967Proxy");
        const initData = CountryRestrictModule.interface.encodeFunctionData("initialize", [deployer.address]);
        const countryProxy = await ERC1967Proxy.deploy(countryImplAddr, initData);
        await countryProxy.waitForDeployment();
        deployment.contracts.CountryRestrictModule = await countryProxy.getAddress();
        console.log("✅ CountryRestrictModule deployed to:", deployment.contracts.CountryRestrictModule);
        
        // MaxBalanceModule
        console.log("\n   Deploying MaxBalanceModule implementation...");
        const MaxBalanceModule = await ethers.getContractFactory("MaxBalanceModule");
        const maxBalanceImpl = await MaxBalanceModule.deploy();
        await maxBalanceImpl.waitForDeployment();
        const maxBalImplAddr = await maxBalanceImpl.getAddress();
        console.log("   ✅ Implementation at:", maxBalImplAddr);
        
        const maxBalInitData = MaxBalanceModule.interface.encodeFunctionData("initialize", [deployer.address]);
        const maxBalProxy = await ERC1967Proxy.deploy(maxBalImplAddr, maxBalInitData);
        await maxBalProxy.waitForDeployment();
        deployment.contracts.MaxBalanceModule = await maxBalProxy.getAddress();
        console.log("✅ MaxBalanceModule deployed to:", deployment.contracts.MaxBalanceModule);
        
        // TransferLimitModule
        console.log("\n   Deploying TransferLimitModule implementation...");
        const TransferLimitModule = await ethers.getContractFactory("TransferLimitModule");
        const transferLimitImpl = await TransferLimitModule.deploy();
        await transferLimitImpl.waitForDeployment();
        const transferImplAddr = await transferLimitImpl.getAddress();
        console.log("   ✅ Implementation at:", transferImplAddr);
        
        const transferInitData = TransferLimitModule.interface.encodeFunctionData("initialize", [deployer.address]);
        const transferProxy = await ERC1967Proxy.deploy(transferImplAddr, transferInitData);
        await transferProxy.waitForDeployment();
        deployment.contracts.TransferLimitModule = await transferProxy.getAddress();
        console.log("✅ TransferLimitModule deployed to:", deployment.contracts.TransferLimitModule);
        
        // ModularCompliance
        console.log("\n   Deploying ModularCompliance implementation...");
        const ModularCompliance = await ethers.getContractFactory("ModularCompliance");
        const complianceImpl = await ModularCompliance.deploy();
        await complianceImpl.waitForDeployment();
        const complianceImplAddr = await complianceImpl.getAddress();
        console.log("   ✅ Implementation at:", complianceImplAddr);
        
        const complianceInitData = ModularCompliance.interface.encodeFunctionData("initialize", []);
        const complianceProxy = await ERC1967Proxy.deploy(complianceImplAddr, complianceInitData);
        await complianceProxy.waitForDeployment();
        deployment.contracts.ModularCompliance = await complianceProxy.getAddress();
        console.log("✅ ModularCompliance deployed to:", deployment.contracts.ModularCompliance);
        
        // AssetRegistry
        console.log("\n   Deploying AssetRegistry implementation...");
        const AssetRegistry = await ethers.getContractFactory("AssetRegistry");
        const assetImpl = await AssetRegistry.deploy();
        await assetImpl.waitForDeployment();
        const assetImplAddr = await assetImpl.getAddress();
        console.log("   ✅ Implementation at:", assetImplAddr);
        
        const assetInitData = AssetRegistry.interface.encodeFunctionData("initialize", []);
        const assetProxy = await ERC1967Proxy.deploy(assetImplAddr, assetInitData);
        await assetProxy.waitForDeployment();
        deployment.contracts.AssetRegistry = await assetProxy.getAddress();
        console.log("✅ AssetRegistry deployed to:", deployment.contracts.AssetRegistry);
        
        // Timelock (no proxy needed)
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
        
        // Main Token
        console.log("\n7️⃣ Deploying FinatradesRWA_Enterprise...");
        const FinatradesRWA = await ethers.getContractFactory("FinatradesRWA_Enterprise");
        const tokenImpl = await FinatradesRWA.deploy();
        await tokenImpl.waitForDeployment();
        const tokenImplAddr = await tokenImpl.getAddress();
        console.log("   ✅ Implementation at:", tokenImplAddr);
        
        const tokenInitData = FinatradesRWA.interface.encodeFunctionData("initialize", [
            deployer.address,
            "Finatrades RWA Token",
            "FRWA",
            18,
            deployment.contracts.IdentityRegistry,
            deployment.contracts.ModularCompliance,
            deployment.contracts.AssetRegistry
        ]);
        const tokenProxy = await ERC1967Proxy.deploy(tokenImplAddr, tokenInitData);
        await tokenProxy.waitForDeployment();
        deployment.contracts.FinatradesRWA_Enterprise = await tokenProxy.getAddress();
        console.log("✅ FinatradesRWA_Enterprise deployed to:", deployment.contracts.FinatradesRWA_Enterprise);
        
        // RegulatoryReporting
        console.log("\n8️⃣ Deploying RegulatoryReportingOptimized...");
        const RegulatoryReporting = await ethers.getContractFactory("RegulatoryReportingOptimized");
        const reportingImpl = await RegulatoryReporting.deploy();
        await reportingImpl.waitForDeployment();
        const reportingImplAddr = await reportingImpl.getAddress();
        console.log("   ✅ Implementation at:", reportingImplAddr);
        
        const reportingInitData = RegulatoryReporting.interface.encodeFunctionData("initialize", [
            deployment.contracts.FinatradesRWA_Enterprise,
            deployment.contracts.IdentityRegistry,
            deployment.contracts.AssetRegistry,
            deployment.contracts.ModularCompliance
        ]);
        const reportingProxy = await ERC1967Proxy.deploy(reportingImplAddr, reportingInitData);
        await reportingProxy.waitForDeployment();
        deployment.contracts.RegulatoryReportingOptimized = await reportingProxy.getAddress();
        console.log("✅ RegulatoryReportingOptimized deployed to:", deployment.contracts.RegulatoryReportingOptimized);
        
        // 9. Configure contracts
        console.log("\n9️⃣ Configuring contracts...");
        
        // Get contract instances at proxy addresses
        const modularCompliance = ModularCompliance.attach(deployment.contracts.ModularCompliance);
        const token = FinatradesRWA.attach(deployment.contracts.FinatradesRWA_Enterprise);
        
        // Set token in compliance
        console.log("   Setting token in ModularCompliance...");
        const setTokenTx = await modularCompliance.setTokenBound(deployment.contracts.FinatradesRWA_Enterprise);
        await setTokenTx.wait(3);
        console.log("   ✅ Token bound to compliance");
        
        // Add compliance modules
        console.log("   Adding compliance modules...");
        const addModule1 = await modularCompliance.addModule(deployment.contracts.CountryRestrictModule);
        await addModule1.wait(3);
        console.log("   ✅ CountryRestrictModule added");
        
        const addModule2 = await modularCompliance.addModule(deployment.contracts.MaxBalanceModule);
        await addModule2.wait(3);
        console.log("   ✅ MaxBalanceModule added");
        
        const addModule3 = await modularCompliance.addModule(deployment.contracts.TransferLimitModule);
        await addModule3.wait(3);
        console.log("   ✅ TransferLimitModule added");
        
        // Set regulatory reporting in token
        console.log("   Setting regulatory reporting in token...");
        const setReportingTx = await token.setRegulatoryReporting(deployment.contracts.RegulatoryReportingOptimized);
        await setReportingTx.wait(3);
        console.log("   ✅ Regulatory reporting set");
        
        // Grant roles
        console.log("   Granting roles...");
        const AGENT_ROLE = await token.AGENT_ROLE();
        const grantAgent = await token.grantRole(AGENT_ROLE, deployer.address);
        await grantAgent.wait(3);
        console.log("   ✅ AGENT_ROLE granted");
        
        const ASSET_MANAGER_ROLE = await token.ASSET_MANAGER_ROLE();
        const grantAssetManager = await token.grantRole(ASSET_MANAGER_ROLE, deployer.address);
        await grantAssetManager.wait(3);
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
        
        console.log("\n🔍 Implementation Addresses:");
        console.log("CountryRestrictModule impl:", countryImplAddr);
        console.log("MaxBalanceModule impl:", maxBalImplAddr);
        console.log("TransferLimitModule impl:", transferImplAddr);
        console.log("ModularCompliance impl:", complianceImplAddr);
        console.log("AssetRegistry impl:", assetImplAddr);
        console.log("FinatradesRWA_Enterprise impl:", tokenImplAddr);
        console.log("RegulatoryReportingOptimized impl:", reportingImplAddr);
        
        return deployment;
        
    } catch (error) {
        console.error("\n❌ Deployment failed:", error);
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

// Deployment with error handling
main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });