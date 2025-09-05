const { ethers, upgrades, run } = require("hardhat");
const fs = require("fs");
const path = require("path");
require("dotenv").config();

async function main() {
    console.log("\n=== Finatrades RWA Complete Deployment with Verification ===");
    console.log("Network:", network.name);
    console.log("==========================================================\n");

    const [deployer] = await ethers.getSigners();
    console.log("Deployer address:", deployer.address);
    
    // Get admin and agent addresses from .env
    const ADMIN_ADDRESS = process.env.OWNER_ADDRESS || deployer.address;
    const AGENT_ADDRESS = process.env.AGENT_ADDRESS || deployer.address;
    
    console.log("Admin address:", ADMIN_ADDRESS);
    console.log("Agent address:", AGENT_ADDRESS);
    
    const balance = await ethers.provider.getBalance(deployer.address);
    console.log("Deployer balance:", ethers.formatEther(balance), "MATIC\n");

    if (balance < ethers.parseEther("5")) {
        throw new Error("Insufficient balance. Need at least 5 MATIC for deployment");
    }

    const deployment = {
        network: network.name,
        deployer: deployer.address,
        adminAddress: ADMIN_ADDRESS,
        agentAddress: AGENT_ADDRESS,
        timestamp: new Date().toISOString(),
        contracts: {},
        implementations: {},
        tokenImplementations: {}
    };

    try {
        // 1. Deploy ClaimTopicsRegistry
        console.log("\n[1/13] Deploying ClaimTopicsRegistry...");
        const ClaimTopicsRegistry = await ethers.getContractFactory("ClaimTopicsRegistry");
        const claimTopicsRegistry = await upgrades.deployProxy(ClaimTopicsRegistry, [ADMIN_ADDRESS]);
        await claimTopicsRegistry.waitForDeployment();
        deployment.contracts.ClaimTopicsRegistry = await claimTopicsRegistry.getAddress();
        deployment.implementations.ClaimTopicsRegistry = await upgrades.erc1967.getImplementationAddress(deployment.contracts.ClaimTopicsRegistry);
        console.log("✅ ClaimTopicsRegistry deployed at:", deployment.contracts.ClaimTopicsRegistry);

        // 2. Deploy IdentityRegistry
        console.log("\n[2/12] Deploying IdentityRegistry...");
        const IdentityRegistry = await ethers.getContractFactory("IdentityRegistry");
        const identityRegistry = await upgrades.deployProxy(IdentityRegistry, [ADMIN_ADDRESS]);
        await identityRegistry.waitForDeployment();
        deployment.contracts.IdentityRegistry = await identityRegistry.getAddress();
        deployment.implementations.IdentityRegistry = await upgrades.erc1967.getImplementationAddress(deployment.contracts.IdentityRegistry);
        console.log("✅ IdentityRegistry deployed at:", deployment.contracts.IdentityRegistry);

        // 3. Deploy ModularCompliance
        console.log("\n[3/12] Deploying ModularCompliance...");
        const ModularCompliance = await ethers.getContractFactory("ModularCompliance");
        const modularCompliance = await upgrades.deployProxy(ModularCompliance, [ADMIN_ADDRESS]);
        await modularCompliance.waitForDeployment();
        deployment.contracts.ModularCompliance = await modularCompliance.getAddress();
        deployment.implementations.ModularCompliance = await upgrades.erc1967.getImplementationAddress(deployment.contracts.ModularCompliance);
        console.log("✅ ModularCompliance deployed at:", deployment.contracts.ModularCompliance);

        // 4. Deploy AssetRegistry
        console.log("\n[4/12] Deploying AssetRegistry...");
        const AssetRegistry = await ethers.getContractFactory("AssetRegistry");
        const assetRegistry = await upgrades.deployProxy(AssetRegistry, [ADMIN_ADDRESS]);
        await assetRegistry.waitForDeployment();
        deployment.contracts.AssetRegistry = await assetRegistry.getAddress();
        deployment.implementations.AssetRegistry = await upgrades.erc1967.getImplementationAddress(deployment.contracts.AssetRegistry);
        console.log("✅ AssetRegistry deployed at:", deployment.contracts.AssetRegistry);

        // 5. Deploy Token
        console.log("\n[5/12] Deploying Token...");
        const Token = await ethers.getContractFactory("Token");
        const token = await upgrades.deployProxy(Token, [
            ADMIN_ADDRESS,
            "Finatrades RWA Token",
            "FRWA",
            18,
            deployment.contracts.IdentityRegistry,
            deployment.contracts.ModularCompliance
        ]);
        await token.waitForDeployment();
        deployment.contracts.Token = await token.getAddress();
        deployment.implementations.Token = await upgrades.erc1967.getImplementationAddress(deployment.contracts.Token);
        console.log("✅ Token deployed at:", deployment.contracts.Token);

        // 6. Deploy RegulatoryReportingOptimized
        console.log("\n[6/12] Deploying RegulatoryReportingOptimized...");
        const RegulatoryReporting = await ethers.getContractFactory("RegulatoryReportingOptimized");
        const regulatoryReporting = await upgrades.deployProxy(RegulatoryReporting, [
            deployment.contracts.Token,
            deployment.contracts.IdentityRegistry,
            deployment.contracts.AssetRegistry,
            deployment.contracts.ModularCompliance
        ]);
        await regulatoryReporting.waitForDeployment();
        deployment.contracts.RegulatoryReportingOptimized = await regulatoryReporting.getAddress();
        deployment.implementations.RegulatoryReportingOptimized = await upgrades.erc1967.getImplementationAddress(deployment.contracts.RegulatoryReportingOptimized);
        console.log("✅ RegulatoryReportingOptimized deployed at:", deployment.contracts.RegulatoryReportingOptimized);

        // 7. Deploy CountryRestrictModule
        console.log("\n[7/12] Deploying CountryRestrictModule...");
        const CountryRestrictModule = await ethers.getContractFactory("CountryRestrictModule");
        const countryRestrictModule = await upgrades.deployProxy(CountryRestrictModule, [ADMIN_ADDRESS]);
        await countryRestrictModule.waitForDeployment();
        deployment.contracts.CountryRestrictModule = await countryRestrictModule.getAddress();
        deployment.implementations.CountryRestrictModule = await upgrades.erc1967.getImplementationAddress(deployment.contracts.CountryRestrictModule);
        console.log("✅ CountryRestrictModule deployed at:", deployment.contracts.CountryRestrictModule);

        // 8. Deploy MaxBalanceModule
        console.log("\n[8/12] Deploying MaxBalanceModule...");
        const MaxBalanceModule = await ethers.getContractFactory("MaxBalanceModule");
        const maxBalanceModule = await upgrades.deployProxy(MaxBalanceModule, 
            [ADMIN_ADDRESS, ethers.parseEther("10000000")] // 10M token default max
        );
        await maxBalanceModule.waitForDeployment();
        deployment.contracts.MaxBalanceModule = await maxBalanceModule.getAddress();
        deployment.implementations.MaxBalanceModule = await upgrades.erc1967.getImplementationAddress(deployment.contracts.MaxBalanceModule);
        console.log("✅ MaxBalanceModule deployed at:", deployment.contracts.MaxBalanceModule);

        // 9. Deploy TransferLimitModule
        console.log("\n[9/12] Deploying TransferLimitModule...");
        const TransferLimitModule = await ethers.getContractFactory("TransferLimitModule");
        const transferLimitModule = await upgrades.deployProxy(TransferLimitModule, 
            [ADMIN_ADDRESS, ethers.parseEther("1000000"), ethers.parseEther("10000000")] // 1M daily, 10M monthly
        );
        await transferLimitModule.waitForDeployment();
        deployment.contracts.TransferLimitModule = await transferLimitModule.getAddress();
        deployment.implementations.TransferLimitModule = await upgrades.erc1967.getImplementationAddress(deployment.contracts.TransferLimitModule);
        console.log("✅ TransferLimitModule deployed at:", deployment.contracts.TransferLimitModule);

        // 10. Deploy FinatradesTimelock
        console.log("\n[10/12] Deploying FinatradesTimelock...");
        const FinatradesTimelock = await ethers.getContractFactory("FinatradesTimelock");
        const timelock = await FinatradesTimelock.deploy(
            172800, // 48 hours delay
            [ADMIN_ADDRESS], // proposers
            [ADMIN_ADDRESS], // executors
            ADMIN_ADDRESS // admin
        );
        await timelock.waitForDeployment();
        deployment.contracts.FinatradesTimelock = await timelock.getAddress();
        console.log("✅ FinatradesTimelock deployed at:", deployment.contracts.FinatradesTimelock);

        // 11. Deploy FinatradesTokenFactory
        console.log("\n[11/12] Deploying FinatradesTokenFactory...");
        const FinatradesTokenFactory = await ethers.getContractFactory("FinatradesTokenFactory");
        const tokenFactory = await upgrades.deployProxy(FinatradesTokenFactory, [
            ADMIN_ADDRESS,
            deployment.contracts.IdentityRegistry,
            deployment.contracts.ModularCompliance,
            deployment.contracts.AssetRegistry
        ]);
        await tokenFactory.waitForDeployment();
        deployment.contracts.FinatradesTokenFactory = await tokenFactory.getAddress();
        deployment.implementations.FinatradesTokenFactory = await upgrades.erc1967.getImplementationAddress(deployment.contracts.FinatradesTokenFactory);
        console.log("✅ FinatradesTokenFactory deployed at:", deployment.contracts.FinatradesTokenFactory);

        // 12. Deploy Token Implementations for Factory
        console.log("\n[12/12] Deploying Token Implementations for Factory...");
        
        // Deploy ERC-20 Implementation
        console.log("Deploying ERC-20 implementation...");
        const TokenImpl = await ethers.getContractFactory("Token");
        const tokenImpl = await TokenImpl.deploy();
        await tokenImpl.waitForDeployment();
        deployment.tokenImplementations.Token = await tokenImpl.getAddress();
        console.log("✅ ERC-20 implementation:", deployment.tokenImplementations.Token);

        // Deploy ERC-721 Implementation
        console.log("Deploying ERC-721 implementation...");
        const NFTImpl = await ethers.getContractFactory("FinatradesNFT");
        const nftImpl = await NFTImpl.deploy();
        await nftImpl.waitForDeployment();
        deployment.tokenImplementations.FinatradesNFT = await nftImpl.getAddress();
        console.log("✅ ERC-721 implementation:", deployment.tokenImplementations.FinatradesNFT);

        // Deploy ERC-1155 Implementation
        console.log("Deploying ERC-1155 implementation...");
        const MultiTokenImpl = await ethers.getContractFactory("FinatradesMultiToken");
        const multiTokenImpl = await MultiTokenImpl.deploy();
        await multiTokenImpl.waitForDeployment();
        deployment.tokenImplementations.FinatradesMultiToken = await multiTokenImpl.getAddress();
        console.log("✅ ERC-1155 implementation:", deployment.tokenImplementations.FinatradesMultiToken);

        // ====== CONFIGURATION PHASE ======
        console.log("\n=== Configuring Contracts ===");
        
        // Set token implementations in factory
        console.log("Setting token implementations in factory...");
        await tokenFactory.setTokenImplementation(deployment.tokenImplementations.Token);
        await tokenFactory.setNFTImplementation(deployment.tokenImplementations.FinatradesNFT);
        await tokenFactory.setERC1155Implementation(deployment.tokenImplementations.FinatradesMultiToken);
        console.log("✅ Token implementations set");

        // Bind token to compliance
        console.log("Binding token to compliance...");
        await modularCompliance.bindToken(deployment.contracts.Token);
        console.log("✅ Token bound to compliance");


        // Bind compliance modules to token
        console.log("Binding modules to token...");
        await countryRestrictModule.bindToken(deployment.contracts.Token);
        await maxBalanceModule.bindToken(deployment.contracts.Token);
        await transferLimitModule.bindToken(deployment.contracts.Token);
        console.log("✅ Modules bound to token");

        // Add compliance modules to ModularCompliance
        console.log("Adding compliance modules...");
        await modularCompliance.addModule(deployment.contracts.CountryRestrictModule);
        await modularCompliance.addModule(deployment.contracts.MaxBalanceModule);
        await modularCompliance.addModule(deployment.contracts.TransferLimitModule);
        console.log("✅ Compliance modules added");

        // ====== ROLE ASSIGNMENT PHASE ======
        console.log("\n=== Assigning Roles ===");
        
        // Grant roles on ClaimTopicsRegistry
        console.log("Granting roles on ClaimTopicsRegistry...");
        const OWNER_ROLE = await claimTopicsRegistry.OWNER_ROLE();
        if (AGENT_ADDRESS !== ADMIN_ADDRESS) {
            await claimTopicsRegistry.grantRole(OWNER_ROLE, AGENT_ADDRESS);
        }
        console.log("✅ ClaimTopicsRegistry roles granted");

        // Grant roles on IdentityRegistry
        console.log("Granting roles on IdentityRegistry...");
        const AGENT_ROLE = await identityRegistry.AGENT_ROLE();
        await identityRegistry.grantRole(AGENT_ROLE, AGENT_ADDRESS);
        if (AGENT_ADDRESS !== ADMIN_ADDRESS) {
            await identityRegistry.grantRole(OWNER_ROLE, AGENT_ADDRESS);
        }
        console.log("✅ IdentityRegistry roles granted");

        // Grant roles on Token
        console.log("Granting roles on Token...");
        await token.grantRole(await token.AGENT_ROLE(), AGENT_ADDRESS);
        if (AGENT_ADDRESS !== ADMIN_ADDRESS) {
            await token.grantRole(await token.OWNER_ROLE(), AGENT_ADDRESS);
        }
        console.log("✅ Token roles granted");

        // Grant roles on AssetRegistry
        console.log("Granting roles on AssetRegistry...");
        await assetRegistry.grantRole(await assetRegistry.REGISTRAR_ROLE(), AGENT_ADDRESS);
        if (AGENT_ADDRESS !== ADMIN_ADDRESS) {
            await assetRegistry.grantRole(await assetRegistry.OWNER_ROLE(), AGENT_ADDRESS);
        }
        console.log("✅ AssetRegistry roles granted");

        // Grant roles on ModularCompliance
        console.log("Granting roles on ModularCompliance...");
        if (AGENT_ADDRESS !== ADMIN_ADDRESS) {
            await modularCompliance.grantRole(await modularCompliance.OWNER_ROLE(), AGENT_ADDRESS);
        }
        console.log("✅ ModularCompliance roles granted");

        // Grant roles on TokenFactory
        console.log("Granting roles on TokenFactory...");
        await tokenFactory.grantRole(await tokenFactory.FACTORY_ADMIN_ROLE(), AGENT_ADDRESS);
        if (AGENT_ADDRESS !== ADMIN_ADDRESS) {
            await tokenFactory.grantRole(await tokenFactory.COMPLIANCE_ADMIN_ROLE(), AGENT_ADDRESS);
        }
        console.log("✅ TokenFactory roles granted");

        // Save deployment data
        const deploymentPath = path.join(__dirname, "..", "deployments", `${network.name}_fresh_deployment.json`);
        fs.writeFileSync(deploymentPath, JSON.stringify(deployment, null, 2));
        console.log("\n✅ Deployment data saved to:", deploymentPath);

        // Verify contracts if on polygon
        if (network.name === "polygon" || network.name === "polygon_amoy") {
            console.log("\n=== Starting Contract Verification ===");
            await verifyContracts(deployment);
        }

        console.log("\n=== Deployment Complete ===");
        console.log("All contracts deployed and configured successfully!");
        console.log("\nDeployed Contract Addresses:");
        console.log("============================");
        Object.entries(deployment.contracts).forEach(([name, address]) => {
            console.log(`${name}: ${address}`);
        });

    } catch (error) {
        console.error("\n❌ Deployment failed:", error);
        // Save partial deployment data even on failure
        const deploymentPath = path.join(__dirname, "..", "deployments", `${network.name}_partial_deployment.json`);
        fs.writeFileSync(deploymentPath, JSON.stringify(deployment, null, 2));
        console.log("Partial deployment data saved to:", deploymentPath);
        throw error;
    }
}

async function verifyContracts(deployment) {
    // Wait for Polygonscan to index
    console.log("\nWaiting 60 seconds for Polygonscan to index contracts...");
    await new Promise(resolve => setTimeout(resolve, 60000));

    const verificationTasks = [
        // Verify implementations
        { name: "ClaimTopicsRegistry Implementation", address: deployment.implementations.ClaimTopicsRegistry, args: [], contract: "contracts/registry/ClaimTopicsRegistry.sol:ClaimTopicsRegistry" },
        { name: "IdentityRegistry Implementation", address: deployment.implementations.IdentityRegistry, args: [], contract: "contracts/identity/IdentityRegistry.sol:IdentityRegistry" },
        { name: "ModularCompliance Implementation", address: deployment.implementations.ModularCompliance, args: [], contract: "contracts/compliance/ModularCompliance.sol:ModularCompliance" },
        { name: "AssetRegistry Implementation", address: deployment.implementations.AssetRegistry, args: [], contract: "contracts/registry/AssetRegistry.sol:AssetRegistry" },
        { name: "Token Implementation", address: deployment.implementations.Token, args: [], contract: "contracts/token/Token.sol:Token" },
        { name: "RegulatoryReporting Implementation", address: deployment.implementations.RegulatoryReportingOptimized, args: [], contract: "contracts/compliance/RegulatoryReportingOptimized.sol:RegulatoryReportingOptimized" },
        { name: "CountryRestrictModule Implementation", address: deployment.implementations.CountryRestrictModule, args: [], contract: "contracts/compliance/modular/CountryRestrictModule.sol:CountryRestrictModule" },
        { name: "MaxBalanceModule Implementation", address: deployment.implementations.MaxBalanceModule, args: [], contract: "contracts/compliance/modular/MaxBalanceModule.sol:MaxBalanceModule" },
        { name: "TransferLimitModule Implementation", address: deployment.implementations.TransferLimitModule, args: [], contract: "contracts/compliance/modular/TransferLimitModule.sol:TransferLimitModule" },
        { name: "TokenFactory Implementation", address: deployment.implementations.FinatradesTokenFactory, args: [], contract: "contracts/factory/FinatradesTokenFactory.sol:FinatradesTokenFactory" },
        
        // Verify token implementations for factory
        { name: "ERC-20 Factory Implementation", address: deployment.tokenImplementations.Token, args: [], contract: "contracts/token/Token.sol:Token" },
        { name: "ERC-721 Factory Implementation", address: deployment.tokenImplementations.FinatradesNFT, args: [], contract: "contracts/token/FinatradesNFT.sol:FinatradesNFT" },
        { name: "ERC-1155 Factory Implementation", address: deployment.tokenImplementations.FinatradesMultiToken, args: [], contract: "contracts/token/FinatradesMultiToken.sol:FinatradesMultiToken" },
        
        // Verify timelock (non-proxy)
        {
            name: "FinatradesTimelock",
            address: deployment.contracts.FinatradesTimelock,
            args: [172800, [deployment.adminAddress], [deployment.adminAddress], deployment.adminAddress],
            contract: "contracts/governance/FinatradesTimelock.sol:FinatradesTimelock"
        }
    ];

    console.log("\nStarting verification of", verificationTasks.length, "contracts...\n");
    
    let verified = 0;
    let failed = 0;
    let alreadyVerified = 0;

    for (const task of verificationTasks) {
        try {
            console.log(`Verifying ${task.name}...`);
            await run("verify:verify", {
                address: task.address,
                constructorArguments: task.args,
                contract: task.contract
            });
            console.log(`✅ ${task.name} verified successfully`);
            verified++;
        } catch (error) {
            if (error.message.includes("already verified")) {
                console.log(`✅ ${task.name} already verified`);
                alreadyVerified++;
            } else {
                console.log(`❌ Failed to verify ${task.name}:`, error.message);
                failed++;
            }
        }
    }

    console.log("\n=== Verification Summary ===");
    console.log(`✅ Successfully verified: ${verified}`);
    console.log(`✅ Already verified: ${alreadyVerified}`);
    console.log(`❌ Failed to verify: ${failed}`);
    console.log(`Total: ${verificationTasks.length}`);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });