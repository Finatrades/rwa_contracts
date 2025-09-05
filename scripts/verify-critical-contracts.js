const { run } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
    console.log("\n=== Verifying Critical Contracts on Polygonscan ===\n");
    
    // Load deployment data
    const deploymentPath = path.join(__dirname, "..", "deployments", "polygon_deployment_1756259748697.json");
    const deployment = JSON.parse(fs.readFileSync(deploymentPath, 'utf8'));
    
    // Focus on the most critical contracts
    const criticalContracts = [
        // Main Token Implementation
        {
            name: "Token Implementation",
            address: deployment.implementations.Token,
            constructorArgs: []
        },
        // Identity Registry Implementation
        {
            name: "IdentityRegistry Implementation", 
            address: deployment.implementations.IdentityRegistry,
            constructorArgs: []
        },
        // Asset Registry Implementation
        {
            name: "AssetRegistry Implementation",
            address: deployment.implementations.AssetRegistry,
            constructorArgs: []
        },
        // Token Factory Implementation
        {
            name: "TokenFactory Implementation",
            address: deployment.implementations.FinatradesTokenFactory,
            constructorArgs: []
        },
        // Compliance Implementation
        {
            name: "ModularCompliance Implementation",
            address: deployment.implementations.ModularCompliance,
            constructorArgs: []
        },
        // ERC-1155 Implementation
        {
            name: "ERC-1155 MultiToken",
            address: deployment.tokenImplementations.FinatradesMultiToken,
            constructorArgs: []
        },
        // ERC-721 Implementation
        {
            name: "ERC-721 NFT",
            address: deployment.tokenImplementations.FinatradesNFT,
            constructorArgs: []
        },
        // Timelock (non-proxy)
        {
            name: "FinatradesTimelock",
            address: deployment.contracts.FinatradesTimelock,
            constructorArgs: [
                172800,
                [deployment.adminAddress, deployment.adminAddress],
                [deployment.adminAddress, deployment.adminAddress],
                deployment.adminAddress
            ]
        }
    ];
    
    console.log(`Verifying ${criticalContracts.length} critical contracts...\n`);
    
    let verified = 0;
    let alreadyVerified = 0;
    let failed = 0;
    
    for (const contract of criticalContracts) {
        try {
            console.log(`\nVerifying ${contract.name}...`);
            console.log(`Address: ${contract.address}`);
            
            await run("verify:verify", {
                address: contract.address,
                constructorArguments: contract.constructorArgs
            });
            
            console.log(`✅ ${contract.name} verified successfully`);
            console.log(`   View at: https://polygonscan.com/address/${contract.address}#code`);
            verified++;
            
        } catch (error) {
            if (error.message.includes("already verified")) {
                console.log(`✅ ${contract.name} already verified`);
                console.log(`   View at: https://polygonscan.com/address/${contract.address}#code`);
                alreadyVerified++;
            } else {
                console.log(`❌ Failed to verify ${contract.name}`);
                console.log(`   Error: ${error.message}`);
                failed++;
            }
        }
        
        // Wait between verifications to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 5000));
    }
    
    console.log("\n========================================");
    console.log("=== VERIFICATION SUMMARY ===");
    console.log("========================================\n");
    
    console.log(`✅ Newly verified: ${verified}`);
    console.log(`✅ Already verified: ${alreadyVerified}`);
    console.log(`❌ Failed: ${failed}`);
    console.log(`📊 Total: ${criticalContracts.length}`);
    
    const successRate = ((verified + alreadyVerified) / criticalContracts.length * 100).toFixed(0);
    console.log(`\n🎯 Success Rate: ${successRate}%`);
    
    if (failed === 0) {
        console.log("\n🎉 All critical contracts are verified!");
    } else {
        console.log(`\n⚠️  ${failed} contracts need manual verification`);
    }
    
    console.log("\n=== IMPORTANT LINKS ===");
    console.log("\nMain User-Facing Contracts:");
    console.log(`Token: https://polygonscan.com/address/${deployment.contracts.Token}#code`);
    console.log(`AssetRegistry: https://polygonscan.com/address/${deployment.contracts.AssetRegistry}#code`);
    console.log(`TokenFactory: https://polygonscan.com/address/${deployment.contracts.FinatradesTokenFactory}#code`);
    console.log(`IdentityRegistry: https://polygonscan.com/address/${deployment.contracts.IdentityRegistry}#code`);
}

main()
    .then(() => {
        console.log("\n✅ Verification script completed");
        process.exit(0);
    })
    .catch((error) => {
        console.error("\n❌ Script error:", error);
        process.exit(1);
    });