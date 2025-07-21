const { ethers, upgrades } = require("hardhat");

async function main() {
    console.log("Deploying Regulatory Reporting System...");
    
    const [deployer] = await ethers.getSigners();
    console.log("Deploying contracts with account:", deployer.address);
    
    // Get existing contract addresses (these would be provided in production)
    const TOKEN_ADDRESS = process.env.TOKEN_ADDRESS || "0x...";
    const IDENTITY_REGISTRY_ADDRESS = process.env.IDENTITY_REGISTRY_ADDRESS || "0x...";
    const ASSET_REGISTRY_ADDRESS = process.env.ASSET_REGISTRY_ADDRESS || "0x...";
    const COMPLIANCE_ADDRESS = process.env.COMPLIANCE_ADDRESS || "0x...";
    
    // Deploy Regulatory Reporting
    const RegulatoryReporting = await ethers.getContractFactory("RegulatoryReporting");
    const regulatoryReporting = await upgrades.deployProxy(
        RegulatoryReporting,
        [
            TOKEN_ADDRESS,
            IDENTITY_REGISTRY_ADDRESS,
            ASSET_REGISTRY_ADDRESS,
            COMPLIANCE_ADDRESS
        ],
        { initializer: 'initialize' }
    );
    
    await regulatoryReporting.deployed();
    console.log("RegulatoryReporting deployed to:", regulatoryReporting.address);
    
    // Update Token contract to use regulatory reporting
    const FinatradesRWAWithReporting = await ethers.getContractFactory("FinatradesRWAWithReporting");
    const token = FinatradesRWAWithReporting.attach(TOKEN_ADDRESS);
    
    console.log("Setting regulatory reporting in token contract...");
    await token.setRegulatoryReporting(regulatoryReporting.address);
    
    // Grant roles as needed
    const REPORTER_ROLE = await regulatoryReporting.REPORTER_ROLE();
    const COMPLIANCE_OFFICER_ROLE = await regulatoryReporting.COMPLIANCE_OFFICER_ROLE();
    
    // Example: Grant reporter role to a reporting service
    // await regulatoryReporting.grantRole(REPORTER_ROLE, "0x...");
    
    console.log("\nDeployment Summary:");
    console.log("===================");
    console.log("RegulatoryReporting:", regulatoryReporting.address);
    console.log("\nRoles:");
    console.log("- REPORTER_ROLE:", REPORTER_ROLE);
    console.log("- COMPLIANCE_OFFICER_ROLE:", COMPLIANCE_OFFICER_ROLE);
    
    // Verify implementation
    const implementationAddress = await upgrades.erc1967.getImplementationAddress(
        regulatoryReporting.address
    );
    console.log("\nImplementation address:", implementationAddress);
    
    return {
        regulatoryReporting: regulatoryReporting.address,
        implementation: implementationAddress
    };
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });