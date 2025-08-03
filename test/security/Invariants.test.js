const { expect } = require("chai");
const { ethers, upgrades } = require("hardhat");
const { loadFixture, time } = require("@nomicfoundation/hardhat-network-helpers");

describe("System Invariants and Critical Properties", function () {
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
            "Invariant Test Token",
            "ITT",
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

    describe("Supply Invariants", function () {
        it("INVARIANT: Total supply equals sum of all balances", async function () {
            const { token, agent, user1, user2, user3 } = await loadFixture(deployFixture);

            // Mint various amounts
            await token.connect(agent).mint(user1.address, ethers.parseEther("100"));
            await token.connect(agent).mint(user2.address, ethers.parseEther("200"));
            await token.connect(agent).mint(user3.address, ethers.parseEther("300"));

            // Perform transfers
            await token.connect(user1).transfer(user2.address, ethers.parseEther("50"));
            await token.connect(user2).transfer(user3.address, ethers.parseEther("75"));

            // Calculate sum of balances
            const balance1 = await token.balanceOf(user1.address);
            const balance2 = await token.balanceOf(user2.address);
            const balance3 = await token.balanceOf(user3.address);
            const sumOfBalances = balance1 + balance2 + balance3;

            // Verify invariant
            expect(await token.totalSupply()).to.equal(sumOfBalances);
        });

        it("INVARIANT: Minting increases total supply by exact amount", async function () {
            const { token, agent, user1 } = await loadFixture(deployFixture);

            const supplyBefore = await token.totalSupply();
            const mintAmount = ethers.parseEther("123.456");
            
            await token.connect(agent).mint(user1.address, mintAmount);
            
            const supplyAfter = await token.totalSupply();
            expect(supplyAfter - supplyBefore).to.equal(mintAmount);
        });

        it("INVARIANT: Burning decreases total supply by exact amount", async function () {
            const { token, agent, user1 } = await loadFixture(deployFixture);

            await token.connect(agent).mint(user1.address, ethers.parseEther("1000"));
            
            const supplyBefore = await token.totalSupply();
            const burnAmount = ethers.parseEther("234.567");
            
            await token.connect(agent).burn(user1.address, burnAmount);
            
            const supplyAfter = await token.totalSupply();
            expect(supplyBefore - supplyAfter).to.equal(burnAmount);
        });

        it("INVARIANT: Transfers do not change total supply", async function () {
            const { token, agent, user1, user2 } = await loadFixture(deployFixture);

            await token.connect(agent).mint(user1.address, ethers.parseEther("1000"));
            
            const supplyBefore = await token.totalSupply();
            
            // Multiple transfers
            await token.connect(user1).transfer(user2.address, ethers.parseEther("100"));
            await token.connect(user1).transfer(user2.address, ethers.parseEther("200"));
            await token.connect(user2).transfer(user1.address, ethers.parseEther("150"));
            
            const supplyAfter = await token.totalSupply();
            expect(supplyAfter).to.equal(supplyBefore);
        });
    });

    describe("Balance Invariants", function () {
        it("INVARIANT: User balance never goes negative", async function () {
            const { token, agent, user1, user2 } = await loadFixture(deployFixture);

            await token.connect(agent).mint(user1.address, ethers.parseEther("100"));
            
            // Try to transfer more than balance
            await expect(
                token.connect(user1).transfer(user2.address, ethers.parseEther("101"))
            ).to.be.reverted;
            
            // Balance should remain unchanged
            expect(await token.balanceOf(user1.address)).to.equal(ethers.parseEther("100"));
        });

        it("INVARIANT: Frozen balance constraints are maintained", async function () {
            const { token, agent, user1, user2 } = await loadFixture(deployFixture);

            await token.connect(agent).mint(user1.address, ethers.parseEther("100"));
            await token.connect(agent).freezePartialTokens(user1.address, ethers.parseEther("60"));
            
            // Can transfer unfrozen amount
            await token.connect(user1).transfer(user2.address, ethers.parseEther("40"));
            
            // Cannot transfer more than unfrozen
            await expect(
                token.connect(user1).transfer(user2.address, ethers.parseEther("1"))
            ).to.be.reverted;
            
            // Frozen amount should still be 60
            expect(await token.getFrozenTokens(user1.address)).to.equal(ethers.parseEther("60"));
        });
    });

    describe("Identity and Compliance Invariants", function () {
        it("INVARIANT: Only verified identities can hold tokens", async function () {
            const { token, agent, identityRegistry } = await loadFixture(deployFixture);
            const unverifiedUser = ethers.Wallet.createRandom();

            // Cannot mint to unverified address
            await expect(
                token.connect(agent).mint(unverifiedUser.address, ethers.parseEther("100"))
            ).to.be.revertedWith("Identity not verified");
            
            // Verify no tokens were minted
            expect(await token.balanceOf(unverifiedUser.address)).to.equal(0);
        });

        it("INVARIANT: Identity removal prevents transfers", async function () {
            const { token, agent, user1, user2, identityRegistry } = await loadFixture(deployFixture);

            await token.connect(agent).mint(user1.address, ethers.parseEther("100"));
            
            // Remove identity
            await identityRegistry.connect(agent).deleteIdentity(user1.address);
            
            // Cannot transfer from deleted identity
            await expect(
                token.connect(user1).transfer(user2.address, ethers.parseEther("50"))
            ).to.be.revertedWith("Identity not verified");
        });

        it("INVARIANT: Compliance rules are always enforced", async function () {
            const { token, agent, user1, user2, modularCompliance } = await loadFixture(deployFixture);

            // Deploy and add a restrictive module
            const MaxBalanceModule = await ethers.getContractFactory("MaxBalanceModule");
            const maxBalanceModule = await upgrades.deployProxy(
                MaxBalanceModule, 
                [agent.address, ethers.parseEther("50")]
            );
            
            await modularCompliance.addModule(await maxBalanceModule.getAddress());
            
            await token.connect(agent).mint(user1.address, ethers.parseEther("40"));
            
            // Cannot receive tokens that would exceed max balance
            await expect(
                token.connect(agent).mint(user2.address, ethers.parseEther("60"))
            ).to.be.revertedWith("Compliance not followed");
        });
    });

    describe("Dividend Invariants", function () {
        it("INVARIANT: Total dividend claimed never exceeds deposited amount", async function () {
            const { token, agent, user1, user2, user3 } = await loadFixture(deployFixture);

            // Setup token distribution
            await token.connect(agent).mint(user1.address, ethers.parseEther("100"));
            await token.connect(agent).mint(user2.address, ethers.parseEther("200"));
            await token.connect(agent).mint(user3.address, ethers.parseEther("300"));

            // Deposit dividend
            const dividendAmount = ethers.parseEther("6");
            await token.connect(agent).depositDividend(ethers.ZeroHash, { value: dividendAmount });

            // Track claims
            const contractBalanceBefore = await ethers.provider.getBalance(await token.getAddress());
            
            // All users claim
            await token.connect(user1).claimDividend(1, 0);
            await token.connect(user2).claimDividend(1, 0);
            await token.connect(user3).claimDividend(1, 0);
            
            const contractBalanceAfter = await ethers.provider.getBalance(await token.getAddress());
            
            // Verify no excess ETH was distributed
            const totalClaimed = contractBalanceBefore - contractBalanceAfter;
            expect(totalClaimed).to.be.lte(dividendAmount);
        });

        it("INVARIANT: User cannot claim more than their proportional share", async function () {
            const { token, agent, user1, user2 } = await loadFixture(deployFixture);

            // User1: 25%, User2: 75%
            await token.connect(agent).mint(user1.address, ethers.parseEther("250"));
            await token.connect(agent).mint(user2.address, ethers.parseEther("750"));

            // Deposit dividend
            await token.connect(agent).depositDividend(ethers.ZeroHash, { value: ethers.parseEther("10") });

            // Track user1 balance change
            const user1BalanceBefore = await ethers.provider.getBalance(user1.address);
            const tx = await token.connect(user1).claimDividend(1, 0);
            const receipt = await tx.wait();
            const gasUsed = receipt.gasUsed * receipt.gasPrice;
            const user1BalanceAfter = await ethers.provider.getBalance(user1.address);

            // User1 should receive ~2.5 ETH (25% of 10 ETH)
            const received = user1BalanceAfter - user1BalanceBefore + gasUsed;
            expect(received).to.be.closeTo(ethers.parseEther("2.5"), ethers.parseEther("0.01"));
        });
    });

    describe("Asset Management Invariants", function () {
        it("INVARIANT: Asset token balance never exceeds total token balance", async function () {
            const { token, agent, user1 } = await loadFixture(deployFixture);

            await token.grantRole(await token.ASSET_MANAGER_ROLE(), agent.address);
            
            const assetId = ethers.id("ASSET-001");
            await token.connect(agent).mint(user1.address, ethers.parseEther("100"));
            
            // Initialize asset balance
            await token.connect(user1).transferWithAsset(user1.address, ethers.parseEther("100"), assetId);
            
            // Asset balance should equal token balance
            expect(await token.getAssetBalance(user1.address, assetId)).to.equal(ethers.parseEther("100"));
            expect(await token.balanceOf(user1.address)).to.equal(ethers.parseEther("100"));
        });

        it("INVARIANT: Sum of asset balances equals asset total supply", async function () {
            const { token, agent, user1, user2, user3 } = await loadFixture(deployFixture);

            await token.grantRole(await token.ASSET_MANAGER_ROLE(), agent.address);
            
            const assetId = ethers.id("ASSET-001");
            
            // Mint and assign to asset
            await token.connect(agent).mint(user1.address, ethers.parseEther("100"));
            await token.connect(agent).mint(user2.address, ethers.parseEther("200"));
            await token.connect(agent).mint(user3.address, ethers.parseEther("300"));
            
            await token.connect(user1).transferWithAsset(user1.address, ethers.parseEther("100"), assetId);
            await token.connect(user2).transferWithAsset(user2.address, ethers.parseEther("200"), assetId);
            await token.connect(user3).transferWithAsset(user3.address, ethers.parseEther("300"), assetId);
            
            // Transfer between users
            await token.connect(user1).transferWithAsset(user2.address, ethers.parseEther("50"), assetId);
            
            // Calculate sum
            const balance1 = await token.getAssetBalance(user1.address, assetId);
            const balance2 = await token.getAssetBalance(user2.address, assetId);
            const balance3 = await token.getAssetBalance(user3.address, assetId);
            const sum = balance1 + balance2 + balance3;
            
            expect(sum).to.equal(await token.getAssetTotalSupply(assetId));
        });
    });

    describe("Snapshot Invariants", function () {
        it("INVARIANT: Snapshot balances are immutable", async function () {
            const { token, agent, user1, user2 } = await loadFixture(deployFixture);

            await token.connect(agent).mint(user1.address, ethers.parseEther("1000"));
            
            // Take snapshot
            await token.connect(agent).snapshot();
            const snapshotId = await token.currentSnapshotId();
            
            // Record historical balance
            const historicalBalance = await token.balanceOfAt(user1.address, snapshotId);
            
            // Make transfers
            await token.connect(user1).transfer(user2.address, ethers.parseEther("500"));
            await token.connect(agent).burn(user1.address, ethers.parseEther("200"));
            
            // Historical balance should remain unchanged
            expect(await token.balanceOfAt(user1.address, snapshotId)).to.equal(historicalBalance);
        });

        it("INVARIANT: Total supply at snapshot equals sum of balances at snapshot", async function () {
            const { token, agent, user1, user2, user3 } = await loadFixture(deployFixture);

            // Setup balances
            await token.connect(agent).mint(user1.address, ethers.parseEther("100"));
            await token.connect(agent).mint(user2.address, ethers.parseEther("200"));
            await token.connect(agent).mint(user3.address, ethers.parseEther("300"));
            
            // Take snapshot
            await token.connect(agent).snapshot();
            const snapshotId = await token.currentSnapshotId();
            
            // Make changes after snapshot
            await token.connect(user1).transfer(user2.address, ethers.parseEther("50"));
            await token.connect(agent).mint(user3.address, ethers.parseEther("100"));
            
            // Calculate historical sum
            const balance1 = await token.balanceOfAt(user1.address, snapshotId);
            const balance2 = await token.balanceOfAt(user2.address, snapshotId);
            const balance3 = await token.balanceOfAt(user3.address, snapshotId);
            const sumAtSnapshot = balance1 + balance2 + balance3;
            
            // Verify invariant
            expect(await token.totalSupplyAt(snapshotId)).to.equal(sumAtSnapshot);
        });
    });

    describe("Role Invariants", function () {
        it("INVARIANT: Role admin can always revoke roles", async function () {
            const { token, owner, agent } = await loadFixture(deployFixture);

            const AGENT_ROLE = await token.AGENT_ROLE();
            
            // Grant role
            await token.connect(owner).grantRole(AGENT_ROLE, agent.address);
            expect(await token.hasRole(AGENT_ROLE, agent.address)).to.be.true;
            
            // Admin can revoke
            await token.connect(owner).revokeRole(AGENT_ROLE, agent.address);
            expect(await token.hasRole(AGENT_ROLE, agent.address)).to.be.false;
        });

        it("INVARIANT: Default admin role cannot be renounced if it's the last admin", async function () {
            const { token, owner } = await loadFixture(deployFixture);

            const DEFAULT_ADMIN_ROLE = await token.DEFAULT_ADMIN_ROLE();
            const adminCount = await token.getRoleMemberCount(DEFAULT_ADMIN_ROLE);
            
            if (adminCount === 1n) {
                // Cannot renounce last admin
                await expect(
                    token.connect(owner).renounceRole(DEFAULT_ADMIN_ROLE, owner.address)
                ).to.be.reverted;
            }
        });
    });

    describe("Pause Invariants", function () {
        it("INVARIANT: No state changes allowed when paused", async function () {
            const { token, owner, agent, user1, user2 } = await loadFixture(deployFixture);

            await token.connect(agent).mint(user1.address, ethers.parseEther("1000"));
            
            // Pause contract
            await token.connect(owner).pause();
            
            // All state-changing operations should fail
            await expect(token.connect(agent).mint(user2.address, ethers.parseEther("100")))
                .to.be.revertedWith("Pausable: paused");
            
            await expect(token.connect(user1).transfer(user2.address, ethers.parseEther("100")))
                .to.be.revertedWith("Pausable: paused");
            
            await expect(token.connect(agent).burn(user1.address, ethers.parseEther("100")))
                .to.be.revertedWith("Pausable: paused");
            
            // Balances should remain unchanged
            expect(await token.balanceOf(user1.address)).to.equal(ethers.parseEther("1000"));
            expect(await token.balanceOf(user2.address)).to.equal(0);
        });
    });
});