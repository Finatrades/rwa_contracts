const { run } = require("hardhat");

async function main() {
    console.log("🔍 Verifying FinatradesTimelock on Polygonscan...\n");
    
    const timelockAddress = "0xf98Ee2EE41Ee008AEc3A17a87E06Aa0Dc4Cd38e4";
    const constructorArgs = [
        172800, // 48 hours in seconds
        ["0xCE982AC6bc316Cf9d875652B84C7626B62a899eA", "0x0000000000000000000000000000000000000001"], // proposers
        ["0xCE982AC6bc316Cf9d875652B84C7626B62a899eA"], // executors
        "0xCE982AC6bc316Cf9d875652B84C7626B62a899eA" // admin
    ];
    
    console.log("Contract: FinatradesTimelock");
    console.log("Address:", timelockAddress);
    console.log("Constructor Arguments:");
    console.log("  - minDelay:", constructorArgs[0], "seconds (48 hours)");
    console.log("  - proposers:", constructorArgs[1]);
    console.log("  - executors:", constructorArgs[2]);
    console.log("  - admin:", constructorArgs[3]);
    console.log("");
    
    try {
        await run("verify:verify", {
            address: timelockAddress,
            contract: "contracts/governance/FinatradesTimelock.sol:FinatradesTimelock",
            constructorArguments: constructorArgs
        });
        
        console.log("\n✅ FinatradesTimelock verified successfully on Polygonscan!");
        console.log("View at: https://polygonscan.com/address/" + timelockAddress + "#code");
        
    } catch (error) {
        if (error.message.includes("Already Verified")) {
            console.log("\n✅ FinatradesTimelock is already verified on Polygonscan!");
            console.log("View at: https://polygonscan.com/address/" + timelockAddress + "#code");
        } else {
            console.error("\n❌ Verification failed:", error.message);
            
            // Try alternative approach
            console.log("\n🔄 Trying alternative verification approach...");
            
            // Create a file with constructor arguments for manual verification
            const fs = require("fs");
            const path = require("path");
            
            const argData = {
                address: timelockAddress,
                constructorArguments: constructorArgs,
                encodedConstructorArgs: ethers.AbiCoder.defaultAbiCoder().encode(
                    ["uint256", "address[]", "address[]", "address"],
                    constructorArgs
                ).slice(2) // Remove 0x prefix
            };
            
            fs.writeFileSync(
                path.join(__dirname, "timelock-constructor-args.json"),
                JSON.stringify(argData, null, 2)
            );
            
            console.log("\n📝 Constructor arguments saved to scripts/timelock-constructor-args.json");
            console.log("\nTo verify manually on Polygonscan:");
            console.log("1. Go to: https://polygonscan.com/address/" + timelockAddress + "#code");
            console.log("2. Click 'Verify and Publish'");
            console.log("3. Select:");
            console.log("   - Compiler: v0.8.19+commit.7dd6d404");
            console.log("   - Contract: contracts/governance/FinatradesTimelock.sol:FinatradesTimelock");
            console.log("   - License: MIT");
            console.log("4. Use the encoded constructor args from the saved file");
        }
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });