const { ethers, run } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function verifyContract(address, contractName, constructorArgs = []) {
    try {
        console.log(`\n🔍 Verifying ${contractName} at ${address}...`);
        await run("verify:verify", {
            address: address,
            constructorArguments: constructorArgs
        });
        console.log(`✅ ${contractName} verified successfully!`);
        return true;
    } catch (error) {
        if (error.message.includes("Already Verified")) {
            console.log(`✅ ${contractName} is already verified`);
            return true;
        } else {
            console.log(`❌ Failed to verify ${contractName}: ${error.message.split('\n')[0]}`);
            return false;
        }
    }
}

async function main() {
    console.log("🚀 VERIFICATION SCRIPT - Checking all deployed contracts\n");
    
    const [deployer] = await ethers.getSigners();
    console.log("📍 Network: Polygon Mainnet");
    console.log("🔑 Deployer:", deployer.address);
    
    // Real deployed contracts from partial deployment file
    const deployedContracts = {
        proxies: {
            "ClaimTopicsRegistry": "0x6Ec58c34DF899Ff9d67FD088Cd339bB75508Dd79",
            "IdentityRegistry": "0x25150414235289c688473340548698B5764651E3",
            "CountryRestrictModule": "0x934b1C1AD4d205517B1a09A984c3F077cd99651A",
            "MaxBalanceModule": "0x77B6c7aBB74653F1F48ac6Ebd1154532D13c41b3",
            "TransferLimitModule": "0x6887c6c45B64C6E6D55dFADb2a4857C5DAD63D57",
            "ModularCompliance": "0x123A014c135417b58BB3e04A5711C8F126cA95E8"
        },
        implementations: {
            "ClaimTopicsRegistry": "0x2DEF12D0C8448DD8866AcFD839aDbFE07b5C7A15",
            "IdentityRegistry": "0x0BD1A2EdF1FCd608fC0537f6268E2b9c565a58B8",
            "CountryRestrictModule": "0xb9a74E93E9Ee80C083F256fbCA24929fF48cab60",
            "MaxBalanceModule": "0xcab5474536C676b62e6bF1aDeb48CE0092c62d00",
            "TransferLimitModule": "0x9fF75c5cE984849224a865f44e0d5bE9BeA12e0A",
            "ModularCompliance": "0xca244a40FEd494075195b9632c75377ccFB7C8ff",
            "AssetRegistry": "0x63CFf0d3ec6F14d2e43C372a541837223fc8BFe8"
        }
    };
    
    console.log("\n📋 Checking deployed contracts on-chain...");
    
    // Check which contracts are actually deployed
    const actuallyDeployed = {};
    for (const [name, address] of Object.entries(deployedContracts.proxies)) {
        const code = await deployer.provider.getCode(address);
        if (code !== "0x") {
            actuallyDeployed[name] = address;
            console.log(`✅ ${name} proxy deployed at ${address}`);
        } else {
            console.log(`❌ ${name} proxy NOT found at ${address}`);
        }
    }
    
    console.log("\n📋 Checking implementation contracts...");
    const actualImplementations = {};
    for (const [name, address] of Object.entries(deployedContracts.implementations)) {
        const code = await deployer.provider.getCode(address);
        if (code !== "0x") {
            actualImplementations[name] = address;
            console.log(`✅ ${name} implementation at ${address}`);
        } else {
            console.log(`❌ ${name} implementation NOT found at ${address}`);
        }
    }
    
    // Verify all implementation contracts
    console.log("\n🔍 Starting verification of all implementation contracts...");
    
    const verificationResults = {
        verified: [],
        failed: []
    };
    
    // Verify implementations (no constructor args for UUPS implementations)
    for (const [name, address] of Object.entries(actualImplementations)) {
        const result = await verifyContract(address, `${name} Implementation`);
        if (result) {
            verificationResults.verified.push(name);
        } else {
            verificationResults.failed.push(name);
        }
    }
    
    // Special case: AssetRegistry proxy if it was deployed
    const assetProxyAddress = "0x18E44f588a4DcF2F7145d35A5C226e129040b6D3";
    const assetProxyCode = await deployer.provider.getCode(assetProxyAddress);
    if (assetProxyCode !== "0x") {
        console.log(`\n✅ Found AssetRegistry proxy at ${assetProxyAddress}`);
        actuallyDeployed["AssetRegistry"] = assetProxyAddress;
    }
    
    // Save verification report
    const report = {
        network: "polygon",
        chainId: 137,
        timestamp: new Date().toISOString(),
        deployedProxies: actuallyDeployed,
        deployedImplementations: actualImplementations,
        verificationResults: verificationResults,
        summary: {
            totalProxies: Object.keys(actuallyDeployed).length,
            totalImplementations: Object.keys(actualImplementations).length,
            verified: verificationResults.verified.length,
            failed: verificationResults.failed.length
        }
    };
    
    const reportPath = path.join(__dirname, '../deployments/verification_report.json');
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    
    // Summary
    console.log("\n📊 VERIFICATION SUMMARY");
    console.log("════════════════════════════════════════");
    console.log(`Total Proxies Deployed: ${report.summary.totalProxies}`);
    console.log(`Total Implementations: ${report.summary.totalImplementations}`);
    console.log(`Successfully Verified: ${report.summary.verified}`);
    console.log(`Failed Verifications: ${report.summary.failed}`);
    console.log("════════════════════════════════════════");
    
    if (verificationResults.failed.length > 0) {
        console.log("\n⚠️ Failed verifications:");
        verificationResults.failed.forEach(name => {
            console.log(`  - ${name}`);
        });
    }
    
    console.log(`\n📄 Full report saved to: ${reportPath}`);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });