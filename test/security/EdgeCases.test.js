const { expect } = require("chai");
const { ethers, upgrades } = require("hardhat");
const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");

describe("Edge Cases and Boundary Tests", function () {
    async function deployFixture() {
        const [owner, agent, user1, user2, user3] = await ethers.getSigners();

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
            "Edge Case Test Token",
            "ECT",
            18,
            await identityRegistry.getAddress(),
            await modularCompliance.getAddress(),
            await assetRegistry.getAddress()
        ], { 
            unsafeAllow: ['missing-initializer'],
            initializer: 'initialize(address,string,string,uint8,address,address,address)'
        });

        await modularCompliance.bindToken(await token.getAddress());

        // Setup roles and identities
        await token.grantRole(await token.AGENT_ROLE(), agent.address);
        await identityRegistry.grantRole(await identityRegistry.AGENT_ROLE(), agent.address);

        // Setup verified users
        const Identity = await ethers.getContractFactory("Identity");
        const identity1 = await Identity.deploy(user1.address, true);
        const identity2 = await Identity.deploy(user2.address, true);
        const identity3 = await Identity.deploy(user3.address, true);

        await identityRegistry.connect(agent).batchRegisterIdentity(
            [user1.address, user2.address, user3.address],
            [await identity1.getAddress(), await identity2.getAddress(), await identity3.getAddress()],
            [840, 840, 840]
        );

        const claimData = ethers.AbiCoder.defaultAbiCoder().encode(["uint256"], [1]);
        await identity1.connect(user1).addClaim(7, 1, owner.address, "0x00", claimData, "");
        await identity2.connect(user2).addClaim(7, 1, owner.address, "0x00", claimData, "");
        await identity3.connect(user3).addClaim(7, 1, owner.address, "0x00", claimData, "");

        return {
            token,
            identityRegistry,
            modularCompliance,
            assetRegistry,
            owner,
            agent,
            user1,
            user2,
            user3
        };
    }

    describe("Zero Value Edge Cases", function () {
        it("Should handle zero amount transfers", async function () {
            const { token, agent, user1, user2 } = await loadFixture(deployFixture);
            
            await token.connect(agent).mint(user1.address, ethers.parseEther("100"));
            
            // Zero transfer should succeed but not change balances
            await expect(token.connect(user1).transfer(user2.address, 0))
                .to.emit(token, "Transfer")
                .withArgs(user1.address, user2.address, 0);
            
            expect(await token.balanceOf(user1.address)).to.equal(ethers.parseEther("100"));
            expect(await token.balanceOf(user2.address)).to.equal(0);
        });

        it("Should handle zero amount minting", async function () {
            const { token, agent, user1 } = await loadFixture(deployFixture);
            
            const balanceBefore = await token.balanceOf(user1.address);
            await token.connect(agent).mint(user1.address, 0);
            const balanceAfter = await token.balanceOf(user1.address);
            
            expect(balanceAfter).to.equal(balanceBefore);
        });

        it("Should handle zero amount burning", async function () {
            const { token, agent, user1 } = await loadFixture(deployFixture);
            
            await token.connect(agent).mint(user1.address, ethers.parseEther("100"));
            
            const balanceBefore = await token.balanceOf(user1.address);
            await token.connect(agent).burn(user1.address, 0);
            const balanceAfter = await token.balanceOf(user1.address);
            
            expect(balanceAfter).to.equal(balanceBefore);
        });

        it("Should handle zero dividend deposits", async function () {
            const { token, agent } = await loadFixture(deployFixture);
            
            await expect(
                token.connect(agent).depositDividend(ethers.ZeroHash, { value: 0 })
            ).to.be.revertedWith("No dividend amount");
        });
    });

    describe("Maximum Value Edge Cases", function () {
        it("Should handle transfers at maximum uint256", async function () {
            const { token, agent, user1, user2 } = await loadFixture(deployFixture);
            
            const maxAmount = ethers.MaxUint256;
            
            // Try to mint max uint256 (should fail due to total supply limits)
            await expect(
                token.connect(agent).mint(user1.address, maxAmount)
            ).to.be.reverted;
        });

        it("Should handle large but valid amounts", async function () {
            const { token, agent, user1, user2 } = await loadFixture(deployFixture);
            
            const largeAmount = ethers.parseEther("1000000000"); // 1 billion tokens
            
            await token.connect(agent).mint(user1.address, largeAmount);
            expect(await token.balanceOf(user1.address)).to.equal(largeAmount);
            
            // Transfer half
            const halfAmount = largeAmount / 2n;
            await token.connect(user1).transfer(user2.address, halfAmount);
            
            expect(await token.balanceOf(user1.address)).to.equal(halfAmount);
            expect(await token.balanceOf(user2.address)).to.equal(halfAmount);
        });
    });

    describe("Address Edge Cases", function () {
        it("Should reject transfers to zero address", async function () {
            const { token, agent, user1 } = await loadFixture(deployFixture);
            
            await token.connect(agent).mint(user1.address, ethers.parseEther("100"));
            
            await expect(
                token.connect(user1).transfer(ethers.ZeroAddress, ethers.parseEther("50"))
            ).to.be.reverted;
        });

        it("Should reject minting to zero address", async function () {
            const { token, agent } = await loadFixture(deployFixture);
            
            await expect(
                token.connect(agent).mint(ethers.ZeroAddress, ethers.parseEther("100"))
            ).to.be.reverted;
        });

        it("Should handle self-transfers", async function () {
            const { token, agent, user1 } = await loadFixture(deployFixture);
            
            await token.connect(agent).mint(user1.address, ethers.parseEther("100"));
            
            // Self-transfer should succeed but not change balance
            await expect(token.connect(user1).transfer(user1.address, ethers.parseEther("50")))
                .to.emit(token, "Transfer")
                .withArgs(user1.address, user1.address, ethers.parseEther("50"));
            
            expect(await token.balanceOf(user1.address)).to.equal(ethers.parseEther("100"));
        });
    });

    describe("Balance Edge Cases", function () {
        it("Should handle transfers of entire balance", async function () {
            const { token, agent, user1, user2 } = await loadFixture(deployFixture);
            
            const amount = ethers.parseEther("100");
            await token.connect(agent).mint(user1.address, amount);
            
            // Transfer entire balance
            await token.connect(user1).transfer(user2.address, amount);
            
            expect(await token.balanceOf(user1.address)).to.equal(0);
            expect(await token.balanceOf(user2.address)).to.equal(amount);
        });

        it("Should reject transfers exceeding balance", async function () {
            const { token, agent, user1, user2 } = await loadFixture(deployFixture);
            
            await token.connect(agent).mint(user1.address, ethers.parseEther("100"));
            
            await expect(
                token.connect(user1).transfer(user2.address, ethers.parseEther("101"))
            ).to.be.reverted;
        });

        it("Should handle multiple small transfers", async function () {
            const { token, agent, user1, user2 } = await loadFixture(deployFixture);
            
            await token.connect(agent).mint(user1.address, ethers.parseEther("100"));
            
            // Make 100 transfers of 1 token each
            for (let i = 0; i < 100; i++) {
                await token.connect(user1).transfer(user2.address, ethers.parseEther("1"));
            }
            
            expect(await token.balanceOf(user1.address)).to.equal(0);
            expect(await token.balanceOf(user2.address)).to.equal(ethers.parseEther("100"));
        });
    });

    describe("Freezing Edge Cases", function () {
        it("Should handle freezing with zero balance", async function () {
            const { token, agent, user1 } = await loadFixture(deployFixture);
            
            // Freeze user with zero balance
            await token.connect(agent).freeze(user1.address);
            expect(await token.isFrozen(user1.address)).to.be.true;
            
            // Try to receive tokens while frozen
            await expect(
                token.connect(agent).mint(user1.address, ethers.parseEther("100"))
            ).to.be.revertedWith("Address frozen");
        });

        it("Should handle partial freezing edge cases", async function () {
            const { token, agent, user1, user2 } = await loadFixture(deployFixture);
            
            await token.connect(agent).mint(user1.address, ethers.parseEther("100"));
            
            // Freeze exactly the balance
            await token.connect(agent).freezePartialTokens(user1.address, ethers.parseEther("100"));
            
            // Should not be able to transfer anything
            await expect(
                token.connect(user1).transfer(user2.address, 1)
            ).to.be.reverted;
            
            // Unfreeze 1 wei
            await token.connect(agent).unfreezePartialTokens(user1.address, 1);
            
            // Should be able to transfer exactly 1 wei
            await token.connect(user1).transfer(user2.address, 1);
            expect(await token.balanceOf(user2.address)).to.equal(1);
        });
    });

    describe("Asset Management Edge Cases", function () {
        it("Should handle asset operations with empty asset ID", async function () {
            const { token, agent, user1, assetRegistry } = await loadFixture(deployFixture);
            
            await token.grantRole(await token.ASSET_MANAGER_ROLE(), agent.address);
            await assetRegistry.grantRole(await assetRegistry.ASSET_MANAGER_ROLE(), agent.address);
            
            const emptyAssetId = ethers.ZeroHash;
            
            // Should handle operations with zero hash asset ID
            await token.connect(agent).mint(user1.address, ethers.parseEther("100"));
            
            // Try to transfer with empty asset ID
            await expect(
                token.connect(user1).transferWithAsset(user1.address, ethers.parseEther("50"), emptyAssetId)
            ).to.not.be.reverted;
        });

        it("Should handle very long asset IDs", async function () {
            const { token, agent, user1 } = await loadFixture(deployFixture);
            
            await token.grantRole(await token.ASSET_MANAGER_ROLE(), agent.address);
            
            // Maximum length bytes32
            const longAssetId = ethers.keccak256(ethers.toUtf8Bytes("x".repeat(1000)));
            
            await token.connect(agent).mint(user1.address, ethers.parseEther("100"));
            
            // Should handle long asset IDs
            await expect(
                token.connect(user1).transferWithAsset(user1.address, ethers.parseEther("50"), longAssetId)
            ).to.not.be.reverted;
        });
    });

    describe("Dividend Edge Cases", function () {
        it("Should handle dividend claims with rounding", async function () {
            const { token, agent, user1, user2, user3 } = await loadFixture(deployFixture);
            
            // Mint uneven amounts
            await token.connect(agent).mint(user1.address, ethers.parseEther("33.333333"));
            await token.connect(agent).mint(user2.address, ethers.parseEther("33.333333"));
            await token.connect(agent).mint(user3.address, ethers.parseEther("33.333334"));
            
            // Deposit dividend that doesn't divide evenly
            await token.connect(agent).depositDividend(ethers.ZeroHash, { value: ethers.parseEther("1") });
            
            // Each user claims
            await token.connect(user1).claimDividend(1, 0);
            await token.connect(user2).claimDividend(1, 0);
            await token.connect(user3).claimDividend(1, 0);
            
            // Verify no ETH is stuck in contract (within dust amount)
            const contractBalance = await ethers.provider.getBalance(await token.getAddress());
            expect(contractBalance).to.be.lessThan(100); // Less than 100 wei dust
        });

        it("Should handle dividend index boundaries", async function () {
            const { token, agent } = await loadFixture(deployFixture);
            
            // Try to claim non-existent dividend
            await expect(
                token.connect(agent).claimDividend(0, 0)
            ).to.be.revertedWith("Invalid dividend index");
            
            await expect(
                token.connect(agent).claimDividend(999999, 0)
            ).to.be.revertedWith("Invalid dividend index");
        });
    });

    describe("Compliance Module Edge Cases", function () {
        it("Should handle empty compliance modules", async function () {
            const { token, agent, user1, user2 } = await loadFixture(deployFixture);
            
            // With no modules, transfers should work
            await token.connect(agent).mint(user1.address, ethers.parseEther("100"));
            await token.connect(user1).transfer(user2.address, ethers.parseEther("50"));
            
            expect(await token.balanceOf(user2.address)).to.equal(ethers.parseEther("50"));
        });
    });

    describe("Snapshot Edge Cases", function () {
        it("Should handle snapshots at boundaries", async function () {
            const { token, agent, user1 } = await loadFixture(deployFixture);
            
            // Create snapshot with no supply
            await token.connect(agent).snapshot();
            const snapshot1 = await token.currentSnapshotId();
            
            // Mint after snapshot
            await token.connect(agent).mint(user1.address, ethers.parseEther("100"));
            
            // Historical balance should be 0
            expect(await token.balanceOfAt(user1.address, snapshot1)).to.equal(0);
            
            // Create another snapshot
            await token.connect(agent).snapshot();
            const snapshot2 = await token.currentSnapshotId();
            
            // Current and historical balance should match
            expect(await token.balanceOfAt(user1.address, snapshot2)).to.equal(ethers.parseEther("100"));
        });

        it("Should handle rapid sequential snapshots", async function () {
            const { token, agent } = await loadFixture(deployFixture);
            
            // Create multiple snapshots rapidly
            const snapshotIds = [];
            for (let i = 0; i < 10; i++) {
                await token.connect(agent).snapshot();
                snapshotIds.push(await token.currentSnapshotId());
            }
            
            // Verify all snapshots are unique and sequential
            for (let i = 1; i < snapshotIds.length; i++) {
                expect(snapshotIds[i]).to.equal(snapshotIds[i-1] + 1n);
            }
        });
    });
});