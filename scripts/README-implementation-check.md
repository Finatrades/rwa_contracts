# Proxy Implementation Address Scripts

This directory contains scripts to retrieve implementation addresses from proxy contracts.

## Scripts

### 1. `get-implementation-addresses.js`
A simple script that retrieves implementation addresses for the specified proxy contracts using the EIP-1967 standard storage slot.

**Usage:**
```bash
npx hardhat run scripts/get-implementation-addresses.js --network polygon
```

**Features:**
- Retrieves implementation addresses using the standard EIP-1967 slot
- Saves results to `deployments/implementation-addresses.json`
- Compares results with existing deployment logs
- Shows matching/mismatching implementations

### 2. `check-proxy-implementations.js`
A comprehensive script that performs detailed analysis of proxy contracts and their implementations.

**Usage:**
```bash
npx hardhat run scripts/check-proxy-implementations.js --network polygon
```

**Features:**
- Checks multiple proxy patterns (EIP-1967, OpenZeppelin Legacy, Transparent Proxy, Beacon)
- Verifies that code exists at both proxy and implementation addresses
- Reports contract code sizes
- Identifies proxy pattern used
- Retrieves admin addresses when available
- Saves detailed results to `deployments/proxy-implementation-check.json`
- Saves simplified results to `deployments/implementation-addresses-simple.json`

## Proxy Addresses

The scripts check the following proxy contracts:
- `claimTopicsRegistry`: 0xeCf537CADeBd2951776f3AC3c1e9b76218d6ecE4
- `identityRegistry`: 0x59A1923E694061b9A49b2eC92AeeF99077f42532
- `claimIssuer`: 0x625986DD1A10859C7F6326eE50B9901D5AD82170
- `countryModule`: 0x620818526106cc35ab598D2500632A62e0176619
- `transferLimitModule`: 0xbb109a19000dF7ca3062161794405DAC026DB4E5
- `maxBalanceModule`: 0x64BC91aba0EF92F4565b076Ea1382B2d82d418cD
- `modularCompliance`: 0x115f87dC7bB192924069b4291DAF0Dcd39C0A76b
- `token`: 0x414A484985771C2CFDA215FB20C48ed037eE409b
- `assetRegistry`: 0xB678e16e773790B0FD56D36a516731dfA8761b77

## Expected Implementation Addresses

Based on the deployment logs, the expected implementation addresses are:
- `claimTopicsRegistry`: 0xF3e5D0f2d6bE87DA0AeA7da96c5c97Fe36D3C55E
- `identityRegistry`: 0x5a77D37e5c3B3EC2DCcE82F8DE2D4F9FD2b88329
- `claimIssuer`: 0xAcE2FA0Aec33A3a0B685f7ce90d8851E7d91AeD8
- `countryModule`: 0x0B2ce8afFdcBCb3dd5d614f973Fc2d2f4Df3c3E1
- `transferLimitModule`: 0x4b96a3c3B37A3d0A10aDb0Be9cb45E2d55F9DDd0
- `maxBalanceModule`: 0x6cEA7336c0F8E1F95B67Ed88c8a59E46E9Ce569A
- `modularCompliance`: 0x87e7eA8F688e1ec417a0d4C95BA8d43F49Fa3e5B
- `token`: 0x907e31Fe52dE3C48C4c07F436a7d1e25D9FDCc70
- `assetRegistry`: 0xED5b1FC638f18D7AEa0DC24c7E3fa96D73AB4E23

## Technical Details

### EIP-1967 Storage Slot
The implementation address is stored at storage slot:
`0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc`

This is calculated as: `keccak256("eip1967.proxy.implementation") - 1`

### Reading Storage
The scripts use `ethers.provider.getStorageAt(address, slot)` to read the storage value directly from the blockchain.

## Requirements
- Node.js and npm installed
- Hardhat configured with the target network
- Network RPC URL and required environment variables set in `.env`