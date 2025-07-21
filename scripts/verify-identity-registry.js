const { run } = require("hardhat");

async function main() {
    console.log("🔍 Verifying IdentityRegistry implementation on Polygonscan...\n");
    
    const address = "0x0BD1A2EdF1FCd608fC0537f6268E2b9c565a58B8";
    
    try {
        await run("verify:verify", {
            address: address,
            constructorArguments: [],
            contract: "contracts/identity/IdentityRegistry.sol:IdentityRegistry"
        });
        
        console.log(`✅ IdentityRegistry implementation verified successfully!`);
        console.log(`View at: https://polygonscan.com/address/${address}#code`);
    } catch (error) {
        if (error.message.includes("Already Verified")) {
            console.log(`✅ Contract is already verified`);
        } else {
            console.error(`❌ Failed to verify:`, error.message);
        }
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });