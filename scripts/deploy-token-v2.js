const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
    console.log("🚀 DEPLOYING TOKEN V2 AND REGULATORY REPORTING\n");
    
    const [deployer] = await ethers.getSigners();
    
    console.log("📍 Network: Polygon Mainnet");
    console.log("🔑 Deployer:", deployer.address);
    console.log("💰 Balance:", ethers.formatEther(await deployer.provider.getBalance(deployer.address)), "MATIC");
    
    // Current deployed contracts
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
            AssetRegistry: "0x4717bED7008bc5aF62b3b91a29aaa24Bab034038",
            FinatradesTimelock: "0xf98Ee2EE41Ee008AEc3A17a87E06Aa0Dc4Cd38e4"
        },
        implementations: {
            ClaimTopicsRegistry: "0x2DEF12D0C8448DD8866AcFD839aDbFE07b5C7A15",
            IdentityRegistry: "0x0BD1A2EdF1FCd608fC0537f6268E2b9c565a58B8",
            CountryRestrictModule: "0xb9a74E93E9Ee80C083F256fbCA24929fF48cab60",
            MaxBalanceModule: "0xcab5474536C676b62e6bF1aDeb48CE0092c62d00",
            TransferLimitModule: "0x9fF75c5cE984849224a865f44e0d5bE9BeA12e0A",
            ModularCompliance: "0xca244a40FEd494075195b9632c75377ccFB7C8ff",
            AssetRegistry: "0xBe125EFCBCeB60EC5Bf38e00158999E8Eb359347"
        }
    };
    
    console.log("\n✅ Already deployed (8/10)");
    
    try {
        const ERC1967Proxy = await ethers.getContractFactory("@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol:ERC1967Proxy");
        
        // Deploy Token (base version that fits size limit)
        console.log("\n=== [9/10] Token (Size-Optimized) ===");
        const Token = await ethers.getContractFactory("Token");
        
        console.log("Deploying token implementation...");
        const tokenImpl = await Token.deploy();
        await tokenImpl.waitForDeployment();
        deployment.implementations.Token = await tokenImpl.getAddress();
        console.log("✅ Implementation:", deployment.implementations.Token);
        await tokenImpl.deploymentTransaction().wait(3);
        
        console.log("Deploying token proxy...");
        const tokenInitData = Token.interface.encodeFunctionData("initialize", [
            deployer.address, // admin
            "Finatrades RWA Token", // name
            "FRWA", // symbol
            18, // decimals
            deployment.contracts.IdentityRegistry, // identity registry
            deployment.contracts.ModularCompliance // compliance
        ]);
        const tokenProxy = await ERC1967Proxy.deploy(
            deployment.implementations.Token, 
            tokenInitData
        );
        await tokenProxy.waitForDeployment();
        deployment.contracts.Token = await tokenProxy.getAddress();
        console.log("✅ Proxy:", deployment.contracts.Token);
        await tokenProxy.deploymentTransaction().wait(3);
        
        // Deploy RegulatoryReporting
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
            deployment.contracts.Token,
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
        
        // Configure contracts
        console.log("\n⚙️ CONFIGURING CONTRACTS...");
        
        const modularCompliance = await ethers.getContractAt("ModularCompliance", deployment.contracts.ModularCompliance);
        const token = await ethers.getContractAt("Token", deployment.contracts.Token);
        
        // Check if token is already bound
        const boundToken = await modularCompliance.tokenBound();
        if (boundToken === ethers.ZeroAddress) {
            console.log("Setting token in compliance...");
            await (await modularCompliance.setTokenBound(deployment.contracts.Token)).wait(3);
            console.log("✅ Token bound");
            
            // Add modules
            console.log("Adding compliance modules...");
            await (await modularCompliance.addModule(deployment.contracts.CountryRestrictModule)).wait(3);
            console.log("✅ CountryRestrictModule added");
            
            await (await modularCompliance.addModule(deployment.contracts.MaxBalanceModule)).wait(3);
            console.log("✅ MaxBalanceModule added");
            
            await (await modularCompliance.addModule(deployment.contracts.TransferLimitModule)).wait(3);
            console.log("✅ TransferLimitModule added");
        } else {
            console.log("⚠️ Token already bound to:", boundToken);
        }
        
        console.log("\nGranting roles...");
        
        // Grant roles on Token
        const AGENT_ROLE = ethers.id("AGENT_ROLE");
        const hasAgentRole = await token.hasRole(AGENT_ROLE, deployer.address);
        if (!hasAgentRole) {
            await (await token.grantRole(AGENT_ROLE, deployer.address)).wait(3);
            console.log("✅ AGENT_ROLE granted on Token");
        }
        
        // Grant roles on AssetRegistry
        const assetRegistry = await ethers.getContractAt("AssetRegistry", deployment.contracts.AssetRegistry);
        const ASSET_MANAGER_ROLE = await assetRegistry.ASSET_MANAGER_ROLE();
        const hasAssetRole = await assetRegistry.hasRole(ASSET_MANAGER_ROLE, deployer.address);
        if (!hasAssetRole) {
            await (await assetRegistry.grantRole(ASSET_MANAGER_ROLE, deployer.address)).wait(3);
            console.log("✅ ASSET_MANAGER_ROLE granted on AssetRegistry");
        }
        
        // Authorize token in asset registry
        console.log("\nAuthorizing token in AssetRegistry...");
        await (await assetRegistry.authorizeTokenContract(deployment.contracts.Token, true)).wait(3);
        console.log("✅ Token authorized in AssetRegistry");
        
        // Save deployment
        const deploymentPath = path.join(__dirname, '../deployments');
        const deploymentForSave = JSON.parse(JSON.stringify(deployment, (key, value) =>
            typeof value === 'bigint' ? value.toString() : value
        ));
        
        fs.writeFileSync(
            path.join(deploymentPath, 'polygon_mainnet_complete.json'),
            JSON.stringify(deploymentForSave, null, 2)
        );
        
        // Update README
        console.log("\n📝 Updating README...");
        const readmePath = path.join(__dirname, '../README.md');
        let readme = fs.readFileSync(readmePath, 'utf8');
        
        const deployedSection = `## Deployed Contracts (Polygon Mainnet)

### ✅ Deployment Status: COMPLETE

All contracts have been successfully deployed on Polygon Mainnet.

#### Main Contracts

| Contract | Address | Description |
|----------|---------|-------------|
| **Token** | [\`${deployment.contracts.Token}\`](https://polygonscan.com/address/${deployment.contracts.Token}) | ERC-3643 compliant security token |
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
| **FinatradesTimelock** | [\`${deployment.contracts.FinatradesTimelock}\`](https://polygonscan.com/address/${deployment.contracts.FinatradesTimelock}) | 48-hour timelock for governance |

#### Implementation Addresses

All upgradeable contracts use the UUPS pattern:

| Contract | Implementation |
|----------|----------------|
| ClaimTopicsRegistry | \`${deployment.implementations.ClaimTopicsRegistry}\` |
| IdentityRegistry | \`${deployment.implementations.IdentityRegistry}\` |
| CountryRestrictModule | \`${deployment.implementations.CountryRestrictModule}\` |
| MaxBalanceModule | \`${deployment.implementations.MaxBalanceModule}\` |
| TransferLimitModule | \`${deployment.implementations.TransferLimitModule}\` |
| ModularCompliance | \`${deployment.implementations.ModularCompliance}\` |
| AssetRegistry | \`${deployment.implementations.AssetRegistry}\` |
| Token | \`${deployment.implementations.Token}\` |
| RegulatoryReportingOptimized | \`${deployment.implementations.RegulatoryReportingOptimized}\` |

### ABI Files Location

All contract ABIs are located in the \`artifacts/contracts/\` directory:

- Token ABI: \`artifacts/contracts/token/Token.sol/Token.json\`
- Registry ABIs: \`artifacts/contracts/registry/\`
- Compliance ABIs: \`artifacts/contracts/compliance/\`
- Reporting ABI: \`artifacts/contracts/reporting/RegulatoryReportingOptimized.sol/\`

### Contract Functionality

#### Token Contract
- ERC-3643 compliant security token
- Implements ERC-20 with transfer restrictions
- Integrated with IdentityRegistry for KYC checks
- Integrated with ModularCompliance for compliance rules
- Supports minting, burning, freezing, and pausing
- Recovery address functionality for lost tokens

#### IdentityRegistry
- Manages on-chain identities
- Links wallet addresses to identity contracts
- Supports identity verification claims
- Role-based access control

#### ModularCompliance
- Orchestrates compliance modules
- Checks transfer eligibility
- Supports adding/removing modules dynamically
- Each module implements specific compliance rules

#### AssetRegistry
- Universal registry for any type of RWA
- Flexible attribute system
- Asset lifecycle management
- Revenue stream tracking
- Supports multiple asset categories

#### RegulatoryReportingOptimized
- Automated regulatory reporting
- Transaction monitoring
- Holder statistics
- Compliance metrics
- Gas-optimized implementation

### Security Features

1. **Access Control**: Role-based permissions across all contracts
2. **Upgradeability**: UUPS proxy pattern for future updates
3. **Pausability**: Emergency pause functionality
4. **Reentrancy Protection**: Guards against reentrancy attacks
5. **Compliance**: Built-in compliance checks for all transfers`;
        
        readme = readme.replace(/## Deployed Contracts.*?(?=##|$)/s, deployedSection + '\n\n');
        fs.writeFileSync(readmePath, readme);
        console.log("✅ README updated");
        
        // Final summary
        console.log("\n🎉 ALL 10 CONTRACTS DEPLOYED SUCCESSFULLY!");
        console.log("\n📋 CONTRACT ADDRESSES:");
        console.log("════════════════════════════════════════════════════════════════");
        Object.entries(deployment.contracts).forEach(([name, address]) => {
            console.log(`${name.padEnd(35)} ${address}`);
        });
        console.log("════════════════════════════════════════════════════════════════");
        
        const finalBalance = await deployer.provider.getBalance(deployer.address);
        console.log("\n💰 Final balance:", ethers.formatEther(finalBalance), "MATIC");
        
        console.log("\n✅ DEPLOYMENT COMPLETE!");
        console.log("✅ CONFIGURATION COMPLETE!");
        console.log("✅ README UPDATED!");
        
        console.log("\n📝 NOTES:");
        console.log("- Using Token contract (base version) to fit size limits");
        console.log("- All contracts are upgradeable via UUPS pattern");
        console.log("- Timelock has 48-hour delay for governance actions");
        console.log("\n🔍 Next: Run verification script to verify all contracts on Polygonscan");
        
    } catch (error) {
        console.error("\n❌ Deployment failed:", error.message);
        
        // Save partial deployment
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