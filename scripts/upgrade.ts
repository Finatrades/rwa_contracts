import { ethers, upgrades } from "hardhat";
import dotenv from "dotenv";

dotenv.config();

async function main() {
  const PROXY_ADDRESS = process.env.PROXY_ADDRESS || "";
  
  if (!PROXY_ADDRESS) {
    throw new Error("Please set PROXY_ADDRESS in .env file");
  }

  console.log("Starting upgrade process...");
  console.log("Proxy address:", PROXY_ADDRESS);

  const [deployer] = await ethers.getSigners();
  console.log("Upgrading with account:", deployer.address);

  // Deploy new implementation
  console.log("\n1. Deploying new implementation...");
  const FinatradesRWAV2 = await ethers.getContractFactory("FinatradesRWA");
  
  console.log("2. Preparing upgrade...");
  const upgraded = await upgrades.upgradeProxy(PROXY_ADDRESS, FinatradesRWAV2, {
    kind: 'uups'
  });
  
  await upgraded.waitForDeployment();
  console.log("Upgrade transaction sent!");

  const newImplementation = await upgrades.erc1967.getImplementationAddress(PROXY_ADDRESS);
  console.log("New implementation address:", newImplementation);

  console.log("\n✅ Upgrade prepared successfully!");
  console.log("\n🔐 Next steps:");
  console.log("1. The upgrade must be executed through the timelock");
  console.log("2. Propose the upgrade transaction to the timelock");
  console.log("3. Wait for the timelock delay");
  console.log("4. Execute the upgrade");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });