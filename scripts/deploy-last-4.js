const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
    console.log("🚀 DEPLOYING LAST 4 CONTRACTS\n");
    
    const [deployer] = await ethers.getSigners();
    
    console.log("📍 Network: Polygon Mainnet");
    console.log("🔑 Deployer:", deployer.address);
    console.log("💰 Balance:", ethers.formatEther(await deployer.provider.getBalance(deployer.address)), "MATIC");
    
    const nonce = await deployer.provider.getTransactionCount(deployer.address);
    console.log("📊 Current nonce:", nonce);
    
    // Current state
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
            TransferLimitModule: "0x6887c6c45B64C6E6D55dFADb2a4857C5DAD63D57",
            ModularCompliance: "0x123A014c135417b58BB3e04A5711C8F126cA95E8"
        },
        implementations: {
            ClaimTopicsRegistry: "0x2DEF12D0C8448DD8866AcFD839aDbFE07b5C7A15",
            IdentityRegistry: "0x0BD1A2EdF1FCd608fC0537f6268E2b9c565a58B8",
            CountryRestrictModule: "0xb9a74E93E9Ee80C083F256fbCA24929fF48cab60",
            MaxBalanceModule: "0xcab5474536C676b62e6bF1aDeb48CE0092c62d00",
            TransferLimitModule: "0x9fF75c5cE984849224a865f44e0d5bE9BeA12e0A",
            ModularCompliance: "0xca244a40FEd494075195b9632c75377ccFB7C8ff",
            AssetRegistry: "0x63CFf0d3ec6F14d2e43C372a541837223fc8BFe8"
        }
    };
    
    console.log("\n✅ Already deployed (6/10)");
    
    try {
        const ERC1967Proxy = await ethers.getContractFactory("@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol:ERC1967Proxy");
        
        // 1. AssetRegistry Proxy
        console.log("\n=== [7/10] AssetRegistry Proxy ===");
        const AssetRegistry = await ethers.getContractFactory("AssetRegistry");
        const assetInitData = AssetRegistry.interface.encodeFunctionData("initialize", [deployer.address]);
        
        console.log("Deploying AssetRegistry proxy with nonce", nonce);
        const assetProxy = await ERC1967Proxy.deploy(
            deployment.implementations.AssetRegistry, 
            assetInitData,
            { nonce: nonce }
        );
        await assetProxy.waitForDeployment();
        deployment.contracts.AssetRegistry = await assetProxy.getAddress();
        console.log("✅ AssetRegistry proxy:", deployment.contracts.AssetRegistry);
        await assetProxy.deploymentTransaction().wait(3);
        
        // 2. Timelock
        console.log("\n=== [8/10] FinatradesTimelock ===");
        const FinatradesTimelock = await ethers.getContractFactory("FinatradesTimelock");
        const timelock = await FinatradesTimelock.deploy(
            24 * 60 * 60,
            [deployer.address],
            [deployer.address],
            deployer.address
        );
        await timelock.waitForDeployment();
        deployment.contracts.FinatradesTimelock = await timelock.getAddress();
        console.log("✅ FinatradesTimelock:", deployment.contracts.FinatradesTimelock);
        await timelock.deploymentTransaction().wait(3);
        
        // 3. Main Token
        console.log("\n=== [9/10] FinatradesRWA_Enterprise ===");
        const FinatradesRWA = await ethers.getContractFactory("FinatradesRWA_Enterprise");
        
        console.log("Deploying token implementation...");
        const tokenImpl = await FinatradesRWA.deploy();
        await tokenImpl.waitForDeployment();
        deployment.implementations.FinatradesRWA_Enterprise = await tokenImpl.getAddress();
        console.log("✅ Implementation:", deployment.implementations.FinatradesRWA_Enterprise);
        await tokenImpl.deploymentTransaction().wait(3);
        
        console.log("Deploying token proxy...");
        const tokenInitData = FinatradesRWA.interface.encodeFunctionData("initialize", [
            deployer.address,
            "Finatrades RWA Token",
            "FRWA",
            18,
            deployment.contracts.IdentityRegistry,
            deployment.contracts.ModularCompliance,
            deployment.contracts.AssetRegistry
        ]);
        const tokenProxy = await ERC1967Proxy.deploy(
            deployment.implementations.FinatradesRWA_Enterprise, 
            tokenInitData
        );
        await tokenProxy.waitForDeployment();
        deployment.contracts.FinatradesRWA_Enterprise = await tokenProxy.getAddress();
        console.log("✅ Proxy:", deployment.contracts.FinatradesRWA_Enterprise);
        await tokenProxy.deploymentTransaction().wait(3);
        
        // 4. RegulatoryReporting
        console.log("\n=== [10/10] RegulatoryReportingOptimized ===");
        const RegulatoryReporting = await ethers.getContractFactory("RegulatoryReportingOptimized");
        
        console.log("Deploying reporting implementation...");
        const reportingImpl = await RegulatoryReporting.deploy();
        await reportingImpl.waitForDeployment();
        deployment.implementations.RegulatoryReportingOptimized = await reportingImpl.getAddress();
        console.log("✅ Implementation:", deployment.implementations.RegulatoryReportingOptimized);
        await reportingImpl.deploymentTransaction().wait(3);
        
        console.log("Deploying reporting proxy...");
        const reportingInitData = RegulatoryReporting.interface.encodeFunctionData("initialize", [
            deployment.contracts.FinatradesRWA_Enterprise,
            deployment.contracts.IdentityRegistry,
            deployment.contracts.AssetRegistry,
            deployment.contracts.ModularCompliance
        ]);
        const reportingProxy = await ERC1967Proxy.deploy(
            deployment.implementations.RegulatoryReportingOptimized, 
            reportingInitData
        );
        await reportingProxy.waitForDeployment();
        deployment.contracts.RegulatoryReportingOptimized = await reportingProxy.getAddress();
        console.log("✅ Proxy:", deployment.contracts.RegulatoryReportingOptimized);
        await reportingProxy.deploymentTransaction().wait(3);
        
        // Configure
        console.log("\n⚙️ CONFIGURING CONTRACTS...");
        
        const modularCompliance = await ethers.getContractAt("ModularCompliance", deployment.contracts.ModularCompliance);
        const token = await ethers.getContractAt("FinatradesRWA_Enterprise", deployment.contracts.FinatradesRWA_Enterprise);
        
        console.log("Setting token in compliance...");
        await (await modularCompliance.setTokenBound(deployment.contracts.FinatradesRWA_Enterprise)).wait(3);
        console.log("✅ Token bound");
        
        console.log("Adding compliance modules...");
        await (await modularCompliance.addModule(deployment.contracts.CountryRestrictModule)).wait(3);
        console.log("✅ CountryRestrictModule");
        
        await (await modularCompliance.addModule(deployment.contracts.MaxBalanceModule)).wait(3);
        console.log("✅ MaxBalanceModule");
        
        await (await modularCompliance.addModule(deployment.contracts.TransferLimitModule)).wait(3);
        console.log("✅ TransferLimitModule");
        
        console.log("Setting regulatory reporting...");
        await (await token.setRegulatoryReporting(deployment.contracts.RegulatoryReportingOptimized)).wait(3);
        console.log("✅ Regulatory reporting set");
        
        console.log("Granting roles...");
        const AGENT_ROLE = await token.AGENT_ROLE();
        await (await token.grantRole(AGENT_ROLE, deployer.address)).wait(3);
        console.log("✅ AGENT_ROLE granted");
        
        const ASSET_MANAGER_ROLE = await token.ASSET_MANAGER_ROLE();
        await (await token.grantRole(ASSET_MANAGER_ROLE, deployer.address)).wait(3);
        console.log("✅ ASSET_MANAGER_ROLE granted");
        
        // Save deployment
        const deploymentPath = path.join(__dirname, '../deployments');
        const deploymentForSave = JSON.parse(JSON.stringify(deployment, (key, value) =>
            typeof value === 'bigint' ? value.toString() : value
        ));
        
        fs.writeFileSync(
            path.join(deploymentPath, 'polygon_mainnet_latest.json'),
            JSON.stringify(deploymentForSave, null, 2)
        );
        
        fs.writeFileSync(
            path.join(deploymentPath, `polygon_mainnet_complete_${Date.now()}.json`),
            JSON.stringify(deploymentForSave, null, 2)
        );
        
        // Final summary
        console.log("\n🎉 ALL 10 CONTRACTS DEPLOYED!");
        console.log("\n📋 FINAL CONTRACT ADDRESSES:");
        console.log("════════════════════════════════════════════════════════════════");
        Object.entries(deployment.contracts).forEach(([name, address]) => {
            console.log(`${name.padEnd(35)} ${address}`);
        });
        console.log("════════════════════════════════════════════════════════════════");
        
        // Start verification process
        console.log("\n🔍 Starting verification...");
        const { run } = require("hardhat");
        
        const implementations = [
            "CountryRestrictModule",
            "MaxBalanceModule", 
            "TransferLimitModule",
            "ModularCompliance",
            "AssetRegistry",
            "FinatradesRWA_Enterprise",
            "RegulatoryReportingOptimized"
        ];
        
        for (const name of implementations) {
            try {
                console.log(`Verifying ${name}...`);
                await run("verify:verify", {
                    address: deployment.implementations[name],
                    constructorArguments: []
                });
                console.log(`✅ ${name} verified`);
            } catch (e) {
                if (e.message.includes("Already Verified")) {
                    console.log(`✅ ${name} already verified`);
                } else {
                    console.log(`⚠️ ${name}: ${e.message.split('\n')[0]}`);
                }
            }
        }
        
        // Verify timelock
        try {
            console.log(`Verifying FinatradesTimelock...`);
            await run("verify:verify", {
                address: deployment.contracts.FinatradesTimelock,
                constructorArguments: [24 * 60 * 60, [deployer.address], [deployer.address], deployer.address]
            });
            console.log(`✅ FinatradesTimelock verified`);
        } catch (e) {
            if (e.message.includes("Already Verified")) {
                console.log(`✅ FinatradesTimelock already verified`);
            } else {
                console.log(`⚠️ FinatradesTimelock: ${e.message.split('\n')[0]}`);
            }
        }
        
        const finalBalance = await deployer.provider.getBalance(deployer.address);
        const spent = ethers.parseEther("9.155") - finalBalance;
        
        console.log("\n💰 FINAL DEPLOYMENT COSTS:");
        console.log(`   Initial: 9.155 MATIC`);
        console.log(`   Final: ${ethers.formatEther(finalBalance)} MATIC`);
        console.log(`   Total spent: ${ethers.formatEther(spent)} MATIC`);
        console.log(`   USD value: ~$${(parseFloat(ethers.formatEther(spent)) * 0.9).toFixed(2)}`);
        
        console.log("\n✅ DEPLOYMENT COMPLETE!");
        console.log("✅ CONFIGURATION COMPLETE!");
        console.log("✅ VERIFICATION IN PROGRESS!");
        
    } catch (error) {
        console.error("\n❌ Failed:", error);
        process.exit(1);
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });