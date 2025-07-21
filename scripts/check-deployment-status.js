const { ethers } = require("hardhat");

async function main() {
    console.log("🔍 CHECKING DEPLOYMENT STATUS\n");
    
    const [deployer] = await ethers.getSigners();
    console.log("Network: Polygon Mainnet");
    console.log("Deployer:", deployer.address);
    console.log("Balance:", ethers.formatEther(await deployer.provider.getBalance(deployer.address)), "MATIC\n");
    
    // All expected contracts
    const allContracts = {
        "ClaimTopicsRegistry": "0x6Ec58c34DF899Ff9d67FD088Cd339bB75508Dd79",
        "IdentityRegistry": "0x25150414235289c688473340548698B5764651E3", 
        "CountryRestrictModule": "0x934b1C1AD4d205517B1a09A984c3F077cd99651A",
        "MaxBalanceModule": "0x77B6c7aBB74653F1F48ac6Ebd1154532D13c41b3",
        "TransferLimitModule": "0x6887c6c45B64C6E6D55dFADb2a4857C5DAD63D57",
        "ModularCompliance": "0x123A014c135417b58BB3e04A5711C8F126cA95E8",
        "AssetRegistry": "0x18E44f588a4DcF2F7145d35A5C226e129040b6D3", // Check this address
        "FinatradesTimelock": null, // Not deployed yet
        "FinatradesRWA_Enterprise": null, // Not deployed yet
        "RegulatoryReportingOptimized": null // Not deployed yet
    };
    
    console.log("📋 CHECKING CONTRACT DEPLOYMENT:");
    console.log("════════════════════════════════════════");
    
    let deployed = 0;
    let notDeployed = [];
    
    for (const [name, address] of Object.entries(allContracts)) {
        if (address) {
            const code = await deployer.provider.getCode(address);
            if (code !== "0x") {
                console.log(`✅ ${name.padEnd(30)} ${address}`);
                deployed++;
            } else {
                console.log(`❌ ${name.padEnd(30)} NOT FOUND at ${address}`);
                notDeployed.push(name);
            }
        } else {
            console.log(`⏳ ${name.padEnd(30)} NOT DEPLOYED YET`);
            notDeployed.push(name);
        }
    }
    
    console.log("════════════════════════════════════════");
    console.log(`\n📊 SUMMARY: ${deployed}/10 contracts deployed`);
    
    if (notDeployed.length > 0) {
        console.log("\n❌ Remaining contracts to deploy:");
        notDeployed.forEach(name => console.log(`   - ${name}`));
    }
    
    // Check AssetRegistry implementation
    const assetImplAddress = "0x63CFf0d3ec6F14d2e43C372a541837223fc8BFe8";
    const assetImplCode = await deployer.provider.getCode(assetImplAddress);
    if (assetImplCode !== "0x") {
        console.log(`\n✅ AssetRegistry implementation exists at ${assetImplAddress}`);
        console.log("   Ready to deploy AssetRegistry proxy");
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });