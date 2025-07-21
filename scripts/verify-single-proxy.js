const { ethers, run } = require("hardhat");

async function main() {
    console.log("🔍 Verifying TransferLimitModule Proxy...\n");
    
    const proxyAddress = "0x6887c6c45B64C6E6D55dFADb2a4857C5DAD63D57";
    const implementationAddress = "0x9fF75c5cE984849224a865f44e0d5bE9BeA12e0A";
    
    // Generate init data
    const TransferLimitModule = await ethers.getContractFactory("TransferLimitModule");
    const initData = TransferLimitModule.interface.encodeFunctionData("initialize", [
        "0xCE982AC6bc316Cf9d875652B84C7626B62a899eA", // owner
        ethers.parseEther("10000"), // defaultDailyLimit
        ethers.parseEther("100000") // defaultMonthlyLimit
    ]);
    
    console.log("Proxy:", proxyAddress);
    console.log("Implementation:", implementationAddress);
    console.log("Init data:", initData);
    
    try {
        console.log("\nVerifying proxy contract...");
        await run("verify:verify", {
            address: proxyAddress,
            constructorArguments: [implementationAddress, initData],
            contract: "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol:ERC1967Proxy"
        });
        
        console.log("\n✅ TransferLimitModule Proxy verified successfully!");
        console.log("View at: https://polygonscan.com/address/" + proxyAddress + "#code");
        
    } catch (error) {
        if (error.message.includes("Already Verified")) {
            console.log("\n✅ TransferLimitModule Proxy is already verified!");
            console.log("View at: https://polygonscan.com/address/" + proxyAddress + "#code");
        } else {
            console.error("\n❌ Verification failed:", error.message);
            
            // Save constructor args for manual verification
            const fs = require("fs");
            const constructorArgs = ethers.AbiCoder.defaultAbiCoder().encode(
                ["address", "bytes"],
                [implementationAddress, initData]
            );
            
            fs.writeFileSync(
                "transfer-limit-proxy-args.txt",
                constructorArgs.slice(2) // Remove 0x
            );
            
            console.log("\n📝 Constructor arguments saved to transfer-limit-proxy-args.txt");
            console.log("\nTo verify manually:");
            console.log("1. Go to: https://polygonscan.com/address/" + proxyAddress + "#code");
            console.log("2. Click 'Verify and Publish'");
            console.log("3. Contract: @openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol:ERC1967Proxy");
            console.log("4. Use the constructor args from the saved file");
        }
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });