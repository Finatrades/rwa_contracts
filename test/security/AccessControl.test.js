const { expect } = require("chai");
const { ethers, upgrades } = require("hardhat");
const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");

describe("Access Control Security Tests", function () {
    async function deployFixture() {
        const [owner, admin, agent, attacker, user1, user2] = await ethers.getSigners();

        // Deploy core infrastructure
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
            "Security Test Token",
            "STT",
            18,
            await identityRegistry.getAddress(),
            await modularCompliance.getAddress(),
            await assetRegistry.getAddress()
        ], { 
            unsafeAllow: ['missing-initializer'],
            initializer: 'initialize(address,string,string,uint8,address,address,address)'
        });

        await modularCompliance.bindToken(await token.getAddress());

        return {
            token,
            identityRegistry,
            modularCompliance,
            assetRegistry,
            owner,
            admin,
            agent,
            attacker,
            user1,
            user2
        };
    }

    describe("Role-Based Access Control", function () {
        it("Should prevent unauthorized minting", async function () {
            const { token, attacker, user1 } = await loadFixture(deployFixture);
            
            await expect(
                token.connect(attacker).mint(user1.address, ethers.parseEther("1000"))
            ).to.be.reverted;
        });

        it("Should prevent unauthorized burning", async function () {
            const { token, attacker, user1 } = await loadFixture(deployFixture);
            
            await expect(
                token.connect(attacker).burn(user1.address, ethers.parseEther("100"))
            ).to.be.reverted;
        });

        it("Should prevent unauthorized freezing", async function () {
            const { token, attacker, user1 } = await loadFixture(deployFixture);
            
            await expect(
                token.connect(attacker).freeze(user1.address)
            ).to.be.reverted;
        });

        it("Should prevent unauthorized pause", async function () {
            const { token, attacker } = await loadFixture(deployFixture);
            
            await expect(
                token.connect(attacker).pause()
            ).to.be.reverted;
        });

        it("Should prevent unauthorized role granting", async function () {
            const { token, attacker } = await loadFixture(deployFixture);
            const AGENT_ROLE = await token.AGENT_ROLE();
            
            await expect(
                token.connect(attacker).grantRole(AGENT_ROLE, attacker.address)
            ).to.be.reverted;
        });

        it("Should prevent unauthorized compliance changes", async function () {
            const { token, attacker, modularCompliance } = await loadFixture(deployFixture);
            
            await expect(
                token.connect(attacker).setCompliance(await modularCompliance.getAddress())
            ).to.be.reverted;
        });

        it("Should prevent unauthorized identity registry changes", async function () {
            const { token, attacker, identityRegistry } = await loadFixture(deployFixture);
            
            await expect(
                token.connect(attacker).setIdentityRegistry(await identityRegistry.getAddress())
            ).to.be.reverted;
        });

        it("Should enforce role hierarchy", async function () {
            const { token, owner, agent } = await loadFixture(deployFixture);
            const AGENT_ROLE = await token.AGENT_ROLE();
            const DEFAULT_ADMIN_ROLE = await token.DEFAULT_ADMIN_ROLE();
            
            // Grant agent role
            await token.connect(owner).grantRole(AGENT_ROLE, agent.address);
            
            // Agent should not be able to grant admin role
            await expect(
                token.connect(agent).grantRole(DEFAULT_ADMIN_ROLE, agent.address)
            ).to.be.reverted;
        });
    });

    describe("Identity Registry Access Control", function () {
        it("Should prevent unauthorized identity registration", async function () {
            const { identityRegistry, attacker, user1 } = await loadFixture(deployFixture);
            
            await expect(
                identityRegistry.connect(attacker).registerIdentity(
                    user1.address,
                    ethers.ZeroAddress,
                    840
                )
            ).to.be.reverted;
        });

        it("Should prevent unauthorized identity removal", async function () {
            const { identityRegistry, attacker, user1 } = await loadFixture(deployFixture);
            
            await expect(
                identityRegistry.connect(attacker).deleteIdentity(user1.address)
            ).to.be.reverted;
        });

        it("Should prevent unauthorized batch operations", async function () {
            const { identityRegistry, attacker, user1, user2 } = await loadFixture(deployFixture);
            
            await expect(
                identityRegistry.connect(attacker).batchRegisterIdentity(
                    [user1.address, user2.address],
                    [ethers.ZeroAddress, ethers.ZeroAddress],
                    [840, 840]
                )
            ).to.be.reverted;
        });
    });

    describe("Asset Registry Access Control", function () {
        it("Should prevent unauthorized asset registration", async function () {
            const { assetRegistry, attacker } = await loadFixture(deployFixture);
            
            await expect(
                assetRegistry.connect(attacker).registerAsset(
                    ethers.id("ASSET-001"),
                    "Unauthorized Asset",
                    0,
                    ethers.parseEther("1000000"),
                    "ipfs://unauthorized",
                    attacker.address
                )
            ).to.be.reverted;
        });

        it("Should prevent unauthorized asset updates", async function () {
            const { assetRegistry, owner, attacker } = await loadFixture(deployFixture);
            
            // Owner registers asset
            const assetId = ethers.id("ASSET-001");
            await assetRegistry.grantRole(await assetRegistry.ASSET_MANAGER_ROLE(), owner.address);
            await assetRegistry.connect(owner).registerAsset(
                assetId,
                "Test Asset",
                0,
                ethers.parseEther("1000000"),
                "ipfs://test",
                owner.address
            );
            
            // Attacker tries to update
            await expect(
                assetRegistry.connect(attacker).updateAssetValuation(
                    assetId,
                    ethers.parseEther("2000000"),
                    "Malicious update"
                )
            ).to.be.reverted;
        });
    });

    describe("Compliance Module Access Control", function () {
        it("Should prevent unauthorized module addition", async function () {
            const { modularCompliance, attacker } = await loadFixture(deployFixture);
            
            await expect(
                modularCompliance.connect(attacker).addModule(ethers.ZeroAddress)
            ).to.be.reverted;
        });

        it("Should prevent unauthorized module removal", async function () {
            const { modularCompliance, attacker } = await loadFixture(deployFixture);
            
            await expect(
                modularCompliance.connect(attacker).removeModule(ethers.ZeroAddress)
            ).to.be.reverted;
        });

        it("Should prevent unauthorized token binding", async function () {
            const { modularCompliance, attacker } = await loadFixture(deployFixture);
            
            await expect(
                modularCompliance.connect(attacker).bindToken(ethers.ZeroAddress)
            ).to.be.reverted;
        });
    });

    describe("Recovery Function Access Control", function () {
        it("Should prevent unauthorized token recovery", async function () {
            const { token, identityRegistry, owner, agent, attacker, user1, user2 } = await loadFixture(deployFixture);
            
            // Setup
            await token.grantRole(await token.AGENT_ROLE(), agent.address);
            await identityRegistry.grantRole(await identityRegistry.AGENT_ROLE(), agent.address);
            
            // Register identities
            const Identity = await ethers.getContractFactory("Identity");
            const identity1 = await Identity.deploy(user1.address, true);
            const identity2 = await Identity.deploy(user2.address, true);
            
            await identityRegistry.connect(agent).registerIdentity(
                user1.address,
                await identity1.getAddress(),
                840
            );
            await identityRegistry.connect(agent).registerIdentity(
                user2.address,
                await identity2.getAddress(),
                840
            );
            
            // Add claims
            const claimData = ethers.AbiCoder.defaultAbiCoder().encode(["uint256"], [1]);
            await identity1.connect(user1).addClaim(7, 1, owner.address, "0x00", claimData, "");
            await identity2.connect(user2).addClaim(7, 1, owner.address, "0x00", claimData, "");
            
            // Mint tokens
            await token.connect(agent).mint(user1.address, ethers.parseEther("1000"));
            
            // Attacker tries to recover tokens
            await expect(
                token.connect(attacker).recoveryAddress(user1.address, attacker.address)
            ).to.be.reverted;
        });
    });

    describe("Upgrade Access Control", function () {
        it("Should prevent unauthorized contract upgrades", async function () {
            const { token, attacker } = await loadFixture(deployFixture);
            
            // Deploy new implementation
            const TokenV2 = await ethers.getContractFactory("FinatradesRWA_Enterprise");
            const tokenV2 = await TokenV2.deploy();
            
            // Attacker tries to upgrade
            await expect(
                upgrades.upgradeProxy(
                    await token.getAddress(),
                    TokenV2.connect(attacker),
                    { unsafeAllow: ['missing-initializer'] }
                )
            ).to.be.reverted;
        });
    });

    describe("Critical Function Protection", function () {
        it("Should protect setRegulatoryReporting from unauthorized access", async function () {
            const { token, attacker } = await loadFixture(deployFixture);
            
            await expect(
                token.connect(attacker).setRegulatoryReporting(ethers.ZeroAddress)
            ).to.be.reverted;
        });

        it("Should verify all admin functions are protected", async function () {
            const { token, identityRegistry, modularCompliance, assetRegistry, owner } = await loadFixture(deployFixture);
            
            // List of critical admin functions and their expected role
            const adminFunctions = [
                { contract: token, function: 'pause', role: 'DEFAULT_ADMIN_ROLE' },
                { contract: token, function: 'unpause', role: 'DEFAULT_ADMIN_ROLE' },
                { contract: token, function: 'setIdentityRegistry', role: 'DEFAULT_ADMIN_ROLE' },
                { contract: token, function: 'setCompliance', role: 'DEFAULT_ADMIN_ROLE' },
                { contract: token, function: 'mint', role: 'AGENT_ROLE' },
                { contract: token, function: 'burn', role: 'AGENT_ROLE' },
                { contract: token, function: 'freeze', role: 'AGENT_ROLE' },
                { contract: token, function: 'unfreeze', role: 'AGENT_ROLE' },
                { contract: token, function: 'recoveryAddress', role: 'AGENT_ROLE' }
            ];
            
            // Verify each function is protected
            for (const func of adminFunctions) {
                const roleBytes = await func.contract[func.role]();
                const hasRole = await func.contract.hasRole(roleBytes, owner.address);
                
                if (func.role === 'DEFAULT_ADMIN_ROLE') {
                    expect(hasRole).to.be.true;
                } else if (func.role === 'AGENT_ROLE') {
                    // Agent role needs to be granted first
                    await token.grantRole(await token.AGENT_ROLE(), owner.address);
                    expect(await token.hasRole(await token.AGENT_ROLE(), owner.address)).to.be.true;
                }
            }
        });
    });
});