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
        return { contract, address };
    } catch (error) {
        console.error(`❌ Failed to deploy ${name}:`, error.message);
        throw error;
    }
}

async function main() {
    console.log("🚀 Manual deployment of all remaining contracts...\n");
    
    const [deployer] = await ethers.getSigners();
    const network = await ethers.provider.getNetwork();
    
    console.log("📍 Network:", network.name);
    console.log("🔑 Deployer:", deployer.address);
    console.log("💰 Balance:", ethers.formatEther(await deployer.provider.getBalance(deployer.address)), "MATIC");
    
    const deployment = {
        network: "polygon",
        chainId: network.chainId,
        deployer: deployer.address,
        timestamp: new Date().toISOString(),
        contracts: {
            ClaimTopicsRegistry: "0x6Ec58c34DF899Ff9d67FD088Cd339bB75508Dd79",
            IdentityRegistry: "0x25150414235289c688473340548698B5764651E3"
        },
        implementations: {}
    };
    
    try {
        // 1. Deploy Compliance Modules
        console.log("\n=== DEPLOYING COMPLIANCE MODULES ===");
        
        // CountryRestrictModule
        const CountryRestrictModule = await ethers.getContractFactory("CountryRestrictModule");
        const countryImpl = await deployContract("CountryRestrictModule Implementation", 
            () => CountryRestrictModule.deploy()
        );
        
        const ERC1967Proxy = await ethers.getContractFactory("@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol:ERC1967Proxy");
        const countryInitData = CountryRestrictModule.interface.encodeFunctionData("initialize", [deployer.address]);
        const countryProxy = await deployContract("CountryRestrictModule Proxy",
            () => ERC1967Proxy.deploy(countryImpl.address, countryInitData)
        );
        deployment.contracts.CountryRestrictModule = countryProxy.address;
        deployment.implementations.CountryRestrictModule = countryImpl.address;
        
        // MaxBalanceModule
        const MaxBalanceModule = await ethers.getContractFactory("MaxBalanceModule");
        const maxImpl = await deployContract("MaxBalanceModule Implementation",
            () => MaxBalanceModule.deploy()
        );
        
        const maxInitData = MaxBalanceModule.interface.encodeFunctionData("initialize", [deployer.address]);
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
        
        // 2. Deploy Core Contracts
        console.log("\n=== DEPLOYING CORE CONTRACTS ===");
        
        // ModularCompliance
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
        
        // Timelock (no proxy)
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
        
        // 3. Deploy Main Token
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
        
        // 4. Deploy RegulatoryReporting
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
        
        // 5. Configure Contracts
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
        
        // 6. Save Deployment
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
        
        // 7. Verify All Contracts
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
                    console.log(`⚠️ ${contract.name} verification failed:`, error.message);
                }
            }
        }
        
        // Print Summary
        console.log("\n🎉 DEPLOYMENT COMPLETE!");
        console.log("\n📋 CONTRACT ADDRESSES:");
        console.log("════════════════════════════════════════════════════════════════");
        Object.entries(deployment.contracts).forEach(([name, address]) => {
            console.log(`${name.padEnd(35)} : ${address}`);
        });
        console.log("════════════════════════════════════════════════════════════════");
        
        console.log("\n📦 IMPLEMENTATION ADDRESSES:");
        console.log("════════════════════════════════════════════════════════════════");
        Object.entries(deployment.implementations).forEach(([name, address]) => {
            console.log(`${name.padEnd(35)} : ${address}`);
        });
        console.log("════════════════════════════════════════════════════════════════");
        
        const finalBalance = await deployer.provider.getBalance(deployer.address);
        console.log("\n💰 Final balance:", ethers.formatEther(finalBalance), "MATIC");
        
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