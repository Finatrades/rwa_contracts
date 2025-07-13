const { ethers, upgrades } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  console.log("Getting implementation addresses using upgrades library...\n");
  
  const contracts = {
    claimTopicsRegistry: "0xeCf537CADeBd2951776f3AC3c1e9b76218d6ecE4",
    identityRegistry: "0x59A1923E694061b9A49b2eC92AeeF99077f42532",
    claimIssuer: "0x625986DD1A10859C7F6326eE50B9901D5AD82170",
    countryModule: "0x620818526106cc35ab598D2500632A62e0176619",
    transferLimitModule: "0xbb109a19000dF7ca3062161794405DAC026DB4E5",
    maxBalanceModule: "0x64BC91aba0EF92F4565b076Ea1382B2d82d418cD",
    modularCompliance: "0x115f87dC7bB192924069b4291DAF0Dcd39C0A76b",
    token: "0x414A484985771C2CFDA215FB20C48ed037eE409b",
    assetRegistry: "0xB678e16e773790B0FD56D36a516731dfA8761b77"
  };
  
  const implementations = {};
  
  for (const [name, proxyAddress] of Object.entries(contracts)) {
    try {
      const implAddress = await upgrades.erc1967.getImplementationAddress(proxyAddress);
      implementations[name] = implAddress;
      console.log(`${name}:`);
      console.log(`  Proxy: ${proxyAddress}`);
      console.log(`  Implementation: ${implAddress}`);
      console.log();
    } catch (error) {
      console.log(`${name}: Error - ${error.message}`);
    }
  }
  
  // Save to file
  const deploymentData = {
    network: "polygon_mainnet",
    chainId: 137,
    deploymentDate: new Date().toISOString(),
    deployer: "0xCE982AC6bc316Cf9d875652B84C7626B62a899eA",
    contracts: contracts,
    implementations: implementations,
    timelock: "0xCF3FA612F1eF813e31Af012B2D77eA8f3d191F82"
  };
  
  const deploymentsDir = path.join(__dirname, "../deployments");
  if (!fs.existsSync(deploymentsDir)) {
    fs.mkdirSync(deploymentsDir, { recursive: true });
  }
  
  fs.writeFileSync(
    path.join(deploymentsDir, "polygon_fresh_implementations.json"),
    JSON.stringify(deploymentData, null, 2)
  );
  
  console.log("Implementation addresses saved to deployments/polygon_fresh_implementations.json");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });