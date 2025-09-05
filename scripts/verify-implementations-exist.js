const { ethers } = require('hardhat');

async function main() {
    const factoryAddress = '0x365086b093Eb31CD32653271371892136FcAb254';
    
    console.log('=== Checking Token Implementation Addresses ===');
    console.log('Factory address:', factoryAddress);
    console.log('---\n');
    
    const Factory = await ethers.getContractAt('FinatradesTokenFactory', factoryAddress);
    
    // Check each implementation type
    const implementations = {
        'ERC20': null,
        'ERC721': null,
        'ERC1155': null,
        'Compliance': null
    };
    
    try {
        implementations.ERC20 = await Factory.erc20Implementation();
        console.log('ERC20 Implementation:', implementations.ERC20);
        
        if (implementations.ERC20 === '0x0000000000000000000000000000000000000000') {
            console.log('  ❌ NOT SET - ERC20 implementation missing!');
        } else {
            const code = await ethers.provider.getCode(implementations.ERC20);
            if (code === '0x') {
                console.log('  ❌ No contract at ERC20 implementation address!');
            } else {
                console.log('  ✅ ERC20 implementation contract exists');
            }
        }
    } catch (e) {
        console.log('Error checking ERC20 implementation:', e.message);
    }
    
    console.log('');
    
    try {
        implementations.ERC721 = await Factory.erc721Implementation();
        console.log('ERC721 Implementation:', implementations.ERC721);
        
        if (implementations.ERC721 === '0x0000000000000000000000000000000000000000') {
            console.log('  ❌ NOT SET - ERC721 implementation missing!');
        } else {
            const code = await ethers.provider.getCode(implementations.ERC721);
            if (code === '0x') {
                console.log('  ❌ No contract at ERC721 implementation address!');
            } else {
                console.log('  ✅ ERC721 implementation contract exists');
            }
        }
    } catch (e) {
        console.log('Error checking ERC721 implementation:', e.message);
    }
    
    console.log('');
    
    try {
        implementations.ERC1155 = await Factory.erc1155Implementation();
        console.log('ERC1155 Implementation:', implementations.ERC1155);
        
        if (implementations.ERC1155 === '0x0000000000000000000000000000000000000000') {
            console.log('  ❌ NOT SET - ERC1155 implementation missing!');
        } else {
            const code = await ethers.provider.getCode(implementations.ERC1155);
            if (code === '0x') {
                console.log('  ❌ No contract at ERC1155 implementation address!');
            } else {
                console.log('  ✅ ERC1155 implementation contract exists');
            }
        }
    } catch (e) {
        console.log('Error checking ERC1155 implementation:', e.message);
    }
    
    console.log('');
    
    try {
        implementations.Compliance = await Factory.complianceImplementation();
        console.log('Compliance Implementation:', implementations.Compliance);
        
        if (implementations.Compliance === '0x0000000000000000000000000000000000000000') {
            console.log('  ❌ NOT SET - Compliance implementation missing!');
        } else {
            const code = await ethers.provider.getCode(implementations.Compliance);
            if (code === '0x') {
                console.log('  ❌ No contract at Compliance implementation address!');
            } else {
                console.log('  ✅ Compliance implementation contract exists');
            }
        }
    } catch (e) {
        console.log('Error checking Compliance implementation:', e.message);
    }
    
    // Summary
    console.log('\n=== Summary ===');
    
    const missingImplementations = [];
    for (const [name, address] of Object.entries(implementations)) {
        if (address === '0x0000000000000000000000000000000000000000' || address === null) {
            missingImplementations.push(name);
        }
    }
    
    if (missingImplementations.length > 0) {
        console.log('❌ Missing implementations:', missingImplementations.join(', '));
        console.log('\n⚠️  The factory cannot deploy tokens without these implementation contracts!');
        console.log('\nTo fix this issue:');
        console.log('1. Deploy the missing implementation contracts');
        console.log('2. Call setImplementation() on the factory to set each implementation address');
    } else {
        // Check if we can get the code at the addresses
        let hasIssues = false;
        for (const [name, address] of Object.entries(implementations)) {
            if (address && address !== '0x0000000000000000000000000000000000000000') {
                const code = await ethers.provider.getCode(address);
                if (code === '0x') {
                    console.log(`❌ ${name} implementation address is set but no contract exists there!`);
                    hasIssues = true;
                }
            }
        }
        
        if (!hasIssues) {
            console.log('✅ All implementation contracts are properly set!');
        }
    }
}

main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
    });
