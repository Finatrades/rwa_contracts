const { run } = require("hardhat");

async function verifyContract(address, contractName) {
    try {
        console.log(`\n🔍 Verifying ${contractName} at ${address}...`);
        await run("verify:verify", {
            address: address,
            constructorArguments: [] // All implementations have no constructor args
        });
        console.log(`✅ ${contractName} verified!`);
        return true;
    } catch (error) {
        if (error.message.includes("Already Verified")) {
            console.log(`✅ ${contractName} already verified`);
            return true;
        } else {
            console.log(`❌ Failed: ${error.message.split('\n')[0]}`);
            return false;
        }
    }
}

async function main() {
    console.log("🚀 VERIFYING IMPLEMENTATION CONTRACTS\n");
    
    const implementations = [
        { name: "ClaimTopicsRegistry", address: "0x2DEF12D0C8448DD8866AcFD839aDbFE07b5C7A15" },
        { name: "IdentityRegistry", address: "0x0BD1A2EdF1FCd608fC0537f6268E2b9c565a58B8" },
        { name: "CountryRestrictModule", address: "0xb9a74E93E9Ee80C083F256fbCA24929fF48cab60" },
        { name: "MaxBalanceModule", address: "0xcab5474536C676b62e6bF1aDeb48CE0092c62d00" },
        { name: "TransferLimitModule", address: "0x9fF75c5cE984849224a865f44e0d5bE9BeA12e0A" },
        { name: "ModularCompliance", address: "0xca244a40FEd494075195b9632c75377ccFB7C8ff" },
        { name: "AssetRegistry", address: "0xBe125EFCBCeB60EC5Bf38e00158999E8Eb359347" },
        { name: "Token", address: "0x8C5DA9118B70A23b01451Bc6f0baEc9A41Aa6A12" },
        { name: "RegulatoryReportingOptimized", address: "0xe4da869B9C55120aeAFc3c1e21d2C413531F18B2" }
    ];
    
    // Timelock
    const timelock = {
        name: "FinatradesTimelock",
        address: "0xf98Ee2EE41Ee008AEc3A17a87E06Aa0Dc4Cd38e4"
    };
    
    let verified = 0;
    let failed = 0;
    
    // Verify implementations
    for (const impl of implementations) {
        const result = await verifyContract(impl.address, impl.name);
        if (result) verified++;
        else failed++;
        
        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 2000));
    }
    
    // Verify timelock with constructor args
    console.log(`\n🔍 Verifying ${timelock.name} at ${timelock.address}...`);
    try {
        await run("verify:verify", {
            address: timelock.address,
            constructorArguments: [
                2 * 24 * 60 * 60, // 48 hours
                ["0xCE982AC6bc316Cf9d875652B84C7626B62a899eA", "0x0000000000000000000000000000000000000001"],
                ["0xCE982AC6bc316Cf9d875652B84C7626B62a899eA"],
                "0xCE982AC6bc316Cf9d875652B84C7626B62a899eA"
            ]
        });
        console.log(`✅ ${timelock.name} verified!`);
        verified++;
    } catch (error) {
        if (error.message.includes("Already Verified")) {
            console.log(`✅ ${timelock.name} already verified`);
            verified++;
        } else {
            console.log(`❌ Failed: ${error.message.split('\n')[0]}`);
            failed++;
        }
    }
    
    // Summary
    console.log("\n📊 VERIFICATION SUMMARY");
    console.log("════════════════════════════════════════");
    console.log(`Total: ${implementations.length + 1}`);
    console.log(`✅ Verified: ${verified}`);
    console.log(`❌ Failed: ${failed}`);
    console.log("════════════════════════════════════════");
    
    console.log("\n📝 NOTES:");
    console.log("- Implementation contracts should be verified first");
    console.log("- Proxy contracts often auto-verify when implementations are verified");
    console.log("- You can check verification status on Polygonscan");
    
    console.log("\n🔗 Check these addresses on Polygonscan:");
    console.log("Token: https://polygonscan.com/address/0xED1c85A48EcD10654eD075F63F554cB3ac7faf6c");
    console.log("ModularCompliance: https://polygonscan.com/address/0x123A014c135417b58BB3e04A5711C8F126cA95E8");
    console.log("AssetRegistry: https://polygonscan.com/address/0x4717bED7008bc5aF62b3b91a29aaa24Bab034038");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });