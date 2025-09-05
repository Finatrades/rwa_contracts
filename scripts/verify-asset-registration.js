const { ethers } = require('hardhat');

async function main() {
    const assetId = '0x6634303030726b737773617261647a3931615f31373536333631343239333638';
    const registryAddress = '0x83413e2C668c9249331Bc88D370655bb44527867';
    
    console.log('Verifying asset registration...');
    console.log('Asset ID:', assetId);
    console.log('Registry:', registryAddress);
    console.log('---');
    
    const AssetRegistry = await ethers.getContractAt('AssetRegistry', registryAddress);
    
    try {
        const asset = await AssetRegistry.getAsset(assetId);
        console.log('✅ Asset found in registry!');
        console.log('\nAsset Details:');
        console.log('  Name:', asset.name);
        console.log('  Category:', asset.category.toString());
        console.log('  Valuation:', ethers.formatEther(asset.valuationAmount), 'tokens');
        console.log('  Metadata URI:', asset.metadataURI);
        console.log('  Custodian:', asset.custodian);
        
        console.log('\n✅ Asset is properly registered and ready for token deployment!');
        console.log('\nYou can now update your backend to retry the token deployment.');
        console.log('The asset registration is confirmed at Asset ID:', assetId);
        
    } catch (error) {
        console.error('❌ Asset not found:', error.reason || error.message);
    }
}

main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
    });