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

async function main() {
    console.log("🚀 COMPLETE DEPLOYMENT - Remaining Contracts\n");
    
    const [deployer] = await ethers.getSigners();
    
    console.log("📍 Network: Polygon Mainnet");
    console.log("🔑 Deployer:", deployer.address);
    console.log("💰 Balance:", ethers.formatEther(await deployer.provider.getBalance(deployer.address)), "MATIC");
    
    // Current deployment state
    const deployment = {
        network: "polygon",
        chainId: 137,
        deployer: deployer.address,
        timestamp: new Date().toISOString(),
        contracts: {
            ClaimTopicsRegistry: "0x6Ec58c34DF899Ff9d67FD088Cd339bB75508Dd79",
            IdentityRegistry: "0x25150414235289c688473340548698B5764651E3",
            CountryRestrictModule: "0x934b1C1AD4d205517B1a09A984c3F077cd99651A",
            MaxBalanceModule: "0x77B6c7aBB74653F1F48ac6Ebd1154532D13c41b3",
            TransferLimitModule: "0x6887c6c45B64C6E6D55dFADb2a4857C5DAD63D57"
        },
        implementations: {
            ClaimTopicsRegistry: "0x2DEF12D0C8448DD8866AcFD839aDbFE07b5C7A15",
            IdentityRegistry: "0x0BD1A2EdF1FCd608fC0537f6268E2b9c565a58B8",
            CountryRestrictModule: "0xb9a74E93E9Ee80C083F256fbCA24929fF48cab60",
            MaxBalanceModule: "0xcab5474536C676b62e6bF1aDeb48CE0092c62d00",
            TransferLimitModule: "0x9fF75c5cE984849224a865f44e0d5bE9BeA12e0A"
        }
    };
    
    console.log("\n✅ Already deployed (5/10):");
    Object.entries(deployment.contracts).forEach(([name, addr]) => {
        console.log(`   ${name}: ${addr}`);
    });
    
    try {
        const ERC1967Proxy = await ethers.getContractFactory("@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol:ERC1967Proxy");
        
        // 1. ModularCompliance (with admin parameter)
        console.log("\n=== [6/10] ModularCompliance ===");
        const ModularCompliance = await ethers.getContractFactory("ModularCompliance");
        const complianceImpl = await deployContract("ModularCompliance Implementation",
            () => ModularCompliance.deploy()
        );
        
        const complianceInitData = ModularCompliance.interface.encodeFunctionData("initialize", [deployer.address]);
        const complianceProxy = await deployContract("ModularCompliance Proxy",
            () => ERC1967Proxy.deploy(complianceImpl.address, complianceInitData)
        );
        deployment.contracts.ModularCompliance = complianceProxy.address;
        deployment.implementations.ModularCompliance = complianceImpl.address;
        
        // 2. AssetRegistry
        console.log("\n=== [7/10] AssetRegistry ===");
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
        
        // 3. Timelock
        console.log("\n=== [8/10] FinatradesTimelock ===");
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
        
        // 4. Main Token
        console.log("\n=== [9/10] FinatradesRWA_Enterprise ===");
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
        
        // 5. RegulatoryReporting
        console.log("\n=== [10/10] RegulatoryReportingOptimized ===");
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
        console.log("\n⚙️ CONFIGURING CONTRACTS...");
        
        const modularCompliance = ModularCompliance.attach(deployment.contracts.ModularCompliance);
        const token = FinatradesRWA.attach(deployment.contracts.FinatradesRWA_Enterprise);
        
        console.log("Setting token in compliance...");
        await (await modularCompliance.setTokenBound(deployment.contracts.FinatradesRWA_Enterprise)).wait(2);
        console.log("✅ Token bound");
        
        console.log("Adding compliance modules...");
        await (await modularCompliance.addModule(deployment.contracts.CountryRestrictModule)).wait(2);
        console.log("✅ CountryRestrictModule");
        
        await (await modularCompliance.addModule(deployment.contracts.MaxBalanceModule)).wait(2);
        console.log("✅ MaxBalanceModule");
        
        await (await modularCompliance.addModule(deployment.contracts.TransferLimitModule)).wait(2);
        console.log("✅ TransferLimitModule");
        
        console.log("Setting regulatory reporting...");
        await (await token.setRegulatoryReporting(deployment.contracts.RegulatoryReportingOptimized)).wait(2);
        console.log("✅ Regulatory reporting");
        
        console.log("Granting roles...");
        const AGENT_ROLE = await token.AGENT_ROLE();
        await (await token.grantRole(AGENT_ROLE, deployer.address)).wait(2);
        console.log("✅ AGENT_ROLE");
        
        const ASSET_MANAGER_ROLE = await token.ASSET_MANAGER_ROLE();
        await (await token.grantRole(ASSET_MANAGER_ROLE, deployer.address)).wait(2);
        console.log("✅ ASSET_MANAGER_ROLE");
        
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
        
        // Verify All Contracts
        console.log("\n🔍 VERIFYING ALL CONTRACTS...");
        const { run } = require("hardhat");
        
        const toVerify = [
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
        
        for (const contract of toVerify) {
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
                    console.log(`⚠️ ${contract.name}: ${error.message.split('\n')[0]}`);
                }
            }
        }
        
        // Final Summary
        console.log("\n🎉 DEPLOYMENT COMPLETE!");
        console.log("\n📋 ALL CONTRACT ADDRESSES (POLYGON MAINNET):");
        console.log("════════════════════════════════════════════════════════════════");
        Object.entries(deployment.contracts).forEach(([name, address]) => {
            console.log(`${name.padEnd(35)} ${address}`);
        });
        console.log("════════════════════════════════════════════════════════════════");
        
        const finalBalance = await deployer.provider.getBalance(deployer.address);
        const spent = ethers.parseEther("9.155") - finalBalance;
        console.log("\n💰 Deployment Cost:");
        console.log(`   Started with: 9.155 MATIC`);
        console.log(`   Final balance: ${ethers.formatEther(finalBalance)} MATIC`);
        console.log(`   Total spent: ${ethers.formatEther(spent)} MATIC`);
        
        console.log("\n✅ ALL 10 CONTRACTS DEPLOYED AND CONFIGURED!");
        console.log("✅ VERIFICATION IN PROGRESS!");
        
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