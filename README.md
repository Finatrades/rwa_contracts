# Finatrades Universal RWA Platform - ERC-3643 Compliant

## Executive Summary

The Finatrades Universal RWA platform is an ERC-3643 (T-REX) compliant security token system that can tokenize **ANY type of real-world asset** - from gold and real estate to intellectual property and carbon credits. Built with institutional-grade security, unlimited scalability, and comprehensive compliance features.

## Contract Architecture

The platform consists of several key components:

### Core Contracts

1. **AssetRegistry** (V2 - NEW)
   - Universal registry for ANY asset type
   - Unlimited asset storage (no 1,000 limit)
   - Flexible attribute system
   - Revenue stream management
   - Custodian tracking

2. **FinatradesRWA_ERC3643_V2** (V2 - NEW)
   - Enhanced security token with registry integration
   - Asset-specific token tracking
   - Per-asset dividend distribution
   - Full ERC-3643 compliance

3. **Identity Registry**
   - Manages investor identities
   - Links wallet addresses to identity contracts
   - Verifies investor claims against requirements

4. **Claim Topics Registry**
   - Defines required claims for token holders
   - Manages trusted claim issuers
   - Configurable compliance requirements

5. **Claim Issuer**
   - Issues KYC/AML claims
   - Manages investor verification
   - Supports claim revocation and updates

### Compliance Modules

1. **Country Restrict Module**
   - Enforces jurisdiction-based restrictions
   - Configurable country whitelist/blacklist
   - Cross-border transfer controls

2. **Transfer Limit Module**
   - Daily and monthly transfer limits
   - Per-investor configurable limits
   - Default limits for all investors

3. **Max Balance Module**
   - Maximum token holding restrictions
   - Prevents concentration of ownership
   - Configurable per investor type

## Key Features

### 1. ERC-3643 Compliance
- Full T-REX standard implementation
- Identity-based transfer restrictions
- Modular compliance system
- Claim-based verification

### 2. Asset Management Options
The platform offers two approaches for different needs:

**Standard Token** (`0x56fBE81E9a84d2F87996419F53a2412Ae8B1658b`)
- Built-in asset management
- Suitable for focused portfolios (up to 1,000 assets)
- Direct dividend distribution
- Simpler deployment

**Universal Token with Registry** (`0x713B4184cF7385e39A6c608ECF0885bd8516f91d`)
- External asset registry for unlimited assets
- ANY asset type supported (real estate, gold, art, IP, etc.)
- Flexible attribute system
- Per-asset token tracking
- Asset-specific dividends

Both tokens use the same compliance infrastructure, allowing you to choose based on your asset scale.

### 3. Security Features
- Role-based access control (7 distinct roles)
- Reentrancy protection
- Pausable transfers
- Emergency freeze capabilities
- Timelock governance (48-hour delay)
- UUPS upgradeability pattern


## 🛠️ Installation

```bash
# Clone the repository
git clone https://github.com/finatrades/rwa_contracts.git
cd rwa_contracts

# Install dependencies
npm install

# Copy environment variables
cp .env.example .env
# Edit .env with your configuration

# Compile contracts
npx hardhat compile

# Run tests
npx hardhat test

# Deploy V2 Universal Asset System to Polygon mainnet
npx hardhat run scripts/deploy-universal-rwa.js --network polygon

# Configure the system
npx hardhat run scripts/setup-universal-rwa.js --network polygon

# Deploy to testnet first (recommended)
npx hardhat run scripts/deploy-universal-rwa.js --network polygonAmoy
```

## 🔧 Configuration

### Environment Variables

Create a `.env` file with the following variables:

```env
PRIVATE_KEY=your_private_key_here
POLYGON_RPC_URL=https://polygon-rpc.com
POLYGON_MUMBAI_RPC_URL=https://rpc-mumbai.maticvigil.com
POLYGONSCAN_API_KEY=your_polygonscan_api_key
```

### Compliance Configuration

1. **Set Allowed Countries**
   ```javascript
   // Example: Allow USA and UK
   await countryRestrictModule.setCountryAllowed(840, true); // USA
   await countryRestrictModule.setCountryAllowed(826, true); // UK
   ```

2. **Configure Transfer Limits**
   ```javascript
   // Set default limits
   await transferLimitModule.setDefaultLimits(
     ethers.utils.parseEther("100000"), // Daily limit
     ethers.utils.parseEther("1000000") // Monthly limit
   );
   ```

3. **Add Trusted Claim Issuers**
   ```javascript
   // Add claim issuer for KYC/AML
   await claimTopicsRegistry.addTrustedIssuer(
     claimIssuerAddress,
     [1, 2, 4] // KYC, AML, Country topics
   );
   ```

## Deployed Contracts (Polygon Mainnet)

### Deployed Contracts (All 11 Contracts ✅)

#### Identity & Claims System
| Contract | Address | Purpose |
|----------|---------|---------|
| ClaimTopicsRegistry | [`0xc0b8B69C1EbB0750C79e9E37003f7f9F67C24ba5`](https://polygonscan.com/address/0xc0b8B69C1EbB0750C79e9E37003f7f9F67C24ba5) | Defines required KYC/AML claims |
| IdentityRegistry | [`0x7fF86B722349185aC7Cc7806067Db4265EC428E1`](https://polygonscan.com/address/0x7fF86B722349185aC7Cc7806067Db4265EC428E1) | Links wallets to verified identities |
| ClaimIssuer | [`0x0bB885b7901b4751Cd216B18cc99201fBbeAf8dC`](https://polygonscan.com/address/0x0bB885b7901b4751Cd216B18cc99201fBbeAf8dC) | Issues verified investor claims |

#### Compliance Modules
| Contract | Address | Purpose |
|----------|---------|---------|
| ModularCompliance | [`0xb5Bc25C8FD3a4B5B6c95a57c93A950fb8398789D`](https://polygonscan.com/address/0xb5Bc25C8FD3a4B5B6c95a57c93A950fb8398789D) | Orchestrates all compliance rules |
| CountryRestrictModule | [`0x22038f4Dc583816ea78540612b9d7077f7e05011`](https://polygonscan.com/address/0x22038f4Dc583816ea78540612b9d7077f7e05011) | Country-based transfer restrictions |
| TransferLimitModule | [`0x739870D268aC653090070cC13C69F8c730eB58AF`](https://polygonscan.com/address/0x739870D268aC653090070cC13C69F8c730eB58AF) | Daily/monthly transfer limits |
| MaxBalanceModule | [`0xe2E06a0e6F86F58Bbe76A6b2d5A580e255Fd4E1b`](https://polygonscan.com/address/0xe2E06a0e6F86F58Bbe76A6b2d5A580e255Fd4E1b) | Maximum balance restrictions |

#### Token & Asset Management
| Contract | Address | Purpose |
|----------|---------|---------|
| FinatradesRWA Token | [`0x56fBE81E9a84d2F87996419F53a2412Ae8B1658b`](https://polygonscan.com/address/0x56fBE81E9a84d2F87996419F53a2412Ae8B1658b) | Main ERC-3643 security token |
| AssetRegistry | [`0x30fabB0f59927f5508F7a3b8bfDcf3a60478649F`](https://polygonscan.com/address/0x30fabB0f59927f5508F7a3b8bfDcf3a60478649F) | Universal asset registry (unlimited) |
| Universal RWA Token | [`0x713B4184cF7385e39A6c608ECF0885bd8516f91d`](https://polygonscan.com/address/0x713B4184cF7385e39A6c608ECF0885bd8516f91d) | Enhanced token with registry integration |

#### Governance
| Contract | Address | Purpose |
|----------|---------|---------|
| Timelock | [`0x87F6Ac9B65970fAB951A8595Fb3a06B707721C39`](https://polygonscan.com/address/0x87F6Ac9B65970fAB951A8595Fb3a06B707721C39) | 48-hour delay for critical changes |

**Network**: Polygon Mainnet (ChainID: 137)
**Deployer**: `0xCE982AC6bc316Cf9d875652B84C7626B62a899eA`

> **Note**: Finatrades will be deploying these contracts to **Ethereum Mainnet** soon for enhanced security and institutional adoption. The Polygon deployment serves as our production-ready implementation.

## 🌍 Supported Asset Types

The platform can tokenize literally ANY real-world asset:

| Category | Examples | Use Cases |
|----------|----------|-----------|
| **Real Estate** | Properties, Land, REITs | Fractional ownership, Rental income |
| **Precious Metals** | Gold, Silver, Platinum | Commodity backing, Store of value |
| **Cryptocurrency** | Wrapped BTC, ETH, Stablecoins | Cross-chain assets, DeFi integration |
| **Art & Collectibles** | Paintings, Sculptures, Rare items | Fractional art ownership, Museums |
| **Intellectual Property** | Patents, Copyrights, Trademarks | Royalty sharing, IP licensing |
| **Equity** | Company shares, Startup equity | Private markets, Employee shares |
| **Debt Instruments** | Bonds, Loans, Receivables | Fixed income, Trade finance |
| **Commodities** | Oil, Gas, Agricultural products | Supply chain, Futures |
| **Carbon Credits** | VCS, Gold Standard credits | ESG investing, Offsetting |
| **Luxury Goods** | Watches, Jewelry, Cars | Fractional luxury ownership |
| **Infrastructure** | Solar farms, Toll roads | Yield generation, Public-private |
| **Other** | Any asset with value | Future innovations |

## 📖 Usage Examples

### Tokenizing Gold
```javascript
// Register 1kg gold bar
const goldId = ethers.keccak256(ethers.toUtf8Bytes("GOLD-BAR-001"));
await assetRegistry.registerAsset(
    goldId,
    "1kg Gold Bar LBMA",
    2, // PRECIOUS_METALS
    65000e6, // $65,000
    "ipfs://QmGoldCert",
    vaultAddress
);

// Set attributes
await assetRegistry.setNumericAttribute(goldId, "weight", 1000); // grams
await assetRegistry.setNumericAttribute(goldId, "purity", 9999); // 99.99%

// Tokenize: 1000 tokens = 1kg
await token.tokenizeAsset(goldId, ethers.parseEther("1000"), investor);
```

### Tokenizing Real Estate
```javascript
// Register property
const propId = ethers.keccak256(ethers.toUtf8Bytes("NYC-PROP-001"));
await assetRegistry.registerAsset(
    propId,
    "Manhattan Office",
    1, // REAL_ESTATE
    50000000e6, // $50M
    "ipfs://QmPropertyDocs",
    propertyManager
);

// Create rental income stream
await assetRegistry.createRevenueStream(
    propId,
    250000e6, // $250k/month
    30 * 86400, // Monthly
    rentCollector
);

// Tokenize for fractional ownership
await token.tokenizeAsset(propId, ethers.parseEther("1000000"), owner);
```

## Access Control Matrix

| Role | Permissions | Risk Level |
|------|-------------|------------|
| DEFAULT_ADMIN_ROLE | Grant/revoke all roles | Critical |
| OWNER_ROLE | Contract configuration, compliance settings | High |
| AGENT_ROLE | Mint/burn tokens, freeze addresses | High |
| UPGRADER_ROLE | Authorize contract upgrades | Critical |
| ASSET_MANAGER_ROLE | Add/update assets, set rental info | Medium |
| CORPORATE_ACTIONS_ROLE | Deposit dividends | Medium |
| CLAIM_ISSUER_ROLE | Issue/revoke identity claims | High |

## Security Mechanisms

### 1. Identity Verification
- ERC-734/735 identity contracts
- Claim-based verification system
- Trusted issuer management
- Required claims: KYC (topic 1), AML (topic 2), Country (topic 4)

### 2. Transfer Restrictions
- Identity verification check
- Country-based restrictions
- Daily/monthly transfer limits
- Maximum balance restrictions
- Frozen address checks

### 3. Emergency Controls
- Global pause mechanism
- Individual address freezing
- Partial token freezing
- Recovery functions for lost wallets
- Timelock delay for critical operations

## Testing Coverage

### Unit Tests
- [x] Identity management (IdentityRegistry)
- [x] Claim verification (ClaimIssuer)
- [x] Compliance modules (Country, TransferLimit, MaxBalance)
- [x] Token transfers with restrictions
- [x] Asset management functions
- [x] Dividend distribution
- [x] Emergency functions
- [x] Access control

### Integration Tests  
- [x] Multi-module compliance checks
- [x] Identity + Compliance + Token flow
- [x] Upgrade mechanism (UUPS)
- [x] Timelock operations

### Security Tests
- [x] Reentrancy protection
- [x] Access control bypass attempts
- [x] Integer overflow/underflow (Solidity 0.8.19)
- [x] Front-running mitigation

## Audit Focus Areas

### 1. Identity System
- Verify identity registry cannot be bypassed
- Check claim validation logic
- Ensure trusted issuer management is secure
- Validate identity recovery mechanisms

### 2. Compliance Modules
- Test module interaction and precedence
- Verify modules cannot be bypassed
- Check for module upgrade risks
- Validate restriction enforcement

### 3. Asset Management
- Verify asset valuation update controls
- Check dividend calculation accuracy
- Test for rounding errors in distributions
- Validate rental income flow

### 4. Access Control
- Verify role separation
- Check for privilege escalation
- Test emergency function restrictions
- Validate timelock effectiveness

## Known Issues & Mitigations

1. **Contract Size**: Main token contract approaches size limit
   - Mitigation: Optimizer enabled with runs=1
   - Alternative: Further modularization if needed

2. **Gas Costs**: Complex compliance checks increase transfer costs
   - Mitigation: Batch operations where possible
   - Gas usage: ~150k-200k per compliant transfer

3. **Upgrade Risks**: UUPS pattern requires careful access control
   - Mitigation: Timelock + multi-role approval
   - Upgrade function restricted to UPGRADER_ROLE

## Deployment Status

### Live on Polygon Mainnet
- **11 Contracts**: Fully deployed and configured ✅
- **Architecture**: Complete RWA tokenization platform
- **Compliance**: All modules active ✅
- **Identity System**: Ready for KYC/AML ✅
- **Asset Support**: From single assets to unlimited portfolios ✅

### Platform Capabilities
- **Any Asset Type**: Real estate, gold, art, IP, carbon credits, etc.
- **Flexible Scale**: Choose standard token or registry-based approach
- **Full Compliance**: ERC-3643 with modular restrictions
- **Revenue Distribution**: Built-in dividend mechanisms
- **Institutional Ready**: Timelock governance and upgrade controls

### Technical Details
- **Compiler**: Solidity 0.8.19
- **Optimizer**: Enabled (runs: 1)
- **Network**: Polygon Mainnet
- **Architecture**: UUPS Upgradeable
- **Gas Used**: ~0.7 POL for core system

## Next Steps

1. **Deploy V2 System**:
   ```bash
   npx hardhat run scripts/deploy-universal-rwa.js --network polygon
   ```

2. **Configure System**:
   ```bash
   npx hardhat run scripts/setup-universal-rwa.js --network polygon
   ```

3. **Start Tokenizing**: Register and tokenize ANY real-world asset!

## Contact

**Technical Support**: tech@finatrades.com  
**Security Contact**: security@finatrades.com  
**Asset Onboarding**: assets@finatrades.com