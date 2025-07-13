# Finatrades Universal RWA Platform - Developer Guide

## Overview

This is an institutional-grade Real World Asset (RWA) tokenization platform implementing the ERC-3643 (T-REX) standard. The platform can tokenize **ANY type of real-world asset** - from gold and real estate to intellectual property and carbon credits - with no limits on the number of assets.

## Deployed Contracts on Polygon Mainnet

The following contracts have been deployed to Polygon Mainnet (Chain ID: 137):

### Core Identity & Claims Contracts

1. **ClaimTopicsRegistry**: `0xc0b8B69C1EbB0750C79e9E37003f7f9F67C24ba5`
   - Manages the list of claim topics required for compliance
   - Defines which claims investors must have to hold tokens

2. **IdentityRegistry**: `0x7fF86B722349185aC7Cc7806067Db4265EC428E1`
   - Central registry linking wallet addresses to identity contracts
   - Verifies investor eligibility based on claims

3. **ClaimIssuer**: `0x0bB885b7901b4751Cd216B18cc99201fBbeAf8dC`
   - Issues verified claims for investors
   - Acts as a trusted authority for KYC/AML verification

### Compliance Modules

4. **CountryRestrictModule**: `0x22038f4Dc583816ea78540612b9d7077f7e05011`
   - Restricts transfers based on investor countries
   - Allows setting country-specific restrictions

5. **TransferLimitModule**: `0x739870D268aC653090070cC13C69F8c730eB58AF`
   - Enforces daily and monthly transfer limits
   - Configurable per investor or global defaults

6. **MaxBalanceModule**: `0xe2E06a0e6F86F58Bbe76A6b2d5A580e255Fd4E1b`
   - Restricts maximum token balance per investor
   - Useful for limiting concentration risk

### Core Contracts

7. **ModularCompliance**: `0xb5Bc25C8FD3a4B5B6c95a57c93A950fb8398789D`
   - Orchestrates all compliance modules
   - Validates transfers against all active modules
   - Dynamically add/remove compliance rules

8. **FinatradesRWA_ERC3643**: `0x56fBE81E9a84d2F87996419F53a2412Ae8B1658b`
   - Main ERC-3643 compliant token contract
   - Integrates with identity registry and compliance
   - Manages asset tokenization

9. **Timelock**: `0x87F6Ac9B65970fAB951A8595Fb3a06B707721C39`
   - Governance delay mechanism (2 days)
   - Controls critical administrative functions
   - Ensures security through time-delayed execution

### Universal Asset System

10. **AssetRegistry**: `[PENDING DEPLOYMENT]`
    - Universal registry supporting ANY asset type
    - Unlimited asset storage (no 1,000 limit)
    - Flexible attribute system
    - Revenue stream management

11. **FinatradesRWA_ERC3643_V2**: `[PENDING DEPLOYMENT]`
    - Enhanced token with AssetRegistry integration
    - Per-asset token tracking
    - Asset-specific dividends

## Architecture Overview

```
┌─────────────────────┐
│  FinatradesRWA     │ ◄── Main ERC-3643 Token
│    ERC3643         │
└──────────┬─────────┘
           │
    ┌──────┴──────┐
    ▼             ▼
┌─────────┐  ┌──────────────┐
│Identity │  │   Modular    │ ◄── Pluggable Compliance
│Registry │  │  Compliance  │
└────┬────┘  └──────┬───────┘
     │              │
     ▼              ▼
┌─────────┐  ┌──────────────┐
│Identity │  │  Compliance  │
│Contract │  │   Modules    │
└────┬────┘  └──────────────┘
     │
     ▼
┌─────────┐
│ Claims  │
└─────────┘
```

## Quick Start Guide

### 1. Setting Up Identity for an Investor

```javascript
// Deploy an identity contract for the investor
const Identity = await ethers.getContractFactory("Identity");
const identity = await Identity.deploy(investorAddress);

// Register the identity
const identityRegistry = await ethers.getContractAt(
    "IdentityRegistry", 
    "0x7fF86B722349185aC7Cc7806067Db4265EC428E1"
);
await identityRegistry.registerIdentity(investorAddress, identity.address);
```

### 2. Adding Claims to an Identity

```javascript
// Get the claim issuer contract
const claimIssuer = await ethers.getContractAt(
    "ClaimIssuer", 
    "0x0bB885b7901b4751Cd216B18cc99201fBbeAf8dC"
);

// Add a KYC claim (topic 1)
const kycData = ethers.utils.formatBytes32String("KYC_VERIFIED");
await claimIssuer.addClaim(
    identity.address,
    1, // KYC topic
    1, // scheme
    claimIssuerAddress,
    signature,
    kycData,
    "ipfs://QmXxx" // optional URI
);
```

### 3. Configuring Compliance Modules

#### Country Restrictions

```javascript
const countryModule = await ethers.getContractAt(
    "CountryRestrictModule",
    "0x22038f4Dc583816ea78540612b9d7077f7e05011"
);

// Allow USA (country code 1) and UK (country code 44)
await countryModule.batchSetCountriesAllowed([1, 44], [true, true]);

// Restrict transfers from USA to certain countries
await countryModule.setCountryPairRestriction(1, 380, true); // USA to Ukraine
```

#### Transfer Limits

```javascript
const transferModule = await ethers.getContractAt(
    "TransferLimitModule",
    "0x739870D268aC653090070cC13C69F8c730eB58AF"
);

// Set limits for a specific investor
await transferModule.setTransferLimit(
    investorAddress,
    ethers.utils.parseEther("10000"), // daily limit
    ethers.utils.parseEther("100000") // monthly limit
);
```

#### Maximum Balance

```javascript
const maxBalanceModule = await ethers.getContractAt(
    "MaxBalanceModule",
    "0xe2E06a0e6F86F58Bbe76A6b2d5A580e255Fd4E1b"
);

// Set max balance for an investor
await maxBalanceModule.setMaxBalance(
    investorAddress,
    ethers.utils.parseEther("1000000")
);
```

## Universal Asset Management (V2)

The platform now supports ANY type of real-world asset through a flexible registry pattern:

### Supported Asset Types
- **Real Estate**: Properties, land, buildings
- **Precious Metals**: Gold, silver, platinum
- **Cryptocurrency**: Wrapped BTC, ETH, etc.
- **Art & Collectibles**: Paintings, sculptures, NFTs
- **Intellectual Property**: Patents, trademarks, copyrights
- **Equity**: Company shares, ownership stakes
- **Debt Instruments**: Bonds, loans, receivables
- **Commodities**: Oil, gas, agricultural products
- **Carbon Credits**: Environmental credits
- **Luxury Goods**: Watches, jewelry, vehicles
- **And more...**

### Asset Registry Pattern

```javascript
// Deploy AssetRegistry (one-time)
const AssetRegistry = await ethers.getContractFactory("AssetRegistry");
const assetRegistry = await upgrades.deployProxy(
    AssetRegistry,
    [adminAddress],
    { kind: "uups" }
);

// Authorize token contract to interact with registry
await assetRegistry.authorizeTokenContract(tokenAddress, true);
```

### Example: Tokenizing Gold

```javascript
const assetRegistry = await ethers.getContractAt(
    "AssetRegistry",
    "0x[REGISTRY_ADDRESS]"
);

const token = await ethers.getContractAt(
    "FinatradesRWA_ERC3643_V2",
    "0x[TOKEN_V2_ADDRESS]"
);

// 1. Register gold asset
const goldAssetId = ethers.keccak256(ethers.toUtf8Bytes("GOLD-BAR-2024-001"));

await assetRegistry.registerAsset(
    goldAssetId,
    "1kg Gold Bar - LBMA Certified",
    2, // PRECIOUS_METALS category
    65000 * 10**6, // $65,000
    "ipfs://QmGoldBarCertificate",
    "0xCustodianAddress" // Vault address
);

// 2. Set gold-specific attributes
await assetRegistry.setTextAttribute(goldAssetId, "metalType", "Gold");
await assetRegistry.setNumericAttribute(goldAssetId, "weight", 1000); // grams
await assetRegistry.setNumericAttribute(goldAssetId, "purity", 9999); // 99.99%
await assetRegistry.setTextAttribute(goldAssetId, "storageLocation", "Brinks Vault Singapore");

// 3. Tokenize (1000 tokens = 1kg gold)
await token.tokenizeAsset(
    goldAssetId,
    ethers.parseEther("1000"),
    investorAddress
);
```

### Example: Tokenizing Real Estate

```javascript
// 1. Register property
const propertyId = ethers.keccak256(ethers.toUtf8Bytes("PROPERTY-NYC-001"));

await assetRegistry.registerAsset(
    propertyId,
    "Manhattan Office Building",
    1, // REAL_ESTATE
    50000000 * 10**6, // $50M
    "ipfs://QmPropertyDocs",
    "0xPropertyManager"
);

// 2. Set property attributes
await assetRegistry.setBatchTextAttributes(
    propertyId,
    ["address", "legalDescription", "propertyType"],
    ["123 5th Ave, NYC", "Lot 42, Block 123", "Commercial"]
);

// 3. Create rental income stream
await assetRegistry.createRevenueStream(
    propertyId,
    250000 * 10**6, // $250k/month
    30 * 24 * 60 * 60, // Monthly
    "0xRentCollector"
);

// 4. Tokenize
await token.tokenizeAsset(propertyId, ethers.parseEther("1000000"), owner);
```

### Example: Tokenizing Intellectual Property

```javascript
// 1. Register patent
const patentId = ethers.keccak256(ethers.toUtf8Bytes("PATENT-US-001"));

await assetRegistry.registerAsset(
    patentId,
    "AI Drug Discovery Patent",
    5, // INTELLECTUAL_PROPERTY
    10000000 * 10**6, // $10M valuation
    "ipfs://QmPatentDocs",
    ownerAddress
);

// 2. Set IP attributes
await assetRegistry.setTextAttribute(patentId, "ipType", "Patent");
await assetRegistry.setTextAttribute(patentId, "registrationNumber", "US10,123,456");
await assetRegistry.setNumericAttribute(patentId, "royaltyRate", 500); // 5%

// 3. Create royalty stream
await assetRegistry.createRevenueStream(
    patentId,
    50000 * 10**6, // $50k monthly royalties
    30 * 24 * 60 * 60,
    royaltyCollector
);
```

### Asset Categories Reference

```javascript
enum AssetCategory { 
    NONE = 0,
    REAL_ESTATE = 1,
    PRECIOUS_METALS = 2,
    CRYPTOCURRENCY = 3,
    ART_COLLECTIBLES = 4,
    INTELLECTUAL_PROPERTY = 5,
    EQUITY = 6,
    DEBT_INSTRUMENTS = 7,
    COMMODITIES = 8,
    CARBON_CREDITS = 9,
    LUXURY_GOODS = 10,
    FINANCIAL_INSTRUMENTS = 11,
    INFRASTRUCTURE = 12,
    OTHER = 13
}
```

## Testing Compliance

Before any transfer, the system checks:

1. **Identity Verification**: Both parties must have registered identities
2. **Required Claims**: Investors must have all required claims (KYC, AML, etc.)
3. **Country Restrictions**: Transfer must be allowed between countries
4. **Transfer Limits**: Amount must be within daily/monthly limits
5. **Balance Limits**: Recipient's balance must not exceed maximum

```javascript
// Check if a transfer would be valid
const modularCompliance = await ethers.getContractAt(
    "ModularCompliance",
    "0xb5Bc25C8FD3a4B5B6c95a57c93A950fb8398789D"
);

const isValid = await modularCompliance.isTransferValid(
    fromAddress,
    toAddress,
    amount
);
```

## Complete Workflow Examples

### 1. Full KYC Onboarding Process

```javascript
// Step 1: Deploy Identity Contract for the investor
const Identity = await ethers.getContractFactory("Identity");
const identityContract = await Identity.deploy(investorAddress);
await identityContract.waitForDeployment();
const identityAddress = await identityContract.getAddress();

// Step 2: Register Identity in the Registry
const identityRegistry = await ethers.getContractAt(
    "IdentityRegistry",
    "0x7fF86B722349185aC7Cc7806067Db4265EC428E1"
);
await identityRegistry.registerIdentity(investorAddress, identityAddress);

// Step 3: Add Required Claims (KYC, AML, Country)
const claimIssuer = await ethers.getContractAt(
    "ClaimIssuer",
    "0x0bB885b7901b4751Cd216B18cc99201fBbeAf8dC"
);

// First, ensure claim topics are registered
const claimTopicsRegistry = await ethers.getContractAt(
    "ClaimTopicsRegistry",
    "0xc0b8B69C1EbB0750C79e9E37003f7f9F67C24ba5"
);

// Add KYC claim (topic 1)
const kycData = ethers.solidityPackedKeccak256(
    ["string", "uint256"],
    ["KYC_VERIFIED", Date.now()]
);
await claimIssuer.addClaim(
    identityAddress,
    1, // KYC topic
    1, // scheme
    claimIssuer.address,
    "0x", // signature (simplified for example)
    kycData,
    ""
);

// Add AML claim (topic 2)
const amlData = ethers.solidityPackedKeccak256(
    ["string", "uint256"],
    ["AML_VERIFIED", Date.now()]
);
await claimIssuer.addClaim(
    identityAddress,
    2, // AML topic
    1, // scheme
    claimIssuer.address,
    "0x",
    amlData,
    ""
);

// Add Country claim (topic 4)
const countryData = ethers.solidityPackedKeccak256(
    ["uint16"], // country code
    [1] // USA
);
await claimIssuer.addClaim(
    identityAddress,
    4, // Country topic
    1, // scheme
    claimIssuer.address,
    "0x",
    countryData,
    ""
);

// Step 4: Set investor country in registry
await identityRegistry.setInvestorCountry(investorAddress, 1); // USA

console.log("✅ KYC onboarding complete for:", investorAddress);
```

### 2. Token Issuance (Minting)

```javascript
// Get the token contract
const token = await ethers.getContractAt(
    "FinatradesRWA_ERC3643",
    "0x56fBE81E9a84d2F87996419F53a2412Ae8B1658b"
);

// Step 1: Verify investor is eligible
const identityRegistry = await ethers.getContractAt(
    "IdentityRegistry",
    "0x7fF86B722349185aC7Cc7806067Db4265EC428E1"
);

const isVerified = await identityRegistry.isVerified(investorAddress);
if (!isVerified) {
    throw new Error("Investor not verified");
}

// Step 2: Mint tokens to investor
const amount = ethers.parseEther("10000"); // 10,000 tokens

// Only AGENT_ROLE can mint
await token.mint(investorAddress, amount);

console.log("✅ Minted", ethers.formatEther(amount), "tokens to:", investorAddress);

// Step 3: Verify balance
const balance = await token.balanceOf(investorAddress);
console.log("New balance:", ethers.formatEther(balance));
```

### 3. Token Transfer Workflow

```javascript
const token = await ethers.getContractAt(
    "FinatradesRWA_ERC3643",
    "0x56fBE81E9a84d2F87996419F53a2412Ae8B1658b"
);

// Step 1: Check if transfer is compliant
const from = "0xSenderAddress";
const to = "0xReceiverAddress";
const amount = ethers.parseEther("100");

// The token automatically checks compliance on transfer
try {
    // Attempt transfer
    const tx = await token.connect(senderSigner).transfer(to, amount);
    const receipt = await tx.wait();
    
    console.log("✅ Transfer successful:", receipt.transactionHash);
} catch (error) {
    // Transfer failed compliance checks
    console.error("❌ Transfer failed:", error.message);
    
    // Get detailed compliance status
    const modularCompliance = await ethers.getContractAt(
        "ModularCompliance",
        "0xb5Bc25C8FD3a4B5B6c95a57c93A950fb8398789D"
    );
    
    // Check which module blocked the transfer
    const countryModule = await ethers.getContractAt(
        "CountryRestrictModule",
        "0x22038f4Dc583816ea78540612b9d7077f7e05011"
    );
    const countryValid = await countryModule.isTransferValid(from, to, amount);
    console.log("Country restriction passed:", countryValid);
    
    const transferLimitModule = await ethers.getContractAt(
        "TransferLimitModule",
        "0x739870D268aC653090070cC13C69F8c730eB58AF"
    );
    const limitValid = await transferLimitModule.isTransferValid(from, to, amount);
    console.log("Transfer limit passed:", limitValid);
    
    const maxBalanceModule = await ethers.getContractAt(
        "MaxBalanceModule",
        "0xe2E06a0e6F86F58Bbe76A6b2d5A580e255Fd4E1b"
    );
    const balanceValid = await maxBalanceModule.isTransferValid(from, to, amount);
    console.log("Max balance passed:", balanceValid);
}
```

### 4. Batch Operations

```javascript
// Batch KYC multiple investors
async function batchKYCInvestors(investors) {
    const identityRegistry = await ethers.getContractAt(
        "IdentityRegistry",
        "0x7fF86B722349185aC7Cc7806067Db4265EC428E1"
    );
    
    for (const investor of investors) {
        // Deploy identity
        const Identity = await ethers.getContractFactory("Identity");
        const identity = await Identity.deploy(investor.address);
        await identity.waitForDeployment();
        
        // Register identity
        await identityRegistry.registerIdentity(
            investor.address,
            await identity.getAddress()
        );
        
        // Set country
        await identityRegistry.setInvestorCountry(
            investor.address,
            investor.countryCode
        );
        
        console.log("✅ Registered:", investor.address);
    }
}

// Batch mint tokens
async function batchMintTokens(recipients) {
    const token = await ethers.getContractAt(
        "FinatradesRWA_ERC3643",
        "0x56fBE81E9a84d2F87996419F53a2412Ae8B1658b"
    );
    
    for (const recipient of recipients) {
        await token.mint(recipient.address, recipient.amount);
        console.log("✅ Minted", recipient.amount, "to", recipient.address);
    }
}
```

### 5. Emergency Operations

```javascript
// Freeze an address (only AGENT_ROLE)
const token = await ethers.getContractAt(
    "FinatradesRWA_ERC3643",
    "0x56fBE81E9a84d2F87996419F53a2412Ae8B1658b"
);

// Freeze address
await token.setAddressFrozen(suspiciousAddress, true);
console.log("❄️ Address frozen:", suspiciousAddress);

// Pause all transfers (only AGENT_ROLE)
await token.pause();
console.log("⏸️ All transfers paused");

// Resume transfers
await token.unpause();
console.log("▶️ Transfers resumed");

// Force transfer (for recovery - only AGENT_ROLE)
await token.forcedTransfer(
    lostWalletAddress,
    recoveryAddress,
    amount
);
console.log("🔄 Forced transfer completed");
```

### 6. Compliance Configuration Examples

```javascript
// Configure for a specific jurisdiction
async function configureForUSCompliance() {
    // Set allowed countries (USA and Canada)
    const countryModule = await ethers.getContractAt(
        "CountryRestrictModule",
        "0x22038f4Dc583816ea78540612b9d7077f7e05011"
    );
    await countryModule.batchSetCountriesAllowed(
        [1, 124], // USA, Canada
        [true, true]
    );
    
    // Set conservative transfer limits
    const transferModule = await ethers.getContractAt(
        "TransferLimitModule",
        "0x739870D268aC653090070cC13C69F8c730eB58AF"
    );
    await transferModule.setDefaultLimits(
        ethers.parseEther("50000"), // $50k daily
        ethers.parseEther("500000") // $500k monthly
    );
    
    // Set max balance for retail investors
    const maxBalanceModule = await ethers.getContractAt(
        "MaxBalanceModule",
        "0xe2E06a0e6F86F58Bbe76A6b2d5A580e255Fd4E1b"
    );
    await maxBalanceModule.setDefaultMaxBalance(
        ethers.parseEther("250000") // $250k max
    );
}

// Configure for institutional investors
async function configureInstitutionalLimits(institutionAddress) {
    const transferModule = await ethers.getContractAt(
        "TransferLimitModule",
        "0x739870D268aC653090070cC13C69F8c730eB58AF"
    );
    
    const maxBalanceModule = await ethers.getContractAt(
        "MaxBalanceModule",
        "0xe2E06a0e6F86F58Bbe76A6b2d5A580e255Fd4E1b"
    );
    
    // Higher limits for institutions
    await transferModule.setTransferLimit(
        institutionAddress,
        ethers.parseEther("10000000"), // $10M daily
        ethers.parseEther("100000000") // $100M monthly
    );
    
    await maxBalanceModule.setMaxBalance(
        institutionAddress,
        ethers.parseEther("500000000") // $500M max
    );
}
```

## Development Setup

1. **Clone the repository**
   ```bash
   git clone [repository]
   cd rwa_contracts
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

4. **Run tests**
   ```bash
   npm test
   ```

5. **Deploy V2 contracts (for unlimited assets)**
   ```bash
   npx hardhat run scripts/deploy-universal-rwa.js --network polygon
   ```

## Common Errors and Solutions

### Transfer Errors

1. **"Identity not registered"**
   - Ensure both sender and receiver have registered identities
   - Use `identityRegistry.registerIdentity()` first

2. **"Missing required claims"**
   - Check which claims are required: `claimTopicsRegistry.getClaimTopics()`
   - Add missing claims using `claimIssuer.addClaim()`

3. **"Country not allowed"**
   - Verify allowed countries: `countryModule.allowedCountries(countryCode)`
   - Add country if needed: `countryModule.setCountryAllowed(countryCode, true)`

4. **"Transfer limit exceeded"**
   - Check current limits: `transferModule.transferLimits(address)`
   - Wait for daily/monthly reset or increase limits

5. **"Would exceed max balance"**
   - Check receiver's max balance: `maxBalanceModule.maxBalances(address)`
   - Increase limit if needed: `maxBalanceModule.setMaxBalance(address, newLimit)`

### Minting Errors

1. **"AccessControl: account is missing role"**
   - Only AGENT_ROLE can mint tokens
   - Grant role: `token.grantRole(AGENT_ROLE, address)`

2. **"Recipient not verified"**
   - Recipient must complete KYC before receiving tokens
   - Follow the KYC onboarding process above

### Administrative Tasks

```javascript
// Grant roles
const AGENT_ROLE = await token.AGENT_ROLE();
await token.grantRole(AGENT_ROLE, agentAddress);

// Add claim topics
await claimTopicsRegistry.addClaimTopic(1); // KYC
await claimTopicsRegistry.addClaimTopic(2); // AML
await claimTopicsRegistry.addClaimTopic(4); // Country

// Authorize claim issuer
await claimIssuer.addKey(
    ethers.solidityPackedKeccak256(["address"], [issuerAddress]),
    3, // CLAIM purpose
    1  // ECDSA key type
);
```

## Security Considerations

1. **Upgradeability**: All contracts use UUPS pattern for upgrades
2. **Access Control**: Critical functions are protected by role-based access
3. **Claim Verification**: Only authorized claim issuers can add claims
4. **Compliance Checks**: All transfers go through comprehensive compliance validation

## Gas Optimization

The modular architecture allows for:
- Selective compliance rules (only deploy needed modules)
- Batch operations for managing multiple investors
- Efficient claim verification through caching

## Contract Configuration Status

✅ **Deployment Complete**: All 9 contracts successfully deployed to Polygon Mainnet
✅ **Modules Configured**: All 3 compliance modules added to ModularCompliance
✅ **Token Bound**: FinatradesRWA_ERC3643 bound to ModularCompliance

## Next Steps

1. **Verify Contracts on Polygonscan**: 
   ```bash
   npx hardhat verify --network polygon CONTRACT_ADDRESS
   ```

2. **Set up Initial Claim Topics**:
   ```javascript
   const claimTopics = await ethers.getContractAt(
       "ClaimTopicsRegistry",
       "0xc0b8B69C1EbB0750C79e9E37003f7f9F67C24ba5"
   );
   await claimTopics.addClaimTopic(1); // KYC
   await claimTopics.addClaimTopic(2); // AML
   await claimTopics.addClaimTopic(3); // Accreditation
   ```

3. **Configure Country Restrictions**:
   ```javascript
   const countryModule = await ethers.getContractAt(
       "CountryRestrictModule",
       "0x22038f4Dc583816ea78540612b9d7077f7e05011"
   );
   // Allow specific countries
   await countryModule.batchSetCountriesAllowed([1, 44, 65], [true, true, true]);
   ```

4. **Set Default Limits**:
   ```javascript
   // Transfer limits
   const transferModule = await ethers.getContractAt(
       "TransferLimitModule",
       "0x739870D268aC653090070cC13C69F8c730eB58AF"
   );
   await transferModule.setDefaultLimits(
       ethers.utils.parseEther("100000"), // daily
       ethers.utils.parseEther("1000000") // monthly
   );
   
   // Max balance
   const maxBalanceModule = await ethers.getContractAt(
       "MaxBalanceModule",
       "0xe2E06a0e6F86F58Bbe76A6b2d5A580e255Fd4E1b"
   );
   await maxBalanceModule.setDefaultMaxBalance(
       ethers.utils.parseEther("10000000")
   );
   ```

## Support

For technical questions or issues:
- Review test files for implementation examples
- Check contract interfaces for available functions
- Ensure proper access control setup before mainnet use

## Web Portal Development Guide

### Essential Contract ABIs

All contract ABIs are located in:
```
artifacts/contracts/[ContractName].sol/[ContractName].json
```

### Key Contracts for Web Integration

1. **Token Contract**: `0x56fBE81E9a84d2F87996419F53a2412Ae8B1658b`
   - Transfer tokens
   - Check balances
   - View token info (name, symbol, decimals)

2. **Identity Registry**: `0x7fF86B722349185aC7Cc7806067Db4265EC428E1`
   - Check if user is KYC verified
   - Get investor country
   - Verify identity status

3. **Compliance Modules**:
   - Country Restrictions: `0x22038f4Dc583816ea78540612b9d7077f7e05011`
   - Transfer Limits: `0x739870D268aC653090070cC13C69F8c730eB58AF`
   - Max Balance: `0xe2E06a0e6F86F58Bbe76A6b2d5A580e255Fd4E1b`

### Web3 Integration Example

```javascript
import { ethers } from 'ethers';
import TokenABI from './artifacts/contracts/FinatradesRWA_ERC3643.sol/FinatradesRWA_ERC3643.json';
import IdentityRegistryABI from './artifacts/contracts/identity/IdentityRegistry.sol/IdentityRegistry.json';

// Connect to Polygon
const provider = new ethers.JsonRpcProvider('https://polygon-rpc.com');

// Contract instances
const token = new ethers.Contract(
    '0x56fBE81E9a84d2F87996419F53a2412Ae8B1658b',
    TokenABI.abi,
    provider
);

const identityRegistry = new ethers.Contract(
    '0x7fF86B722349185aC7Cc7806067Db4265EC428E1',
    IdentityRegistryABI.abi,
    provider
);

// Check if user can receive tokens
async function checkUserEligibility(userAddress) {
    const isVerified = await identityRegistry.isVerified(userAddress);
    return isVerified;
}

// Get user balance
async function getUserBalance(userAddress) {
    const balance = await token.balanceOf(userAddress);
    return ethers.formatEther(balance);
}

// Transfer tokens (requires signer)
async function transferTokens(signer, toAddress, amount) {
    const tokenWithSigner = token.connect(signer);
    const tx = await tokenWithSigner.transfer(
        toAddress, 
        ethers.parseEther(amount.toString())
    );
    return tx;
}
```

### Required Features for Web Portal

1. **User Dashboard**
   - Display token balance
   - Show KYC status
   - List owned assets
   - View transaction history

2. **KYC Integration**
   - Connect with identity provider
   - Display verification status
   - Show required claims

3. **Asset Explorer**
   - List all tokenized assets
   - Show asset details (valuation, type, custodian)
   - Display revenue streams

4. **Transfer Interface**
   - Check recipient eligibility
   - Preview compliance checks
   - Execute transfers
   - Handle error messages

5. **Admin Panel** (for authorized roles)
   - Register new assets
   - Manage investor KYC
   - Configure compliance rules
   - Monitor system activity

### Event Monitoring

Key events to monitor:
```javascript
// Token transfers
token.on('Transfer', (from, to, amount) => {
    console.log(`Transfer: ${from} -> ${to}: ${amount}`);
});

// Identity registration
identityRegistry.on('IdentityRegistered', (investor, identity) => {
    console.log(`New identity registered: ${investor}`);
});

// Asset tokenization (when V2 is deployed)
// assetRegistry.on('AssetRegistered', (assetId, name, category) => {
//     console.log(`New asset: ${name}`);
// });
```

### API Endpoints Needed

Your backend should provide:
1. `/api/user/kyc-status` - Check user KYC status
2. `/api/assets/list` - List all assets with pagination
3. `/api/assets/{id}` - Get specific asset details
4. `/api/user/balance` - Get user token balance
5. `/api/compliance/check` - Pre-check transfer compliance
6. `/api/transactions/history` - User transaction history

### Security Considerations for Web Portal

1. **Never expose private keys** in frontend
2. **Use MetaMask or WalletConnect** for transactions
3. **Validate all inputs** before blockchain calls
4. **Handle blockchain errors** gracefully
5. **Cache read-only data** to reduce RPC calls
6. **Implement rate limiting** for API endpoints

### Testing on Polygon Mainnet

All contracts are live on Polygon Mainnet. For testing:
1. Use small amounts initially
2. Test all compliance scenarios
3. Verify gas costs for operations
4. Monitor transaction confirmations

---

**Note**: This platform implements institutional-grade security features. Ensure proper legal compliance and auditing before production use.

## License

MIT