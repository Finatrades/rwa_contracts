# Finatrades RWA ERC-3643 - Audit Documentation

## Executive Summary

The Finatrades RWA platform is an ERC-3643 (T-REX) compliant security token system designed for tokenizing real-world assets with comprehensive compliance, identity management, and regulatory controls.

## Contract Architecture

The platform consists of several key components:

### Core Contracts

1. **FinatradesRWA_ERC3643**
   - Main security token contract
   - ERC-20 compatible with additional security features
   - Asset management capabilities
   - Dividend distribution system
   - Snapshot functionality for corporate actions

2. **Identity Registry**
   - Manages investor identities
   - Links wallet addresses to identity contracts
   - Verifies investor claims against requirements

3. **Claim Topics Registry**
   - Defines required claims for token holders
   - Manages trusted claim issuers
   - Configurable compliance requirements

4. **Claim Issuer**
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

### 2. Asset Management
- Multi-asset support (up to 1,000 assets)
- Asset types: Residential, Commercial, Industrial, Agricultural, Mixed-Use
- Valuation tracking and updates
- Rental income distribution

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

# Deploy to Polygon Mumbai testnet
npx hardhat run scripts/deploy_erc3643.js --network polygonMumbai

# Deploy to Polygon mainnet
npx hardhat run scripts/deploy_erc3643.js --network polygon
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

| Contract | Address | Verification Status |
|----------|---------|--------------------|
| ClaimTopicsRegistry | [`0x315a3f5d4a482204eA7EaE89D05e64b6B90a919E`](https://polygonscan.com/address/0x315a3f5d4a482204eA7EaE89D05e64b6B90a919E) | Pending |
| IdentityRegistry | [`0x1D6f1Ca3Df3d601A079E02dCaBd809D5Bd95fe80`](https://polygonscan.com/address/0x1D6f1Ca3Df3d601A079E02dCaBd809D5Bd95fe80) | Pending |
| ClaimIssuer | [`0x55106CFA1217A15A6bcedc7dFf9Ca0897f4E378a`](https://polygonscan.com/address/0x55106CFA1217A15A6bcedc7dFf9Ca0897f4E378a) | Pending |
| CountryRestrictModule | [`0x952E87D7f2f5FDe3f387bE9bd6CE59Ad98BbD3A7`](https://polygonscan.com/address/0x952E87D7f2f5FDe3f387bE9bd6CE59Ad98BbD3A7) | Pending |
| TransferLimitModule | [`0xAC4d1d37b307DE646A82A65F9a19a5a54F4D8f00`](https://polygonscan.com/address/0xAC4d1d37b307DE646A82A65F9a19a5a54F4D8f00) | Pending |
| MaxBalanceModule | [`0x60540b959652Ef4E955385C6E28529520a25dcd2`](https://polygonscan.com/address/0x60540b959652Ef4E955385C6E28529520a25dcd2) | Pending |
| ModularCompliance | [`0x9Db249617E876c18248Bf5Cd1289fA33A725170d`](https://polygonscan.com/address/0x9Db249617E876c18248Bf5Cd1289fA33A725170d) | Pending |
| FinatradesRWA_ERC3643 | [`0x10375fdf730D39774eF1fD20424CD0504ef35afb`](https://polygonscan.com/address/0x10375fdf730D39774eF1fD20424CD0504ef35afb) | Pending |
| Timelock | [`0xc929923D0d52Df0b72C8cf00C7c6156DB24232dE`](https://polygonscan.com/address/0xc929923D0d52Df0b72C8cf00C7c6156DB24232dE) | Pending |

**Network**: Polygon Mainnet (ChainID: 137)
**Deployer**: `0xCE982AC6bc316Cf9d875652B84C7626B62a899eA`
**Block Range**: 73905850 - 73905906
**Total POL Used**: ~0.7 POL

## 📖 Usage Examples

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

## Deployment Information

- **Compiler**: Solidity 0.8.19
- **Optimizer**: Enabled (runs: 1)
- **Network**: Polygon Mainnet
- **Total Deployment Gas**: ~25,000,000
- **Deployment Status**: Complete ✅
- **Configuration Status**: Complete ✅
  - All compliance modules added to ModularCompliance
  - Token bound to compliance contract
  - Ready for identity registration and claim issuance
- **Verification**: Pending (use `npx hardhat verify` commands)

## Contact

**Security Contact**: security@finatrades.com