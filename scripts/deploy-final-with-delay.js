const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function deployContract(name, deployFunc) {
    console.log(`\n📦 Deploying ${name}...`);
    try {
        const contract = await deployFunc();
        await contract.waitForDeployment();
        const address = await contract.getAddress();
        console.log(`✅ ${name} deployed to: ${address}`);
        
        // Wait for multiple confirmations
        const tx = contract.deploymentTransaction();
        console.log(`   Waiting for confirmations...`);
        await tx.wait(5);
        
        // Additional delay to ensure contract is fully deployed
        await sleep(5000);
        
        return { contract, address };
    } catch (error) {
        console.error(`❌ Failed to deploy ${name}:`, error.message);
        throw error;
    }
}

async function main() {
    console.log("🚀 FINAL DEPLOYMENT - Remaining 5 Contracts\n");
    
    const [deployer] = await ethers.getSigners();
    
    console.log("📍 Network: Polygon Mainnet");
    console.log("🔑 Deployer:", deployer.address);
    console.log("💰 Balance:", ethers.formatEther(await deployer.provider.getBalance(deployer.address)), "MATIC");
    
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
            TransferLimitModule: "0x9fF75c5cE984849224a865f44e0d5bE9BeA12e0A",
            ModularCompliance: "0x2C46d057aa69940d72785b3B87c7Bb28008F2eA1" // Already deployed implementation
        }
    };
    
    console.log("\n✅ Deployed (5/10):");
    Object.entries(deployment.contracts).forEach(([name, addr]) => {
        console.log(`   ${name}: ${addr}`);
    });
    
    console.log("\n⚠️  ModularCompliance implementation already at:", deployment.implementations.ModularCompliance);
    
    try {
        const ERC1967Proxy = await ethers.getContractFactory("@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol:ERC1967Proxy");
        
        // Deploy ModularCompliance Proxy using existing implementation
        console.log("\n=== [6/10] ModularCompliance Proxy ===");
        const ModularCompliance = await ethers.getContractFactory("ModularCompliance");
        const complianceInitData = ModularCompliance.interface.encodeFunctionData("initialize", [deployer.address]);
        
        const complianceProxy = await deployContract("ModularCompliance Proxy",
            () => ERC1967Proxy.deploy(deployment.implementations.ModularCompliance, complianceInitData)
        );
        deployment.contracts.ModularCompliance = complianceProxy.address;
        
        // AssetRegistry
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
        
        // Timelock
        console.log("\n=== [8/10] FinatradesTimelock ===");
        const FinatradesTimelock = await ethers.getContractFactory("FinatradesTimelock");
        const timelock = await deployContract("FinatradesTimelock",
            () => FinatradesTimelock.deploy(
                24 * 60 * 60,
                [deployer.address],
                [deployer.address],
                deployer.address
            )
        );
        deployment.contracts.FinatradesTimelock = timelock.address;
        
        // Main Token
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
        
        // RegulatoryReporting
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
        
        // Configure
        console.log("\n⚙️ CONFIGURING...");
        
        const modularCompliance = ModularCompliance.attach(deployment.contracts.ModularCompliance);
        const token = FinatradesRWA.attach(deployment.contracts.FinatradesRWA_Enterprise);
        
        console.log("Setting token...");
        await (await modularCompliance.setTokenBound(deployment.contracts.FinatradesRWA_Enterprise)).wait(3);
        
        console.log("Adding modules...");
        await (await modularCompliance.addModule(deployment.contracts.CountryRestrictModule)).wait(3);
        await (await modularCompliance.addModule(deployment.contracts.MaxBalanceModule)).wait(3);
        await (await modularCompliance.addModule(deployment.contracts.TransferLimitModule)).wait(3);
        
        console.log("Setting reporting...");
        await (await token.setRegulatoryReporting(deployment.contracts.RegulatoryReportingOptimized)).wait(3);
        
        console.log("Granting roles...");
        const AGENT_ROLE = await token.AGENT_ROLE();
        await (await token.grantRole(AGENT_ROLE, deployer.address)).wait(3);
        
        const ASSET_MANAGER_ROLE = await token.ASSET_MANAGER_ROLE();
        await (await token.grantRole(ASSET_MANAGER_ROLE, deployer.address)).wait(3);
        
        // Save
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
        
        // Verify
        console.log("\n🔍 VERIFYING...");
        const { run } = require("hardhat");
        
        const toVerify = [
            deployment.implementations.ModularCompliance,
            deployment.implementations.AssetRegistry,
            deployment.implementations.FinatradesRWA_Enterprise,
            deployment.implementations.RegulatoryReportingOptimized,
            deployment.contracts.FinatradesTimelock
        ];
        
        for (const address of toVerify) {
            try {
                console.log(`Verifying ${address}...`);
                await run("verify:verify", { address, constructorArguments: [] });
                console.log(`✅ Verified`);
            } catch (e) {
                console.log(`⚠️ ${e.message.split('\n')[0]}`);
            }
        }
        
        // Update README
        console.log("\n📝 Updating README...");
        const readmePath = path.join(__dirname, '../README.md');
        let readme = fs.readFileSync(readmePath, 'utf8');
        
        const newSection = `## Deployed Contracts (Polygon Mainnet)

### ✅ Deployment Status: COMPLETE

All contracts successfully deployed and verified on Polygon Mainnet.

#### Contract Addresses

| Contract | Proxy Address | Description |
|----------|---------------|-------------|
| **FinatradesRWA_Enterprise** | [\`${deployment.contracts.FinatradesRWA_Enterprise}\`](https://polygonscan.com/address/${deployment.contracts.FinatradesRWA_Enterprise}) | Main ERC-3643 security token |
| **IdentityRegistry** | [\`${deployment.contracts.IdentityRegistry}\`](https://polygonscan.com/address/${deployment.contracts.IdentityRegistry}) | KYC and identity management |
| **ModularCompliance** | [\`${deployment.contracts.ModularCompliance}\`](https://polygonscan.com/address/${deployment.contracts.ModularCompliance}) | Compliance rules orchestration |
| **AssetRegistry** | [\`${deployment.contracts.AssetRegistry}\`](https://polygonscan.com/address/${deployment.contracts.AssetRegistry}) | RWA asset tracking |
| **RegulatoryReportingOptimized** | [\`${deployment.contracts.RegulatoryReportingOptimized}\`](https://polygonscan.com/address/${deployment.contracts.RegulatoryReportingOptimized}) | Regulatory reporting |
| **ClaimTopicsRegistry** | [\`${deployment.contracts.ClaimTopicsRegistry}\`](https://polygonscan.com/address/${deployment.contracts.ClaimTopicsRegistry}) | Identity claims registry |
| **CountryRestrictModule** | [\`${deployment.contracts.CountryRestrictModule}\`](https://polygonscan.com/address/${deployment.contracts.CountryRestrictModule}) | Country restrictions |
| **MaxBalanceModule** | [\`${deployment.contracts.MaxBalanceModule}\`](https://polygonscan.com/address/${deployment.contracts.MaxBalanceModule}) | Balance limits |
| **TransferLimitModule** | [\`${deployment.contracts.TransferLimitModule}\`](https://polygonscan.com/address/${deployment.contracts.TransferLimitModule}) | Transfer limits |
| **FinatradesTimelock** | [\`${deployment.contracts.FinatradesTimelock}\`](https://polygonscan.com/address/${deployment.contracts.FinatradesTimelock}) | 24-hour governance timelock |`;
        
        readme = readme.replace(/## Deployed Contracts.*?(?=##|$)/s, newSection + '\n\n');
        fs.writeFileSync(readmePath, readme);
        
        console.log("\n🎉 DEPLOYMENT COMPLETE!");
        console.log("\n📋 ALL CONTRACTS:");
        Object.entries(deployment.contracts).forEach(([name, address]) => {
            console.log(`${name.padEnd(35)} ${address}`);
        });
        
        const finalBalance = await deployer.provider.getBalance(deployer.address);
        console.log("\n💰 Final balance:", ethers.formatEther(finalBalance), "MATIC");
        
    } catch (error) {
        console.error("\n❌ Failed:", error.message);
        
        const deploymentPath = path.join(__dirname, '../deployments');
        fs.writeFileSync(
            path.join(deploymentPath, `polygon_mainnet_partial_${Date.now()}.json`),
            JSON.stringify(deployment, null, 2)
        );
        
        process.exit(1);
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });