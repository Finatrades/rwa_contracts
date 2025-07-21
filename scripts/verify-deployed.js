const { run } = require("hardhat");

async function main() {
    console.log("🔍 Verifying deployed contracts on Polygonscan...\n");
    
    const contracts = [
        {
            name: "ClaimTopicsRegistry Implementation",
            address: "0x2DEF12D0C8448DD8866AcFD839aDbFE07b5C7A15",
            constructorArguments: []
        },
        {
            name: "IdentityRegistry Implementation", 
            address: "0x0BD1A2EdF1FCd608fC0537f6268E2b9c565a58B8",
            constructorArguments: []
        }
    ];
    
    for (const contract of contracts) {
        console.log(`\nVerifying ${contract.name} at ${contract.address}...`);
        
        try {
            await run("verify:verify", {
                address: contract.address,
                constructorArguments: contract.constructorArguments,
            });
            
            console.log(`✅ ${contract.name} verified successfully!`);
        } catch (error) {
            if (error.message.includes("Already Verified")) {
                console.log(`✅ ${contract.name} is already verified`);
            } else {
                console.error(`❌ Failed to verify ${contract.name}:`, error.message);
            }
        }
    }
    
    console.log("\n📋 Verification Summary:");
    console.log("ClaimTopicsRegistry: https://polygonscan.com/address/0x6Ec58c34DF899Ff9d67FD088Cd339bB75508Dd79#code");
    console.log("IdentityRegistry: https://polygonscan.com/address/0x25150414235289c688473340548698B5764651E3#code");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });