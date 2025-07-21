const { run } = require("hardhat");

async function verifyImplementation(address, contractPath) {
    try {
        console.log(`\n🔍 Verifying ${contractPath} at ${address}...`);
        await run("verify:verify", {
            address: address,
            contract: contractPath,
            constructorArguments: []
        });
        console.log(`✅ Verified!`);
        return true;
    } catch (error) {
        if (error.message.includes("Already Verified")) {
            console.log(`✅ Already verified`);
            return true;
        } else {
            console.log(`❌ Failed: ${error.message.split('\n')[0]}`);
            return false;
        }
    }
}

async function main() {
    console.log("🚀 VERIFYING CONTRACTS ONE BY ONE\n");
    
    const contracts = [
        // Implementation contracts
        {
            address: "0x2DEF12D0C8448DD8866AcFD839aDbFE07b5C7A15",
            path: "contracts/registry/ClaimTopicsRegistry.sol:ClaimTopicsRegistry"
        },
        {
            address: "0x0BD1A2EdF1FCd608fC0537f6268E2b9c565a58B8",
            path: "contracts/registry/IdentityRegistry.sol:IdentityRegistry"
        },
        {
            address: "0xb9a74E93E9Ee80C083F256fbCA24929fF48cab60",
            path: "contracts/compliance/modular/CountryRestrictModule.sol:CountryRestrictModule"
        },
        {
            address: "0xcab5474536C676b62e6bF1aDeb48CE0092c62d00",
            path: "contracts/compliance/modular/MaxBalanceModule.sol:MaxBalanceModule"
        },
        {
            address: "0x9fF75c5cE984849224a865f44e0d5bE9BeA12e0A",
            path: "contracts/compliance/modular/TransferLimitModule.sol:TransferLimitModule"
        },
        {
            address: "0xca244a40FEd494075195b9632c75377ccFB7C8ff",
            path: "contracts/compliance/ModularCompliance.sol:ModularCompliance"
        },
        {
            address: "0xBe125EFCBCeB60EC5Bf38e00158999E8Eb359347",
            path: "contracts/registry/AssetRegistry.sol:AssetRegistry"
        },
        {
            address: "0x8C5DA9118B70A23b01451Bc6f0baEc9A41Aa6A12",
            path: "contracts/token/Token.sol:Token"
        },
        {
            address: "0xe4da869B9C55120aeAFc3c1e21d2C413531F18B2",
            path: "contracts/reporting/RegulatoryReportingOptimized.sol:RegulatoryReportingOptimized"
        }
    ];
    
    // Process each contract
    console.log(`Processing ${contracts.length} implementation contracts...\n`);
    
    for (let i = 0; i < contracts.length; i++) {
        const contract = contracts[i];
        console.log(`[${i + 1}/${contracts.length}] ${contract.path}`);
        await verifyImplementation(contract.address, contract.path);
        
        // Wait between verifications
        if (i < contracts.length - 1) {
            console.log("⏳ Waiting 3 seconds...");
            await new Promise(resolve => setTimeout(resolve, 3000));
        }
    }
    
    // Verify Timelock
    console.log("\n🔍 Verifying Timelock contract...");
    try {
        await run("verify:verify", {
            address: "0xf98Ee2EE41Ee008AEc3A17a87E06Aa0Dc4Cd38e4",
            contract: "contracts/governance/FinatradesTimelock.sol:FinatradesTimelock",
            constructorArguments: [
                172800, // 48 hours in seconds
                ["0xCE982AC6bc316Cf9d875652B84C7626B62a899eA", "0x0000000000000000000000000000000000000001"],
                ["0xCE982AC6bc316Cf9d875652B84C7626B62a899eA"],
                "0xCE982AC6bc316Cf9d875652B84C7626B62a899eA"
            ]
        });
        console.log("✅ Timelock verified!");
    } catch (error) {
        if (error.message.includes("Already Verified")) {
            console.log("✅ Timelock already verified");
        } else {
            console.log(`❌ Timelock failed: ${error.message.split('\n')[0]}`);
        }
    }
    
    console.log("\n✅ VERIFICATION COMPLETE!");
    console.log("\n📝 NOTE: Proxy contracts typically show as unverified but work correctly.");
    console.log("Polygonscan recognizes them as proxies and shows the implementation code.");
    
    console.log("\n🔗 View contracts on Polygonscan:");
    console.log("Token: https://polygonscan.com/address/0xED1c85A48EcD10654eD075F63F554cB3ac7faf6c#code");
    console.log("ModularCompliance: https://polygonscan.com/address/0x123A014c135417b58BB3e04A5711C8F126cA95E8#code");
    console.log("AssetRegistry: https://polygonscan.com/address/0x4717bED7008bc5aF62b3b91a29aaa24Bab034038#code");
    console.log("Timelock: https://polygonscan.com/address/0xf98Ee2EE41Ee008AEc3A17a87E06Aa0Dc4Cd38e4#code");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });