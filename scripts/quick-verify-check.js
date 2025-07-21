const { run } = require("hardhat");

async function checkIfVerified(address, contractName) {
    try {
        await run("verify:verify", {
            address: address,
            constructorArguments: [],
            force: false
        });
        return false; // If verification succeeds, it wasn't verified before
    } catch (error) {
        if (error.message.includes("already been verified") || 
            error.message.includes("Already Verified") ||
            error.message.includes("Contract source code already verified")) {
            return true; // Contract is verified
        }
        return false; // Some other error, assume not verified
    }
}

async function main() {
    console.log("🔍 QUICK VERIFICATION STATUS CHECK\n");
    
    const proxies = [
        { name: "Token Proxy", address: "0xED1c85A48EcD10654eD075F63F554cB3ac7faf6c" },
        { name: "ModularCompliance Proxy", address: "0x123A014c135417b58BB3e04A5711C8F126cA95E8" },
        { name: "AssetRegistry Proxy", address: "0x4717bED7008bc5aF62b3b91a29aaa24Bab034038" },
        { name: "RegulatoryReporting Proxy", address: "0xcd5fC2E20D697394d66e30475981bA5F37fD160e" },
        { name: "CountryRestrictModule Proxy", address: "0x934b1C1AD4d205517B1a09A984c3F077cd99651A" },
        { name: "MaxBalanceModule Proxy", address: "0x77B6c7aBB74653F1F48ac6Ebd1154532D13c41b3" },
        { name: "TransferLimitModule Proxy", address: "0x6887c6c45B64C6E6D55dFADb2a4857C5DAD63D57" },
        { name: "FinatradesTimelock", address: "0xf98Ee2EE41Ee008AEc3A17a87E06Aa0Dc4Cd38e4" }
    ];
    
    console.log("Checking proxy contracts...\n");
    
    for (const contract of proxies) {
        process.stdout.write(`Checking ${contract.name}... `);
        const isVerified = await checkIfVerified(contract.address, contract.name);
        console.log(isVerified ? "✅ VERIFIED" : "❌ NOT VERIFIED");
    }
    
    console.log("\n📊 SUMMARY:");
    console.log("To see full verification details, visit the Polygonscan URLs listed in the previous output.");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });