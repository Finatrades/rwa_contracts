const { ethers } = require("hardhat");

async function checkVerificationStatus() {
    console.log("🔍 CHECKING CONTRACT VERIFICATION STATUS ON POLYGONSCAN\n");
    
    const contracts = [
        { name: "Token Proxy", address: "0xED1c85A48EcD10654eD075F63F554cB3ac7faf6c" },
        { name: "ModularCompliance Proxy", address: "0x123A014c135417b58BB3e04A5711C8F126cA95E8" },
        { name: "AssetRegistry Proxy", address: "0x4717bED7008bc5aF62b3b91a29aaa24Bab034038" },
        { name: "RegulatoryReporting Proxy", address: "0xcd5fC2E20D697394d66e30475981bA5F37fD160e" },
        { name: "CountryRestrictModule Proxy", address: "0x934b1C1AD4d205517B1a09A984c3F077cd99651A" },
        { name: "MaxBalanceModule Proxy", address: "0x77B6c7aBB74653F1F48ac6Ebd1154532D13c41b3" },
        { name: "TransferLimitModule Proxy", address: "0x6887c6c45B64C6E6D55dFADb2a4857C5DAD63D57" },
        { name: "FinatradesTimelock", address: "0xf98Ee2EE41Ee008AEc3A17a87E06Aa0Dc4Cd38e4" }
    ];
    
    const implementations = [
        { name: "Token Implementation", address: "0x8C5DA9118B70A23b01451Bc6f0baEc9A41Aa6A12" },
        { name: "ModularCompliance Implementation", address: "0xca244a40FEd494075195b9632c75377ccFB7C8ff" },
        { name: "AssetRegistry Implementation", address: "0xBe125EFCBCeB60EC5Bf38e00158999E8Eb359347" },
        { name: "RegulatoryReporting Implementation", address: "0xe4da869B9C55120aeAFc3c1e21d2C413531F18B2" },
        { name: "CountryRestrictModule Implementation", address: "0xb9a74E93E9Ee80C083F256fbCA24929fF48cab60" },
        { name: "MaxBalanceModule Implementation", address: "0xcab5474536C676b62e6bF1aDeb48CE0092c62d00" },
        { name: "TransferLimitModule Implementation", address: "0x9fF75c5cE984849224a865f44e0d5bE9BeA12e0A" },
        { name: "ClaimTopicsRegistry Implementation", address: "0x2DEF12D0C8448DD8866AcFD839aDbFE07b5C7A15" },
        { name: "IdentityRegistry Implementation", address: "0x0BD1A2EdF1FCd608fC0537f6268E2b9c565a58B8" }
    ];
    
    console.log("📋 PROXY CONTRACTS:");
    console.log("══════════════════════════════════════════════════════════");
    for (const contract of contracts) {
        console.log(`${contract.name}:`);
        console.log(`Address: ${contract.address}`);
        console.log(`URL: https://polygonscan.com/address/${contract.address}#code`);
        console.log("──────────────────────────────────────────────────────────");
    }
    
    console.log("\n📋 IMPLEMENTATION CONTRACTS:");
    console.log("══════════════════════════════════════════════════════════");
    for (const contract of implementations) {
        console.log(`${contract.name}:`);
        console.log(`Address: ${contract.address}`);
        console.log(`URL: https://polygonscan.com/address/${contract.address}#code`);
        console.log("──────────────────────────────────────────────────────────");
    }
    
    console.log("\n✅ To verify these contracts manually:");
    console.log("1. Visit each URL above");
    console.log("2. Check for the green checkmark ✓ next to 'Contract'");
    console.log("3. Verified contracts will show source code and Read/Write Contract tabs");
    
    console.log("\n🔧 To run automatic verification:");
    console.log("npx hardhat run scripts/verify-all.js --network polygon");
}

checkVerificationStatus()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });