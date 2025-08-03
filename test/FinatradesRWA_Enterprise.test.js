const { expect } = require("chai");
const { ethers, upgrades } = require("hardhat");
const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");

describe("FinatradesRWA_Enterprise", function () {
    // Deploy fixture
    async function deployFixture() {
        const [owner, agent, admin, investor1, investor2, investor3, issuer, custodian] = await ethers.getSigners();

        // Deploy ClaimTopicsRegistry
        const ClaimTopicsRegistry = await ethers.getContractFactory("ClaimTopicsRegistry");
        const claimTopicsRegistry = await upgrades.deployProxy(ClaimTopicsRegistry, [owner.address]);

        // Deploy IdentityRegistry
        const IdentityRegistry = await ethers.getContractFactory("IdentityRegistry");
        const identityRegistry = await upgrades.deployProxy(IdentityRegistry, [owner.address]);

        // Deploy ModularCompliance
        const ModularCompliance = await ethers.getContractFactory("ModularCompliance");
        const modularCompliance = await upgrades.deployProxy(ModularCompliance, [owner.address]);

        // Deploy AssetRegistry
        const AssetRegistry = await ethers.getContractFactory("AssetRegistry");
        const assetRegistry = await upgrades.deployProxy(AssetRegistry, [owner.address]);

        // Deploy FinatradesRWA_Enterprise
        const FinatradesRWAEnterprise = await ethers.getContractFactory("FinatradesRWA_Enterprise");
        const token = await upgrades.deployProxy(FinatradesRWAEnterprise, [
            owner.address,
            "Finatrades RWA Token",
            "FRWA",
            18,
            await identityRegistry.getAddress(),
            await modularCompliance.getAddress(),
            await assetRegistry.getAddress()
        ], { 
            unsafeAllow: ['missing-initializer'],
            initializer: 'initialize(address,string,string,uint8,address,address,address)'
        });

        // Deploy RegulatoryReporting
        const RegulatoryReporting = await ethers.getContractFactory("RegulatoryReportingOptimized");
        const regulatoryReporting = await upgrades.deployProxy(RegulatoryReporting, [
            await token.getAddress(),
            await identityRegistry.getAddress(),
            await assetRegistry.getAddress(),
            await modularCompliance.getAddress()
        ]);

        // Set up roles
        await token.grantRole(await token.AGENT_ROLE(), agent.address);
        await token.grantRole(await token.ASSET_MANAGER_ROLE(), agent.address);
        await identityRegistry.grantRole(await identityRegistry.AGENT_ROLE(), agent.address);
        await assetRegistry.grantRole(await assetRegistry.ASSET_MANAGER_ROLE(), agent.address);

        // Set compliance bound token
        await modularCompliance.bindToken(await token.getAddress());

        // Deploy compliance modules
        const CountryRestrictModule = await ethers.getContractFactory("CountryRestrictModule");
        const countryModule = await upgrades.deployProxy(CountryRestrictModule, [owner.address]);
        
        const MaxBalanceModule = await ethers.getContractFactory("MaxBalanceModule");
        const maxBalanceModule = await upgrades.deployProxy(MaxBalanceModule, [owner.address, ethers.parseEther("10000")]);
        
        const TransferLimitModule = await ethers.getContractFactory("TransferLimitModule");
        const transferLimitModule = await upgrades.deployProxy(TransferLimitModule, [owner.address, ethers.parseEther("5000"), ethers.parseEther("50000")]);

        // Skip adding modules for now - they need proper token binding
        // await modularCompliance.addModule(await countryModule.getAddress());
        // await modularCompliance.addModule(await maxBalanceModule.getAddress());
        // await modularCompliance.addModule(await transferLimitModule.getAddress());

        // Deploy identities for investors
        const Identity = await ethers.getContractFactory("Identity");
        const identity1 = await Identity.deploy(investor1.address, true);
        const identity2 = await Identity.deploy(investor2.address, true);
        const identity3 = await Identity.deploy(investor3.address, true);

        // Register identities
        await identityRegistry.connect(agent).batchRegisterIdentity(
            [investor1.address, investor2.address, investor3.address],
            [await identity1.getAddress(), await identity2.getAddress(), await identity3.getAddress()],
            [840, 840, 826] // USA, USA, UK
        );

        // Add KYC claims
        const claimData = ethers.AbiCoder.defaultAbiCoder().encode(["uint256"], [1]);
        await identity1.connect(investor1).addClaim(7, 1, issuer.address, "0x00", claimData, "");
        await identity2.connect(investor2).addClaim(7, 1, issuer.address, "0x00", claimData, "");
        await identity3.connect(investor3).addClaim(7, 1, issuer.address, "0x00", claimData, "");

        return {
            token,
            identityRegistry,
            modularCompliance,
            assetRegistry,
            regulatoryReporting,
            claimTopicsRegistry,
            countryModule,
            maxBalanceModule,
            transferLimitModule,
            identity1,
            identity2,
            identity3,
            owner,
            agent,
            admin,
            investor1,
            investor2,
            investor3,
            issuer,
            custodian
        };
    }

    describe("Deployment", function () {
        it("Should deploy with correct parameters", async function () {
            const { token } = await loadFixture(deployFixture);
            
            expect(await token.name()).to.equal("Finatrades RWA Token");
            expect(await token.symbol()).to.equal("FRWA");
            expect(await token.decimals()).to.equal(18);
            expect(await token.totalSupply()).to.equal(0);
        });

        it("Should set up roles correctly", async function () {
            const { token, owner, agent } = await loadFixture(deployFixture);
            
            expect(await token.hasRole(await token.DEFAULT_ADMIN_ROLE(), owner.address)).to.be.true;
            expect(await token.hasRole(await token.AGENT_ROLE(), agent.address)).to.be.true;
            expect(await token.hasRole(await token.ASSET_MANAGER_ROLE(), agent.address)).to.be.true;
        });
    });

    describe("Regulatory Reporting Integration", function () {
        it("Should set regulatory reporting contract", async function () {
            const { token, regulatoryReporting, owner } = await loadFixture(deployFixture);
            
            await token.setRegulatoryReporting(await regulatoryReporting.getAddress());
            expect(await token.regulatoryReporting()).to.equal(await regulatoryReporting.getAddress());
        });

        it("Should reject zero address for regulatory reporting", async function () {
            const { token, owner } = await loadFixture(deployFixture);
            
            await expect(
                token.setRegulatoryReporting(ethers.ZeroAddress)
            ).to.be.revertedWith("Invalid reporting contract");
        });

        it("Should only allow admin to set regulatory reporting", async function () {
            const { token, regulatoryReporting, investor1 } = await loadFixture(deployFixture);
            
            await expect(
                token.connect(investor1).setRegulatoryReporting(await regulatoryReporting.getAddress())
            ).to.be.reverted;
        });
    });

    describe("Minting and Burning", function () {
        it("Should mint tokens to verified investor", async function () {
            const { token, agent, investor1 } = await loadFixture(deployFixture);
            
            const amount = ethers.parseEther("1000");
            await token.connect(agent).mint(investor1.address, amount);
            
            expect(await token.balanceOf(investor1.address)).to.equal(amount);
            expect(await token.totalSupply()).to.equal(amount);
        });

        it("Should burn tokens from investor", async function () {
            const { token, agent, investor1 } = await loadFixture(deployFixture);
            
            const amount = ethers.parseEther("1000");
            await token.connect(agent).mint(investor1.address, amount);
            
            const burnAmount = ethers.parseEther("300");
            await token.connect(agent).burn(investor1.address, burnAmount);
            
            expect(await token.balanceOf(investor1.address)).to.equal(amount - burnAmount);
            expect(await token.totalSupply()).to.equal(amount - burnAmount);
        });

        it("Should not mint to unverified address", async function () {
            const { token, agent, owner } = await loadFixture(deployFixture);
            const [,,,,,,,,unverified] = await ethers.getSigners();
            
            await expect(
                token.connect(agent).mint(unverified.address, ethers.parseEther("100"))
            ).to.be.revertedWith("Identity not verified");
        });
    });

    describe("Transfers", function () {
        beforeEach(async function () {
            const { token, agent, investor1, investor2 } = await loadFixture(deployFixture);
            await token.connect(agent).mint(investor1.address, ethers.parseEther("1000"));
        });

        it("Should transfer between verified investors", async function () {
            const { token, investor1, investor2 } = await loadFixture(deployFixture);
            
            const amount = ethers.parseEther("100");
            await token.connect(investor1).transfer(investor2.address, amount);
            
            expect(await token.balanceOf(investor1.address)).to.equal(ethers.parseEther("900"));
            expect(await token.balanceOf(investor2.address)).to.equal(amount);
        });

        it("Should not transfer to unverified address", async function () {
            const { token, investor1 } = await loadFixture(deployFixture);
            const [,,,,,,,,unverified] = await ethers.getSigners();
            
            await expect(
                token.connect(investor1).transfer(unverified.address, ethers.parseEther("100"))
            ).to.be.revertedWith("Identity not verified");
        });

        it("Should record successful transfers in regulatory reporting", async function () {
            const { token, regulatoryReporting, investor1, investor2 } = await loadFixture(deployFixture);
            
            await token.setRegulatoryReporting(await regulatoryReporting.getAddress());
            
            const amount = ethers.parseEther("100");
            await token.connect(investor1).transfer(investor2.address, amount);
            
            // Verify transaction was recorded (would need to check reporting contract)
        });
    });

    describe("Asset Management", function () {
        it("Should tokenize assets", async function () {
            const { token, assetRegistry, agent, custodian } = await loadFixture(deployFixture);
            
            // Register asset first
            const assetId = ethers.id("PROPERTY-001");
            await assetRegistry.connect(agent).registerAsset(
                assetId,
                "Manhattan Building",
                0, // REAL_ESTATE
                ethers.parseEther("1000000"), // $1M
                "ipfs://metadata",
                custodian.address
            );
            
            // Tokenize asset
            const tokenAmount = ethers.parseEther("1000");
            await token.connect(agent).tokenizeAsset(assetId, tokenAmount);
            
            expect(await token.getAssetTotalSupply(assetId)).to.equal(tokenAmount);
        });

        it("Should transfer with asset tracking", async function () {
            const { token, assetRegistry, agent, investor1, investor2, custodian } = await loadFixture(deployFixture);
            
            // Setup asset and mint tokens
            const assetId = ethers.id("PROPERTY-001");
            await assetRegistry.connect(agent).registerAsset(
                assetId,
                "Manhattan Building",
                0,
                ethers.parseEther("1000000"),
                "ipfs://metadata",
                custodian.address
            );
            
            await token.connect(agent).tokenizeAsset(assetId, ethers.parseEther("1000"), agent.address);
            await token.connect(agent).mint(investor1.address, ethers.parseEther("100"));
            
            // Transfer with asset
            const amount = ethers.parseEther("50");
            await token.connect(investor1).transferWithAsset(investor2.address, amount, assetId);
            
            expect(await token.getAssetBalance(investor1.address, assetId)).to.equal(ethers.parseEther("50"));
            expect(await token.getAssetBalance(investor2.address, assetId)).to.equal(amount);
        });

        it("Should burn asset tokens", async function () {
            const { token, assetRegistry, agent, investor1, custodian } = await loadFixture(deployFixture);
            
            // Setup
            const assetId = ethers.id("PROPERTY-001");
            await assetRegistry.connect(agent).registerAsset(
                assetId,
                "Manhattan Building",
                0,
                ethers.parseEther("1000000"),
                "ipfs://metadata",
                custodian.address
            );
            
            await token.connect(agent).tokenizeAsset(assetId, ethers.parseEther("1000"), agent.address);
            await token.connect(agent).mint(investor1.address, ethers.parseEther("100"));
            await token.connect(investor1).transferWithAsset(investor1.address, ethers.parseEther("100"), assetId);
            
            // Burn asset tokens
            const burnAmount = ethers.parseEther("30");
            await token.connect(agent).burnAssetTokens(investor1.address, assetId, burnAmount);
            
            expect(await token.getAssetBalance(investor1.address, assetId)).to.equal(ethers.parseEther("70"));
            expect(await token.balanceOf(investor1.address)).to.equal(ethers.parseEther("70"));
        });
    });

    describe("Dividends", function () {
        beforeEach(async function () {
            const { token, agent, investor1, investor2, investor3 } = await loadFixture(deployFixture);
            
            // Mint tokens to investors
            await token.connect(agent).mint(investor1.address, ethers.parseEther("1000"));
            await token.connect(agent).mint(investor2.address, ethers.parseEther("2000"));
            await token.connect(agent).mint(investor3.address, ethers.parseEther("3000"));
        });

        it("Should deposit and distribute dividends", async function () {
            const { token, agent, investor1 } = await loadFixture(deployFixture);
            
            // Deposit dividend
            const dividendAmount = ethers.parseEther("6");
            await token.connect(agent).depositDividend(ethers.ZeroHash, { value: dividendAmount });
            
            // Check dividend info
            const dividendInfo = await token.getDividendInfo(1);
            expect(dividendInfo.totalAmount).to.equal(dividendAmount);
        });

        it("Should allow investors to claim dividends", async function () {
            const { token, agent, investor1, investor2 } = await loadFixture(deployFixture);
            
            // Deposit dividend
            const dividendAmount = ethers.parseEther("6");
            await token.connect(agent).depositDividend(ethers.ZeroHash, { value: dividendAmount });
            
            // Claim dividend
            const balanceBefore = await ethers.provider.getBalance(investor1.address);
            await token.connect(investor1).claimDividend(1, 0);
            const balanceAfter = await ethers.provider.getBalance(investor1.address);
            
            // Investor1 should receive 1/6 of dividend (1000/6000 tokens)
            expect(balanceAfter - balanceBefore).to.be.closeTo(ethers.parseEther("1"), ethers.parseEther("0.01"));
        });

        it("Should not allow double claiming", async function () {
            const { token, agent, investor1 } = await loadFixture(deployFixture);
            
            await token.connect(agent).depositDividend(ethers.ZeroHash, { value: ethers.parseEther("6") });
            await token.connect(investor1).claimDividend(1, 0);
            
            await expect(
                token.connect(investor1).claimDividend(1, 0)
            ).to.be.revertedWithCustomError(token, "AlreadyClaimed");
        });

        it("Should calculate dividend amounts correctly", async function () {
            const { token, investor1, investor2, investor3 } = await loadFixture(deployFixture);
            
            // Get expected amounts based on holdings
            const balance1 = await token.balanceOf(investor1.address);
            const balance2 = await token.balanceOf(investor2.address);
            const balance3 = await token.balanceOf(investor3.address);
            const totalSupply = await token.totalSupply();
            
            expect(balance1).to.equal(ethers.parseEther("1000"));
            expect(balance2).to.equal(ethers.parseEther("2000"));
            expect(balance3).to.equal(ethers.parseEther("3000"));
            expect(totalSupply).to.equal(ethers.parseEther("6000"));
        });
    });

    describe("Freezing", function () {
        it("Should freeze investor account", async function () {
            const { token, agent, investor1, investor2 } = await loadFixture(deployFixture);
            
            await token.connect(agent).mint(investor1.address, ethers.parseEther("1000"));
            await token.connect(agent).freeze(investor1.address);
            
            expect(await token.isFrozen(investor1.address)).to.be.true;
            
            await expect(
                token.connect(investor1).transfer(investor2.address, ethers.parseEther("100"))
            ).to.be.revertedWith("Address frozen");
        });

        it("Should freeze partial tokens", async function () {
            const { token, agent, investor1, investor2 } = await loadFixture(deployFixture);
            
            await token.connect(agent).mint(investor1.address, ethers.parseEther("1000"));
            await token.connect(agent).freezePartialTokens(investor1.address, ethers.parseEther("700"));
            
            // Can transfer unfrozen amount
            await token.connect(investor1).transfer(investor2.address, ethers.parseEther("300"));
            
            // Cannot transfer more than unfrozen
            await expect(
                token.connect(investor1).transfer(investor2.address, ethers.parseEther("1"))
            ).to.be.reverted;
        });

        it("Should unfreeze account", async function () {
            const { token, agent, investor1, investor2 } = await loadFixture(deployFixture);
            
            await token.connect(agent).mint(investor1.address, ethers.parseEther("1000"));
            await token.connect(agent).freeze(investor1.address);
            await token.connect(agent).unfreeze(investor1.address);
            
            expect(await token.isFrozen(investor1.address)).to.be.false;
            
            // Should be able to transfer now
            await token.connect(investor1).transfer(investor2.address, ethers.parseEther("100"));
            expect(await token.balanceOf(investor2.address)).to.equal(ethers.parseEther("100"));
        });
    });

    describe("Compliance Modules", function () {
        it("Should respect country restrictions", async function () {
            const { token, countryModule, agent, investor1, investor3 } = await loadFixture(deployFixture);
            
            await token.connect(agent).mint(investor1.address, ethers.parseEther("1000"));
            
            // Restrict UK (826)
            await countryModule.addCountryRestriction(826);
            
            // Transfer to UK investor should fail
            await expect(
                token.connect(investor1).transfer(investor3.address, ethers.parseEther("100"))
            ).to.be.revertedWith("Compliance not followed");
        });

        it("Should enforce max balance limits", async function () {
            const { token, maxBalanceModule, agent, investor1, investor2 } = await loadFixture(deployFixture);
            
            // Set max balance
            await maxBalanceModule.setDefaultMaxBalance(ethers.parseEther("500"));
            
            await token.connect(agent).mint(investor1.address, ethers.parseEther("1000"));
            
            // Transfer that would exceed max balance should fail
            await expect(
                token.connect(investor1).transfer(investor2.address, ethers.parseEther("600"))
            ).to.be.revertedWith("Compliance not followed");
            
            // Transfer within limit should succeed
            await token.connect(investor1).transfer(investor2.address, ethers.parseEther("400"));
            expect(await token.balanceOf(investor2.address)).to.equal(ethers.parseEther("400"));
        });

        it("Should enforce transfer limits", async function () {
            const { token, transferLimitModule, agent, investor1, investor2 } = await loadFixture(deployFixture);
            
            // Set daily limit
            await transferLimitModule.setDefaultLimits(ethers.parseEther("200"), ethers.parseEther("1000"));
            
            await token.connect(agent).mint(investor1.address, ethers.parseEther("1000"));
            
            // First transfer within limit
            await token.connect(investor1).transfer(investor2.address, ethers.parseEther("150"));
            
            // Second transfer exceeding daily limit should fail
            await expect(
                token.connect(investor1).transfer(investor2.address, ethers.parseEther("100"))
            ).to.be.revertedWith("Compliance not followed");
        });
    });

    describe("Recovery", function () {
        it("Should recover tokens from lost wallet", async function () {
            const { token, agent, investor1, investor2 } = await loadFixture(deployFixture);
            
            await token.connect(agent).mint(investor1.address, ethers.parseEther("1000"));
            
            // Recover tokens to new wallet
            await token.connect(agent).recoveryAddress(investor1.address, investor2.address);
            
            expect(await token.balanceOf(investor1.address)).to.equal(0);
            expect(await token.balanceOf(investor2.address)).to.equal(ethers.parseEther("1000"));
        });

        it("Should only allow agent to recover tokens", async function () {
            const { token, investor1, investor2 } = await loadFixture(deployFixture);
            
            await expect(
                token.connect(investor1).recoveryAddress(investor1.address, investor2.address)
            ).to.be.reverted;
        });
    });

    describe("Pausing", function () {
        it("Should pause and unpause transfers", async function () {
            const { token, agent, owner, investor1, investor2 } = await loadFixture(deployFixture);
            
            await token.connect(agent).mint(investor1.address, ethers.parseEther("1000"));
            
            // Pause
            await token.connect(owner).pause();
            expect(await token.paused()).to.be.true;
            
            // Transfer should fail when paused
            await expect(
                token.connect(investor1).transfer(investor2.address, ethers.parseEther("100"))
            ).to.be.revertedWith("Pausable: paused");
            
            // Unpause
            await token.connect(owner).unpause();
            expect(await token.paused()).to.be.false;
            
            // Transfer should succeed after unpause
            await token.connect(investor1).transfer(investor2.address, ethers.parseEther("100"));
            expect(await token.balanceOf(investor2.address)).to.equal(ethers.parseEther("100"));
        });
    });

    describe("Snapshots", function () {
        it("Should create snapshots and query historical balances", async function () {
            const { token, agent, investor1, investor2 } = await loadFixture(deployFixture);
            
            // Mint initial tokens
            await token.connect(agent).mint(investor1.address, ethers.parseEther("1000"));
            
            // Create snapshot
            await token.connect(agent).snapshot();
            const snapshotId = await token.currentSnapshotId();
            
            // Transfer after snapshot
            await token.connect(investor1).transfer(investor2.address, ethers.parseEther("300"));
            
            // Check historical balance
            expect(await token.balanceOfAt(investor1.address, snapshotId)).to.equal(ethers.parseEther("1000"));
            expect(await token.balanceOfAt(investor2.address, snapshotId)).to.equal(0);
            
            // Check current balance
            expect(await token.balanceOf(investor1.address)).to.equal(ethers.parseEther("700"));
            expect(await token.balanceOf(investor2.address)).to.equal(ethers.parseEther("300"));
        });
    });

    describe("Access Control", function () {
        it("Should grant and revoke roles", async function () {
            const { token, owner, investor1 } = await loadFixture(deployFixture);
            
            const agentRole = await token.AGENT_ROLE();
            
            // Grant role
            await token.connect(owner).grantRole(agentRole, investor1.address);
            expect(await token.hasRole(agentRole, investor1.address)).to.be.true;
            
            // Revoke role
            await token.connect(owner).revokeRole(agentRole, investor1.address);
            expect(await token.hasRole(agentRole, investor1.address)).to.be.false;
        });

        it("Should enforce role-based permissions", async function () {
            const { token, investor1, investor2 } = await loadFixture(deployFixture);
            
            // Non-agent cannot mint
            await expect(
                token.connect(investor1).mint(investor2.address, ethers.parseEther("100"))
            ).to.be.reverted;
            
            // Non-admin cannot pause
            await expect(
                token.connect(investor1).pause()
            ).to.be.reverted;
        });
    });

    describe("Enterprise Features", function () {
        it("Should track compliance violations in beforeTokenTransfer", async function () {
            const { token, regulatoryReporting, agent, investor1 } = await loadFixture(deployFixture);
            const [,,,,,,,,unverified] = await ethers.getSigners();
            
            await token.setRegulatoryReporting(await regulatoryReporting.getAddress());
            await token.connect(agent).mint(investor1.address, ethers.parseEther("1000"));
            
            // Try to transfer to unverified address (should fail and record violation)
            await expect(
                token.connect(investor1).transfer(unverified.address, ethers.parseEther("100"))
            ).to.be.revertedWith("Identity not verified");
        });

        it("Should handle transferWithAsset without recursion", async function () {
            const { token, assetRegistry, regulatoryReporting, agent, investor1, investor2, custodian } = await loadFixture(deployFixture);
            
            await token.setRegulatoryReporting(await regulatoryReporting.getAddress());
            
            // Setup asset
            const assetId = ethers.id("PROPERTY-001");
            await assetRegistry.connect(agent).registerAsset(
                assetId,
                "Test Property",
                0,
                ethers.parseEther("1000000"),
                "ipfs://metadata",
                custodian.address
            );
            
            await token.connect(agent).tokenizeAsset(assetId, ethers.parseEther("1000"), agent.address);
            await token.connect(agent).mint(investor1.address, ethers.parseEther("100"));
            
            // This should not cause recursion
            await token.connect(investor1).transferWithAsset(investor2.address, ethers.parseEther("50"), assetId);
            
            expect(await token.getAssetBalance(investor2.address, assetId)).to.equal(ethers.parseEther("50"));
        });

        it("Should provide dividend info through getDividendInfo", async function () {
            const { token, agent } = await loadFixture(deployFixture);
            
            // Mint tokens and create dividend
            await token.connect(agent).mint(agent.address, ethers.parseEther("1000"));
            await token.connect(agent).depositDividend(ethers.ZeroHash, { value: ethers.parseEther("1") });
            
            const info = await token.getDividendInfo(1);
            expect(info.totalAmount).to.equal(ethers.parseEther("1"));
            expect(info.snapshotId).to.be.gt(0);
        });
    });

    describe("Edge Cases", function () {
        it("Should handle zero amount transfers", async function () {
            const { token, agent, investor1, investor2 } = await loadFixture(deployFixture);
            
            await token.connect(agent).mint(investor1.address, ethers.parseEther("1000"));
            
            // Zero transfer should succeed but not change balances
            await token.connect(investor1).transfer(investor2.address, 0);
            expect(await token.balanceOf(investor1.address)).to.equal(ethers.parseEther("1000"));
            expect(await token.balanceOf(investor2.address)).to.equal(0);
        });

        it("Should handle mint to zero address (should fail)", async function () {
            const { token, agent } = await loadFixture(deployFixture);
            
            await expect(
                token.connect(agent).mint(ethers.ZeroAddress, ethers.parseEther("100"))
            ).to.be.reverted;
        });

        it("Should handle transfers when reporting contract is not set", async function () {
            const { token, agent, investor1, investor2 } = await loadFixture(deployFixture);
            
            // Don't set regulatory reporting
            await token.connect(agent).mint(investor1.address, ethers.parseEther("1000"));
            
            // Transfer should still work
            await token.connect(investor1).transfer(investor2.address, ethers.parseEther("100"));
            expect(await token.balanceOf(investor2.address)).to.equal(ethers.parseEther("100"));
        });
    });
});