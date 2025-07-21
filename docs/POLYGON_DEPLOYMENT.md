# Polygon Mainnet Deployment Guide

## Overview

All Finatrades RWA contracts are fully compatible with Polygon mainnet. Unlike Ethereum mainnet, Polygon has **no 24KB contract size limit**, allowing deployment of our full-featured contracts.

## Contract Recommendations for Polygon

### 1. **FinatradesRWA_Enterprise** (Recommended)
- **Best for**: Institutional deployments requiring full compliance and reporting
- **Features**: Complete RWA tokenization with integrated regulatory reporting
- **Gas Cost**: ~3-5M gas for deployment
- **Benefits on Polygon**: 
  - Low deployment cost (~$3-5 vs ~$3000 on Ethereum)
  - All features available in single contract
  - No need for modular deployment

### 2. **FinatradesRWA_Extended**
- **Best for**: Standard RWA tokenization without reporting
- **Features**: Full asset management and dividend distribution
- **Gas Cost**: ~2.5-3.5M gas for deployment

### 3. **FinatradesRWA_Core**
- **Best for**: Projects prioritizing minimal gas costs
- **Features**: Essential RWA tokenization features
- **Gas Cost**: ~2-3M gas for deployment

## Polygon-Specific Optimizations

1. **High Optimization Runs** (999999)
   - Optimizes for runtime gas efficiency
   - Ideal for Polygon's low gas costs
   - Reduces transaction costs for users

2. **Batch Operations**
   - Take advantage of low gas costs
   - Process larger batches (up to 100 items)
   - Efficient for airdrops and mass transfers

3. **Event Logging**
   - Comprehensive events for off-chain indexing
   - Lower cost allows detailed logging
   - Better integration with Graph Protocol

## Deployment Steps

### 1. Environment Setup
```bash
# .env file
POLYGON_RPC_URL=https://polygon-rpc.com
PRIVATE_KEY=your_deployment_key
POLYGONSCAN_API_KEY=your_api_key
```

### 2. Deploy Core Infrastructure
```bash
# Deploy identity and compliance contracts
npx hardhat run scripts/deploy-polygon-infrastructure.js --network polygon

# Deploy main token contract
npx hardhat run scripts/deploy-polygon-token.js --network polygon
```

### 3. Verify Contracts
```bash
npx hardhat verify --network polygon DEPLOYED_ADDRESS "constructor" "arguments"
```

### 4. Post-Deployment
1. Configure compliance modules
2. Set up identity registry
3. Initialize asset registry
4. Grant appropriate roles

## Gas Costs Comparison

| Operation | Ethereum Mainnet | Polygon Mainnet |
|-----------|-----------------|-----------------|
| Contract Deployment | $2,000 - $5,000 | $2 - $5 |
| Token Transfer | $30 - $100 | $0.01 - $0.05 |
| Mint Tokens | $50 - $150 | $0.02 - $0.08 |
| Claim Dividend | $40 - $120 | $0.02 - $0.06 |
| Batch Transfer (10) | $300 - $900 | $0.15 - $0.45 |

## Security Considerations

1. **Bridge Security**
   - Use official Polygon Bridge for MATIC transfers
   - Implement timelock for critical operations
   - Monitor bridge activities

2. **Validator Set**
   - Polygon has fewer validators than Ethereum
   - Consider additional security measures for high-value assets

3. **Finality**
   - Polygon has faster finality (~2 seconds)
   - Wait for sufficient confirmations for large transactions

## Best Practices

1. **Use FinatradesRWA_Enterprise** for full features
2. **Set high optimization runs** for gas efficiency
3. **Implement comprehensive monitoring** using events
4. **Use Graph Protocol** for efficient data querying
5. **Enable meta-transactions** for gasless operations

## Contract Addresses (To be filled after deployment)

```json
{
  "network": "polygon",
  "chainId": 137,
  "contracts": {
    "Token": "0x...",
    "IdentityRegistry": "0x...",
    "ModularCompliance": "0x...",
    "AssetRegistry": "0x...",
    "RegulatoryReporting": "0x...",
    "ClaimTopicsRegistry": "0x...",
    "FinatradesTimelock": "0x..."
  }
}
```

## Support

For deployment assistance, contact: support@finatrades.com