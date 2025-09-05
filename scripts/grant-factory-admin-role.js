const { ethers } = require('hardhat');
require('dotenv').config();

async function main() {
    const registryAddress = '0x83413e2C668c9249331Bc88D370655bb44527867';
    const factoryAddress = '0x365086b093Eb31CD32653271371892136FcAb254';
    
    console.log('Granting permissions to FinatradesTokenFactory...');
    console.log('Asset Registry:', registryAddress);
    console.log('Token Factory:', factoryAddress);
    console.log('---');
    
    // Get signer
    const [signer] = await ethers.getSigners();
    console.log('Signer address:', signer.address);
    
    // Get AssetRegistry contract
    const AssetRegistry = await ethers.getContractAt('AssetRegistry', registryAddress);
    
    // Define role constants
    const DEFAULT_ADMIN_ROLE = '0x0000000000000000000000000000000000000000000000000000000000000000';
    const ASSET_ADMIN_ROLE = ethers.keccak256(ethers.toUtf8Bytes('ASSET_ADMIN'));
    
    console.log('\nRole hashes:');
    console.log('DEFAULT_ADMIN_ROLE:', DEFAULT_ADMIN_ROLE);
    console.log('ASSET_ADMIN_ROLE:', ASSET_ADMIN_ROLE);
    
    // Check current permissions
    console.log('\n--- Checking Current Permissions ---');
    
    const factoryHasDefaultAdmin = await AssetRegistry.hasRole(DEFAULT_ADMIN_ROLE, factoryAddress);
    console.log('Factory has DEFAULT_ADMIN role:', factoryHasDefaultAdmin);
    
    const factoryHasAssetAdmin = await AssetRegistry.hasRole(ASSET_ADMIN_ROLE, factoryAddress);
    console.log('Factory has ASSET_ADMIN role:', factoryHasAssetAdmin);
    
    // Check signer permissions
    const signerHasDefaultAdmin = await AssetRegistry.hasRole(DEFAULT_ADMIN_ROLE, signer.address);
    console.log('Signer has DEFAULT_ADMIN role:', signerHasDefaultAdmin);
    
    if (!signerHasDefaultAdmin) {
        console.error('❌ Signer does not have DEFAULT_ADMIN role to grant permissions');
        return;
    }
    
    // Grant necessary roles to factory
    const rolesToGrant = [];
    
    if (!factoryHasDefaultAdmin) {
        rolesToGrant.push({
            role: DEFAULT_ADMIN_ROLE,
            name: 'DEFAULT_ADMIN'
        });
    }
    
    if (!factoryHasAssetAdmin) {
        rolesToGrant.push({
            role: ASSET_ADMIN_ROLE,
            name: 'ASSET_ADMIN'
        });
    }
    
    if (rolesToGrant.length === 0) {
        console.log('\n✅ Factory already has all necessary permissions');
        return;
    }
    
    console.log('\n--- Granting Roles ---');
    
    for (const roleInfo of rolesToGrant) {
        console.log(`\nGranting ${roleInfo.name} role to factory...`);
        
        try {
            const tx = await AssetRegistry.grantRole(roleInfo.role, factoryAddress);
            console.log('Transaction sent:', tx.hash);
            
            const receipt = await tx.wait();
            console.log('Transaction confirmed in block:', receipt.blockNumber);
            
            // Verify role was granted
            const hasRole = await AssetRegistry.hasRole(roleInfo.role, factoryAddress);
            console.log(`✅ ${roleInfo.name} role granted successfully:`, hasRole);
            
        } catch (error) {
            console.error(`❌ Failed to grant ${roleInfo.name} role:`, error.reason || error.message);
        }
    }
    
    // Final verification
    console.log('\n--- Final Permission Status ---');
    
    const finalDefaultAdmin = await AssetRegistry.hasRole(DEFAULT_ADMIN_ROLE, factoryAddress);
    console.log('Factory has DEFAULT_ADMIN role:', finalDefaultAdmin);
    
    const finalAssetAdmin = await AssetRegistry.hasRole(ASSET_ADMIN_ROLE, factoryAddress);
    console.log('Factory has ASSET_ADMIN role:', finalAssetAdmin);
    
    if (finalDefaultAdmin && finalAssetAdmin) {
        console.log('\n🎉 FinatradesTokenFactory now has all necessary permissions!');
        console.log('The factory can now deploy tokens and update asset records.');
    }
}

main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
    });