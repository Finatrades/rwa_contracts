const { expect } = require("chai");
const { ethers, upgrades } = require("hardhat");
const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");

describe("FinatradesMultiToken (ERC1155)", function () {
    async function deployMultiTokenFixture() {
        const [admin, agent, user1, user2, user3, unauthorized] = await ethers.getSigners();
        
        // Deploy Identity Registry
        const IdentityRegistry = await ethers.getContractFactory("IdentityRegistry");
        const identityRegistry = await upgrades.deployProxy(IdentityRegistry, [admin.address]);
        await identityRegistry.waitForDeployment();
        
        // Deploy Compliance
        const ModularCompliance = await ethers.getContractFactory("ModularCompliance");
        const compliance = await upgrades.deployProxy(ModularCompliance, [admin.address]);
        await compliance.waitForDeployment();
        
        // Deploy Multi-Token
        const FinatradesMultiToken = await ethers.getContractFactory("FinatradesMultiToken");
        const multiToken = await upgrades.deployProxy(
            FinatradesMultiToken,
            [
                admin.address,
                "https://api.finatrades.com/metadata/",
                await identityRegistry.getAddress(),
                await compliance.getAddress()
            ]
        );
        await multiToken.waitForDeployment();
        
        // Bind token to compliance
        await compliance.bindToken(await multiToken.getAddress());
        
        // Grant roles
        const AGENT_ROLE = await multiToken.AGENT_ROLE();
        const BATCH_CREATOR_ROLE = await multiToken.BATCH_CREATOR_ROLE();
        await multiToken.grantRole(AGENT_ROLE, agent.address);
        await multiToken.grantRole(BATCH_CREATOR_ROLE, agent.address);
        
        // Register identities for users
        const users = [user1, user2, user3];
        for (const user of users) {
            // Deploy identity contract
            const Identity = await ethers.getContractFactory("Identity");
            const identity = await Identity.deploy(user.address, false);
            await identity.waitForDeployment();
            
            // Register in IdentityRegistry
            await identityRegistry.registerIdentity(
                user.address,
                await identity.getAddress(),
                840 // USA
            );
        }
        
        return {
            multiToken,
            identityRegistry,
            compliance,
            admin,
            agent,
            user1,
            user2,
            user3,
            unauthorized
        };
    }
    
    describe("Batch Creation", function () {
        it("Should create a new batch with correct metadata", async function () {
            const { multiToken, agent } = await loadFixture(deployMultiTokenFixture);
            
            const assetId = ethers.keccak256(ethers.toUtf8Bytes("GOLD-001"));
            const name = "Gold Batch Q1 2024";
            const description = "100 ounces of gold";
            const totalSupply = 100000;
            const unitValue = ethers.parseEther("50");
            const metadataURI = "ipfs://QmBatchMetadata";
            
            const tx = await multiToken.connect(agent).createBatch(
                assetId,
                name,
                description,
                totalSupply,
                unitValue,
                metadataURI
            );
            
            const receipt = await tx.wait();
            const event = receipt.logs.find(log => log.fragment?.name === "BatchCreated");
            
            expect(event.args.tokenId).to.equal(1);
            expect(event.args.assetId).to.equal(assetId);
            expect(event.args.totalSupply).to.equal(totalSupply);
            
            // Verify batch metadata
            const metadata = await multiToken.getBatchMetadata(1);
            expect(metadata.name).to.equal(name);
            expect(metadata.description).to.equal(description);
            expect(metadata.totalSupply).to.equal(totalSupply);
            expect(metadata.unitValue).to.equal(unitValue);
            expect(metadata.metadataURI).to.equal(metadataURI);
            expect(metadata.isActive).to.be.true;
        });
        
        it("Should not allow unauthorized users to create batches", async function () {
            const { multiToken, unauthorized } = await loadFixture(deployMultiTokenFixture);
            
            await expect(
                multiToken.connect(unauthorized).createBatch(
                    ethers.keccak256(ethers.toUtf8Bytes("GOLD-001")),
                    "Gold Batch",
                    "Description",
                    100000,
                    ethers.parseEther("50"),
                    "ipfs://metadata"
                )
            ).to.be.reverted;
        });
        
        it("Should reject batch creation with invalid parameters", async function () {
            const { multiToken, agent } = await loadFixture(deployMultiTokenFixture);
            
            // Zero asset ID
            await expect(
                multiToken.connect(agent).createBatch(
                    ethers.ZeroHash,
                    "Name",
                    "Description",
                    100000,
                    ethers.parseEther("50"),
                    "ipfs://metadata"
                )
            ).to.be.revertedWith("Invalid asset ID");
            
            // Zero total supply
            await expect(
                multiToken.connect(agent).createBatch(
                    ethers.keccak256(ethers.toUtf8Bytes("GOLD-001")),
                    "Name",
                    "Description",
                    0,
                    ethers.parseEther("50"),
                    "ipfs://metadata"
                )
            ).to.be.revertedWith("Total supply must be > 0");
            
            // Zero unit value
            await expect(
                multiToken.connect(agent).createBatch(
                    ethers.keccak256(ethers.toUtf8Bytes("GOLD-001")),
                    "Name",
                    "Description",
                    100000,
                    0,
                    "ipfs://metadata"
                )
            ).to.be.revertedWith("Unit value must be > 0");
        });
    });
    
    describe("Minting", function () {
        it("Should mint tokens to verified users", async function () {
            const { multiToken, agent, user1 } = await loadFixture(deployMultiTokenFixture);
            
            // Create a batch
            await multiToken.connect(agent).createBatch(
                ethers.keccak256(ethers.toUtf8Bytes("GOLD-001")),
                "Gold Batch",
                "Description",
                100000,
                ethers.parseEther("50"),
                "ipfs://metadata"
            );
            
            // Mint tokens
            await multiToken.connect(agent).mintBatch(1, user1.address, 10000);
            
            // Check balance
            const balance = await multiToken.balanceOf(user1.address, 1);
            expect(balance).to.equal(10000);
            
            // Check batch metadata updated
            const metadata = await multiToken.getBatchMetadata(1);
            expect(metadata.mintedSupply).to.equal(10000);
        });
        
        it("Should mint to multiple addresses", async function () {
            const { multiToken, agent, user1, user2, user3 } = await loadFixture(deployMultiTokenFixture);
            
            // Create a batch
            await multiToken.connect(agent).createBatch(
                ethers.keccak256(ethers.toUtf8Bytes("GOLD-001")),
                "Gold Batch",
                "Description",
                100000,
                ethers.parseEther("50"),
                "ipfs://metadata"
            );
            
            // Mint to multiple users
            await multiToken.connect(agent).mintBatchMultiple(
                1,
                [user1.address, user2.address, user3.address],
                [10000, 20000, 30000]
            );
            
            // Check balances
            expect(await multiToken.balanceOf(user1.address, 1)).to.equal(10000);
            expect(await multiToken.balanceOf(user2.address, 1)).to.equal(20000);
            expect(await multiToken.balanceOf(user3.address, 1)).to.equal(30000);
            
            // Check total minted
            const metadata = await multiToken.getBatchMetadata(1);
            expect(metadata.mintedSupply).to.equal(60000);
        });
        
        it("Should not exceed max supply", async function () {
            const { multiToken, agent, user1 } = await loadFixture(deployMultiTokenFixture);
            
            // Create a batch with small supply
            await multiToken.connect(agent).createBatch(
                ethers.keccak256(ethers.toUtf8Bytes("GOLD-001")),
                "Gold Batch",
                "Description",
                1000,
                ethers.parseEther("50"),
                "ipfs://metadata"
            );
            
            // Try to mint more than total supply
            await expect(
                multiToken.connect(agent).mintBatch(1, user1.address, 1001)
            ).to.be.revertedWithCustomError(multiToken, "ExceedsMaxSupply");
        });
        
        it("Should not mint to unverified users", async function () {
            const { multiToken, agent, unauthorized } = await loadFixture(deployMultiTokenFixture);
            
            // Create a batch
            await multiToken.connect(agent).createBatch(
                ethers.keccak256(ethers.toUtf8Bytes("GOLD-001")),
                "Gold Batch",
                "Description",
                100000,
                ethers.parseEther("50"),
                "ipfs://metadata"
            );
            
            // Try to mint to unverified user
            await expect(
                multiToken.connect(agent).mintBatch(1, unauthorized.address, 10000)
            ).to.be.revertedWithCustomError(multiToken, "IdentityNotVerified");
        });
    });
    
    describe("Transfers", function () {
        it("Should transfer tokens between verified users", async function () {
            const { multiToken, agent, user1, user2 } = await loadFixture(deployMultiTokenFixture);
            
            // Setup: Create batch and mint to user1
            await multiToken.connect(agent).createBatch(
                ethers.keccak256(ethers.toUtf8Bytes("GOLD-001")),
                "Gold Batch",
                "Description",
                100000,
                ethers.parseEther("50"),
                "ipfs://metadata"
            );
            await multiToken.connect(agent).mintBatch(1, user1.address, 10000);
            
            // Transfer from user1 to user2
            await multiToken.connect(user1).safeTransferFrom(
                user1.address,
                user2.address,
                1,
                5000,
                "0x"
            );
            
            // Check balances
            expect(await multiToken.balanceOf(user1.address, 1)).to.equal(5000);
            expect(await multiToken.balanceOf(user2.address, 1)).to.equal(5000);
        });
        
        it("Should not transfer to unverified users", async function () {
            const { multiToken, agent, user1, unauthorized } = await loadFixture(deployMultiTokenFixture);
            
            // Setup
            await multiToken.connect(agent).createBatch(
                ethers.keccak256(ethers.toUtf8Bytes("GOLD-001")),
                "Gold Batch",
                "Description",
                100000,
                ethers.parseEther("50"),
                "ipfs://metadata"
            );
            await multiToken.connect(agent).mintBatch(1, user1.address, 10000);
            
            // Try to transfer to unverified user
            await expect(
                multiToken.connect(user1).safeTransferFrom(
                    user1.address,
                    unauthorized.address,
                    1,
                    5000,
                    "0x"
                )
            ).to.be.revertedWithCustomError(multiToken, "IdentityNotVerified");
        });
        
        it("Should not transfer from frozen accounts", async function () {
            const { multiToken, agent, user1, user2 } = await loadFixture(deployMultiTokenFixture);
            
            // Setup
            await multiToken.connect(agent).createBatch(
                ethers.keccak256(ethers.toUtf8Bytes("GOLD-001")),
                "Gold Batch",
                "Description",
                100000,
                ethers.parseEther("50"),
                "ipfs://metadata"
            );
            await multiToken.connect(agent).mintBatch(1, user1.address, 10000);
            
            // Freeze user1
            await multiToken.connect(agent).freezeAddress(user1.address, true);
            
            // Try to transfer from frozen account
            await expect(
                multiToken.connect(user1).safeTransferFrom(
                    user1.address,
                    user2.address,
                    1,
                    5000,
                    "0x"
                )
            ).to.be.revertedWithCustomError(multiToken, "AccountFrozen");
        });
        
        it("Should not transfer frozen batches", async function () {
            const { multiToken, agent, user1, user2 } = await loadFixture(deployMultiTokenFixture);
            
            // Setup
            await multiToken.connect(agent).createBatch(
                ethers.keccak256(ethers.toUtf8Bytes("GOLD-001")),
                "Gold Batch",
                "Description",
                100000,
                ethers.parseEther("50"),
                "ipfs://metadata"
            );
            await multiToken.connect(agent).mintBatch(1, user1.address, 10000);
            
            // Freeze the batch
            await multiToken.connect(agent).freezeBatch(1, true);
            
            // Try to transfer frozen batch
            await expect(
                multiToken.connect(user1).safeTransferFrom(
                    user1.address,
                    user2.address,
                    1,
                    5000,
                    "0x"
                )
            ).to.be.revertedWithCustomError(multiToken, "BatchFrozen");
        });
    });
    
    describe("Burning and Redemption", function () {
        it("Should burn tokens", async function () {
            const { multiToken, agent, user1 } = await loadFixture(deployMultiTokenFixture);
            
            // Setup
            await multiToken.connect(agent).createBatch(
                ethers.keccak256(ethers.toUtf8Bytes("GOLD-001")),
                "Gold Batch",
                "Description",
                100000,
                ethers.parseEther("50"),
                "ipfs://metadata"
            );
            await multiToken.connect(agent).mintBatch(1, user1.address, 10000);
            
            // Burn tokens
            await multiToken.connect(agent).burnBatch(1, user1.address, 3000);
            
            // Check balance and metadata
            expect(await multiToken.balanceOf(user1.address, 1)).to.equal(7000);
            const metadata = await multiToken.getBatchMetadata(1);
            expect(metadata.mintedSupply).to.equal(7000);
        });
        
        it("Should allow token redemption", async function () {
            const { multiToken, agent, user1 } = await loadFixture(deployMultiTokenFixture);
            
            // Setup
            await multiToken.connect(agent).createBatch(
                ethers.keccak256(ethers.toUtf8Bytes("GOLD-001")),
                "Gold Batch",
                "Description",
                100000,
                ethers.parseEther("50"),
                "ipfs://metadata"
            );
            await multiToken.connect(agent).mintBatch(1, user1.address, 10000);
            
            // Redeem tokens
            await multiToken.connect(user1).redeemTokens(1, 2000);
            
            // Check balance
            expect(await multiToken.balanceOf(user1.address, 1)).to.equal(8000);
            const metadata = await multiToken.getBatchMetadata(1);
            expect(metadata.mintedSupply).to.equal(8000);
        });
    });
    
    describe("Ownership Distribution", function () {
        it("Should track ownership distribution correctly", async function () {
            const { multiToken, agent, user1, user2, user3 } = await loadFixture(deployMultiTokenFixture);
            
            // Setup
            await multiToken.connect(agent).createBatch(
                ethers.keccak256(ethers.toUtf8Bytes("GOLD-001")),
                "Gold Batch",
                "Description",
                100000,
                ethers.parseEther("50"),
                "ipfs://metadata"
            );
            
            // Mint to multiple users
            await multiToken.connect(agent).mintBatchMultiple(
                1,
                [user1.address, user2.address, user3.address],
                [30000, 45000, 25000]
            );
            
            // Get ownership distribution
            const [holders, balances] = await multiToken.getOwnershipDistribution(1, 0, 10);
            
            expect(holders.length).to.equal(3);
            expect(holders).to.include(user1.address);
            expect(holders).to.include(user2.address);
            expect(holders).to.include(user3.address);
            
            // Verify balances match
            const user1Index = holders.indexOf(user1.address);
            expect(balances[user1Index]).to.equal(30000);
        });
        
        it("Should calculate total value for a holder", async function () {
            const { multiToken, agent, user1 } = await loadFixture(deployMultiTokenFixture);
            
            // Create multiple batches
            await multiToken.connect(agent).createBatch(
                ethers.keccak256(ethers.toUtf8Bytes("GOLD-001")),
                "Gold Batch 1",
                "Description",
                100000,
                ethers.parseEther("50"),
                "ipfs://metadata1"
            );
            
            await multiToken.connect(agent).createBatch(
                ethers.keccak256(ethers.toUtf8Bytes("GOLD-002")),
                "Gold Batch 2",
                "Description",
                100000,
                ethers.parseEther("75"),
                "ipfs://metadata2"
            );
            
            // Mint from both batches
            await multiToken.connect(agent).mintBatch(1, user1.address, 1000);
            await multiToken.connect(agent).mintBatch(2, user1.address, 2000);
            
            // Calculate total value
            const totalValue = await multiToken.getTotalValue(user1.address);
            const expectedValue = (1000n * ethers.parseEther("50")) + (2000n * ethers.parseEther("75"));
            expect(totalValue).to.equal(expectedValue);
        });
    });
    
    describe("Forced Transfers and Recovery", function () {
        it("Should perform forced transfer", async function () {
            const { multiToken, agent, user1, user2 } = await loadFixture(deployMultiTokenFixture);
            
            // Setup
            await multiToken.connect(agent).createBatch(
                ethers.keccak256(ethers.toUtf8Bytes("GOLD-001")),
                "Gold Batch",
                "Description",
                100000,
                ethers.parseEther("50"),
                "ipfs://metadata"
            );
            await multiToken.connect(agent).mintBatch(1, user1.address, 10000);
            
            // Forced transfer
            await multiToken.connect(agent).forcedTransfer(1, user1.address, user2.address, 5000);
            
            // Check balances
            expect(await multiToken.balanceOf(user1.address, 1)).to.equal(5000);
            expect(await multiToken.balanceOf(user2.address, 1)).to.equal(5000);
        });
        
        it("Should recover tokens from lost wallet", async function () {
            const { multiToken, identityRegistry, agent, user1, user2 } = await loadFixture(deployMultiTokenFixture);
            
            // Setup
            await multiToken.connect(agent).createBatch(
                ethers.keccak256(ethers.toUtf8Bytes("GOLD-001")),
                "Gold Batch",
                "Description",
                100000,
                ethers.parseEther("50"),
                "ipfs://metadata"
            );
            await multiToken.connect(agent).mintBatch(1, user1.address, 10000);
            
            // Register identity for user2 (new wallet)
            const Identity = await ethers.getContractFactory("Identity");
            const identity = await Identity.deploy(user2.address, false);
            await identity.waitForDeployment();
            await identityRegistry.registerIdentity(
                user2.address,
                await identity.getAddress(),
                840
            );
            
            // Recover tokens
            await multiToken.connect(agent).recoveryAddress(1, user1.address, user2.address);
            
            // Check balances
            expect(await multiToken.balanceOf(user1.address, 1)).to.equal(0);
            expect(await multiToken.balanceOf(user2.address, 1)).to.equal(10000);
            
            // Check user1 is frozen
            expect(await multiToken.isFrozen(user1.address)).to.be.true;
        });
    });
    
    describe("Metadata Management", function () {
        it("Should update batch metadata URI", async function () {
            const { multiToken, admin, agent } = await loadFixture(deployMultiTokenFixture);
            
            // Create batch
            await multiToken.connect(agent).createBatch(
                ethers.keccak256(ethers.toUtf8Bytes("GOLD-001")),
                "Gold Batch",
                "Description",
                100000,
                ethers.parseEther("50"),
                "ipfs://metadata"
            );
            
            // Update metadata
            const newURI = "ipfs://newMetadata";
            await multiToken.connect(admin).updateBatchMetadata(1, newURI);
            
            // Verify
            const metadata = await multiToken.getBatchMetadata(1);
            expect(metadata.metadataURI).to.equal(newURI);
            expect(await multiToken.uri(1)).to.equal(newURI);
        });
        
        it("Should update batch unit value", async function () {
            const { multiToken, admin, agent } = await loadFixture(deployMultiTokenFixture);
            
            // Create batch
            await multiToken.connect(agent).createBatch(
                ethers.keccak256(ethers.toUtf8Bytes("GOLD-001")),
                "Gold Batch",
                "Description",
                100000,
                ethers.parseEther("50"),
                "ipfs://metadata"
            );
            
            // Update value
            const newValue = ethers.parseEther("60");
            await multiToken.connect(admin).updateBatchValue(1, newValue);
            
            // Verify
            const metadata = await multiToken.getBatchMetadata(1);
            expect(metadata.unitValue).to.equal(newValue);
        });
    });
    
    describe("Pause Functionality", function () {
        it("Should pause and unpause transfers", async function () {
            const { multiToken, agent, user1, user2 } = await loadFixture(deployMultiTokenFixture);
            
            // Setup
            await multiToken.connect(agent).createBatch(
                ethers.keccak256(ethers.toUtf8Bytes("GOLD-001")),
                "Gold Batch",
                "Description",
                100000,
                ethers.parseEther("50"),
                "ipfs://metadata"
            );
            await multiToken.connect(agent).mintBatch(1, user1.address, 10000);
            
            // Pause
            await multiToken.connect(agent).pause();
            
            // Try to transfer while paused
            await expect(
                multiToken.connect(user1).safeTransferFrom(
                    user1.address,
                    user2.address,
                    1,
                    5000,
                    "0x"
                )
            ).to.be.revertedWith("Pausable: paused");
            
            // Unpause
            await multiToken.connect(agent).unpause();
            
            // Transfer should work now
            await multiToken.connect(user1).safeTransferFrom(
                user1.address,
                user2.address,
                1,
                5000,
                "0x"
            );
            
            expect(await multiToken.balanceOf(user2.address, 1)).to.equal(5000);
        });
    });
});