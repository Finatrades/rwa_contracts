const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
    console.log("🔍 Starting contract verification on Polygon...\n");
    
    // Read deployment info
    const network = hre.network.name;
    const deploymentPath = path.join(__dirname, `../deployments/erc3643_${network}_example.json`);
    
    if (!fs.existsSync(deploymentPath)) {
        console.error(`❌ Deployment file not found for network: ${network}`);
        return;
    }
    
    const deployment = JSON.parse(fs.readFileSync(deploymentPath, 'utf8'));
    console.log(`📋 Verifying contracts on ${network}...`);
    
    // Verify each contract
    const verificationTasks = [
        {
            name: "ClaimTopicsRegistry",
            address: deployment.contracts.ClaimTopicsRegistry,
            constructorArguments: [deployment.deployer]
        },
        {
            name: "IdentityRegistry", 
            address: deployment.contracts.IdentityRegistry,
            constructorArguments: [deployment.deployer]
        },
        {
            name: "ClaimIssuer",
            address: deployment.contracts.ClaimIssuer,
            constructorArguments: [deployment.deployer]
        },
        {
            name: "CountryRestrictModule",
            address: deployment.contracts.CountryRestrictModule,
            constructorArguments: [deployment.deployer]
        },
        {
            name: "TransferLimitModule",
            address: deployment.contracts.TransferLimitModule,
            constructorArguments: [
                deployment.deployer,
                ethers.utils.parseEther("100000"), // Default daily limit
                ethers.utils.parseEther("1000000") // Default monthly limit
            ]
        },
        {
            name: "MaxBalanceModule",
            address: deployment.contracts.MaxBalanceModule,
            constructorArguments: [
                deployment.deployer,
                ethers.utils.parseEther("10000000") // Default max balance
            ]
        },
        {
            name: "ModularCompliance",
            address: deployment.contracts.ModularCompliance,
            constructorArguments: [deployment.deployer]
        },
        {
            name: "FinatradesRWA_ERC3643",
            address: deployment.contracts.FinatradesRWA_ERC3643,
            constructorArguments: [
                deployment.deployer,
                "Finatrades RWA Token",
                "FRWA",
                18,
                deployment.contracts.IdentityRegistry,
                deployment.contracts.ModularCompliance
            ]
        },
        {
            name: "Timelock",
            address: deployment.contracts.Timelock,
            contract: "contracts/governance/FinatradesTimelock.sol:FinatradesTimelock",
            constructorArguments: [
                2 * 24 * 60 * 60, // 2 days
                [deployment.deployer], // proposers
                [deployment.deployer], // executors
                deployment.deployer // admin
            ]
        }
    ];
    
    for (const task of verificationTasks) {
        try {
            console.log(`\n✅ Verifying ${task.name}...`);
            await hre.run("verify:verify", {
                address: task.address,
                constructorArguments: task.constructorArguments,
                contract: task.contract
            });
            console.log(`✅ ${task.name} verified successfully!`);
        } catch (error) {
            if (error.message.includes("already verified")) {
                console.log(`✅ ${task.name} is already verified.`);
            } else {
                console.error(`❌ Failed to verify ${task.name}:`, error.message);
            }
        }
    }
    
    console.log("\n🎉 Verification process completed!");
    console.log("\n📊 View verified contracts on Polygonscan:");
    
    const scanUrl = network === "polygon" ? "https://polygonscan.com" : "https://mumbai.polygonscan.com";
    for (const [name, address] of Object.entries(deployment.contracts)) {
        console.log(`${name}: ${scanUrl}/address/${address}#code`);
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });