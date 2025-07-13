# Finatrades RWA ERC-3643 Developer Guide

## Overview

This is an institutional-grade Real World Asset (RWA) tokenization platform implementing the ERC-3643 (T-REX) standard. The platform provides comprehensive identity management, compliance modules, and security features required for tokenizing real-world assets.

## Deployed Contracts on Polygon Mainnet

The following contracts have been deployed to Polygon Mainnet (Chain ID: 137):

### Core Identity & Claims Contracts

1. **ClaimTopicsRegistry**: `0x315a3f5d4a482204eA7EaE89D05e64b6B90a919E`
   - Manages the list of claim topics required for compliance
   - Defines which claims investors must have to hold tokens

2. **IdentityRegistry**: `0x1D6f1Ca3Df3d601A079E02dCaBd809D5Bd95fe80`
   - Central registry linking wallet addresses to identity contracts
   - Verifies investor eligibility based on claims

3. **ClaimIssuer**: `0x55106CFA1217A15A6bcedc7dFf9Ca0897f4E378a`
   - Issues verified claims for investors
   - Acts as a trusted authority for KYC/AML verification

### Compliance Modules

4. **CountryRestrictModule**: `0x952E87D7f2f5FDe3f387bE9bd6CE59Ad98BbD3A7`
   - Restricts transfers based on investor countries
   - Allows setting country-specific restrictions

5. **TransferLimitModule**: `0xeFc6E2808ba990B6344EC23316CFCA8a64F0597d`
   - Enforces daily and monthly transfer limits
   - Configurable per investor or global defaults

6. **MaxBalanceModule**: `0x60540b959652Ef4E955385C6E28529520a25dcd2`
   - Restricts maximum token balance per investor
   - Useful for limiting concentration risk

### Core Contracts

7. **ModularCompliance**: `0x9Db249617E876c18248Bf5Cd1289fA33A725170d`
   - Orchestrates all compliance modules
   - Validates transfers against all active modules
   - Dynamically add/remove compliance rules

8. **FinatradesRWA_ERC3643**: `0x10375fdf730D39774eF1fD20424CD0504ef35afb`
   - Main ERC-3643 compliant token contract
   - Integrates with identity registry and compliance
   - Manages asset tokenization

9. **Timelock**: `0xc929923D0d52Df0b72C8cf00C7c6156DB24232dE`
   - Governance delay mechanism (2 days)
   - Controls critical administrative functions
   - Ensures security through time-delayed execution

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
    "0x1D6f1Ca3Df3d601A079E02dCaBd809D5Bd95fe80"
);
await identityRegistry.registerIdentity(investorAddress, identity.address);
```

### 2. Adding Claims to an Identity

```javascript
// Get the claim issuer contract
const claimIssuer = await ethers.getContractAt(
    "ClaimIssuer", 
    "0x55106CFA1217A15A6bcedc7dFf9Ca0897f4E378a"
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
    "0x952E87D7f2f5FDe3f387bE9bd6CE59Ad98BbD3A7"
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
    "0xeFc6E2808ba990B6344EC23316CFCA8a64F0597d"
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
    "0x60540b959652Ef4E955385C6E28529520a25dcd2"
);

// Set max balance for an investor
await maxBalanceModule.setMaxBalance(
    investorAddress,
    ethers.utils.parseEther("1000000")
);
```

## Asset Management

The platform uses the AssetLib library for managing real-world assets:

```javascript
// Interact with the main token contract
const token = await ethers.getContractAt(
    "FinatradesRWA_ERC3643",
    "0x10375fdf730D39774eF1fD20424CD0504ef35afb"
);

// Create a new asset
await token.createAsset(
    assetId,
    "Luxury Apartment NYC",
    "https://ipfs.io/ipfs/QmXxx",
    ethers.utils.parseEther("1000000"), // $1M valuation
    ownerAddress
);

// Tokenize the asset
await token.tokenizeAsset(
    assetId,
    ethers.utils.parseEther("1000"), // 1000 tokens
    investorAddress
);
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
    "0x9Db249617E876c18248Bf5Cd1289fA33A725170d"
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
    "0x1D6f1Ca3Df3d601A079E02dCaBd809D5Bd95fe80"
);
await identityRegistry.registerIdentity(investorAddress, identityAddress);

// Step 3: Add Required Claims (KYC, AML, Country)
const claimIssuer = await ethers.getContractAt(
    "ClaimIssuer",
    "0x55106CFA1217A15A6bcedc7dFf9Ca0897f4E378a"
);

// First, ensure claim topics are registered
const claimTopicsRegistry = await ethers.getContractAt(
    "ClaimTopicsRegistry",
    "0x315a3f5d4a482204eA7EaE89D05e64b6B90a919E"
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
    "0x10375fdf730D39774eF1fD20424CD0504ef35afb"
);

// Step 1: Verify investor is eligible
const identityRegistry = await ethers.getContractAt(
    "IdentityRegistry",
    "0x1D6f1Ca3Df3d601A079E02dCaBd809D5Bd95fe80"
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
    "0x10375fdf730D39774eF1fD20424CD0504ef35afb"
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
        "0x9Db249617E876c18248Bf5Cd1289fA33A725170d"
    );
    
    // Check which module blocked the transfer
    const countryModule = await ethers.getContractAt(
        "CountryRestrictModule",
        "0x952E87D7f2f5FDe3f387bE9bd6CE59Ad98BbD3A7"
    );
    const countryValid = await countryModule.isTransferValid(from, to, amount);
    console.log("Country restriction passed:", countryValid);
    
    const transferLimitModule = await ethers.getContractAt(
        "TransferLimitModule",
        "0xeFc6E2808ba990B6344EC23316CFCA8a64F0597d"
    );
    const limitValid = await transferLimitModule.isTransferValid(from, to, amount);
    console.log("Transfer limit passed:", limitValid);
    
    const maxBalanceModule = await ethers.getContractAt(
        "MaxBalanceModule",
        "0x60540b959652Ef4E955385C6E28529520a25dcd2"
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
        "0x1D6f1Ca3Df3d601A079E02dCaBd809D5Bd95fe80"
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
        "0x10375fdf730D39774eF1fD20424CD0504ef35afb"
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
    "0x10375fdf730D39774eF1fD20424CD0504ef35afb"
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
        "0x952E87D7f2f5FDe3f387bE9bd6CE59Ad98BbD3A7"
    );
    await countryModule.batchSetCountriesAllowed(
        [1, 124], // USA, Canada
        [true, true]
    );
    
    // Set conservative transfer limits
    const transferModule = await ethers.getContractAt(
        "TransferLimitModule",
        "0xeFc6E2808ba990B6344EC23316CFCA8a64F0597d"
    );
    await transferModule.setDefaultLimits(
        ethers.parseEther("50000"), // $50k daily
        ethers.parseEther("500000") // $500k monthly
    );
    
    // Set max balance for retail investors
    const maxBalanceModule = await ethers.getContractAt(
        "MaxBalanceModule",
        "0x60540b959652Ef4E955385C6E28529520a25dcd2"
    );
    await maxBalanceModule.setDefaultMaxBalance(
        ethers.parseEther("250000") // $250k max
    );
}

// Configure for institutional investors
async function configureInstitutionalLimits(institutionAddress) {
    const transferModule = await ethers.getContractAt(
        "TransferLimitModule",
        "0xeFc6E2808ba990B6344EC23316CFCA8a64F0597d"
    );
    
    const maxBalanceModule = await ethers.getContractAt(
        "MaxBalanceModule",
        "0x60540b959652Ef4E955385C6E28529520a25dcd2"
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

5. **Deploy remaining contracts**
   ```bash
   npx hardhat run scripts/deploy-remaining.js --network polygon
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
       "0x315a3f5d4a482204eA7EaE89D05e64b6B90a919E"
   );
   await claimTopics.addClaimTopic(1); // KYC
   await claimTopics.addClaimTopic(2); // AML
   await claimTopics.addClaimTopic(3); // Accreditation
   ```

3. **Configure Country Restrictions**:
   ```javascript
   const countryModule = await ethers.getContractAt(
       "CountryRestrictModule",
       "0x952E87D7f2f5FDe3f387bE9bd6CE59Ad98BbD3A7"
   );
   // Allow specific countries
   await countryModule.batchSetCountriesAllowed([1, 44, 65], [true, true, true]);
   ```

4. **Set Default Limits**:
   ```javascript
   // Transfer limits
   const transferModule = await ethers.getContractAt(
       "TransferLimitModule",
       "0xAC4d1d37b307DE646A82A65F9a19a5a54F4D8f00"
   );
   await transferModule.setDefaultLimits(
       ethers.utils.parseEther("100000"), // daily
       ethers.utils.parseEther("1000000") // monthly
   );
   
   // Max balance
   const maxBalanceModule = await ethers.getContractAt(
       "MaxBalanceModule",
       "0x60540b959652Ef4E955385C6E28529520a25dcd2"
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

---

**Note**: This platform implements institutional-grade security features. Ensure proper legal compliance and auditing before production use.

## License

MIT