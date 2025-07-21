const { ethers, run } = require("hardhat");

async function verifyProxy(proxyAddress, implementationAddress, initData, contractName) {
    console.log(`\n🔍 Verifying ${contractName} Proxy...`);
    console.log(`Proxy: ${proxyAddress}`);
    console.log(`Implementation: ${implementationAddress}`);
    
    try {
        await run("verify:verify", {
            address: proxyAddress,
            constructorArguments: [implementationAddress, initData],
            contract: "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol:ERC1967Proxy"
        });
        console.log(`✅ ${contractName} Proxy verified!`);
        return true;
    } catch (error) {
        if (error.message.includes("Already Verified")) {
            console.log(`✅ ${contractName} Proxy already verified`);
            return true;
        } else {
            console.log(`❌ Failed: ${error.message.split('\n')[0]}`);
            return false;
        }
    }
}

async function main() {
    console.log("🚀 VERIFYING PROXY CONTRACTS ON POLYGONSCAN\n");
    
    const [deployer] = await ethers.getSigners();
    
    // Generate initialization data for each proxy
    const proxiesToVerify = [
        {
            name: "TransferLimitModule",
            proxy: "0x6887c6c45B64C6E6D55dFADb2a4857C5DAD63D57",
            implementation: "0x9fF75c5cE984849224a865f44e0d5bE9BeA12e0A",
            initFunction: "initialize",
            initParams: [
                deployer.address, // owner
                ethers.parseEther("10000"), // defaultDailyLimit (10k tokens)
                ethers.parseEther("100000") // defaultMonthlyLimit (100k tokens)
            ]
        },
        {
            name: "MaxBalanceModule",
            proxy: "0x77B6c7aBB74653F1F48ac6Ebd1154532D13c41b3",
            implementation: "0xcab5474536C676b62e6bF1aDeb48CE0092c62d00",
            initFunction: "initialize",
            initParams: [
                deployer.address, // owner
                ethers.parseEther("1000000") // defaultMaxBalance (1M tokens)
            ]
        },
        {
            name: "CountryRestrictModule",
            proxy: "0x934b1C1AD4d205517B1a09A984c3F077cd99651A",
            implementation: "0xb9a74E93E9Ee80C083F256fbCA24929fF48cab60",
            initFunction: "initialize",
            initParams: [deployer.address] // owner
        },
        {
            name: "Token",
            proxy: "0xED1c85A48EcD10654eD075F63F554cB3ac7faf6c",
            implementation: "0x8C5DA9118B70A23b01451Bc6f0baEc9A41Aa6A12",
            initFunction: "initialize",
            initParams: [
                deployer.address, // admin
                "Finatrades RWA Token", // name
                "FRWA", // symbol
                18, // decimals
                "0x25150414235289c688473340548698B5764651E3", // identityRegistry
                "0x123A014c135417b58BB3e04A5711C8F126cA95E8" // compliance
            ]
        },
        {
            name: "ModularCompliance",
            proxy: "0x123A014c135417b58BB3e04A5711C8F126cA95E8",
            implementation: "0xca244a40FEd494075195b9632c75377ccFB7C8ff",
            initFunction: "initialize",
            initParams: [deployer.address] // admin
        },
        {
            name: "AssetRegistry",
            proxy: "0x4717bED7008bc5aF62b3b91a29aaa24Bab034038",
            implementation: "0xBe125EFCBCeB60EC5Bf38e00158999E8Eb359347",
            initFunction: "initialize",
            initParams: [deployer.address] // admin
        },
        {
            name: "RegulatoryReportingOptimized",
            proxy: "0xcd5fC2E20D697394d66e30475981bA5F37fD160e",
            implementation: "0xe4da869B9C55120aeAFc3c1e21d2C413531F18B2",
            initFunction: "initialize",
            initParams: [
                "0xED1c85A48EcD10654eD075F63F554cB3ac7faf6c", // token
                "0x25150414235289c688473340548698B5764651E3", // identityRegistry
                "0x4717bED7008bc5aF62b3b91a29aaa24Bab034038", // assetRegistry
                "0x123A014c135417b58BB3e04A5711C8F126cA95E8" // compliance
            ]
        }
    ];
    
    let verified = 0;
    let failed = 0;
    
    for (const proxyInfo of proxiesToVerify) {
        try {
            // Get the contract factory to encode init data
            let contractFactory;
            switch(proxyInfo.name) {
                case "TransferLimitModule":
                    contractFactory = await ethers.getContractFactory("TransferLimitModule");
                    break;
                case "MaxBalanceModule":
                    contractFactory = await ethers.getContractFactory("MaxBalanceModule");
                    break;
                case "CountryRestrictModule":
                    contractFactory = await ethers.getContractFactory("CountryRestrictModule");
                    break;
                case "Token":
                    contractFactory = await ethers.getContractFactory("Token");
                    break;
                case "ModularCompliance":
                    contractFactory = await ethers.getContractFactory("ModularCompliance");
                    break;
                case "AssetRegistry":
                    contractFactory = await ethers.getContractFactory("AssetRegistry");
                    break;
                case "RegulatoryReportingOptimized":
                    contractFactory = await ethers.getContractFactory("RegulatoryReportingOptimized");
                    break;
            }
            
            const initData = contractFactory.interface.encodeFunctionData(
                proxyInfo.initFunction,
                proxyInfo.initParams
            );
            
            const result = await verifyProxy(
                proxyInfo.proxy,
                proxyInfo.implementation,
                initData,
                proxyInfo.name
            );
            
            if (result) verified++;
            else failed++;
            
            // Wait between verifications
            await new Promise(resolve => setTimeout(resolve, 3000));
            
        } catch (error) {
            console.log(`❌ Error processing ${proxyInfo.name}: ${error.message}`);
            failed++;
        }
    }
    
    console.log("\n📊 VERIFICATION SUMMARY");
    console.log("════════════════════════════════════════");
    console.log(`Total proxies: ${proxiesToVerify.length}`);
    console.log(`✅ Verified: ${verified}`);
    console.log(`❌ Failed: ${failed}`);
    console.log("════════════════════════════════════════");
    
    if (failed > 0) {
        console.log("\n📝 Manual Verification Instructions:");
        console.log("For any failed proxy verifications:");
        console.log("1. Go to the proxy address on Polygonscan");
        console.log("2. Click 'Verify and Publish'");
        console.log("3. Select contract: @openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol:ERC1967Proxy");
        console.log("4. Constructor args: implementation address + encoded init data");
        console.log("5. Compiler: v0.8.19+commit.7dd6d404");
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });