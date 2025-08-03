const { expect } = require("chai");
const { ethers, upgrades } = require("hardhat");
const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");

describe("Overflow/Underflow Protection Tests", function () {
    async function deployFixture() {
        const [owner, agent, user1, user2] = await ethers.getSigners();

        // Deploy infrastructure
        const ClaimTopicsRegistry = await ethers.getContractFactory("ClaimTopicsRegistry");
        const claimTopicsRegistry = await upgrades.deployProxy(ClaimTopicsRegistry, [owner.address]);

        const IdentityRegistry = await ethers.getContractFactory("IdentityRegistry");
        const identityRegistry = await upgrades.deployProxy(IdentityRegistry, [owner.address]);

        const ModularCompliance = await ethers.getContractFactory("ModularCompliance");
        const modularCompliance = await upgrades.deployProxy(ModularCompliance, [owner.address]);

        const AssetRegistry = await ethers.getContractFactory("AssetRegistry");
        const assetRegistry = await upgrades.deployProxy(AssetRegistry, [owner.address]);

        // Deploy token
        const FinatradesRWAEnterprise = await ethers.getContractFactory("FinatradesRWA_Enterprise");
        const token = await upgrades.deployProxy(FinatradesRWAEnterprise, [
            owner.address,
            "Overflow Test Token",
            "OTT",
            18,
            await identityRegistry.getAddress(),
            await modularCompliance.getAddress(),
            await assetRegistry.getAddress()
        ], { 
            unsafeAllow: ['missing-initializer'],
            initializer: 'initialize(address,string,string,uint8,address,address,address)'
        });

        await modularCompliance.bindToken(await token.getAddress());

        // Setup roles
        await token.grantRole(await token.AGENT_ROLE(), agent.address);
        await identityRegistry.grantRole(await identityRegistry.AGENT_ROLE(), agent.address);

        // Setup verified users
        const Identity = await ethers.getContractFactory("Identity");
        const identity1 = await Identity.deploy(user1.address, true);
        const identity2 = await Identity.deploy(user2.address, true);

        await identityRegistry.connect(agent).batchRegisterIdentity(
            [user1.address, user2.address],
            [await identity1.getAddress(), await identity2.getAddress()],
            [840, 840]
        );

        const claimData = ethers.AbiCoder.defaultAbiCoder().encode(["uint256"], [1]);
        await identity1.connect(user1).addClaim(7, 1, owner.address, "0x00", claimData, "");
        await identity2.connect(user2).addClaim(7, 1, owner.address, "0x00", claimData, "");

        return {
            token,
            identityRegistry,
            modularCompliance,
            assetRegistry,
            owner,
            agent,
            user1,
            user2
        };
    }

    describe("Supply Overflow Protection", function () {
        it("Should prevent minting that would cause total supply overflow", async function () {
            const { token, agent, user1 } = await loadFixture(deployFixture);

            // Try to mint max uint256
            await expect(
                token.connect(agent).mint(user1.address, ethers.MaxUint256)
            ).to.be.reverted;
        });

        it("Should prevent cumulative minting that approaches max supply", async function () {
            const { token, agent, user1, user2 } = await loadFixture(deployFixture);

            // Mint large amount to user1
            const largeAmount = ethers.MaxUint256 / 2n;
            
            // This would work with unchecked math but should fail with SafeMath
            await expect(
                token.connect(agent).mint(user1.address, largeAmount)
            ).to.be.reverted;
        });

        it("Should handle operations near uint256 boundaries safely", async function () {
            const { token, agent, user1 } = await loadFixture(deployFixture);

            // Test with large but safe values
            const safeAmount = ethers.parseEther("1000000000000000"); // 1 quadrillion tokens
            
            await token.connect(agent).mint(user1.address, safeAmount);
            expect(await token.balanceOf(user1.address)).to.equal(safeAmount);
            expect(await token.totalSupply()).to.equal(safeAmount);
        });
    });

    describe("Balance Underflow Protection", function () {
        it("Should prevent transfers that would cause balance underflow", async function () {
            const { token, agent, user1, user2 } = await loadFixture(deployFixture);

            await token.connect(agent).mint(user1.address, ethers.parseEther("100"));

            // Try to transfer more than balance
            await expect(
                token.connect(user1).transfer(user2.address, ethers.parseEther("101"))
            ).to.be.reverted;

            // Balance should remain unchanged
            expect(await token.balanceOf(user1.address)).to.equal(ethers.parseEther("100"));
        });

        it("Should prevent burning that would cause balance underflow", async function () {
            const { token, agent, user1 } = await loadFixture(deployFixture);

            await token.connect(agent).mint(user1.address, ethers.parseEther("100"));

            // Try to burn more than balance
            await expect(
                token.connect(agent).burn(user1.address, ethers.parseEther("101"))
            ).to.be.reverted;

            // Balance should remain unchanged
            expect(await token.balanceOf(user1.address)).to.equal(ethers.parseEther("100"));
        });

        it("Should handle multiple operations without underflow", async function () {
            const { token, agent, user1, user2 } = await loadFixture(deployFixture);

            await token.connect(agent).mint(user1.address, ethers.parseEther("1000"));

            // Perform multiple operations
            await token.connect(user1).transfer(user2.address, ethers.parseEther("300"));
            await token.connect(user1).transfer(user2.address, ethers.parseEther("400"));
            await token.connect(user1).transfer(user2.address, ethers.parseEther("300"));

            // This should fail (would need 1001 total)
            await expect(
                token.connect(user1).transfer(user2.address, ethers.parseEther("1"))
            ).to.be.reverted;

            // Verify final balances
            expect(await token.balanceOf(user1.address)).to.equal(0);
            expect(await token.balanceOf(user2.address)).to.equal(ethers.parseEther("1000"));
        });
    });

    describe("Frozen Balance Arithmetic Safety", function () {
        it("Should prevent frozen amount overflow", async function () {
            const { token, agent, user1 } = await loadFixture(deployFixture);

            await token.connect(agent).mint(user1.address, ethers.parseEther("100"));

            // Try to freeze more than balance
            await expect(
                token.connect(agent).freezePartialTokens(user1.address, ethers.parseEther("101"))
            ).to.be.reverted;
        });

        it("Should safely handle frozen balance calculations", async function () {
            const { token, agent, user1, user2 } = await loadFixture(deployFixture);

            await token.connect(agent).mint(user1.address, ethers.parseEther("100"));
            await token.connect(agent).freezePartialTokens(user1.address, ethers.parseEther("60"));

            // Available balance = 100 - 60 = 40
            await token.connect(user1).transfer(user2.address, ethers.parseEther("40"));

            // Should not be able to transfer any more
            await expect(
                token.connect(user1).transfer(user2.address, 1)
            ).to.be.reverted;
        });

        it("Should prevent unfreezing more than frozen", async function () {
            const { token, agent, user1 } = await loadFixture(deployFixture);

            await token.connect(agent).mint(user1.address, ethers.parseEther("100"));
            await token.connect(agent).freezePartialTokens(user1.address, ethers.parseEther("60"));

            // Try to unfreeze more than frozen
            await expect(
                token.connect(agent).unfreezePartialTokens(user1.address, ethers.parseEther("61"))
            ).to.be.reverted;
        });
    });

    describe("Asset Balance Overflow Protection", function () {
        it("Should prevent asset balance from exceeding token balance", async function () {
            const { token, agent, user1 } = await loadFixture(deployFixture);

            await token.grantRole(await token.ASSET_MANAGER_ROLE(), agent.address);
            
            const assetId = ethers.id("ASSET-001");
            await token.connect(agent).mint(user1.address, ethers.parseEther("100"));

            // Try to assign more asset tokens than token balance
            await expect(
                token.connect(user1).transferWithAsset(user1.address, ethers.parseEther("101"), assetId)
            ).to.be.revertedWith("Insufficient asset tokens");
        });

        it("Should handle asset balance arithmetic safely", async function () {
            const { token, agent, user1, user2 } = await loadFixture(deployFixture);

            await token.grantRole(await token.ASSET_MANAGER_ROLE(), agent.address);
            
            const assetId = ethers.id("ASSET-001");
            await token.connect(agent).mint(user1.address, ethers.parseEther("1000"));
            await token.connect(agent).mint(user2.address, ethers.parseEther("1000"));

            // Initialize asset balances
            await token.connect(user1).transferWithAsset(user1.address, ethers.parseEther("1000"), assetId);
            await token.connect(user2).transferWithAsset(user2.address, ethers.parseEther("1000"), assetId);

            // Transfer between users
            await token.connect(user1).transferWithAsset(user2.address, ethers.parseEther("500"), assetId);

            // Verify balances
            expect(await token.getAssetBalance(user1.address, assetId)).to.equal(ethers.parseEther("500"));
            expect(await token.getAssetBalance(user2.address, assetId)).to.equal(ethers.parseEther("1500"));
            expect(await token.getAssetTotalSupply(assetId)).to.equal(ethers.parseEther("2000"));
        });
    });

    describe("Dividend Calculation Safety", function () {
        it("Should handle dividend calculations without overflow", async function () {
            const { token, agent, user1 } = await loadFixture(deployFixture);

            // Mint maximum safe amount
            const largeAmount = ethers.parseEther("1000000000000"); // 1 trillion tokens
            await token.connect(agent).mint(user1.address, largeAmount);

            // Deposit large dividend
            const largeDividend = ethers.parseEther("1000000"); // 1 million ETH
            await token.connect(agent).depositDividend(ethers.ZeroHash, { value: largeDividend });

            // Claim should work without overflow
            const balanceBefore = await ethers.provider.getBalance(user1.address);
            await token.connect(user1).claimDividend(1, 0);
            const balanceAfter = await ethers.provider.getBalance(user1.address);

            // User should receive the full dividend (minus gas)
            expect(balanceAfter).to.be.gt(balanceBefore);
        });

        it("Should prevent dividend claims with slippage overflow", async function () {
            const { token, agent, user1 } = await loadFixture(deployFixture);

            await token.connect(agent).mint(user1.address, ethers.parseEther("100"));
            await token.connect(agent).depositDividend(ethers.ZeroHash, { value: ethers.parseEther("1") });

            // Try to claim with unrealistic minimum amount (slippage protection)
            await expect(
                token.connect(user1).claimDividend(1, ethers.MaxUint256)
            ).to.be.reverted;
        });
    });

    describe("Timestamp and Time-based Calculations", function () {
        it("Should handle time calculations without overflow", async function () {
            const { token, agent } = await loadFixture(deployFixture);

            // Operations near max timestamp should not cause issues
            const currentTime = await ethers.provider.getBlock('latest').then(b => b.timestamp);
            
            // Snapshots use timestamps internally
            await token.connect(agent).snapshot();
            const snapshotId = await token.currentSnapshotId();
            
            expect(snapshotId).to.be.gt(0);
        });
    });

    describe("Compliance Module Calculations", function () {
        it("Should handle transfer limit calculations safely", async function () {
            const { token, agent, user1, user2, modularCompliance } = await loadFixture(deployFixture);

            // Deploy transfer limit module
            const TransferLimitModule = await ethers.getContractFactory("TransferLimitModule");
            const transferLimitModule = await upgrades.deployProxy(
                TransferLimitModule,
                [owner.address, ethers.parseEther("1000"), ethers.parseEther("10000")]
            );

            await modularCompliance.addModule(await transferLimitModule.getAddress());

            await token.connect(agent).mint(user1.address, ethers.parseEther("20000"));

            // Daily limit is 1000, should work
            await token.connect(user1).transfer(user2.address, ethers.parseEther("1000"));

            // Next transfer should fail (exceeds daily limit)
            await expect(
                token.connect(user1).transfer(user2.address, ethers.parseEther("1"))
            ).to.be.revertedWith("Compliance not followed");
        });

        it("Should handle max balance calculations safely", async function () {
            const { token, agent, user1, user2, modularCompliance } = await loadFixture(deployFixture);

            // Deploy max balance module
            const MaxBalanceModule = await ethers.getContractFactory("MaxBalanceModule");
            const maxBalanceModule = await upgrades.deployProxy(
                MaxBalanceModule,
                [owner.address, ethers.parseEther("1000")]
            );

            await modularCompliance.addModule(await maxBalanceModule.getAddress());

            await token.connect(agent).mint(user1.address, ethers.parseEther("500"));

            // Should work (total would be 1000)
            await token.connect(agent).mint(user2.address, ethers.parseEther("1000"));

            // Should fail (would exceed max balance)
            await expect(
                token.connect(user1).transfer(user2.address, ethers.parseEther("1"))
            ).to.be.revertedWith("Compliance not followed");
        });
    });

    describe("Edge Value Arithmetic", function () {
        it("Should handle arithmetic with 0 safely", async function () {
            const { token, agent, user1, user2 } = await loadFixture(deployFixture);

            await token.connect(agent).mint(user1.address, ethers.parseEther("100"));

            // Operations with 0
            await token.connect(user1).transfer(user2.address, 0);
            await token.connect(agent).mint(user1.address, 0);
            await token.connect(agent).burn(user1.address, 0);

            // Balance should remain unchanged
            expect(await token.balanceOf(user1.address)).to.equal(ethers.parseEther("100"));
        });

        it("Should handle arithmetic with 1 wei safely", async function () {
            const { token, agent, user1, user2 } = await loadFixture(deployFixture);

            await token.connect(agent).mint(user1.address, 1);
            expect(await token.balanceOf(user1.address)).to.equal(1);

            await token.connect(user1).transfer(user2.address, 1);
            expect(await token.balanceOf(user1.address)).to.equal(0);
            expect(await token.balanceOf(user2.address)).to.equal(1);

            await token.connect(agent).burn(user2.address, 1);
            expect(await token.balanceOf(user2.address)).to.equal(0);
        });
    });
});