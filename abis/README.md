# Contract ABIs

This directory contains the Application Binary Interfaces (ABIs) for all deployed contracts.

## ABI Files

- **ClaimTopicsRegistry.json** - Registry for claim topics used in identity verification
- **IdentityRegistry.json** - Registry managing investor identities and KYC status
- **CountryRestrictModule.json** - Compliance module for country-based restrictions
- **MaxBalanceModule.json** - Compliance module for maximum balance limits
- **TransferLimitModule.json** - Compliance module for transfer amount limits
- **ModularCompliance.json** - Main compliance contract orchestrating all modules
- **AssetRegistry.json** - Registry for underlying RWA assets
- **FinatradesTimelock.json** - Timelock controller for governance
- **FinatradesRWA_Enterprise.json** - Main token contract with full features
- **RegulatoryReportingOptimized.json** - Regulatory reporting system

## Usage

Import the ABIs in your application:

```javascript
const tokenABI = require('./FinatradesRWA_Enterprise.json');
const identityABI = require('./IdentityRegistry.json');
```

## Contract Addresses

See `deployments/polygon_mainnet_latest.json` for the latest contract addresses.