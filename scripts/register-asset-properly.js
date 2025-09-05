const { ethers } = require('hardhat');
require('dotenv').config();

async function main() {
    // Asset details from the failed attempt
    const assetId = '0x6634303030726b737773617261647a3931615f31373536333631343239333638';
    const name = 'Fina Germanium Token';
    const category = 7; // From the original attempt
    const valuationAmount = ethers.parseEther('2100000'); // 2.1M tokens
    const metadataURI = 'ipfs://QmSSLqJdXoFdQxPHWDJYiAEKx5UzvXeCsFBXMkveGT6TFH';
    const custodian = '0x9F4B0E138F6Caa9756d81F238FF027CBF96a1B34';
    
    const registryAddress = '0x83413e2C668c9249331Bc88D370655bb44527867';
    
    console.log('Registering asset with proper permissions...');
    console.log('Asset ID:', assetId);
    console.log('Name:', name);
    console.log('Category:', category);
    console.log('Valuation Amount:', valuationAmount.toString());
    console.log('Metadata URI:', metadataURI);
    console.log('Custodian:', custodian);
    console.log('Registry:', registryAddress);
    console.log('---');
    
    // Get signer
    const [signer] = await ethers.getSigners();
    console.log('Signer address:', signer.address);
    
    // Get AssetRegistry contract
    const AssetRegistry = await ethers.getContractAt('AssetRegistry', registryAddress);
    
    // Check permissions
    const ASSET_ADMIN_ROLE = ethers.keccak256(ethers.toUtf8Bytes('ASSET_ADMIN'));
    const hasRole = await AssetRegistry.hasRole(ASSET_ADMIN_ROLE, signer.address);
    console.log('Signer has ASSET_ADMIN role:', hasRole);
    
    if (!hasRole) {
        console.error('❌ Signer does not have ASSET_ADMIN role');
        return;
    }
    
    // Check if asset already exists
    try {
        const existingAsset = await AssetRegistry.getAsset(assetId);
        console.log('⚠️ Asset already exists:', existingAsset.name);
        return;
    } catch (e) {
        console.log('✓ Asset does not exist yet, proceeding with registration');
    }
    
    // Register the asset
    console.log('\nRegistering asset...');
    
    try {
        const tx = await AssetRegistry.registerAsset(
            assetId,
            name,
            category,
            valuationAmount,
            metadataURI,
            custodian
        );
        
        console.log('Transaction sent:', tx.hash);
        
        const receipt = await tx.wait();
        console.log('Transaction confirmed in block:', receipt.blockNumber);
        console.log('Gas used:', receipt.gasUsed.toString());
        console.log('Status:', receipt.status === 1 ? 'SUCCESS' : 'FAILED');
        
        if (receipt.status === 1) {
            // Verify the asset was registered
            console.log('\n--- Verifying Registration ---');
            
            const registeredAsset = await AssetRegistry.getAsset(assetId);
            console.log('✅ Asset registered successfully!');
            console.log('Asset details from chain:');
            console.log('  Name:', registeredAsset.name);
            console.log('  Category:', registeredAsset.category.toString());
            console.log('  Valuation:', registeredAsset.valuationAmount.toString());
            console.log('  Metadata URI:', registeredAsset.metadataURI);
            console.log('  Custodian:', registeredAsset.custodian);
            
            // Handle optional fields that might not exist
            if (registeredAsset.tokenAddress !== undefined) {
                console.log('  Token Address:', registeredAsset.tokenAddress);
            }
            if (registeredAsset.tokenType !== undefined) {
                console.log('  Token Type:', registeredAsset.tokenType.toString());
            }
            if (registeredAsset.compliance !== undefined) {
                console.log('  Compliance:', registeredAsset.compliance);
            }
            
            // Check the next asset ID
            try {
                const nextId = await AssetRegistry.nextAssetId();
                console.log('\nNext asset ID on chain:', nextId.toString());
            } catch (e) {
                // Method might not exist
            }
            
            console.log('\n🎉 Asset registration completed successfully!');
            console.log('You can now proceed with token deployment for this asset.');
            
        } else {
            console.error('❌ Transaction failed');
        }
        
    } catch (error) {
        console.error('❌ Failed to register asset:', error.reason || error.message);
        
        if (error.data) {
            console.log('Error data:', error.data);
        }
    }
}

main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
    });