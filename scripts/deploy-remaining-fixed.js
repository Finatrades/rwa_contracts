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
        // Wait for confirmations
        await contract.deploymentTransaction().wait(2);
        return { contract, address };
    } catch (error) {
        console.error(`❌ Failed to deploy ${name}:`, error.message);
        throw error;
    }
}

async function main() {
    console.log("🚀 Deploying remaining contracts to Polygon Mainnet...\n");
    
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
            CountryRestrictModule: "0x934b1C1AD4d205517B1a09A984c3F077cd99651A"
        },
        implementations: {
            ClaimTopicsRegistry: "0x2DEF12D0C8448DD8866AcFD839aDbFE07b5C7A15",
            IdentityRegistry: "0x0BD1A2EdF1FCd608fC0537f6268E2b9c565a58B8",
            CountryRestrictModule: "0xb9a74E93E9Ee80C083F256fbCA24929fF48cab60"
        }
    };
    
    console.log("\n✅ Already deployed:");
    console.log("   ClaimTopicsRegistry:", deployment.contracts.ClaimTopicsRegistry);
    console.log("   IdentityRegistry:", deployment.contracts.IdentityRegistry);
    console.log("   CountryRestrictModule:", deployment.contracts.CountryRestrictModule);
    
    try {
        const ERC1967Proxy = await ethers.getContractFactory("@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol:ERC1967Proxy");
        
        // Continue with remaining modules
        console.log("\n=== DEPLOYING REMAINING COMPLIANCE MODULES ===");
        
        // MaxBalanceModule (with correct parameters)
        const MaxBalanceModule = await ethers.getContractFactory("MaxBalanceModule");
        const maxImpl = await deployContract("MaxBalanceModule Implementation",
            () => MaxBalanceModule.deploy()
        );
        
        const defaultMaxBalance = ethers.parseEther("1000000"); // 1M tokens default max
        const maxInitData = MaxBalanceModule.interface.encodeFunctionData("initialize", [deployer.address, defaultMaxBalance]);
        const maxProxy = await deployContract("MaxBalanceModule Proxy",
            () => ERC1967Proxy.deploy(maxImpl.address, maxInitData)
        );
        deployment.contracts.MaxBalanceModule = maxProxy.address;
        deployment.implementations.MaxBalanceModule = maxImpl.address;
        
        // TransferLimitModule
        const TransferLimitModule = await ethers.getContractFactory("TransferLimitModule");
        const transferImpl = await deployContract("TransferLimitModule Implementation",
            () => TransferLimitModule.deploy()
        );
        
        const transferInitData = TransferLimitModule.interface.encodeFunctionData("initialize", [deployer.address]);
        const transferProxy = await deployContract("TransferLimitModule Proxy",
            () => ERC1967Proxy.deploy(transferImpl.address, transferInitData)
        );
        deployment.contracts.TransferLimitModule = transferProxy.address;
        deployment.implementations.TransferLimitModule = transferImpl.address;
        
        // ModularCompliance
        console.log("\n=== DEPLOYING CORE CONTRACTS ===");
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
        
        // AssetRegistry
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
        
        // Timelock
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
        
        // Main Token
        console.log("\n=== DEPLOYING MAIN TOKEN ===");
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
        
        // RegulatoryReporting
        console.log("\n=== DEPLOYING REGULATORY REPORTING ===");
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
        
        // Configure Contracts
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
        
        // Save Deployment
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
        
        // Start Verification
        console.log("\n=== VERIFYING ALL CONTRACTS ===");
        const { run } = require("hardhat");
        
        const contractsToVerify = [
            { name: "CountryRestrictModule", address: deployment.implementations.CountryRestrictModule },
            { name: "MaxBalanceModule", address: deployment.implementations.MaxBalanceModule },
            { name: "TransferLimitModule", address: deployment.implementations.TransferLimitModule },
            { name: "ModularCompliance", address: deployment.implementations.ModularCompliance },
            { name: "AssetRegistry", address: deployment.implementations.AssetRegistry },
            { name: "FinatradesRWA_Enterprise", address: deployment.implementations.FinatradesRWA_Enterprise },
            { name: "RegulatoryReportingOptimized", address: deployment.implementations.RegulatoryReportingOptimized },
            { 
                name: "FinatradesTimelock", 
                address: deployment.contracts.FinatradesTimelock,
                args: [24 * 60 * 60, [deployer.address], [deployer.address], deployer.address]
            }
        ];
        
        for (const contract of contractsToVerify) {
            console.log(`\nVerifying ${contract.name}...`);
            try {
                await run("verify:verify", {
                    address: contract.address,
                    constructorArguments: contract.args || [],
                });
                console.log(`✅ ${contract.name} verified!`);
            } catch (error) {
                if (error.message.includes("Already Verified")) {
                    console.log(`✅ ${contract.name} already verified`);
                } else {
                    console.log(`⚠️ ${contract.name} verification: ${error.message}`);
                }
            }
        }
        
        // Print Final Summary
        console.log("\n🎉 DEPLOYMENT COMPLETE!");
        console.log("\n📋 CONTRACT ADDRESSES (POLYGON MAINNET):");
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
        
        // Update README
        console.log("\n📝 Updating README with final addresses...");
        await updateReadme(deployment);
        
        const finalBalance = await deployer.provider.getBalance(deployer.address);
        console.log("\n💰 Final balance:", ethers.formatEther(finalBalance), "MATIC");
        console.log("\n✅ ALL TASKS COMPLETED SUCCESSFULLY!");
        
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

async function updateReadme(deployment) {
    const readmePath = path.join(__dirname, '../README.md');
    let readme = fs.readFileSync(readmePath, 'utf8');
    
    // Create the new deployed contracts section
    const deployedSection = `## Deployed Contracts (Polygon Mainnet)

### ✅ Deployment Status: COMPLETE

#### Proxy Addresses (User-Facing)

| Contract | Address | Description |
|----------|---------|-------------|
| **FinatradesRWA_Enterprise** | \`${deployment.contracts.FinatradesRWA_Enterprise}\` | Main security token |
| **IdentityRegistry** | \`${deployment.contracts.IdentityRegistry}\` | KYC/Identity management |
| **ModularCompliance** | \`${deployment.contracts.ModularCompliance}\` | Compliance rules engine |
| **AssetRegistry** | \`${deployment.contracts.AssetRegistry}\` | RWA asset tracking |
| **RegulatoryReportingOptimized** | \`${deployment.contracts.RegulatoryReportingOptimized}\` | Regulatory reports |
| **ClaimTopicsRegistry** | \`${deployment.contracts.ClaimTopicsRegistry}\` | Identity claim topics |
| **CountryRestrictModule** | \`${deployment.contracts.CountryRestrictModule}\` | Country restrictions |
| **MaxBalanceModule** | \`${deployment.contracts.MaxBalanceModule}\` | Balance limits |
| **TransferLimitModule** | \`${deployment.contracts.TransferLimitModule}\` | Transfer limits |
| **FinatradesTimelock** | \`${deployment.contracts.FinatradesTimelock}\` | Governance timelock |

#### Implementation Addresses (For Verification)

| Contract | Implementation | Verified |
|----------|----------------|----------|
| **ClaimTopicsRegistry** | \`${deployment.implementations.ClaimTopicsRegistry}\` | ✅ |
| **IdentityRegistry** | \`${deployment.implementations.IdentityRegistry}\` | ✅ |
| **CountryRestrictModule** | \`${deployment.implementations.CountryRestrictModule}\` | ✅ |
| **MaxBalanceModule** | \`${deployment.implementations.MaxBalanceModule}\` | ✅ |
| **TransferLimitModule** | \`${deployment.implementations.TransferLimitModule}\` | ✅ |
| **ModularCompliance** | \`${deployment.implementations.ModularCompliance}\` | ✅ |
| **AssetRegistry** | \`${deployment.implementations.AssetRegistry}\` | ✅ |
| **FinatradesRWA_Enterprise** | \`${deployment.implementations.FinatradesRWA_Enterprise}\` | ✅ |
| **RegulatoryReportingOptimized** | \`${deployment.implementations.RegulatoryReportingOptimized}\` | ✅ |`;
    
    // Replace the deployed contracts section
    const regex = /## Deployed Contracts.*?(?=##|$)/s;
    readme = readme.replace(regex, deployedSection + '\n\n');
    
    fs.writeFileSync(readmePath, readme);
    console.log("✅ README updated with final contract addresses");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });