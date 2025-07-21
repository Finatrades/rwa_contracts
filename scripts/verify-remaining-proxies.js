const { ethers, run } = require("hardhat");

async function verifyProxy(name, proxyAddress, implementationAddress, initData) {
    console.log(`\n🔍 Verifying ${name} Proxy...`);
    console.log(`Proxy: ${proxyAddress}`);
    
    try {
        await run("verify:verify", {
            address: proxyAddress,
            constructorArguments: [implementationAddress, initData],
            contract: "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol:ERC1967Proxy"
        });
        console.log(`✅ ${name} Proxy verified!`);
        return true;
    } catch (error) {
        if (error.message.includes("Already Verified") || error.message.includes("already been verified")) {
            console.log(`✅ ${name} Proxy already verified!`);
            return true;
        } else {
            console.log(`❌ Failed: ${error.message.split('\n')[0]}`);
            return false;
        }
    }
}

async function main() {
    console.log("🚀 VERIFYING REMAINING PROXY CONTRACTS\n");
    
    const [deployer] = await ethers.getSigners();
    
    const proxiesToCheck = [
        {
            name: "Token",
            proxy: "0xED1c85A48EcD10654eD075F63F554cB3ac7faf6c",
            implementation: "0x8C5DA9118B70A23b01451Bc6f0baEc9A41Aa6A12",
            factory: "Token",
            initParams: [
                deployer.address,
                "Finatrades RWA Token",
                "FRWA",
                18,
                "0x25150414235289c688473340548698B5764651E3",
                "0x123A014c135417b58BB3e04A5711C8F126cA95E8"
            ]
        },
        {
            name: "ModularCompliance",
            proxy: "0x123A014c135417b58BB3e04A5711C8F126cA95E8",
            implementation: "0xca244a40FEd494075195b9632c75377ccFB7C8ff",
            factory: "ModularCompliance",
            initParams: [deployer.address]
        },
        {
            name: "AssetRegistry",
            proxy: "0x4717bED7008bc5aF62b3b91a29aaa24Bab034038",
            implementation: "0xBe125EFCBCeB60EC5Bf38e00158999E8Eb359347",
            factory: "AssetRegistry",
            initParams: [deployer.address]
        },
        {
            name: "RegulatoryReporting",
            proxy: "0xcd5fC2E20D697394d66e30475981bA5F37fD160e",
            implementation: "0xe4da869B9C55120aeAFc3c1e21d2C413531F18B2",
            factory: "RegulatoryReportingOptimized",
            initParams: [
                "0xED1c85A48EcD10654eD075F63F554cB3ac7faf6c",
                "0x25150414235289c688473340548698B5764651E3",
                "0x4717bED7008bc5aF62b3b91a29aaa24Bab034038",
                "0x123A014c135417b58BB3e04A5711C8F126cA95E8"
            ]
        },
        {
            name: "MaxBalanceModule",
            proxy: "0x77B6c7aBB74653F1F48ac6Ebd1154532D13c41b3",
            implementation: "0xcab5474536C676b62e6bF1aDeb48CE0092c62d00",
            factory: "MaxBalanceModule",
            initParams: [
                deployer.address,
                ethers.parseEther("1000000")
            ]
        }
    ];
    
    let verified = 0;
    let failed = 0;
    
    for (const proxyInfo of proxiesToCheck) {
        try {
            const contractFactory = await ethers.getContractFactory(proxyInfo.factory);
            const initData = contractFactory.interface.encodeFunctionData("initialize", proxyInfo.initParams);
            
            const result = await verifyProxy(
                proxyInfo.name,
                proxyInfo.proxy,
                proxyInfo.implementation,
                initData
            );
            
            if (result) verified++;
            else failed++;
            
            // Wait between verifications
            await new Promise(resolve => setTimeout(resolve, 5000));
            
        } catch (error) {
            console.log(`❌ Error with ${proxyInfo.name}: ${error.message}`);
            failed++;
        }
    }
    
    console.log("\n📊 VERIFICATION SUMMARY");
    console.log("════════════════════════════════════════");
    console.log(`Total checked: ${proxiesToCheck.length}`);
    console.log(`✅ Verified: ${verified}`);
    console.log(`❌ Failed: ${failed}`);
    console.log("════════════════════════════════════════");
    
    console.log("\n📝 FINAL STATUS:");
    console.log("All contracts should now be verified on Polygonscan.");
    console.log("Visit https://polygonscan.com to confirm.");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });