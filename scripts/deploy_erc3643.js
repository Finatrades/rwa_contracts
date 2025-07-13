const { ethers, upgrades } = require("hardhat");

async function main() {
    console.log("Deploying ERC-3643 compliant RWA tokenization system...");
    
    const [deployer] = await ethers.getSigners();
    console.log("Deploying contracts with account:", deployer.address);
    console.log("Account balance:", (await deployer.provider.getBalance(deployer.address)).toString());
    
    // 1. Deploy ClaimTopicsRegistry
    console.log("\n1. Deploying ClaimTopicsRegistry...");
    const ClaimTopicsRegistry = await ethers.getContractFactory("ClaimTopicsRegistry");
    const claimTopicsRegistry = await upgrades.deployProxy(ClaimTopicsRegistry, [deployer.address], {
        initializer: "initialize",
        kind: "uups"
    });
    await claimTopicsRegistry.deployed();
    console.log("ClaimTopicsRegistry deployed to:", claimTopicsRegistry.address);
    
    // 2. Deploy IdentityRegistry
    console.log("\n2. Deploying IdentityRegistry...");
    const IdentityRegistry = await ethers.getContractFactory("IdentityRegistry");
    const identityRegistry = await upgrades.deployProxy(IdentityRegistry, [deployer.address], {
        initializer: "initialize",
        kind: "uups"
    });
    await identityRegistry.deployed();
    console.log("IdentityRegistry deployed to:", identityRegistry.address);
    
    // Link ClaimTopicsRegistry to IdentityRegistry
    await identityRegistry.setClaimTopicsRegistry(claimTopicsRegistry.address);
    console.log("Linked ClaimTopicsRegistry to IdentityRegistry");
    
    // 3. Deploy ClaimIssuer
    console.log("\n3. Deploying ClaimIssuer...");
    const ClaimIssuer = await ethers.getContractFactory("ClaimIssuer");
    const claimIssuer = await upgrades.deployProxy(ClaimIssuer, [deployer.address], {
        initializer: "initialize",
        kind: "uups"
    });
    await claimIssuer.deployed();
    console.log("ClaimIssuer deployed to:", claimIssuer.address);
    
    // 4. Deploy Compliance Modules
    console.log("\n4. Deploying Compliance Modules...");
    
    // Deploy CountryRestrictModule
    const CountryRestrictModule = await ethers.getContractFactory("CountryRestrictModule");
    const countryRestrictModule = await upgrades.deployProxy(CountryRestrictModule, [deployer.address], {
        initializer: "initialize",
        kind: "uups"
    });
    await countryRestrictModule.deployed();
    console.log("CountryRestrictModule deployed to:", countryRestrictModule.address);
    
    // Deploy TransferLimitModule
    const TransferLimitModule = await ethers.getContractFactory("TransferLimitModule");
    const defaultDailyLimit = ethers.utils.parseEther("100000"); // 100k tokens daily limit
    const defaultMonthlyLimit = ethers.utils.parseEther("1000000"); // 1M tokens monthly limit
    const transferLimitModule = await upgrades.deployProxy(
        TransferLimitModule, 
        [deployer.address, defaultDailyLimit, defaultMonthlyLimit], 
        {
            initializer: "initialize",
            kind: "uups"
        }
    );
    await transferLimitModule.deployed();
    console.log("TransferLimitModule deployed to:", transferLimitModule.address);
    
    // Deploy MaxBalanceModule
    const MaxBalanceModule = await ethers.getContractFactory("MaxBalanceModule");
    const defaultMaxBalance = ethers.utils.parseEther("10000000"); // 10M tokens max balance
    const maxBalanceModule = await upgrades.deployProxy(
        MaxBalanceModule, 
        [deployer.address, defaultMaxBalance], 
        {
            initializer: "initialize",
            kind: "uups"
        }
    );
    await maxBalanceModule.deployed();
    console.log("MaxBalanceModule deployed to:", maxBalanceModule.address);
    
    // 5. Deploy ModularCompliance
    console.log("\n5. Deploying ModularCompliance...");
    const ModularCompliance = await ethers.getContractFactory("ModularCompliance");
    const modularCompliance = await upgrades.deployProxy(ModularCompliance, [deployer.address], {
        initializer: "initialize",
        kind: "uups"
    });
    await modularCompliance.deployed();
    console.log("ModularCompliance deployed to:", modularCompliance.address);
    
    // Add modules to compliance
    await modularCompliance.addModule(countryRestrictModule.address);
    await modularCompliance.addModule(transferLimitModule.address);
    await modularCompliance.addModule(maxBalanceModule.address);
    console.log("Added compliance modules");
    
    // 6. Deploy Token
    console.log("\n6. Deploying FinatradesRWA_ERC3643 Token...");
    const Token = await ethers.getContractFactory("FinatradesRWA_ERC3643");
    const token = await upgrades.deployProxy(
        Token,
        [
            deployer.address,
            "Finatrades RWA Token",
            "FRWA",
            18,
            identityRegistry.address,
            modularCompliance.address
        ],
        {
            initializer: "initialize",
            kind: "uups"
        }
    );
    await token.deployed();
    console.log("FinatradesRWA_ERC3643 Token deployed to:", token.address);
    
    // 7. Configure compliance and bind token
    console.log("\n7. Configuring compliance...");
    await modularCompliance.bindToken(token.address);
    console.log("Token bound to compliance");
    
    // 8. Setup claim topics
    console.log("\n8. Setting up claim topics...");
    await claimTopicsRegistry.addClaimTopic(1); // KYC
    await claimTopicsRegistry.addClaimTopic(2); // AML
    await claimTopicsRegistry.addClaimTopic(4); // Country
    console.log("Added claim topics");
    
    // Add claim issuer as trusted issuer
    await claimTopicsRegistry.addTrustedIssuer(claimIssuer.address, [1, 2, 4]);
    console.log("Added claim issuer as trusted issuer");
    
    // 9. Setup allowed countries (example with Asian countries)
    console.log("\n9. Setting up allowed countries...");
    const asianCountries = [
        156, // China
        356, // India
        392, // Japan
        410, // South Korea
        702, // Singapore
        458, // Malaysia
        764, // Thailand
        360, // Indonesia
        608, // Philippines
        704, // Vietnam
    ];
    
    for (const country of asianCountries) {
        await countryRestrictModule.setCountryAllowed(country, true);
    }
    console.log("Configured allowed countries");
    
    // 10. Deploy Timelock
    console.log("\n10. Deploying Timelock...");
    const Timelock = await ethers.getContractFactory("FinatradesTimelock");
    const minDelay = 2 * 24 * 60 * 60; // 2 days
    const proposers = [deployer.address];
    const executors = [deployer.address];
    const timelock = await Timelock.deploy(minDelay, proposers, executors, deployer.address);
    await timelock.deployed();
    console.log("Timelock deployed to:", timelock.address);
    
    // Save deployment addresses
    const deployment = {
        network: network.name,
        contracts: {
            ClaimTopicsRegistry: claimTopicsRegistry.address,
            IdentityRegistry: identityRegistry.address,
            ClaimIssuer: claimIssuer.address,
            CountryRestrictModule: countryRestrictModule.address,
            TransferLimitModule: transferLimitModule.address,
            MaxBalanceModule: maxBalanceModule.address,
            ModularCompliance: modularCompliance.address,
            Token: token.address,
            Timelock: timelock.address
        },
        deployer: deployer.address,
        timestamp: new Date().toISOString()
    };
    
    console.log("\n=== Deployment Summary ===");
    console.log(JSON.stringify(deployment, null, 2));
    
    // Save to file
    const fs = require("fs");
    const path = require("path");
    const deploymentsDir = path.join(__dirname, "../deployments");
    if (!fs.existsSync(deploymentsDir)) {
        fs.mkdirSync(deploymentsDir);
    }
    fs.writeFileSync(
        path.join(deploymentsDir, `erc3643_${network.name}_${Date.now()}.json`),
        JSON.stringify(deployment, null, 2)
    );
    
    console.log("\nDeployment completed successfully!");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });