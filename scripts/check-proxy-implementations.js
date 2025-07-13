const { ethers } = require('hardhat');
const fs = require('fs');
const path = require('path');

// Common proxy implementation storage slots
const SLOTS = {
    // EIP-1967 implementation slot
    EIP1967_IMPLEMENTATION: '0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc',
    // EIP-1967 admin slot
    EIP1967_ADMIN: '0xb53127684a568b3173ae13b9f8a6016e243e63b6e8ee1178d6a717850b5d6103',
    // OpenZeppelin's old implementation slot (pre-EIP1967)
    OZ_IMPLEMENTATION_OLD: '0x7050c9e0f4ca769c69bd3a8ef740bc37934f8e2c036e5a723fd8ee048ed3f8c3',
    // Transparent proxy pattern implementation slot
    TRANSPARENT_IMPLEMENTATION: '0x5f3b5dfeb7b28cdbd7faba78963ee202a494e2a2cc8c9978d5e30d2e474b3618'
};

async function getStorageValue(provider, address, slot) {
    try {
        const value = await provider.getStorageAt(address, slot);
        return value;
    } catch (error) {
        return null;
    }
}

async function getImplementationDetails(provider, proxyAddress) {
    const details = {
        proxy: proxyAddress,
        implementation: null,
        admin: null,
        pattern: null
    };

    // Try EIP-1967 implementation slot first (most common)
    let implStorage = await getStorageValue(provider, proxyAddress, SLOTS.EIP1967_IMPLEMENTATION);
    if (implStorage && implStorage !== '0x0000000000000000000000000000000000000000000000000000000000000000') {
        details.implementation = '0x' + implStorage.slice(-40);
        details.pattern = 'EIP-1967';
        
        // Also try to get admin
        const adminStorage = await getStorageValue(provider, proxyAddress, SLOTS.EIP1967_ADMIN);
        if (adminStorage && adminStorage !== '0x0000000000000000000000000000000000000000000000000000000000000000') {
            details.admin = '0x' + adminStorage.slice(-40);
        }
        
        return details;
    }

    // Try old OpenZeppelin slot
    implStorage = await getStorageValue(provider, proxyAddress, SLOTS.OZ_IMPLEMENTATION_OLD);
    if (implStorage && implStorage !== '0x0000000000000000000000000000000000000000000000000000000000000000') {
        details.implementation = '0x' + implStorage.slice(-40);
        details.pattern = 'OpenZeppelin (Legacy)';
        return details;
    }

    // Try transparent proxy slot
    implStorage = await getStorageValue(provider, proxyAddress, SLOTS.TRANSPARENT_IMPLEMENTATION);
    if (implStorage && implStorage !== '0x0000000000000000000000000000000000000000000000000000000000000000') {
        details.implementation = '0x' + implStorage.slice(-40);
        details.pattern = 'Transparent Proxy';
        return details;
    }

    // Check if it might be a beacon proxy by looking for common beacon methods
    try {
        const beaconABI = ['function implementation() view returns (address)'];
        const contract = new ethers.Contract(proxyAddress, beaconABI, provider);
        const impl = await contract.implementation();
        if (impl && impl !== ethers.constants.AddressZero) {
            details.implementation = impl;
            details.pattern = 'Beacon Proxy';
            return details;
        }
    } catch (error) {
        // Not a beacon proxy
    }

    return details;
}

async function getContractInfo(provider, address) {
    try {
        const code = await provider.getCode(address);
        const codeSize = (code.length - 2) / 2; // Remove '0x' and convert hex to bytes
        
        return {
            hasCode: code !== '0x',
            codeSize: codeSize,
            codeHash: ethers.utils.keccak256(code)
        };
    } catch (error) {
        return {
            hasCode: false,
            codeSize: 0,
            codeHash: null
        };
    }
}

async function main() {
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

    console.log('='.repeat(80));
    console.log('PROXY IMPLEMENTATION CHECKER');
    console.log('='.repeat(80));
    console.log(`Network: ${network.name}`);
    console.log(`Chain ID: ${network.config.chainId}`);
    console.log(`Timestamp: ${new Date().toISOString()}`);
    console.log('='.repeat(80));
    console.log();

    const provider = ethers.provider;
    const results = {};

    for (const [contractName, proxyAddress] of Object.entries(proxyAddresses)) {
        console.log(`\n[${contractName}]`);
        console.log('-'.repeat(60));
        
        // Get proxy info
        const proxyInfo = await getContractInfo(provider, proxyAddress);
        console.log(`Proxy Address: ${proxyAddress}`);
        console.log(`  Has Code: ${proxyInfo.hasCode ? 'Yes' : 'No'}`);
        console.log(`  Code Size: ${proxyInfo.codeSize} bytes`);
        
        if (!proxyInfo.hasCode) {
            console.log('  ⚠️  WARNING: No code at proxy address!');
            results[contractName] = { error: 'No code at proxy address' };
            continue;
        }

        // Get implementation details
        const details = await getImplementationDetails(provider, proxyAddress);
        
        if (details.implementation) {
            console.log(`  Proxy Pattern: ${details.pattern}`);
            console.log(`\nImplementation: ${details.implementation}`);
            
            // Get implementation info
            const implInfo = await getContractInfo(provider, details.implementation);
            console.log(`  Has Code: ${implInfo.hasCode ? 'Yes' : 'No'}`);
            console.log(`  Code Size: ${implInfo.codeSize} bytes`);
            
            if (!implInfo.hasCode) {
                console.log('  ⚠️  WARNING: No code at implementation address!');
            }
            
            if (details.admin) {
                console.log(`\nAdmin: ${details.admin}`);
            }
            
            results[contractName] = details;
        } else {
            console.log('  ❌ Could not determine implementation address');
            console.log('  This might not be a proxy contract or uses an unknown pattern');
            results[contractName] = { error: 'Implementation not found' };
        }
    }

    // Save detailed results
    const outputData = {
        network: network.name,
        chainId: network.config.chainId,
        timestamp: new Date().toISOString(),
        results: results
    };

    const outputPath = path.join(__dirname, '..', 'deployments', 'proxy-implementation-check.json');
    fs.writeFileSync(outputPath, JSON.stringify(outputData, null, 2));

    // Create summary
    console.log('\n' + '='.repeat(80));
    console.log('SUMMARY');
    console.log('='.repeat(80));
    
    const implementations = {};
    for (const [contractName, details] of Object.entries(results)) {
        if (details.implementation) {
            implementations[contractName] = details.implementation;
            console.log(`${contractName}: ${details.implementation}`);
        } else {
            console.log(`${contractName}: ERROR - ${details.error}`);
        }
    }

    // Save simplified implementation list
    const simpleOutputPath = path.join(__dirname, '..', 'deployments', 'implementation-addresses-simple.json');
    fs.writeFileSync(simpleOutputPath, JSON.stringify({
        network: network.name,
        chainId: network.config.chainId,
        timestamp: new Date().toISOString(),
        implementations: implementations
    }, null, 2));

    console.log('\n' + '='.repeat(80));
    console.log('Files saved:');
    console.log(`  - Detailed results: ${outputPath}`);
    console.log(`  - Simple implementations: ${simpleOutputPath}`);
    console.log('='.repeat(80));
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });