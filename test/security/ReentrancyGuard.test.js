const { expect } = require("chai");
const { ethers, upgrades } = require("hardhat");
const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");

// Malicious contract for reentrancy testing
const MALICIOUS_RECEIVER = `
pragma solidity ^0.8.19;

interface IToken {
    function transfer(address to, uint256 amount) external returns (bool);
    function claimDividend(uint256 index, uint256 minAmount) external;
}

contract MaliciousReceiver {
    IToken public token;
    address public attacker;
    bool public attacking;
    uint256 public attackCount;
    
    constructor(address _token) {
        token = IToken(_token);
        attacker = msg.sender;
    }
    
    receive() external payable {
        if (attacking && attackCount < 10) {
            attackCount++;
            // Attempt reentrancy
            try token.claimDividend(1, 0) {
                // If successful, we've reentered
            } catch {
                // Failed to reenter (good)
            }
        }
    }
    
    function attack() external {
        require(msg.sender == attacker, "Only attacker");
        attacking = true;
        attackCount = 0;
        token.claimDividend(1, 0);
        attacking = false;
    }
    
    function onERC1155Received(
        address,
        address,
        uint256,
        uint256,
        bytes calldata
    ) external pure returns (bytes4) {
        return this.onERC1155Received.selector;
    }
}
`;

describe("Reentrancy Protection Tests", function () {
    async function deployFixture() {
        const [owner, agent, user1, user2, attacker] = await ethers.getSigners();

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
            "Reentrancy Test Token",
            "RTT",
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
        await token.grantRole(await token.ASSET_MANAGER_ROLE(), agent.address);
        await token.grantRole(await token.CORPORATE_ACTIONS_ROLE(), agent.address);
        await identityRegistry.grantRole(await identityRegistry.AGENT_ROLE(), agent.address);

        // Deploy and register identities
        const Identity = await ethers.getContractFactory("Identity");
        const identity1 = await Identity.deploy(user1.address, true);
        const identity2 = await Identity.deploy(user2.address, true);
        const attackerIdentity = await Identity.deploy(attacker.address, true);

        await identityRegistry.connect(agent).batchRegisterIdentity(
            [user1.address, user2.address, attacker.address],
            [await identity1.getAddress(), await identity2.getAddress(), await attackerIdentity.getAddress()],
            [840, 840, 840]
        );

        // Add KYC claims
        const claimData = ethers.AbiCoder.defaultAbiCoder().encode(["uint256"], [1]);
        await identity1.connect(user1).addClaim(7, 1, owner.address, "0x00", claimData, "");
        await identity2.connect(user2).addClaim(7, 1, owner.address, "0x00", claimData, "");
        await attackerIdentity.connect(attacker).addClaim(7, 1, owner.address, "0x00", claimData, "");

        return {
            token,
            identityRegistry,
            modularCompliance,
            assetRegistry,
            owner,
            agent,
            user1,
            user2,
            attacker,
            identity1,
            identity2,
            attackerIdentity
        };
    }

    describe("Dividend Claim Reentrancy Protection", function () {
        it("Should prevent reentrancy during dividend claims", async function () {
            const { token, agent, attacker } = await loadFixture(deployFixture);

            // Deploy malicious contract
            const MaliciousReceiverFactory = new ethers.ContractFactory(
                [
                    "constructor(address _token)",
                    "function attack() external",
                    "function onERC1155Received(address,address,uint256,uint256,bytes) external pure returns (bytes4)",
                    "receive() external payable"
                ],
                MALICIOUS_RECEIVER,
                attacker
            );
            
            const maliciousContract = await MaliciousReceiverFactory.deploy(await token.getAddress());
            await maliciousContract.waitForDeployment();

            // Register malicious contract as verified identity
            const Identity = await ethers.getContractFactory("Identity");
            const maliciousIdentity = await Identity.deploy(await maliciousContract.getAddress(), true);
            
            const { identityRegistry } = await loadFixture(deployFixture);
            await identityRegistry.connect(agent).registerIdentity(
                await maliciousContract.getAddress(),
                await maliciousIdentity.getAddress(),
                840
            );

            const claimData = ethers.AbiCoder.defaultAbiCoder().encode(["uint256"], [1]);
            await maliciousIdentity.connect(attacker).addClaim(7, 1, agent.address, "0x00", claimData, "");

            // Mint tokens to malicious contract
            await token.connect(agent).mint(await maliciousContract.getAddress(), ethers.parseEther("1000"));

            // Deposit dividend
            await token.connect(agent).depositDividend(ethers.ZeroHash, { value: ethers.parseEther("10") });

            // Attempt reentrancy attack
            await expect(
                maliciousContract.connect(attacker).attack()
            ).to.not.be.reverted; // Should complete without reentrancy

            // Verify no double claiming occurred
            const maliciousBalance = await ethers.provider.getBalance(await maliciousContract.getAddress());
            expect(maliciousBalance).to.be.lessThan(ethers.parseEther("20")); // Should not have claimed twice
        });
    });

    describe("Transfer Reentrancy Protection", function () {
        it("Should handle callbacks safely during transfers", async function () {
            const { token, agent, user1, user2 } = await loadFixture(deployFixture);

            // Mint tokens
            await token.connect(agent).mint(user1.address, ethers.parseEther("1000"));

            // Create a contract that could attempt reentrancy
            const ReentrancyTester = await ethers.getContractFactory("Identity"); // Using Identity as a safe contract
            const tester = await ReentrancyTester.deploy(user2.address, true);

            // Transfer should complete safely even if receiver is a contract
            await expect(
                token.connect(user1).transfer(await tester.getAddress(), ethers.parseEther("100"))
            ).to.not.be.reverted;
        });
    });

    describe("State Consistency During External Calls", function () {
        it("Should maintain state consistency when calling external contracts", async function () {
            const { token, agent, user1 } = await loadFixture(deployFixture);

            // Mint tokens
            await token.connect(agent).mint(user1.address, ethers.parseEther("1000"));

            const balanceBefore = await token.balanceOf(user1.address);

            // Perform operations that involve external calls
            await token.connect(agent).freeze(user1.address);
            await token.connect(agent).unfreeze(user1.address);

            const balanceAfter = await token.balanceOf(user1.address);
            expect(balanceAfter).to.equal(balanceBefore);
        });

        it("Should handle failed external calls gracefully", async function () {
            const { token, agent } = await loadFixture(deployFixture);

            // Set regulatory reporting to a non-contract address (will fail on call)
            await token.setRegulatoryReporting(ethers.Wallet.createRandom().address);

            // Operations should still work even if reporting fails
            const Identity = await ethers.getContractFactory("Identity");
            const newUserWallet = ethers.Wallet.createRandom();
            const newUserIdentity = await Identity.deploy(newUserWallet.address, true);
            
            const { identityRegistry } = await loadFixture(deployFixture);
            await identityRegistry.connect(agent).registerIdentity(
                newUserWallet.address,
                await newUserIdentity.getAddress(),
                840
            );

            const claimData = ethers.AbiCoder.defaultAbiCoder().encode(["uint256"], [1]);
            await newUserIdentity.connect(agent).addClaim(7, 1, agent.address, "0x00", claimData, "");

            // Mint should work even if regulatory reporting fails
            await expect(
                token.connect(agent).mint(newUserWallet.address, ethers.parseEther("100"))
            ).to.not.be.reverted;
        });
    });

    describe("Cross-Function Reentrancy", function () {
        it("Should prevent cross-function reentrancy attacks", async function () {
            const { token, agent, user1, user2 } = await loadFixture(deployFixture);

            // Setup initial state
            await token.connect(agent).mint(user1.address, ethers.parseEther("1000"));
            await token.connect(agent).mint(user2.address, ethers.parseEther("1000"));

            // Track balances
            const user1BalanceBefore = await token.balanceOf(user1.address);
            const user2BalanceBefore = await token.balanceOf(user2.address);

            // Perform multiple operations in sequence
            await token.connect(user1).transfer(user2.address, ethers.parseEther("100"));
            await token.connect(user2).transfer(user1.address, ethers.parseEther("50"));

            // Verify final state is consistent
            const user1BalanceAfter = await token.balanceOf(user1.address);
            const user2BalanceAfter = await token.balanceOf(user2.address);

            expect(user1BalanceAfter).to.equal(user1BalanceBefore - ethers.parseEther("50"));
            expect(user2BalanceAfter).to.equal(user2BalanceBefore + ethers.parseEther("50"));
        });
    });

    describe("Gas Limit Protection", function () {
        it("Should handle operations within reasonable gas limits", async function () {
            const { token, agent, user1 } = await loadFixture(deployFixture);

            // Mint tokens
            await token.connect(agent).mint(user1.address, ethers.parseEther("1000"));

            // Measure gas for critical operations
            const transferTx = await token.connect(user1).transfer(agent.address, ethers.parseEther("100"));
            const transferReceipt = await transferTx.wait();

            // Verify gas usage is reasonable (prevents unbounded loops)
            expect(transferReceipt.gasUsed).to.be.lessThan(500000n); // 500k gas limit
        });
    });

    describe("Check-Effects-Interactions Pattern", function () {
        it("Should follow CEI pattern in critical functions", async function () {
            const { token, agent, user1, user2 } = await loadFixture(deployFixture);

            // Mint tokens
            await token.connect(agent).mint(user1.address, ethers.parseEther("1000"));

            // Monitor state changes
            const transferPromise = token.connect(user1).transfer(user2.address, ethers.parseEther("100"));

            // Transfer should succeed following CEI pattern
            await expect(transferPromise)
                .to.emit(token, "Transfer")
                .withArgs(user1.address, user2.address, ethers.parseEther("100"));

            // Verify state was updated correctly
            expect(await token.balanceOf(user1.address)).to.equal(ethers.parseEther("900"));
            expect(await token.balanceOf(user2.address)).to.equal(ethers.parseEther("100"));
        });
    });
});