const { run } = require("hardhat");

async function verifyContract(address, contractName, constructorArgs = []) {
    try {
        console.log(`\n🔍 Verifying ${contractName} at ${address}...`);
        await run("verify:verify", {
            address: address,
            constructorArguments: constructorArgs,
            contract: contractName
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
    console.log("🚀 VERIFYING PROXY CONTRACTS ON POLYGONSCAN\n");
    
    // Proxy contracts to verify
    const proxies = [
        {
            name: "Token Proxy",
            address: "0xED1c85A48EcD10654eD075F63F554cB3ac7faf6c",
            contract: "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol:ERC1967Proxy",
            args: [
                "0x8C5DA9118B70A23b01451Bc6f0baEc9A41Aa6A12", // implementation
                "0x" // init data (would be the actual encoded data)
            ]
        },
        {
            name: "ModularCompliance Proxy",
            address: "0x123A014c135417b58BB3e04A5711C8F126cA95E8",
            contract: "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol:ERC1967Proxy",
            args: [
                "0xca244a40FEd494075195b9632c75377ccFB7C8ff", // implementation
                "0x" // init data
            ]
        },
        {
            name: "AssetRegistry Proxy",
            address: "0x4717bED7008bc5aF62b3b91a29aaa24Bab034038",
            contract: "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol:ERC1967Proxy",
            args: [
                "0xBe125EFCBCeB60EC5Bf38e00158999E8Eb359347", // implementation
                "0x" // init data
            ]
        },
        {
            name: "RegulatoryReporting Proxy",
            address: "0xcd5fC2E20D697394d66e30475981bA5F37fD160e",
            contract: "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol:ERC1967Proxy",
            args: [
                "0xe4da869B9C55120aeAFc3c1e21d2C413531F18B2", // implementation
                "0x" // init data
            ]
        },
        {
            name: "CountryRestrictModule Proxy",
            address: "0x934b1C1AD4d205517B1a09A984c3F077cd99651A",
            contract: "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol:ERC1967Proxy",
            args: [
                "0xb9a74E93E9Ee80C083F256fbCA24929fF48cab60", // implementation
                "0x" // init data
            ]
        },
        {
            name: "MaxBalanceModule Proxy",
            address: "0x77B6c7aBB74653F1F48ac6Ebd1154532D13c41b3",
            contract: "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol:ERC1967Proxy",
            args: [
                "0xcab5474536C676b62e6bF1aDeb48CE0092c62d00", // implementation
                "0x" // init data
            ]
        },
        {
            name: "TransferLimitModule Proxy",
            address: "0x6887c6c45B64C6E6D55dFADb2a4857C5DAD63D57",
            contract: "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol:ERC1967Proxy",
            args: [
                "0x9fF75c5cE984849224a865f44e0d5bE9BeA12e0A", // implementation
                "0x" // init data
            ]
        }
    ];
    
    // Timelock contract
    const timelock = {
        name: "FinatradesTimelock",
        address: "0xf98Ee2EE41Ee008AEc3A17a87E06Aa0Dc4Cd38e4",
        contract: "contracts/governance/FinatradesTimelock.sol:FinatradesTimelock",
        args: [
            2 * 24 * 60 * 60, // 48 hours
            ["0xCE982AC6bc316Cf9d875652B84C7626B62a899eA", "0x0000000000000000000000000000000000000001"], // proposers
            ["0xCE982AC6bc316Cf9d875652B84C7626B62a899eA"], // executors
            "0xCE982AC6bc316Cf9d875652B84C7626B62a899eA" // admin
        ]
    };
    
    console.log("📋 Contracts to verify:");
    console.log(`- ${proxies.length} Proxy contracts`);
    console.log("- 1 Timelock contract");
    console.log(`Total: ${proxies.length + 1} contracts\n`);
    
    let verified = 0;
    let failed = 0;
    
    // Verify proxies
    console.log("=== VERIFYING PROXY CONTRACTS ===");
    for (const proxy of proxies) {
        const result = await verifyContract(proxy.address, proxy.contract, proxy.args);
        if (result) verified++;
        else failed++;
        
        // Wait a bit between verifications to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 3000));
    }
    
    // Verify timelock
    console.log("\n=== VERIFYING TIMELOCK ===");
    const timelockResult = await verifyContract(timelock.address, timelock.contract, timelock.args);
    if (timelockResult) verified++;
    else failed++;
    
    // Summary
    console.log("\n📊 VERIFICATION SUMMARY");
    console.log("════════════════════════════════════════");
    console.log(`Total contracts: ${proxies.length + 1}`);
    console.log(`✅ Verified: ${verified}`);
    console.log(`❌ Failed: ${failed}`);
    console.log("════════════════════════════════════════");
    
    if (failed > 0) {
        console.log("\n⚠️ Some verifications failed. For proxy contracts, this is often because:");
        console.log("1. Polygonscan auto-verifies proxies when implementations are verified");
        console.log("2. The init data parameter needs the exact encoded initialization data");
        console.log("\nYou can verify them manually on Polygonscan using:");
        console.log("- Contract: ERC1967Proxy");
        console.log("- Constructor args: implementation address + encoded init data");
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });