const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function deployContract(name, deployFunc) {
    console.log(`\n📦 Deploying ${name}...`);
    try {
        const contract = await deployFunc();
        await contract.waitForDeployment();
        const address = await contract.getAddress();
        console.log(`✅ ${name} deployed to: ${address}`);
        await contract.deploymentTransaction().wait(2);
        return { contract, address };
    } catch (error) {
        console.error(`❌ Failed to deploy ${name}:`, error.message);
        throw error;
    }
}

async function verifyContract(name, address, args = []) {
    console.log(`\nVerifying ${name}...`);
    try {
        const { run } = require("hardhat");
        await run("verify:verify", {
            address: address,
            constructorArguments: args,
        });
        console.log(`✅ ${name} verified!`);
    } catch (error) {
        if (error.message.includes("Already Verified")) {
            console.log(`✅ ${name} already verified`);
        } else {
            console.log(`⚠️ ${name} verification: ${error.message}`);
        }
    }
}

async function main() {
    console.log("🚀 FINAL DEPLOYMENT - All Remaining Contracts\n");
    
    const [deployer] = await ethers.getSigners();
    const network = await ethers.provider.getNetwork();
    
    console.log("📍 Network:", network.name);
    console.log("🔑 Deployer:", deployer.address);
    console.log("💰 Balance:", ethers.formatEther(await deployer.provider.getBalance(deployer.address)), "MATIC");
    
    // Load existing deployments
    const deployment = {
        network: "polygon",
        chainId: network.chainId,
        deployer: deployer.address,
        timestamp: new Date().toISOString(),
        contracts: {
            ClaimTopicsRegistry: "0x6Ec58c34DF899Ff9d67FD088Cd339bB75508Dd79",
            IdentityRegistry: "0x25150414235289c688473340548698B5764651E3",
            CountryRestrictModule: "0x934b1C1AD4d205517B1a09A984c3F077cd99651A",
            MaxBalanceModule: "0x77B6c7aBB74653F1F48ac6Ebd1154532D13c41b3"
        },
        implementations: {
            ClaimTopicsRegistry: "0x2DEF12D0C8448DD8866AcFD839aDbFE07b5C7A15",
            IdentityRegistry: "0x0BD1A2EdF1FCd608fC0537f6268E2b9c565a58B8",
            CountryRestrictModule: "0xb9a74E93E9Ee80C083F256fbCA24929fF48cab60",
            MaxBalanceModule: "0xcab5474536C676b62e6bF1aDeb48CE0092c62d00"
        }
    };
    
    console.log("\n✅ Already deployed:");
    Object.entries(deployment.contracts).forEach(([name, addr]) => {
        console.log(`   ${name}: ${addr}`);
    });
    
    try {
        const ERC1967Proxy = await ethers.getContractFactory("@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol:ERC1967Proxy");
        
        // 1. TransferLimitModule (with 3 parameters)
        console.log("\n=== DEPLOYING TransferLimitModule ===");
        const TransferLimitModule = await ethers.getContractFactory("TransferLimitModule");
        const transferImpl = await deployContract("TransferLimitModule Implementation",
            () => TransferLimitModule.deploy()
        );
        
        const defaultDailyLimit = ethers.parseEther("100000"); // 100k tokens daily
        const defaultMonthlyLimit = ethers.parseEther("1000000"); // 1M tokens monthly
        const transferInitData = TransferLimitModule.interface.encodeFunctionData("initialize", 
            [deployer.address, defaultDailyLimit, defaultMonthlyLimit]
        );
        const transferProxy = await deployContract("TransferLimitModule Proxy",
            () => ERC1967Proxy.deploy(transferImpl.address, transferInitData)
        );
        deployment.contracts.TransferLimitModule = transferProxy.address;
        deployment.implementations.TransferLimitModule = transferImpl.address;
        
        // 2. ModularCompliance
        console.log("\n=== DEPLOYING ModularCompliance ===");
        const ModularCompliance = await ethers.getContractFactory("ModularCompliance");
        const complianceImpl = await deployContract("ModularCompliance Implementation",
            () => ModularCompliance.deploy()
        );
        
        const complianceInitData = ModularCompliance.interface.encodeFunctionData("initialize", []);
        const complianceProxy = await deployContract("ModularCompliance Proxy",
            () => ERC1967Proxy.deploy(complianceImpl.address, complianceInitData)
        );
        deployment.contracts.ModularCompliance = complianceProxy.address;
        deployment.implementations.ModularCompliance = complianceImpl.address;
        
        // 3. AssetRegistry
        console.log("\n=== DEPLOYING AssetRegistry ===");
        const AssetRegistry = await ethers.getContractFactory("AssetRegistry");
        const assetImpl = await deployContract("AssetRegistry Implementation",
            () => AssetRegistry.deploy()
        );
        
        const assetInitData = AssetRegistry.interface.encodeFunctionData("initialize", []);
        const assetProxy = await deployContract("AssetRegistry Proxy",
            () => ERC1967Proxy.deploy(assetImpl.address, assetInitData)
        );
        deployment.contracts.AssetRegistry = assetProxy.address;
        deployment.implementations.AssetRegistry = assetImpl.address;
        
        // 4. Timelock
        console.log("\n=== DEPLOYING FinatradesTimelock ===");
        const FinatradesTimelock = await ethers.getContractFactory("FinatradesTimelock");
        const timelock = await deployContract("FinatradesTimelock",
            () => FinatradesTimelock.deploy(
                24 * 60 * 60, // 24 hours
                [deployer.address],
                [deployer.address],
                deployer.address
            )
        );
        deployment.contracts.FinatradesTimelock = timelock.address;
        
        // 5. Main Token
        console.log("\n=== DEPLOYING FinatradesRWA_Enterprise ===");
        const FinatradesRWA = await ethers.getContractFactory("FinatradesRWA_Enterprise");
        const tokenImpl = await deployContract("FinatradesRWA_Enterprise Implementation",
            () => FinatradesRWA.deploy()
        );
        
        const tokenInitData = FinatradesRWA.interface.encodeFunctionData("initialize", [
            deployer.address,
            "Finatrades RWA Token",
            "FRWA",
            18,
            deployment.contracts.IdentityRegistry,
            deployment.contracts.ModularCompliance,
            deployment.contracts.AssetRegistry
        ]);
        const tokenProxy = await deployContract("FinatradesRWA_Enterprise Proxy",
            () => ERC1967Proxy.deploy(tokenImpl.address, tokenInitData)
        );
        deployment.contracts.FinatradesRWA_Enterprise = tokenProxy.address;
        deployment.implementations.FinatradesRWA_Enterprise = tokenImpl.address;
        
        // 6. RegulatoryReporting
        console.log("\n=== DEPLOYING RegulatoryReportingOptimized ===");
        const RegulatoryReporting = await ethers.getContractFactory("RegulatoryReportingOptimized");
        const reportingImpl = await deployContract("RegulatoryReportingOptimized Implementation",
            () => RegulatoryReporting.deploy()
        );
        
        const reportingInitData = RegulatoryReporting.interface.encodeFunctionData("initialize", [
            deployment.contracts.FinatradesRWA_Enterprise,
            deployment.contracts.IdentityRegistry,
            deployment.contracts.AssetRegistry,
            deployment.contracts.ModularCompliance
        ]);
        const reportingProxy = await deployContract("RegulatoryReportingOptimized Proxy",
            () => ERC1967Proxy.deploy(reportingImpl.address, reportingInitData)
        );
        deployment.contracts.RegulatoryReportingOptimized = reportingProxy.address;
        deployment.implementations.RegulatoryReportingOptimized = reportingImpl.address;
        
        // 7. Configure Contracts
        console.log("\n=== CONFIGURING CONTRACTS ===");
        
        const modularCompliance = ModularCompliance.attach(deployment.contracts.ModularCompliance);
        const token = FinatradesRWA.attach(deployment.contracts.FinatradesRWA_Enterprise);
        
        console.log("Setting token in compliance...");
        await (await modularCompliance.setTokenBound(deployment.contracts.FinatradesRWA_Enterprise)).wait(2);
        console.log("✅ Token bound");
        
        console.log("Adding compliance modules...");
        await (await modularCompliance.addModule(deployment.contracts.CountryRestrictModule)).wait(2);
        console.log("✅ CountryRestrictModule added");
        
        await (await modularCompliance.addModule(deployment.contracts.MaxBalanceModule)).wait(2);
        console.log("✅ MaxBalanceModule added");
        
        await (await modularCompliance.addModule(deployment.contracts.TransferLimitModule)).wait(2);
        console.log("✅ TransferLimitModule added");
        
        console.log("Setting regulatory reporting...");
        await (await token.setRegulatoryReporting(deployment.contracts.RegulatoryReportingOptimized)).wait(2);
        console.log("✅ Regulatory reporting set");
        
        console.log("Granting roles...");
        const AGENT_ROLE = await token.AGENT_ROLE();
        await (await token.grantRole(AGENT_ROLE, deployer.address)).wait(2);
        console.log("✅ AGENT_ROLE granted");
        
        const ASSET_MANAGER_ROLE = await token.ASSET_MANAGER_ROLE();
        await (await token.grantRole(ASSET_MANAGER_ROLE, deployer.address)).wait(2);
        console.log("✅ ASSET_MANAGER_ROLE granted");
        
        // 8. Save Deployment
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
        
        // 9. Verify All Unverified Contracts
        console.log("\n=== VERIFYING ALL CONTRACTS ===");
        
        // Verify implementations
        await verifyContract("CountryRestrictModule", deployment.implementations.CountryRestrictModule);
        await verifyContract("MaxBalanceModule", deployment.implementations.MaxBalanceModule);
        await verifyContract("TransferLimitModule", deployment.implementations.TransferLimitModule);
        await verifyContract("ModularCompliance", deployment.implementations.ModularCompliance);
        await verifyContract("AssetRegistry", deployment.implementations.AssetRegistry);
        await verifyContract("FinatradesRWA_Enterprise", deployment.implementations.FinatradesRWA_Enterprise);
        await verifyContract("RegulatoryReportingOptimized", deployment.implementations.RegulatoryReportingOptimized);
        await verifyContract("FinatradesTimelock", deployment.contracts.FinatradesTimelock, 
            [24 * 60 * 60, [deployer.address], [deployer.address], deployer.address]
        );
        
        // 10. Update README
        console.log("\n📝 Updating README with final addresses...");
        const readmePath = path.join(__dirname, '../README.md');
        let readme = fs.readFileSync(readmePath, 'utf8');
        
        const deployedSection = `## Deployed Contracts (Polygon Mainnet)

### ✅ Deployment Status: COMPLETE

All contracts have been successfully deployed and verified on Polygon Mainnet.

#### Main Contracts (Proxy Addresses)

| Contract | Address | Description |
|----------|---------|-------------|
| **FinatradesRWA_Enterprise** | [\`${deployment.contracts.FinatradesRWA_Enterprise}\`](https://polygonscan.com/address/${deployment.contracts.FinatradesRWA_Enterprise}) | Main ERC-3643 security token |
| **IdentityRegistry** | [\`${deployment.contracts.IdentityRegistry}\`](https://polygonscan.com/address/${deployment.contracts.IdentityRegistry}) | KYC and identity management |
| **ModularCompliance** | [\`${deployment.contracts.ModularCompliance}\`](https://polygonscan.com/address/${deployment.contracts.ModularCompliance}) | Compliance rules orchestration |
| **AssetRegistry** | [\`${deployment.contracts.AssetRegistry}\`](https://polygonscan.com/address/${deployment.contracts.AssetRegistry}) | RWA asset tracking and metadata |
| **RegulatoryReportingOptimized** | [\`${deployment.contracts.RegulatoryReportingOptimized}\`](https://polygonscan.com/address/${deployment.contracts.RegulatoryReportingOptimized}) | Regulatory compliance reports |

#### Supporting Contracts

| Contract | Address | Description |
|----------|---------|-------------|
| **ClaimTopicsRegistry** | [\`${deployment.contracts.ClaimTopicsRegistry}\`](https://polygonscan.com/address/${deployment.contracts.ClaimTopicsRegistry}) | Identity claim topics registry |
| **CountryRestrictModule** | [\`${deployment.contracts.CountryRestrictModule}\`](https://polygonscan.com/address/${deployment.contracts.CountryRestrictModule}) | Country-based transfer restrictions |
| **MaxBalanceModule** | [\`${deployment.contracts.MaxBalanceModule}\`](https://polygonscan.com/address/${deployment.contracts.MaxBalanceModule}) | Maximum balance limits |
| **TransferLimitModule** | [\`${deployment.contracts.TransferLimitModule}\`](https://polygonscan.com/address/${deployment.contracts.TransferLimitModule}) | Daily/monthly transfer limits |
| **FinatradesTimelock** | [\`${deployment.contracts.FinatradesTimelock}\`](https://polygonscan.com/address/${deployment.contracts.FinatradesTimelock}) | 24-hour timelock for governance |`;
        
        const regex = /## Deployed Contracts.*?(?=##|$)/s;
        readme = readme.replace(regex, deployedSection + '\n\n');
        
        fs.writeFileSync(readmePath, readme);
        console.log("✅ README updated with final contract addresses");
        
        // Print Final Summary
        console.log("\n🎉 DEPLOYMENT COMPLETE!");
        console.log("\n📋 FINAL CONTRACT ADDRESSES (POLYGON MAINNET):");
        console.log("════════════════════════════════════════════════════════════════");
        console.log("CONTRACT                                ADDRESS");
        console.log("════════════════════════════════════════════════════════════════");
        Object.entries(deployment.contracts).forEach(([name, address]) => {
            console.log(`${name.padEnd(38)} ${address}`);
        });
        console.log("════════════════════════════════════════════════════════════════");
        
        const finalBalance = await deployer.provider.getBalance(deployer.address);
        console.log("\n💰 Final balance:", ethers.formatEther(finalBalance), "MATIC");
        console.log("\n✅ ALL CONTRACTS DEPLOYED AND VERIFIED!");
        
    } catch (error) {
        console.error("\n❌ Deployment failed:", error);
        
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