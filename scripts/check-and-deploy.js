const { ethers } = require("hardhat");

async function main() {
    const [deployer] = await ethers.getSigners();
    
    console.log("Checking account status...");
    console.log("Address:", deployer.address);
    console.log("Balance:", ethers.formatEther(await deployer.provider.getBalance(deployer.address)), "MATIC");
    
    const nonce = await deployer.provider.getTransactionCount(deployer.address);
    console.log("Current nonce:", nonce);
    
    // Check if AssetRegistry proxy was already deployed
    const assetProxyAddress = "0x18E44f588a4DcF2F7145d35A5C226e129040b6D3";
    const code = await deployer.provider.getCode(assetProxyAddress);
    
    if (code !== "0x") {
        console.log("\n✅ AssetRegistry proxy already deployed at:", assetProxyAddress);
        console.log("Continuing with remaining deployments...");
        
        // Continue with remaining deployments
        await deployRemaining(deployer, assetProxyAddress);
    } else {
        console.log("\nAssetRegistry proxy not found, deploying...");
        await deployAll(deployer);
    }
}

async function deployRemaining(deployer, assetProxyAddress) {
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
            ModularCompliance: "0x123A014c135417b58BB3e04A5711C8F126cA95E8",
            AssetRegistry: assetProxyAddress
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
    
    try {
        const ERC1967Proxy = await ethers.getContractFactory("@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol:ERC1967Proxy");
        
        // Deploy remaining 3 contracts
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
        
        console.log("\n=== [9/10] FinatradesRWA_Enterprise ===");
        const FinatradesRWA = await ethers.getContractFactory("FinatradesRWA_Enterprise");
        const tokenImpl = await FinatradesRWA.deploy();
        await tokenImpl.waitForDeployment();
        deployment.implementations.FinatradesRWA_Enterprise = await tokenImpl.getAddress();
        console.log("✅ Implementation:", deployment.implementations.FinatradesRWA_Enterprise);
        await tokenImpl.deploymentTransaction().wait(3);
        
        const tokenInitData = FinatradesRWA.interface.encodeFunctionData("initialize", [
            deployer.address,
            "Finatrades RWA Token",
            "FRWA",
            18,
            deployment.contracts.IdentityRegistry,
            deployment.contracts.ModularCompliance,
            deployment.contracts.AssetRegistry
        ]);
        const tokenProxy = await ERC1967Proxy.deploy(deployment.implementations.FinatradesRWA_Enterprise, tokenInitData);
        await tokenProxy.waitForDeployment();
        deployment.contracts.FinatradesRWA_Enterprise = await tokenProxy.getAddress();
        console.log("✅ Proxy:", deployment.contracts.FinatradesRWA_Enterprise);
        await tokenProxy.deploymentTransaction().wait(3);
        
        console.log("\n=== [10/10] RegulatoryReportingOptimized ===");
        const RegulatoryReporting = await ethers.getContractFactory("RegulatoryReportingOptimized");
        const reportingImpl = await RegulatoryReporting.deploy();
        await reportingImpl.waitForDeployment();
        deployment.implementations.RegulatoryReportingOptimized = await reportingImpl.getAddress();
        console.log("✅ Implementation:", deployment.implementations.RegulatoryReportingOptimized);
        await reportingImpl.deploymentTransaction().wait(3);
        
        const reportingInitData = RegulatoryReporting.interface.encodeFunctionData("initialize", [
            deployment.contracts.FinatradesRWA_Enterprise,
            deployment.contracts.IdentityRegistry,
            deployment.contracts.AssetRegistry,
            deployment.contracts.ModularCompliance
        ]);
        const reportingProxy = await ERC1967Proxy.deploy(deployment.implementations.RegulatoryReportingOptimized, reportingInitData);
        await reportingProxy.waitForDeployment();
        deployment.contracts.RegulatoryReportingOptimized = await reportingProxy.getAddress();
        console.log("✅ Proxy:", deployment.contracts.RegulatoryReportingOptimized);
        await reportingProxy.deploymentTransaction().wait(3);
        
        // Configure
        console.log("\n⚙️ CONFIGURING...");
        const modularCompliance = await ethers.getContractAt("ModularCompliance", deployment.contracts.ModularCompliance);
        const token = await ethers.getContractAt("FinatradesRWA_Enterprise", deployment.contracts.FinatradesRWA_Enterprise);
        
        console.log("Setting token...");
        await (await modularCompliance.setTokenBound(deployment.contracts.FinatradesRWA_Enterprise)).wait(2);
        
        console.log("Adding modules...");
        await (await modularCompliance.addModule(deployment.contracts.CountryRestrictModule)).wait(2);
        await (await modularCompliance.addModule(deployment.contracts.MaxBalanceModule)).wait(2);
        await (await modularCompliance.addModule(deployment.contracts.TransferLimitModule)).wait(2);
        
        console.log("Setting reporting...");
        await (await token.setRegulatoryReporting(deployment.contracts.RegulatoryReportingOptimized)).wait(2);
        
        console.log("Granting roles...");
        await (await token.grantRole(await token.AGENT_ROLE(), deployer.address)).wait(2);
        await (await token.grantRole(await token.ASSET_MANAGER_ROLE(), deployer.address)).wait(2);
        
        // Save
        const fs = require("fs");
        const path = require("path");
        const deploymentPath = path.join(__dirname, '../deployments');
        
        fs.writeFileSync(
            path.join(deploymentPath, 'polygon_mainnet_latest.json'),
            JSON.stringify(deployment, null, 2)
        );
        
        console.log("\n🎉 ALL CONTRACTS DEPLOYED!");
        console.log("\n📋 FINAL ADDRESSES:");
        console.log("════════════════════════════════════════════════════════════════");
        Object.entries(deployment.contracts).forEach(([name, address]) => {
            console.log(`${name.padEnd(35)} ${address}`);
        });
        console.log("════════════════════════════════════════════════════════════════");
        
        // Start verification
        console.log("\n🔍 Starting verification...");
        const { run } = require("hardhat");
        
        const toVerify = [
            { name: "FinatradesRWA_Enterprise", addr: deployment.implementations.FinatradesRWA_Enterprise },
            { name: "RegulatoryReportingOptimized", addr: deployment.implementations.RegulatoryReportingOptimized },
            { 
                name: "FinatradesTimelock", 
                addr: deployment.contracts.FinatradesTimelock,
                args: [24 * 60 * 60, [deployer.address], [deployer.address], deployer.address]
            }
        ];
        
        for (const item of toVerify) {
            try {
                console.log(`Verifying ${item.name}...`);
                await run("verify:verify", { 
                    address: item.addr, 
                    constructorArguments: item.args || [] 
                });
                console.log(`✅ Verified`);
            } catch (e) {
                console.log(`⚠️ ${e.message.includes("Already Verified") ? "Already verified" : e.message.split('\n')[0]}`);
            }
        }
        
        const finalBalance = await deployer.provider.getBalance(deployer.address);
        console.log("\n💰 Final balance:", ethers.formatEther(finalBalance), "MATIC");
        console.log("\n✅ DEPLOYMENT AND CONFIGURATION COMPLETE!");
        
    } catch (error) {
        console.error("\n❌ Failed:", error.message);
        process.exit(1);
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });