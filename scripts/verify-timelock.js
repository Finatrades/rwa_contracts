const hre = require("hardhat");

async function main() {
  console.log("🔍 Verifying Timelock contract on Polygonscan...");

  const contractAddress = "0xc929923D0d52Df0b72C8cf00C7c6156DB24232dE";
  
  // Constructor arguments used during deployment
  const minDelay = 172800; // 2 days
  const proposers = ["0xCE982AC6bc316Cf9d875652B84C7626B62a899eA", "0x0000000000000000000000000000000000000000"];
  const executors = ["0xCE982AC6bc316Cf9d875652B84C7626B62a899eA"];
  const admin = "0xCE982AC6bc316Cf9d875652B84C7626B62a899eA";

  try {
    await hre.run("verify:verify", {
      address: contractAddress,
      constructorArguments: [
        minDelay,
        proposers,
        executors,
        admin
      ],
      contract: "contracts/governance/FinatradesTimelock.sol:FinatradesTimelock"
    });
    
    console.log("✅ Timelock contract verified successfully!");
  } catch (error) {
    if (error.message.includes("Already Verified")) {
      console.log("✅ Contract is already verified!");
    } else {
      console.error("❌ Verification failed:", error.message);
      
      // Try alternative approach
      console.log("\n🔄 Trying alternative verification approach...");
      
      // Generate constructor arguments file
      const fs = require('fs');
      const constructorArgs = {
        minDelay: minDelay,
        proposers: proposers,
        executors: executors,
        admin: admin
      };
      
      fs.writeFileSync(
        'timelock-constructor-args.js',
        `module.exports = [
  ${minDelay}, // minDelay (2 days)
  ["${proposers[0]}", "${proposers[1]}"], // proposers
  ["${executors[0]}"], // executors
  "${admin}" // admin
];`
      );
      
      console.log("📝 Constructor arguments saved to timelock-constructor-args.js");
      console.log("\nNow run:");
      console.log(`npx hardhat verify --network polygon --constructor-args timelock-constructor-args.js ${contractAddress}`);
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });