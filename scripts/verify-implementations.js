const { run } = require("hardhat");

async function main() {
    console.log("\n=== Verifying Implementation Contracts ===\n");

    const contracts = [
        {
            name: "Finatrades Token (ERC-20)",
            address: "0x5900027BbdA1A833C9f93F3bcE76b9E4eCf8D341",
            contract: "contracts/token/Token.sol:Token"
        },
        {
            name: "FinatradesNFT (ERC-721)",
            address: "0xF23688617C09B89d13F625a0670D8Ba64a2c065A",
            contract: "contracts/token/FinatradesNFT.sol:FinatradesNFT"
        },
        {
            name: "FinatradesTokenFactory Implementation",
            address: "0x4E989F963B10cF417E16C58447E725fb34F6b09f",
            contract: "contracts/factory/FinatradesTokenFactory.sol:FinatradesTokenFactory"
        }
    ];

    for (const item of contracts) {
        try {
            console.log(`Verifying ${item.name} at ${item.address}...`);
            
            await run("verify:verify", {
                address: item.address,
                constructorArguments: [],
                contract: item.contract,
                force: true
            });
            
            console.log(`✅ ${item.name} verified successfully!\n`);
        } catch (error) {
            if (error.message.includes("already verified")) {
                console.log(`✅ ${item.name} is already verified\n`);
            } else {
                console.log(`❌ Failed to verify ${item.name}: ${error.message}\n`);
            }
        }
    }

    console.log("\nVerification complete!");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });