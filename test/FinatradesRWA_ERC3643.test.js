const { expect } = require("chai");
const { ethers, upgrades } = require("hardhat");

describe("FinatradesRWA_ERC3643", function () {
    let token, identityRegistry, claimTopicsRegistry, compliance, claimIssuer;
    let owner, agent, investor1, investor2, rentCollector;
    let countryRestrictModule;
    
    beforeEach(async function () {
        [owner, agent, investor1, investor2, rentCollector] = await ethers.getSigners();
        
        // Deploy ClaimTopicsRegistry
        const ClaimTopicsRegistry = await ethers.getContractFactory("ClaimTopicsRegistry");
        claimTopicsRegistry = await upgrades.deployProxy(ClaimTopicsRegistry, [owner.address]);
        
        // Deploy IdentityRegistry
        const IdentityRegistry = await ethers.getContractFactory("IdentityRegistry");
        identityRegistry = await upgrades.deployProxy(IdentityRegistry, [owner.address]);
        await identityRegistry.setClaimTopicsRegistry(claimTopicsRegistry.address);
        
        // Deploy ClaimIssuer
        const ClaimIssuer = await ethers.getContractFactory("ClaimIssuer");
        claimIssuer = await upgrades.deployProxy(ClaimIssuer, [owner.address]);
        
        // Deploy CountryRestrictModule
        const CountryRestrictModule = await ethers.getContractFactory("CountryRestrictModule");
        countryRestrictModule = await upgrades.deployProxy(CountryRestrictModule, [owner.address]);
        
        // Deploy ModularCompliance
        const ModularCompliance = await ethers.getContractFactory("ModularCompliance");
        compliance = await upgrades.deployProxy(ModularCompliance, [owner.address]);
        await compliance.addModule(countryRestrictModule.address);
        
        // Deploy Token
        const Token = await ethers.getContractFactory("FinatradesRWA_ERC3643");
        token = await upgrades.deployProxy(Token, [
            owner.address,
            "Finatrades RWA Token",
            "FRWA",
            18,
            identityRegistry.address,
            compliance.address
        ]);
        
        // Bind token to compliance
        await compliance.bindToken(token.address);
        
        // Setup claim topics
        await claimTopicsRegistry.addClaimTopic(1); // KYC
        await claimTopicsRegistry.addClaimTopic(2); // AML
        await claimTopicsRegistry.addClaimTopic(4); // Country
        
        // Add claim issuer as trusted issuer
        await claimTopicsRegistry.addTrustedIssuer(claimIssuer.address, [1, 2, 4]);
        
        // Setup allowed countries
        await countryRestrictModule.setCountryAllowed(840, true); // USA
        await countryRestrictModule.setCountryAllowed(826, true); // UK
        
        // Grant roles
        await token.grantRole(await token.AGENT_ROLE(), agent.address);
        await token.grantRole(await token.ASSET_MANAGER_ROLE(), owner.address);
        await identityRegistry.grantRole(await identityRegistry.AGENT_ROLE(), owner.address);
    });
    
    describe("Deployment", function () {
        it("Should deploy with correct parameters", async function () {
            expect(await token.name()).to.equal("Finatrades RWA Token");
            expect(await token.symbol()).to.equal("FRWA");
            expect(await token.decimals()).to.equal(18);
            expect(await token.identityRegistry()).to.equal(identityRegistry.address);
            expect(await token.compliance()).to.equal(compliance.address);
        });
    });
    
    describe("Identity Management", function () {
        it("Should register investor identity", async function () {
            // Deploy mock identity contract
            const Identity = await ethers.getContractFactory("contracts/mocks/MockIdentity.sol:MockIdentity");
            const identity1 = await Identity.deploy();
            
            // Register identity
            await identityRegistry.registerIdentity(investor1.address, identity1.address, 840); // USA
            
            expect(await identityRegistry.contains(investor1.address)).to.be.true;
            expect(await identityRegistry.identity(investor1.address)).to.equal(identity1.address);
            expect(await identityRegistry.investorCountry(investor1.address)).to.equal(840);
        });
    });
    
    describe("Token Transfers with Compliance", function () {
        let identity1, identity2;
        
        beforeEach(async function () {
            // Create mock identities
            const Identity = await ethers.getContractFactory("contracts/mocks/MockIdentity.sol:MockIdentity");
            identity1 = await Identity.deploy();
            identity2 = await Identity.deploy();
            
            // Register identities
            await identityRegistry.registerIdentity(investor1.address, identity1.address, 840); // USA
            await identityRegistry.registerIdentity(investor2.address, identity2.address, 826); // UK
            
            // Issue claims for verification
            await claimIssuer.issueKYCAMLClaims(identity1.address, "US", true);
            await claimIssuer.issueKYCAMLClaims(identity2.address, "UK", false);
            
            // Mint tokens to investor1
            await token.connect(agent).mint(investor1.address, ethers.utils.parseEther("1000"));
        });
        
        it("Should allow transfer between verified investors", async function () {
            const amount = ethers.utils.parseEther("100");
            
            await expect(token.connect(investor1).transfer(investor2.address, amount))
                .to.emit(token, "Transfer")
                .withArgs(investor1.address, investor2.address, amount);
            
            expect(await token.balanceOf(investor2.address)).to.equal(amount);
        });
        
        it("Should block transfer to unverified address", async function () {
            const amount = ethers.utils.parseEther("100");
            
            await expect(token.connect(investor1).transfer(rentCollector.address, amount))
                .to.be.revertedWith("To address not verified");
        });
        
        it("Should enforce country restrictions", async function () {
            // Register investor from restricted country
            const Identity = await ethers.getContractFactory("contracts/mocks/MockIdentity.sol:MockIdentity");
            const identity3 = await Identity.deploy();
            await identityRegistry.registerIdentity(rentCollector.address, identity3.address, 156); // China (not allowed)
            await claimIssuer.issueKYCAMLClaims(identity3.address, "CN", false);
            
            const amount = ethers.utils.parseEther("100");
            
            await expect(token.connect(investor1).transfer(rentCollector.address, amount))
                .to.be.revertedWith("Transfer not compliant");
        });
    });
    
    describe("Asset Management", function () {
        it("Should add a asset", async function () {
            const assetId = ethers.utils.formatBytes32String("ASSET001");
            
            await expect(token.addAsset(
                assetId,
                1, // RESIDENTIAL
                "123 Main St, New York, NY",
                "Lot 1, Block 2, NYC",
                ethers.utils.parseUnits("1000000", 6), // $1M valuation
                2020,
                500,
                "ipfs://QmAssetHash"
            )).to.emit(token, "AssetAdded")
              .withArgs(assetId, 1, ethers.utils.parseUnits("1000000", 6));
            
            const asset = await token.getAsset(assetId);
            expect(asset.assetType).to.equal(1);
            expect(asset.valuationAmount).to.equal(ethers.utils.parseUnits("1000000", 6));
        });
    });
    
    describe("Dividend Distribution", function () {
        let identity1, identity2;
        const assetId = ethers.utils.formatBytes32String("ASSET001");
        
        beforeEach(async function () {
            // Setup identities and mint tokens
            const Identity = await ethers.getContractFactory("contracts/mocks/MockIdentity.sol:MockIdentity");
            identity1 = await Identity.deploy();
            identity2 = await Identity.deploy();
            
            await identityRegistry.registerIdentity(investor1.address, identity1.address, 840);
            await identityRegistry.registerIdentity(investor2.address, identity2.address, 826);
            
            await claimIssuer.issueKYCAMLClaims(identity1.address, "US", true);
            await claimIssuer.issueKYCAMLClaims(identity2.address, "UK", false);
            
            await token.connect(agent).mint(investor1.address, ethers.utils.parseEther("600"));
            await token.connect(agent).mint(investor2.address, ethers.utils.parseEther("400"));
            
            // Add asset and set rental info
            await token.addAsset(
                assetId,
                1, // RESIDENTIAL
                "123 Main St",
                "Lot 1",
                ethers.utils.parseUnits("1000000", 6),
                2020,
                500,
                "ipfs://hash"
            );
            
            await token.setRentalInfo(assetId, ethers.utils.parseUnits("10000", 6), 9500, rentCollector.address);
        });
        
        it("Should deposit rental income and allow dividend claims", async function () {
            const rentalAmount = ethers.utils.parseEther("1");
            
            // Deposit rental income
            await expect(token.connect(rentCollector).depositRentalIncome(assetId, { value: rentalAmount }))
                .to.emit(token, "RentalIncomeDeposited")
                .withArgs(assetId, rentalAmount, await ethers.provider.getBlock().then(b => b.timestamp + 1));
            
            // Check unclaimed dividends
            const unclaimed1 = await token.getUnclaimedDividends(investor1.address);
            const unclaimed2 = await token.getUnclaimedDividends(investor2.address);
            
            expect(unclaimed1).to.equal(ethers.utils.parseEther("0.6")); // 60% of rental
            expect(unclaimed2).to.equal(ethers.utils.parseEther("0.4")); // 40% of rental
            
            // Claim dividends
            const balanceBefore = await ethers.provider.getBalance(investor1.address);
            await token.connect(investor1).claimDividend(0);
            const balanceAfter = await ethers.provider.getBalance(investor1.address);
            
            expect(balanceAfter.sub(balanceBefore)).to.be.closeTo(
                ethers.utils.parseEther("0.6"),
                ethers.utils.parseEther("0.01") // Account for gas
            );
        });
    });
    
    describe("Freeze Functions", function () {
        let identity1;
        
        beforeEach(async function () {
            const Identity = await ethers.getContractFactory("contracts/mocks/MockIdentity.sol:MockIdentity");
            identity1 = await Identity.deploy();
            
            await identityRegistry.registerIdentity(investor1.address, identity1.address, 840);
            await claimIssuer.issueKYCAMLClaims(identity1.address, "US", true);
            
            await token.connect(agent).mint(investor1.address, ethers.utils.parseEther("1000"));
        });
        
        it("Should freeze and unfreeze addresses", async function () {
            await token.connect(agent).setAddressFrozen(investor1.address, true);
            expect(await token.isFrozen(investor1.address)).to.be.true;
            
            // Should not allow transfers from frozen address
            await expect(token.connect(investor1).transfer(investor2.address, ethers.utils.parseEther("100")))
                .to.be.revertedWith("From address is frozen");
            
            await token.connect(agent).setAddressFrozen(investor1.address, false);
            expect(await token.isFrozen(investor1.address)).to.be.false;
        });
        
        it("Should freeze partial tokens", async function () {
            const freezeAmount = ethers.utils.parseEther("600");
            await token.connect(agent).freezePartialTokens(investor1.address, freezeAmount);
            
            expect(await token.getFrozenTokens(investor1.address)).to.equal(freezeAmount);
            
            // Should only allow transfer of unfrozen tokens
            await expect(token.connect(investor1).transfer(investor2.address, ethers.utils.parseEther("500")))
                .to.be.revertedWith("Insufficient unfrozen balance");
            
            // Should allow transfer of available amount
            const Identity = await ethers.getContractFactory("contracts/mocks/MockIdentity.sol:MockIdentity");
            const identity2 = await Identity.deploy();
            await identityRegistry.registerIdentity(investor2.address, identity2.address, 826);
            await claimIssuer.issueKYCAMLClaims(identity2.address, "UK", false);
            
            await expect(token.connect(investor1).transfer(investor2.address, ethers.utils.parseEther("400")))
                .to.not.be.reverted;
        });
    });
});

// Mock Identity contract for testing
const mockIdentitySource = `
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "../../contracts/identity/IIdentity.sol";

contract MockIdentity is IIdentity {
    mapping(bytes32 => Claim) private claims;
    mapping(uint256 => bytes32[]) private claimsByTopic;
    mapping(bytes32 => Key) private keys;
    mapping(uint256 => bytes32[]) private keysByPurpose;
    
    function addKey(bytes32 _key, uint256 _purpose, uint256 _keyType) external override returns (bool) {
        keys[_key] = Key(_purpose, _keyType, _key);
        keysByPurpose[_purpose].push(_key);
        emit KeyAdded(_key, _purpose, _keyType);
        return true;
    }
    
    function removeKey(bytes32 _key, uint256 _purpose) external override returns (bool) {
        delete keys[_key];
        emit KeyRemoved(_key, _purpose, 0);
        return true;
    }
    
    function execute(address _to, uint256 _value, bytes calldata _data) external payable override returns (uint256) {
        return 0;
    }
    
    function approve(uint256 _id, bool _approve) external override returns (bool) {
        return true;
    }
    
    function addClaim(
        uint256 _topic,
        uint256 _scheme,
        address _issuer,
        bytes calldata _signature,
        bytes calldata _data,
        string calldata _uri
    ) external override returns (bytes32) {
        bytes32 claimId = keccak256(abi.encodePacked(_topic, _issuer, _data));
        claims[claimId] = Claim(_topic, _scheme, _issuer, _signature, _data, _uri);
        claimsByTopic[_topic].push(claimId);
        emit ClaimAdded(claimId, _topic, _scheme, _issuer, _signature, _data, _uri);
        return claimId;
    }
    
    function removeClaim(bytes32 _claimId) external override returns (bool) {
        Claim memory claim = claims[_claimId];
        delete claims[_claimId];
        emit ClaimRemoved(_claimId, claim.topic, claim.scheme, claim.issuer, claim.signature, claim.data, claim.uri);
        return true;
    }
    
    function getKey(bytes32 _key) external view override returns (uint256, uint256, bytes32) {
        Key memory key = keys[_key];
        return (key.purpose, key.keyType, key.key);
    }
    
    function keyHasPurpose(bytes32 _key, uint256 _purpose) external view override returns (bool) {
        return keys[_key].purpose == _purpose;
    }
    
    function getKeysByPurpose(uint256 _purpose) external view override returns (bytes32[] memory) {
        return keysByPurpose[_purpose];
    }
    
    function getClaim(bytes32 _claimId) external view override returns (
        uint256 topic,
        uint256 scheme,
        address issuer,
        bytes memory signature,
        bytes memory data,
        string memory uri
    ) {
        Claim memory claim = claims[_claimId];
        return (claim.topic, claim.scheme, claim.issuer, claim.signature, claim.data, claim.uri);
    }
    
    function getClaimIdsByTopic(uint256 _topic) external view override returns (bytes32[] memory) {
        return claimsByTopic[_topic];
    }
}
`;

// Save mock identity contract
const fs = require("fs");
const path = require("path");

const mocksDir = path.join(__dirname, "../contracts/mocks");
if (!fs.existsSync(mocksDir)) {
    fs.mkdirSync(mocksDir, { recursive: true });
}

fs.writeFileSync(
    path.join(mocksDir, "MockIdentity.sol"),
    mockIdentitySource
);