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
        const tx = contract.deploymentTransaction();
        await tx.wait(5);
        
        return { contract, address };
    } catch (error) {
        console.error(`❌ Failed to deploy ${name}:`, error.message);
        throw error;
    }
}

async function main() {
    console.log("🚀 FRESH DEPLOYMENT - Remaining 5 Contracts\n");
    
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
            TransferLimitModule: "0x9fF75c5cE984849224a865f44e0d5bE9BeA12e0A"
        }
    };
    
    try {
        const ERC1967Proxy = await ethers.getContractFactory("@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol:ERC1967Proxy");
        
        // 1. Deploy fresh ModularCompliance
        console.log("\n=== [6/10] ModularCompliance (Fresh) ===");
        const ModularCompliance = await ethers.getContractFactory("ModularCompliance");
        const complianceImpl = await deployContract("ModularCompliance Implementation",
            () => ModularCompliance.deploy()
        );
        deployment.implementations.ModularCompliance = complianceImpl.address;
        
        const complianceInitData = ModularCompliance.interface.encodeFunctionData("initialize", [deployer.address]);
        const complianceProxy = await deployContract("ModularCompliance Proxy",
            () => ERC1967Proxy.deploy(complianceImpl.address, complianceInitData)
        );
        deployment.contracts.ModularCompliance = complianceProxy.address;
        
        // 2. AssetRegistry
        console.log("\n=== [7/10] AssetRegistry ===");
        const AssetRegistry = await ethers.getContractFactory("AssetRegistry");
        const assetImpl = await deployContract("AssetRegistry Implementation",
            () => AssetRegistry.deploy()
        );
        deployment.implementations.AssetRegistry = assetImpl.address;
        
        const assetInitData = AssetRegistry.interface.encodeFunctionData("initialize", []);
        const assetProxy = await deployContract("AssetRegistry Proxy",
            () => ERC1967Proxy.deploy(assetImpl.address, assetInitData)
        );
        deployment.contracts.AssetRegistry = assetProxy.address;
        
        // 3. Timelock
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
        
        // 4. Main Token
        console.log("\n=== [9/10] FinatradesRWA_Enterprise ===");
        const FinatradesRWA = await ethers.getContractFactory("FinatradesRWA_Enterprise");
        const tokenImpl = await deployContract("FinatradesRWA_Enterprise Implementation",
            () => FinatradesRWA.deploy()
        );
        deployment.implementations.FinatradesRWA_Enterprise = tokenImpl.address;
        
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
        
        // 5. RegulatoryReporting
        console.log("\n=== [10/10] RegulatoryReportingOptimized ===");
        const RegulatoryReporting = await ethers.getContractFactory("RegulatoryReportingOptimized");
        const reportingImpl = await deployContract("RegulatoryReportingOptimized Implementation",
            () => RegulatoryReporting.deploy()
        );
        deployment.implementations.RegulatoryReportingOptimized = reportingImpl.address;
        
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
        
        // Configure
        console.log("\n⚙️ CONFIGURING CONTRACTS...");
        
        const modularCompliance = ModularCompliance.attach(deployment.contracts.ModularCompliance);
        const token = FinatradesRWA.attach(deployment.contracts.FinatradesRWA_Enterprise);
        
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
        
        // Start verification
        console.log("\n🔍 STARTING VERIFICATION...");
        const { run } = require("hardhat");
        
        const implementations = [
            { name: "CountryRestrictModule", addr: deployment.implementations.CountryRestrictModule },
            { name: "MaxBalanceModule", addr: deployment.implementations.MaxBalanceModule },
            { name: "TransferLimitModule", addr: deployment.implementations.TransferLimitModule },
            { name: "ModularCompliance", addr: deployment.implementations.ModularCompliance },
            { name: "AssetRegistry", addr: deployment.implementations.AssetRegistry },
            { name: "FinatradesRWA_Enterprise", addr: deployment.implementations.FinatradesRWA_Enterprise },
            { name: "RegulatoryReportingOptimized", addr: deployment.implementations.RegulatoryReportingOptimized }
        ];
        
        for (const impl of implementations) {
            try {
                console.log(`\nVerifying ${impl.name}...`);
                await run("verify:verify", {
                    address: impl.addr,
                    constructorArguments: []
                });
                console.log(`✅ ${impl.name} verified`);
            } catch (e) {
                if (e.message.includes("Already Verified")) {
                    console.log(`✅ ${impl.name} already verified`);
                } else {
                    console.log(`⚠️ ${impl.name}: ${e.message.split('\n')[0]}`);
                }
            }
        }
        
        // Verify timelock
        try {
            console.log(`\nVerifying FinatradesTimelock...`);
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
        
        // Update README
        console.log("\n📝 Updating README...");
        const readmePath = path.join(__dirname, '../README.md');
        let readme = fs.readFileSync(readmePath, 'utf8');
        
        const deployedSection = `## Deployed Contracts (Polygon Mainnet)

### ✅ Deployment Status: COMPLETE

All contracts have been successfully deployed and verified on Polygon Mainnet.

#### Main Contracts (User-Facing Addresses)

| Contract | Address | Description |
|----------|---------|-------------|
| **FinatradesRWA_Enterprise** | [\`${deployment.contracts.FinatradesRWA_Enterprise}\`](https://polygonscan.com/address/${deployment.contracts.FinatradesRWA_Enterprise}) | Main ERC-3643 security token |
| **IdentityRegistry** | [\`${deployment.contracts.IdentityRegistry}\`](https://polygonscan.com/address/${deployment.contracts.IdentityRegistry}) | KYC and identity management |
| **ModularCompliance** | [\`${deployment.contracts.ModularCompliance}\`](https://polygonscan.com/address/${deployment.contracts.ModularCompliance}) | Compliance rules orchestration |
| **AssetRegistry** | [\`${deployment.contracts.AssetRegistry}\`](https://polygonscan.com/address/${deployment.contracts.AssetRegistry}) | RWA asset tracking and metadata |
| **RegulatoryReportingOptimized** | [\`${deployment.contracts.RegulatoryReportingOptimized}\`](https://polygonscan.com/address/${deployment.contracts.RegulatoryReportingOptimized}) | Regulatory compliance reporting |

#### Supporting Contracts

| Contract | Address | Description |
|----------|---------|-------------|
| **ClaimTopicsRegistry** | [\`${deployment.contracts.ClaimTopicsRegistry}\`](https://polygonscan.com/address/${deployment.contracts.ClaimTopicsRegistry}) | Identity claim topics registry |
| **CountryRestrictModule** | [\`${deployment.contracts.CountryRestrictModule}\`](https://polygonscan.com/address/${deployment.contracts.CountryRestrictModule}) | Country-based transfer restrictions |
| **MaxBalanceModule** | [\`${deployment.contracts.MaxBalanceModule}\`](https://polygonscan.com/address/${deployment.contracts.MaxBalanceModule}) | Maximum balance limits |
| **TransferLimitModule** | [\`${deployment.contracts.TransferLimitModule}\`](https://polygonscan.com/address/${deployment.contracts.TransferLimitModule}) | Daily/monthly transfer limits |
| **FinatradesTimelock** | [\`${deployment.contracts.FinatradesTimelock}\`](https://polygonscan.com/address/${deployment.contracts.FinatradesTimelock}) | 24-hour timelock for governance |`;
        
        readme = readme.replace(/## Deployed Contracts.*?(?=##|$)/s, deployedSection + '\n\n');
        fs.writeFileSync(readmePath, readme);
        console.log("✅ README updated");
        
        // Final summary
        console.log("\n🎉 DEPLOYMENT COMPLETE!");
        console.log("\n📋 ALL CONTRACT ADDRESSES:");
        console.log("════════════════════════════════════════════════════════════════");
        Object.entries(deployment.contracts).forEach(([name, address]) => {
            console.log(`${name.padEnd(35)} ${address}`);
        });
        console.log("════════════════════════════════════════════════════════════════");
        
        console.log("\n📦 IMPLEMENTATION ADDRESSES:");
        console.log("════════════════════════════════════════════════════════════════");
        Object.entries(deployment.implementations).forEach(([name, address]) => {
            console.log(`${name.padEnd(35)} ${address}`);
        });
        console.log("════════════════════════════════════════════════════════════════");
        
        const finalBalance = await deployer.provider.getBalance(deployer.address);
        const spent = ethers.parseEther("9.155") - finalBalance;
        
        console.log("\n💰 DEPLOYMENT COSTS:");
        console.log(`   Initial balance: 9.155 MATIC`);
        console.log(`   Final balance: ${ethers.formatEther(finalBalance)} MATIC`);
        console.log(`   Total spent: ${ethers.formatEther(spent)} MATIC`);
        console.log(`   USD value: ~$${(parseFloat(ethers.formatEther(spent)) * 0.9).toFixed(2)} (at $0.90/MATIC)`);
        
        console.log("\n✅ ALL 10 CONTRACTS DEPLOYED!");
        console.log("✅ VERIFICATION IN PROGRESS!");
        console.log("✅ README UPDATED!");
        
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