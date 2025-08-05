# Finatrades RWA Smart Contracts

## Table of Contents
- [Executive Summary](#executive-summary)
- [Architecture Overview](#architecture-overview)
- [Deployed Contracts](#deployed-contracts)
- [Contract Details](#contract-details)
- [Security Features](#security-features)
- [Integration Guide](#integration-guide)
- [Testing](#testing)
- [Audit Status](#audit-status)

## Executive Summary

**Finatrades** is pioneering the tokenization of Real World Assets (RWAs) through a comprehensive ERC-3643 compliant security token system. Our platform enables institutions to tokenize any asset class—from real estate and commodities to art and intellectual property—while maintaining full regulatory compliance.

### Key Features
- **ERC-3643 (T-REX) Compliant**: Full implementation of the Token for Regulated EXchanges standard
- **Multi-Asset Support**: Universal registry supporting any type of RWA
- **Flexible Token Standards**: Choose between ERC-20 (fractional) or ERC-721 (NFT) for each asset
- **Token Factory**: Automated deployment of compliant tokens with user-selected standard
- **Modular Compliance**: Pluggable compliance modules for different jurisdictions
- **Identity Management**: On-chain KYC/AML with privacy preservation
- **Regulatory Reporting**: Automated compliance reporting and monitoring
- **Immutable Audit Trail**: Comprehensive compliance action tracking
- **Upgradeability**: UUPS proxy pattern for future enhancements
- **Cross-Chain Ready**: Optional Chainlink CCIP integration for multi-chain deployments (not required for single-chain compliance)

### Technical Stack
- **Blockchain**: Polygon Mainnet (Chain ID: 137)
- **Solidity Version**: 0.8.19
- **Framework**: Hardhat
- **Standards**: ERC-3643, ERC-20, ERC-1967 (UUPS)
- **Dependencies**: OpenZeppelin 4.9.0

## Architecture Overview

### System Architecture
```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           Finatrades RWA Ecosystem                           │
└─────────────────────────────────────────────────────────────────────────────┘
                                        │
        ┌───────────────────────────────┴────────────────────────────────┐
        │                                                                 │
┌───────▼──────────┐                                          ┌──────────▼─────────┐
│  Security Token  │                                          │   Asset Registry   │
│  (ERC-3643)      │◄─────────────────────────────────────────┤   (Universal RWA)  │
└──────┬───────────┘                                          └────────────────────┘
       │                                                                 
       ├──────────────┬────────────────┬─────────────────┬──────────────┐
       │              │                │                 │              │
┌──────▼──────┐ ┌─────▼──────┐ ┌──────▼──────┐ ┌───────▼──────┐ ┌─────▼───────┐
│  Identity    │ │ Compliance │ │  Modules    │ │  Regulatory  │ │  Timelock   │
│  Registry    │ │  Engine    │ │  (3 Types) │ │  Reporting   │ │  Governance │
└─────────────┘ └────────────┘ └─────────────┘ └──────────────┘ └─────────────┘
```

### Token Transfer Flow (Mermaid)
```mermaid
flowchart TD
    Start([User Initiates Transfer]) --> CheckIdentity{Is Sender<br/>KYC Verified?}
    
    CheckIdentity -->|No| RejectKYC[Transfer Rejected:<br/>KYC Required]
    CheckIdentity -->|Yes| CheckReceiver{Is Receiver<br/>KYC Verified?}
    
    CheckReceiver -->|No| RejectReceiverKYC[Transfer Rejected:<br/>Receiver KYC Required]
    CheckReceiver -->|Yes| CheckCompliance{Check Compliance<br/>Modules}
    
    CheckCompliance --> Country{Country<br/>Restrictions OK?}
    Country -->|No| RejectCountry[Transfer Rejected:<br/>Country Restricted]
    Country -->|Yes| Balance{Balance Limit<br/>Check OK?}
    
    Balance -->|No| RejectBalance[Transfer Rejected:<br/>Exceeds Balance Limit]
    Balance -->|Yes| TransferLimit{Transfer Limit<br/>Check OK?}
    
    TransferLimit -->|No| RejectLimit[Transfer Rejected:<br/>Exceeds Transfer Limit]
    TransferLimit -->|Yes| Frozen{Accounts Not<br/>Frozen?}
    
    Frozen -->|No| RejectFrozen[Transfer Rejected:<br/>Account Frozen]
    Frozen -->|Yes| ExecuteTransfer[Execute Token Transfer]
    
    ExecuteTransfer --> UpdateCompliance[Update Compliance State]
    UpdateCompliance --> RecordTransaction[Record in<br/>Regulatory Reporting]
    RecordTransaction --> Success([Transfer Complete])
    
    style Start fill:#e1f5fe
    style Success fill:#c8e6c9
    style RejectKYC fill:#ffcdd2
    style RejectReceiverKYC fill:#ffcdd2
    style RejectCountry fill:#ffcdd2
    style RejectBalance fill:#ffcdd2
    style RejectLimit fill:#ffcdd2
    style RejectFrozen fill:#ffcdd2
```

### Contract Interaction Flow (Mermaid)
```mermaid
graph TB
    subgraph External
        User[User/Investor]
        Admin[Admin/Agent]
        Issuer[Claim Issuer]
    end
    
    subgraph Core
        Token[Token<br/>0x3496D4...]
        Identity[IdentityRegistry<br/>0x4483de...]
        Compliance[ModularCompliance<br/>0xC42a1E...]
        Asset[AssetRegistry<br/>0x04aA90...]
    end
    
    subgraph Modules
        Country[CountryRestrict<br/>0x843299...]
        MaxBal[MaxBalance<br/>0x00145e...]
        Transfer[TransferLimit<br/>0xB45a0e...]
    end
    
    subgraph Reporting
        Report[RegulatoryReporting<br/>0x4337BA...]
        Claims[ClaimTopics<br/>0xb97E45...]
    end
    
    subgraph Governance
        Timelock[Timelock<br/>0x64897d...]
    end
    
    User -->|Transfer| Token
    Admin -->|Mint/Burn| Token
    Admin -->|Configure| Compliance
    Issuer -->|Add Claims| Identity
    
    Token -->|Check KYC| Identity
    Token -->|Check Rules| Compliance
    Token -->|Log Activity| Report
    
    Compliance -->|Query| Country
    Compliance -->|Query| MaxBal
    Compliance -->|Query| Transfer
    
    Identity -->|Verify Claims| Claims
    Asset -->|Report Assets| Report
    
    Admin -->|Delayed Actions| Timelock
    Timelock -->|Execute| Token
    
    style Token fill:#2196F3,color:#fff
    style Identity fill:#4CAF50,color:#fff
    style Compliance fill:#FF9800,color:#fff
    style Asset fill:#9C27B0,color:#fff
```

## Token Selection Guide

### When to Use ERC-20 (Fractional Tokens)

Choose ERC-20 tokens for assets that benefit from:
- **Fractional Ownership**: Multiple investors can own portions of the asset
- **High Liquidity**: Easier to trade on secondary markets
- **Lower Entry Barriers**: Investors can buy small amounts
- **Standardized Pricing**: All tokens have the same value

**Best for**: Real estate properties, commodity pools, investment funds, revenue-sharing agreements

### When to Use ERC-721 (NFTs)

Choose ERC-721 tokens for assets that are:
- **Unique and Indivisible**: Each asset is one-of-a-kind
- **Collector Items**: Value derived from uniqueness
- **Whole Ownership**: Single owner per asset
- **Distinct Metadata**: Each token has unique properties

**Best for**: Individual properties, art pieces, luxury items, unique collectibles, certificates

### Hybrid Approach

Some projects may use both:
- ERC-721 for the property deed (ownership)
- ERC-20 for revenue sharing tokens
- Multiple asset types in one ecosystem

## Regulatory Compliance Approach

### Single-Chain Compliance (Current Deployment)
The deployed contracts provide **complete regulatory compliance** for RWA tokenization on Polygon:

- **KYC/AML Verification**: All token holders must pass identity verification through the IdentityRegistry
- **Jurisdiction Controls**: Country restrictions ensure compliance with local regulations
- **Transfer Restrictions**: Balance limits and transfer limits prevent market manipulation
- **Audit Trail**: All transfers and compliance violations are recorded on-chain
- **Regulatory Reporting**: Automated generation of compliance reports for regulators

**Note**: CCIP (Cross-Chain Interoperability Protocol) is NOT required for regulatory compliance on a single blockchain. The current deployment on Polygon provides all necessary regulatory features for compliant RWA tokenization.

### Optional Cross-Chain Features
The codebase includes CCIP contracts for future multi-chain deployments:
- `CCIPRegulatoryBridge.sol` - For cross-chain compliance synchronization
- `CCIPIdentityReceiver.sol` - For receiving KYC data from other chains
- `RegulatoryIdentityRegistry.sol` - For multi-chain identity management
- `RegulatoryAuditTrail.sol` - For cross-chain audit trails

These contracts are **not deployed** as they are only needed when operating across multiple blockchains.

## Deployed Contracts

### Polygon Mainnet Deployment (August 2025)

#### Main Contracts (Proxy Addresses)

| Contract | Proxy Address | Implementation | Purpose |
|----------|---------------|----------------|---------|
| **Token** | [`0x3496D447c773905B5CA3B29DA1ca7c42510596B3`](https://polygonscan.com/address/0x3496D447c773905B5CA3B29DA1ca7c42510596B3) | [`0x2BD4EA5353dAC5d7e17FC149d267Fc2174A89594`](https://polygonscan.com/address/0x2BD4EA5353dAC5d7e17FC149d267Fc2174A89594) | ERC-3643 Security Token |
| **IdentityRegistry** | [`0x4483de4257Ca47E02E7862452d6E08690c6827fd`](https://polygonscan.com/address/0x4483de4257Ca47E02E7862452d6E08690c6827fd) | [`0x2e469Ff181dbBfFB86957dADBdfe948DCe2f843b`](https://polygonscan.com/address/0x2e469Ff181dbBfFB86957dADBdfe948DCe2f843b) | KYC/Identity Management |
| **ModularCompliance** | [`0xC42a1E382ef2C36d8D4bEE654fB877e2E9b1Eb8a`](https://polygonscan.com/address/0xC42a1E382ef2C36d8D4bEE654fB877e2E9b1Eb8a) | [`0x2F52feE580053e641009fEBaf22484CA495C0938`](https://polygonscan.com/address/0x2F52feE580053e641009fEBaf22484CA495C0938) | Compliance Orchestration |
| **AssetRegistry** | [`0x04aA90cAaAc423a5a1A858EE863482cAFd0fEb5F`](https://polygonscan.com/address/0x04aA90cAaAc423a5a1A858EE863482cAFd0fEb5F) | [`0xef98aC203A72796Bd9f764dDc4D78c4568094252`](https://polygonscan.com/address/0xef98aC203A72796Bd9f764dDc4D78c4568094252) | RWA Asset Management |
| **RegulatoryReportingOptimized** | [`0x4337BA0627DA5649736447Ce49Ed65315dD74E47`](https://polygonscan.com/address/0x4337BA0627DA5649736447Ce49Ed65315dD74E47) | [`0x15B00D40A30A8FA0BB432fA780595fD820620255`](https://polygonscan.com/address/0x15B00D40A30A8FA0BB432fA780595fD820620255) | Compliance Reporting |

#### Supporting Contracts

| Contract | Proxy Address | Implementation | Purpose |
|----------|---------------|----------------|---------|
| **ClaimTopicsRegistry** | [`0xb97E45F808369C0629667B1eCD67d7cB31755110`](https://polygonscan.com/address/0xb97E45F808369C0629667B1eCD67d7cB31755110) | [`0x769015E394fD7AeDff895eEb1C12a88038e2B843`](https://polygonscan.com/address/0x769015E394fD7AeDff895eEb1C12a88038e2B843) | Identity Claim Topics |
| **IdentityFactory** | [`0x3B44eb575E2971E967Ef979199c14Db795ba4156`](https://polygonscan.com/address/0x3B44eb575E2971E967Ef979199c14Db795ba4156) | [`0xEf68334bC08DD2E0bB2748e1B942cDf8287e0905`](https://polygonscan.com/address/0xEf68334bC08DD2E0bB2748e1B942cDf8287e0905) | Factory for deploying Identity contracts |
| **CountryRestrictModule** | [`0x843299F60C3D07562e23bF3e7C5481edEC9c8DD9`](https://polygonscan.com/address/0x843299F60C3D07562e23bF3e7C5481edEC9c8DD9) | [`0x3Df52370727F84B4f7384bF1cbEB253F01Bbf82a`](https://polygonscan.com/address/0x3Df52370727F84B4f7384bF1cbEB253F01Bbf82a) | Geographic Restrictions |
| **MaxBalanceModule** | [`0x00145e3a2897a1110632562EC469B2434841C009`](https://polygonscan.com/address/0x00145e3a2897a1110632562EC469B2434841C009) | [`0xa60820B239f3423ed08D61D9bF937AB45F0C5C3B`](https://polygonscan.com/address/0xa60820B239f3423ed08D61D9bF937AB45F0C5C3B) | Balance Limits |
| **TransferLimitModule** | [`0xB45a0eB5c79aEFD7185f246CA9a2397AaF3Ea5Ae`](https://polygonscan.com/address/0xB45a0eB5c79aEFD7185f246CA9a2397AaF3Ea5Ae) | [`0x59e1aC8be18b4CD7792Fc0bAF4dC279D8a4aa2BB`](https://polygonscan.com/address/0x59e1aC8be18b4CD7792Fc0bAF4dC279D8a4aa2BB) | Transfer Limits |
| **FinatradesTimelock** | [`0x64897d31E7A90CF5166d85B039340122D2e1B72e`](https://polygonscan.com/address/0x64897d31E7A90CF5166d85B039340122D2e1B72e) | N/A (Non-upgradeable) | 48-hour Governance Delay |

#### New: Finatrades Token Factory System (August 2025)

| Contract | Proxy Address | Implementation | Purpose |
|----------|---------------|----------------|---------|
| **FinatradesTokenFactory** | [`0x5aC1EB4BE5D56D0d0b37ac21E3A2362d028F7A70`](https://polygonscan.com/address/0x5aC1EB4BE5D56D0d0b37ac21E3A2362d028F7A70) | [`0x4E989F963B10cF417E16C58447E725fb34F6b09f`](https://polygonscan.com/address/0x4E989F963B10cF417E16C58447E725fb34F6b09f) | Factory for deploying Finatrades ERC-20 or ERC-721 tokens |

**Token Implementations (Finatrades Branded):**
- **Finatrades Token (ERC-20)**: [`0x5900027BbdA1A833C9f93F3bcE76b9E4eCf8D341`](https://polygonscan.com/address/0x5900027BbdA1A833C9f93F3bcE76b9E4eCf8D341)
- **FinatradesNFT (ERC-721)**: [`0xF23688617C09B89d13F625a0670D8Ba64a2c065A`](https://polygonscan.com/address/0xF23688617C09B89d13F625a0670D8Ba64a2c065A)

### Deployment Information
- **Network**: Polygon Mainnet (Chain ID: 137)
- **Deployer**: `0xCE982AC6bc316Cf9d875652B84C7626B62a899eA`
- **Deployment Date**: December 3, 2025 (Main contracts), August 4, 2025 (IdentityFactory, TokenFactory)
- **Token Name**: Finatrades RWA Token
- **Token Symbol**: FRWA
- **Token Decimals**: 18

## Contract Details

### 1. Token (ERC-3643 Security Token)

The base ERC-3643 compliant security token implementing the T-REX standard.

**Key Functions**:
```solidity
transfer(address to, uint256 amount) // Compliance-checked transfer
mint(address account, uint256 amount) // Restricted minting
burn(address account, uint256 amount) // Token burning
freeze(address account) // Freeze investor account
pause() / unpause() // Emergency pause functionality
setIdentityRegistry(address _identityRegistry) // Update identity registry
setCompliance(address _compliance) // Update compliance contract
recoveryAddress(address lostWallet, address newWallet) // Recover lost tokens
```

**Access Control Roles**:
- `DEFAULT_ADMIN_ROLE`: Full administrative control
- `AGENT_ROLE`: Mint, burn, freeze operations
- `OWNER_ROLE`: Contract configuration

### 2. IdentityRegistry

Manages on-chain identities and KYC verification.

**Key Functions**:
```solidity
registerIdentity(address _userAddress, address _identity, uint16 _country)
updateIdentity(address _userAddress, address _identity)
updateCountry(address _userAddress, uint16 _country)
deleteIdentity(address _userAddress)
isVerified(address _userAddress) returns (bool)
batchRegisterIdentity(address[] _userAddresses, address[] _identities, uint16[] _countries)
```

### 3. ModularCompliance

Orchestrates compliance rules through pluggable modules.

**Key Functions**:
```solidity
bindToken(address _token)
addModule(address _module)
removeModule(address _module)
canTransfer(address _from, address _to, uint256 _amount) returns (bool)
transferred(address _from, address _to, uint256 _amount)
getModules() returns (address[])
```

### 4. AssetRegistry

Universal registry for any type of Real World Asset.

**Key Functions**:
```solidity
registerAsset(bytes32 assetId, string name, AssetCategory category, uint256 valuation, string metadataURI, address custodian)
updateAssetValuation(bytes32 assetId, uint256 newValuation, string source)
setAssetStatus(bytes32 assetId, AssetStatus status)
createRevenueStream(bytes32 assetId, uint256 amount, uint256 frequency, address collector)
```

**Asset Categories**:
- REAL_ESTATE (0)
- COMMODITIES (1)
- ART_COLLECTIBLES (2)
- INTELLECTUAL_PROPERTY (3)
- FINANCIAL_INSTRUMENTS (4)
- INFRASTRUCTURE (5)
- NATURAL_RESOURCES (6)
- OTHER (7)

### 5. Compliance Modules

#### CountryRestrictModule
```solidity
addCountryRestriction(uint16 _country)
removeCountryRestriction(uint16 _country)
batchRestrictCountries(uint16[] _countries)
```

#### MaxBalanceModule
```solidity
setDefaultMaxBalance(uint256 _defaultMax)
setMaxBalance(address _user, uint256 _max)
batchSetMaxBalance(address[] _users, uint256[] _maxBalances)
```

#### TransferLimitModule
```solidity
setDefaultLimits(uint256 _dailyLimit, uint256 _monthlyLimit)
setTransferLimit(address _user, uint256 _dailyLimit, uint256 _monthlyLimit)
```

### 6. RegulatoryReportingOptimized

Automated regulatory reporting and compliance monitoring.

**Key Functions**:
```solidity
recordTransaction(address from, address to, uint256 amount, string assetId, bool wasCompliant)
recordComplianceViolation(address violator, address counterparty, uint256 attemptedAmount, string reason, string action)
getHolderCount() returns (uint256)
getHolderList(uint256 offset, uint256 limit) returns (address[])
generateComplianceReport() returns (bytes)
```

### 7. IdentityFactory

Factory contract for deploying ERC-734/735 compliant Identity contracts.

**Key Functions**:
```solidity
deployIdentity(address _user, uint16 _country) // Deploy and register identity
deployIdentityWithClaim(address _user, uint16 _country, uint256 _claimTopic, bytes _claimData) // Deploy with initial claim
getIdentity(address _user) returns (address) // Get user's identity contract
isFactoryIdentity(address _identity) returns (bool) // Verify factory deployment
```

**Access Control Roles**:
- `DEFAULT_ADMIN_ROLE`: Full administrative control
- `IDENTITY_DEPLOYER_ROLE`: Can deploy identity contracts
- `UPGRADER_ROLE`: Can upgrade the factory contract

### 8. FinatradesTokenFactory

Factory contract for deploying Finatrades-branded ERC-20 or ERC-721 compliant security tokens based on user preference.

**Key Functions**:
```solidity
deployToken(TokenType _tokenType, string _name, string _symbol, bytes32 _assetId, address _tokenAdmin) // Deploy token
updateImplementation(TokenType _tokenType, address _newImplementation) // Update implementation
deactivateToken(address _tokenAddress) // Emergency deactivation
getTokenForAsset(bytes32 _assetId) returns (address) // Get token for asset
```

**Token Types**:
- `TokenType.ERC20 (0)`: Fractional ownership tokens using Finatrades Token contract
- `TokenType.ERC721 (1)`: Non-fungible tokens using FinatradesNFT contract

**Access Control Roles**:
- `FACTORY_ADMIN_ROLE`: Administrative control over factory
- `TOKEN_DEPLOYER_ROLE`: Can deploy new tokens
- `UPGRADER_ROLE`: Can upgrade the factory contract

### 9. FinatradesNFT

Finatrades-branded ERC-721 compliant security token for non-fungible real-world assets with full compliance integration.

**Key Functions**:
```solidity
mint(address _to, uint256 _value, bytes32 _assetId, string _uri) returns (uint256) // Mint NFT
burn(uint256 _tokenId) // Burn NFT
tokenValue(uint256 _tokenId) returns (uint256) // Get token value
tokenAssetId(uint256 _tokenId) returns (bytes32) // Get asset ID
forcedTransfer(address _from, address _to, uint256 _tokenId) // Forced transfer
```

**Features**:
- Full ERC-3643 compliance checks on transfers
- Value tracking for each NFT
- Asset ID association
- Metadata URI support
- Batch minting capabilities

## Security Features

### Access Control
- Role-based access control (RBAC) with granular permissions
- Multi-signature capability through timelock
- Emergency pause functionality
- Token recovery mechanisms

### Compliance
- Real-time compliance checking
- Modular compliance rules
- Jurisdiction-based restrictions
- Transfer limits and balance caps

### Audit Trail
- Immutable transaction history
- Compliance violation tracking
- Regulatory reporting integration
- On-chain identity verification

## Integration Guide

### 1. Setting Up Identity (KYC/AML)

#### Option A: Using IdentityFactory (Recommended)

```javascript
// Deploy identity using factory (automatic registration)
const tx = await identityFactory.deployIdentity(
    investorAddress,
    840 // USA country code
);
const receipt = await tx.wait();

// Get the deployed identity address
const identityAddress = await identityFactory.getIdentity(investorAddress);

// Add KYC claim to the identity
const identity = await ethers.getContractAt("Identity", identityAddress);
await identity.addClaim(
    7, // KYC claim topic
    1, // Scheme
    issuerAddress,
    signature,
    data,
    uri
);
```

#### Option B: Manual Deployment

```javascript
// Deploy identity contract for investor
const Identity = await ethers.getContractFactory("Identity");
const identity = await Identity.deploy(investorAddress, false);

// Register in IdentityRegistry
await identityRegistry.registerIdentity(
    investorAddress,
    identity.address,
    840 // USA country code
);
```

### 2. Minting Tokens

```javascript
// Only AGENT_ROLE can mint
await token.mint(investorAddress, ethers.parseEther("1000"));
```

### 3. Asset Registration

```javascript
// Register asset
const assetId = ethers.id("PROPERTY-001");
await assetRegistry.registerAsset(
    assetId,
    "Manhattan Commercial Building",
    0, // REAL_ESTATE
    ethers.parseEther("1000000"), // $1M valuation
    "ipfs://QmAssetMetadata",
    custodianAddress
);
```

### 4. Token Deployment via Factory

The TokenFactory allows users to choose between ERC-20 and ERC-721 tokens for their assets:

#### Deploy ERC-20 Token (Fractional Ownership)

```javascript
// For assets that need fractional ownership
const FACTORY_ADDRESS = "0x5aC1EB4BE5D56D0d0b37ac21E3A2362d028F7A70";
const tokenFactory = await ethers.getContractAt("FinatradesTokenFactory", FACTORY_ADDRESS);

// Deploy ERC-20 token
const tx = await tokenFactory.deployToken(
    0, // TokenType.ERC20
    "Manhattan Office Building Token",
    "MOB",
    assetId,
    adminAddress
);

const receipt = await tx.wait();
const tokenAddress = receipt.events.find(e => e.event === "TokenDeployed").args.tokenAddress;

// Mint tokens to investors
const token = await ethers.getContractAt("Token", tokenAddress);
await token.mint(investorAddress, ethers.parseEther("1000"));
```

#### Deploy ERC-721 Token (Unique Assets)

```javascript
// For unique, non-divisible assets
const artAssetId = ethers.id("ART-PICASSO-001");

// Register art asset first
await assetRegistry.registerAsset(
    artAssetId,
    "Picasso Blue Period Original",
    2, // ART_COLLECTIBLES
    ethers.parseEther("50000000"), // $50M
    "ipfs://QmArtMetadata",
    custodianAddress
);

// Deploy ERC-721 token
const tx = await tokenFactory.deployToken(
    1, // TokenType.ERC721
    "Picasso Collection",
    "PBC",
    artAssetId,
    adminAddress
);

const receipt = await tx.wait();
const nftAddress = receipt.events.find(e => e.event === "TokenDeployed").args.tokenAddress;

// Mint NFT
const nftToken = await ethers.getContractAt("FinatradesNFT", nftAddress);
await nftToken.mint(
    collectorAddress,
    ethers.parseEther("50000000"), // Value
    artAssetId,
    "ipfs://QmNFTMetadata"
);
```

## Deployment Guide

### Prerequisites

1. Funded deployer wallet with MATIC on Polygon
2. Environment variables configured in `.env`:
   ```env
   PRIVATE_KEY=your_deployer_private_key
   POLYGONSCAN_API_KEY=your_polygonscan_api_key
   POLYGON_RPC_URL=https://polygon-rpc.com
   ```

### Deploying IdentityFactory

1. **Deploy the contract**:
   ```bash
   npx hardhat run scripts/deploy-identity-factory.js --network polygon
   ```

2. **Grant roles to backend wallet**:
   ```javascript
   const factory = await ethers.getContractAt("IdentityFactory", FACTORY_ADDRESS);
   const role = await factory.IDENTITY_DEPLOYER_ROLE();
   await factory.grantRole(role, "0xYourBackendWallet");
   ```

3. **Update environment configuration**:
   ```env
   NEXT_PUBLIC_IDENTITY_FACTORY_ADDRESS=0x3B44eb575E2971E967Ef979199c14Db795ba4156
   ```

### Backend Integration

Update your KYC approval flow to use IdentityFactory:

```javascript
import { deployIdentityForUser } from '@/lib/identity-factory';

// During KYC approval
if (!hasIdentity) {
  const { identityAddress, txHash } = await deployIdentityForUser(
    user.walletAddress,
    countryCode,
    factoryAddress,
    wallet
  );
  
  // Register the deployed identity
  await identityRegistry.registerIdentity(
    user.walletAddress,
    identityAddress, // Proper Identity contract
    countryCode
  );
}
```

### Gas Costs

- IdentityFactory deployment: ~3M gas
- Per user identity deployment: ~2.5M gas
- Total cost per user: ~$5-10 on Polygon

### JavaScript Library

The `identity-factory.js` library provides helper functions for web application integration:

```javascript
// Deploy identity for a user
const { identityAddress, txHash } = await deployIdentityForUser(
  userAddress,
  countryCode,
  factoryAddress,
  signer
);

// Check if user has an identity
const hasIdentity = await checkUserIdentity(userAddress, factoryAddress, provider);

// Get user's identity address
const identityAddress = await getUserIdentity(userAddress, factoryAddress, provider);
```

## Testing

### Security Test Suite
```bash
# Run all security tests
npx hardhat test test/security/*.test.js

# Run specific test categories
npx hardhat test test/security/AccessControl.test.js
npx hardhat test test/security/ReentrancyGuard.test.js
npx hardhat test test/security/EdgeCases.test.js
npx hardhat test test/security/Invariants.test.js
npx hardhat test test/security/OverflowUnderflow.test.js
```

### Coverage
```bash
npx hardhat coverage
```

## Audit Status

- **Status**: Ready for audit
- **Security Tests**: Comprehensive test suite included
- **Known Issues**: None
- **Last Review**: August 2025

## Support

- **Technical Support**: blockchain@finatrades.com
- **Security Contact**: security@finatrades.com
- **Website**: https://finatrades.com

## Recent Updates

### Finatrades Token Factory Deployment (August 4, 2025)

The Finatrades Token Factory system has been successfully deployed on Polygon Mainnet with proper branding, enabling users to choose between ERC-20 and ERC-721 tokens for their RWA tokenization needs:

- **FinatradesTokenFactory**: [`0x5aC1EB4BE5D56D0d0b37ac21E3A2362d028F7A70`](https://polygonscan.com/address/0x5aC1EB4BE5D56D0d0b37ac21E3A2362d028F7A70)
- **Finatrades Token (ERC-20)**: [`0x5900027BbdA1A833C9f93F3bcE76b9E4eCf8D341`](https://polygonscan.com/address/0x5900027BbdA1A833C9f93F3bcE76b9E4eCf8D341)
- **FinatradesNFT (ERC-721)**: [`0xF23688617C09B89d13F625a0670D8Ba64a2c065A`](https://polygonscan.com/address/0xF23688617C09B89d13F625a0670D8Ba64a2c065A)

All contracts now carry the Finatrades brand name and are fully verified on Polygonscan.

Users can deploy compliant security tokens for their assets by calling:
```javascript
await tokenFactory.deployToken(tokenType, name, symbol, assetId, adminAddress);
```

## License

MIT License - Copyright (c) 2025 Finatrades

---

**Version**: 2.1.0  
**Last Updated**: August 4, 2025