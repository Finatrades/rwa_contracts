const { ethers } = require('hardhat');
const fs = require('fs');
const path = require('path');

// EIP-1967 storage slot for implementation address
// keccak256("eip1967.proxy.implementation") - 1
const IMPLEMENTATION_SLOT = '0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc';

async function getImplementationAddress(provider, proxyAddress) {
    try {
        // Get the storage value at the implementation slot
        const implementationStorage = await provider.getStorageAt(proxyAddress, IMPLEMENTATION_SLOT);
        
        // Convert the storage value to an address
        // The storage value is a 32-byte hex string, we need to extract the last 20 bytes (40 hex chars)
        const implementationAddress = '0x' + implementationStorage.slice(-40);
        
        return implementationAddress;
    } catch (error) {
        console.error(`Error getting implementation for ${proxyAddress}:`, error.message);
        return null;
    }
}

async function main() {
    // Proxy addresses provided by the user
    const proxyAddresses = {
        claimTopicsRegistry: '0xeCf537CADeBd2951776f3AC3c1e9b76218d6ecE4',
        identityRegistry: '0x59A1923E694061b9A49b2eC92AeeF99077f42532',
        claimIssuer: '0x625986DD1A10859C7F6326eE50B9901D5AD82170',
        countryModule: '0x620818526106cc35ab598D2500632A62e0176619',
        transferLimitModule: '0xbb109a19000dF7ca3062161794405DAC026DB4E5',
        maxBalanceModule: '0x64BC91aba0EF92F4565b076Ea1382B2d82d418cD',
        modularCompliance: '0x115f87dC7bB192924069b4291DAF0Dcd39C0A76b',
        token: '0x414A484985771C2CFDA215FB20C48ed037eE409b',
        assetRegistry: '0xB678e16e773790B0FD56D36a516731dfA8761b77'
    };

    console.log('Getting implementation addresses for proxy contracts...\n');
    console.log(`Network: ${network.name}`);
    console.log(`Chain ID: ${network.config.chainId}\n`);

    const provider = ethers.provider;
    const implementations = {};

    // Get implementation address for each proxy
    for (const [contractName, proxyAddress] of Object.entries(proxyAddresses)) {
        console.log(`${contractName}:`);
        console.log(`  Proxy: ${proxyAddress}`);
        
        const implementationAddress = await getImplementationAddress(provider, proxyAddress);
        
        if (implementationAddress && implementationAddress !== '0x0000000000000000000000000000000000000000') {
            implementations[contractName] = implementationAddress;
            console.log(`  Implementation: ${implementationAddress}`);
        } else {
            console.log(`  Implementation: Not found or not a proxy`);
        }
        console.log();
    }

    // Save results to a file
    const outputData = {
        network: network.name,
        chainId: network.config.chainId,
        timestamp: new Date().toISOString(),
        proxies: proxyAddresses,
        implementations: implementations
    };

    const outputPath = path.join(__dirname, '..', 'deployments', 'implementation-addresses.json');
    fs.writeFileSync(outputPath, JSON.stringify(outputData, null, 2));
    console.log(`\nImplementation addresses saved to: ${outputPath}`);

    // Compare with existing deployment log if available
    try {
        const deploymentLogPath = path.join(__dirname, '..', 'deployments', 'polygon_mainnet_fresh_verified_final.json');
        if (fs.existsSync(deploymentLogPath)) {
            const deploymentLog = JSON.parse(fs.readFileSync(deploymentLogPath, 'utf8'));
            
            console.log('\n--- Comparison with deployment log ---');
            let allMatch = true;
            
            for (const [contractName, implAddress] of Object.entries(implementations)) {
                if (deploymentLog.implementations && deploymentLog.implementations[contractName]) {
                    const expectedImpl = deploymentLog.implementations[contractName];
                    const match = implAddress.toLowerCase() === expectedImpl.toLowerCase();
                    
                    console.log(`${contractName}: ${match ? '✓ MATCH' : '✗ MISMATCH'}`);
                    if (!match) {
                        console.log(`  Expected: ${expectedImpl}`);
                        console.log(`  Actual:   ${implAddress}`);
                        allMatch = false;
                    }
                }
            }
            
            console.log(`\nAll implementations match: ${allMatch ? 'YES ✓' : 'NO ✗'}`);
        }
    } catch (error) {
        console.log('\nCould not compare with deployment log:', error.message);
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });