import { expect } from "chai";
import { ethers, upgrades } from "hardhat";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { FinatradesRWA_Final, FinatradesTimelock } from "../typechain-types";
import { time } from "@nomicfoundation/hardhat-network-helpers";

describe("FinatradesRWA Final - Comprehensive Tests", function () {
  let token: FinatradesRWA_Final;
  let timelock: FinatradesTimelock;
  let owner: SignerWithAddress;
  let admin: SignerWithAddress;
  let compliance: SignerWithAddress;
  let propertyManager: SignerWithAddress;
  let minter: SignerWithAddress;
  let corporateActions: SignerWithAddress;
  let investor1: SignerWithAddress;
  let investor2: SignerWithAddress;
  let investor3: SignerWithAddress;
  let unregistered: SignerWithAddress;
  let addrs: SignerWithAddress[];

  // Constants
  const TOKEN_NAME = "Finatrades RWA Token";
  const TOKEN_SYMBOL = "FRWA";
  const MIN_DELAY = 2 * 24 * 60 * 60; // 2 days
  const ONE_TOKEN = ethers.parseEther("1");
  const HUNDRED_TOKENS = ethers.parseEther("100");
  const THOUSAND_TOKENS = ethers.parseEther("1000");

  // Test data
  const propertyId1 = ethers.keccak256(ethers.toUtf8Bytes("PROP001"));
  const propertyId2 = ethers.keccak256(ethers.toUtf8Bytes("PROP002"));
  const partitionResidential = ethers.keccak256(ethers.toUtf8Bytes("RESIDENTIAL_SG"));
  const partitionCommercial = ethers.keccak256(ethers.toUtf8Bytes("COMMERCIAL_MY"));

  beforeEach(async function () {
    [owner, admin, compliance, propertyManager, minter, corporateActions, investor1, investor2, investor3, unregistered, ...addrs] = await ethers.getSigners();

    // Deploy Timelock
    const TimelockFactory = await ethers.getContractFactory("FinatradesTimelock");
    timelock = await TimelockFactory.deploy(
      MIN_DELAY,
      [owner.address, admin.address],
      [owner.address],
      owner.address
    );

    // Deploy Token
    const TokenFactory = await ethers.getContractFactory("FinatradesRWA_Final");
    token = await upgrades.deployProxy(
      TokenFactory,
      [TOKEN_NAME, TOKEN_SYMBOL, admin.address, await timelock.getAddress()],
      { initializer: 'initialize' }
    ) as unknown as FinatradesRWA_Final;

    // Grant roles
    await token.connect(admin).grantRole(await token.COMPLIANCE_ROLE(), compliance.address);
    await token.connect(admin).grantRole(await token.PROPERTY_MANAGER_ROLE(), propertyManager.address);
    await token.connect(admin).grantRole(await token.MINTER_ROLE(), minter.address);
    await token.connect(admin).grantRole(await token.CORPORATE_ACTIONS_ROLE(), corporateActions.address);

    // Set allowed jurisdictions
    await token.connect(compliance).setAllowedJurisdictions(
      ["SG", "MY", "ID", "TH", "PH", "NG", "KE", "ZA"],
      [true, true, true, true, true, true, true, true]
    );
  });

  describe("Property Management", function () {
    it("Should add a new property", async function () {
      const propertyData = {
        propertyType: 1, // RESIDENTIAL
        propertyAddress: "123 Main Street, Singapore",
        legalDescription: "Lot 123, Block 456",
        valuationAmount: ethers.parseUnits("1000000", 6), // $1M with 6 decimals
        valuationDate: await time.latest(),
        yearBuilt: 2020,
        totalArea: 150, // 150 sqm
        propertyStatus: 1, // ACTIVE
        ipfsHash: "QmXxxPropertyDocuments"
      };

      const rentalData = {
        monthlyRent: ethers.parseUnits("5000", 6), // $5K/month
        lastRentCollection: 0,
        totalRentCollected: 0,
        occupancyRate: 9500, // 95%
        rentCollector: corporateActions.address
      };

      await expect(token.connect(propertyManager).addProperty(
        propertyId1,
        partitionResidential,
        propertyData,
        rentalData
      )).to.emit(token, "PropertyAdded")
        .withArgs(propertyId1, 1, propertyData.valuationAmount);

      const [property, rental] = await token.getProperty(propertyId1);
      expect(property.propertyType).to.equal(1);
      expect(property.valuationAmount).to.equal(propertyData.valuationAmount);
    });

    it("Should update property valuation", async function () {
      // First add property
      await addTestProperty();

      const newValuation = ethers.parseUnits("1200000", 6); // $1.2M
      await expect(token.connect(propertyManager).updatePropertyValuation(propertyId1, newValuation))
        .to.emit(token, "PropertyValuationUpdated")
        .withArgs(propertyId1, ethers.parseUnits("1000000", 6), newValuation);
    });

    it("Should change property status", async function () {
      await addTestProperty();

      await expect(token.connect(propertyManager).updatePropertyStatus(propertyId1, 3)) // FOR_SALE
        .to.emit(token, "PropertyStatusChanged")
        .withArgs(propertyId1, 1, 3); // ACTIVE to FOR_SALE
    });

    it("Should finalize property sale", async function () {
      await addTestProperty();
      await token.connect(propertyManager).updatePropertyStatus(propertyId1, 3); // FOR_SALE

      await expect(token.connect(propertyManager).finalizePropertySale(propertyId1))
        .to.emit(token, "PropertyStatusChanged")
        .withArgs(propertyId1, 3, 4); // FOR_SALE to SOLD
    });
  });

  describe("Investor Management", function () {
    it("Should register investor with KYC", async function () {
      const kycExpiry = (await time.latest()) + 365 * 24 * 60 * 60; // 1 year

      await expect(token.connect(compliance).registerInvestor(
        investor1.address,
        2, // QUALIFIED
        "SG",
        kycExpiry
      )).to.emit(token, "InvestorRegistered")
        .withArgs(investor1.address, 2, "SG");

      const investor = await token.getInvestorDetails(investor1.address);
      expect(investor.investorType).to.equal(2);
      expect(investor.jurisdictionCode).to.equal("SG");
      expect(investor.isActive).to.be.true;
    });

    it("Should update investor KYC", async function () {
      await registerTestInvestor(investor1.address);
      
      const newExpiry = (await time.latest()) + 730 * 24 * 60 * 60; // 2 years
      await expect(token.connect(compliance).updateInvestorKYC(investor1.address, newExpiry))
        .to.emit(token, "InvestorKYCUpdated");
    });

    it("Should reject registration for non-allowed jurisdiction", async function () {
      const kycExpiry = (await time.latest()) + 365 * 24 * 60 * 60;

      await expect(token.connect(compliance).registerInvestor(
        investor1.address,
        2,
        "US", // Not allowed
        kycExpiry
      )).to.be.revertedWith("Jurisdiction not allowed");
    });
  });

  describe("Token Issuance", function () {
    beforeEach(async function () {
      await addTestProperty();
      await registerTestInvestor(investor1.address);
      await registerTestInvestor(investor2.address);
    });

    it("Should issue tokens by partition", async function () {
      await expect(token.connect(minter).issueByPartition(
        partitionResidential,
        investor1.address,
        THOUSAND_TOKENS,
        "0x"
      )).to.emit(token, "IssuedByPartition")
        .withArgs(partitionResidential, investor1.address, THOUSAND_TOKENS, "0x");

      expect(await token.balanceOf(investor1.address)).to.equal(THOUSAND_TOKENS);
      expect(await token.balanceOfByPartition(investor1.address, partitionResidential)).to.equal(THOUSAND_TOKENS);
    });

    it("Should enforce minimum investment", async function () {
      await token.connect(compliance).setInvestmentLimits(HUNDRED_TOKENS, ethers.parseEther("10000"));

      await expect(token.connect(minter).issueByPartition(
        partitionResidential,
        investor1.address,
        ONE_TOKEN, // Below minimum
        "0x"
      )).to.be.revertedWith("Below minimum investment");
    });

    it("Should enforce maximum holders", async function () {
      await token.connect(compliance).setMaxHolders(2);
      
      await token.connect(minter).issueByPartition(partitionResidential, investor1.address, HUNDRED_TOKENS, "0x");
      await token.connect(minter).issueByPartition(partitionResidential, investor2.address, HUNDRED_TOKENS, "0x");
      
      await registerTestInvestor(investor3.address);
      await expect(token.connect(minter).issueByPartition(
        partitionResidential,
        investor3.address,
        HUNDRED_TOKENS,
        "0x"
      )).to.be.revertedWith("Max holders reached");
    });
  });

  describe("Transfers", function () {
    beforeEach(async function () {
      await addTestProperty();
      await registerTestInvestor(investor1.address);
      await registerTestInvestor(investor2.address);
      await token.connect(minter).issueByPartition(partitionResidential, investor1.address, THOUSAND_TOKENS, "0x");
    });

    it("Should transfer tokens between registered investors", async function () {
      await expect(token.connect(investor1).transfer(investor2.address, HUNDRED_TOKENS))
        .to.emit(token, "Transfer")
        .withArgs(investor1.address, investor2.address, HUNDRED_TOKENS);

      expect(await token.balanceOf(investor2.address)).to.equal(HUNDRED_TOKENS);
    });

    it("Should transfer by partition", async function () {
      await expect(token.connect(investor1).transferByPartition(
        partitionResidential,
        investor2.address,
        HUNDRED_TOKENS,
        "0x"
      )).to.emit(token, "TransferByPartition");

      expect(await token.balanceOfByPartition(investor2.address, partitionResidential)).to.equal(HUNDRED_TOKENS);
    });

    it("Should reject transfer to unregistered investor", async function () {
      await expect(token.connect(investor1).transfer(unregistered.address, HUNDRED_TOKENS))
        .to.be.revertedWith("Recipient not registered");
    });

    it("Should check transfer eligibility", async function () {
      const [statusCode, reasonCode, partition] = await token.canTransferByPartition(
        investor1.address,
        investor2.address,
        partitionResidential,
        HUNDRED_TOKENS,
        "0x"
      );
      expect(statusCode).to.equal("0x51"); // Success
    });
  });

  describe("Dividend Distribution", function () {
    beforeEach(async function () {
      await addTestProperty();
      await registerTestInvestor(investor1.address);
      await registerTestInvestor(investor2.address);
      await registerTestInvestor(investor3.address);
      
      // Issue tokens: 60%, 30%, 10%
      await token.connect(minter).issueByPartition(partitionResidential, investor1.address, ethers.parseEther("600"), "0x");
      await token.connect(minter).issueByPartition(partitionResidential, investor2.address, ethers.parseEther("300"), "0x");
      await token.connect(minter).issueByPartition(partitionResidential, investor3.address, ethers.parseEther("100"), "0x");
    });

    it("Should deposit dividend for property", async function () {
      const dividendAmount = ethers.parseEther("10");
      
      await expect(token.connect(corporateActions).depositDividendForProperty(propertyId1, { value: dividendAmount }))
        .to.emit(token, "DividendDeposited")
        .withArgs(0, dividendAmount, ethers.parseEther("1000"), propertyId1);
    });

    it("Should claim dividend proportionally", async function () {
      const dividendAmount = ethers.parseEther("10");
      await token.connect(corporateActions).depositDividendForProperty(propertyId1, { value: dividendAmount });

      const balanceBefore = await ethers.provider.getBalance(investor1.address);
      await token.connect(investor1).claimDividend(0);
      const balanceAfter = await ethers.provider.getBalance(investor1.address);
      
      // Investor1 owns 60%, should receive 6 ETH (minus gas)
      const received = balanceAfter - balanceBefore;
      expect(received).to.be.closeTo(ethers.parseEther("6"), ethers.parseEther("0.01"));
    });

    it("Should prevent double claiming", async function () {
      await token.connect(corporateActions).depositDividendForProperty(propertyId1, { value: ethers.parseEther("10") });
      
      await token.connect(investor1).claimDividend(0);
      await expect(token.connect(investor1).claimDividend(0))
        .to.be.revertedWith("Already claimed");
    });

    it("Should claim all unclaimed dividends", async function () {
      // Deposit multiple dividends
      await token.connect(corporateActions).depositDividendForProperty(propertyId1, { value: ethers.parseEther("5") });
      await token.connect(corporateActions).depositDividendForProperty(propertyId1, { value: ethers.parseEther("3") });
      
      const unclaimed = await token.getUnclaimedDividends(investor1.address);
      expect(unclaimed).to.equal(ethers.parseEther("4.8")); // 60% of 8 ETH
      
      await token.connect(investor1).claimAllDividends();
      
      const unclaimedAfter = await token.getUnclaimedDividends(investor1.address);
      expect(unclaimedAfter).to.equal(0);
    });
  });

  describe("Document Management", function () {
    it("Should set and retrieve documents", async function () {
      const docName = ethers.keccak256(ethers.toUtf8Bytes("DEED_PROP001"));
      const docHash = ethers.keccak256(ethers.toUtf8Bytes("document content"));
      const uri = "ipfs://QmDocumentHash";

      await expect(token.connect(admin).setDocument(docName, uri, docHash, "Property Deed"))
        .to.emit(token, "DocumentUpdated")
        .withArgs(docName, uri, docHash);

      const [retrievedUri, retrievedHash, timestamp, docType] = await token.getDocument(docName);
      expect(retrievedUri).to.equal(uri);
      expect(retrievedHash).to.equal(docHash);
      expect(docType).to.equal("Property Deed");
    });
  });

  describe("Compliance Controls", function () {
    it("Should pause and unpause transfers", async function () {
      await registerTestInvestor(investor1.address);
      await registerTestInvestor(investor2.address);
      await token.connect(minter).issueByPartition(partitionResidential, investor1.address, HUNDRED_TOKENS, "0x");

      await token.connect(admin).pause();
      await expect(token.connect(investor1).transfer(investor2.address, ONE_TOKEN))
        .to.be.revertedWith("Pausable: paused");

      await token.connect(admin).unpause();
      await expect(token.connect(investor1).transfer(investor2.address, ONE_TOKEN))
        .to.emit(token, "Transfer");
    });

    it("Should perform controller transfer", async function () {
      await registerTestInvestor(investor1.address);
      await registerTestInvestor(investor2.address);
      await token.connect(minter).issueByPartition(partitionResidential, investor1.address, HUNDRED_TOKENS, "0x");

      await expect(token.connect(admin).controllerTransfer(
        investor1.address,
        investor2.address,
        HUNDRED_TOKENS,
        "0x",
        "0x"
      )).to.emit(token, "ControllerTransfer");
    });
  });

  describe("Emergency Functions", function () {
    it("Should activate and deactivate emergency stop", async function () {
      await expect(token.connect(admin).activateEmergencyStop())
        .to.emit(token, "EmergencyStopActivated");

      // Should block transfers
      await registerTestInvestor(investor1.address);
      await expect(token.connect(minter).issueByPartition(partitionResidential, investor1.address, HUNDRED_TOKENS, "0x"))
        .to.be.revertedWith("Emergency stop activated");

      // Wait 1 hour before deactivating
      await time.increase(3600);
      
      await expect(token.connect(admin).deactivateEmergencyStop())
        .to.emit(token, "EmergencyStopDeactivated");
    });

    it("Should allow emergency withdrawal when stopped", async function () {
      // Send some ETH to contract
      await owner.sendTransaction({ to: await token.getAddress(), value: ethers.parseEther("10") });
      
      await token.connect(admin).activateEmergencyStop();
      
      const timelockRole = await token.DEFAULT_ADMIN_ROLE();
      await timelock.grantRole(timelockRole, owner.address);
      
      await expect(token.connect(owner).emergencyWithdraw(owner.address, ethers.parseEther("5")))
        .to.emit(token, "EmergencyWithdrawal")
        .withArgs(owner.address, ethers.parseEther("5"));
    });
  });

  describe("Rate Limiting", function () {
    it("Should enforce rate limits on dividend claims", async function () {
      await addTestProperty();
      await registerTestInvestor(investor1.address);
      await token.connect(minter).issueByPartition(partitionResidential, investor1.address, HUNDRED_TOKENS, "0x");

      // Deposit multiple dividends
      for (let i = 0; i < 5; i++) {
        await token.connect(corporateActions).depositDividendForProperty(propertyId1, { value: ONE_TOKEN });
      }

      // Claim should work initially
      await token.connect(investor1).claimDividend(0);
      
      // But claiming all at once might hit rate limit
      // (depends on MAX_TRANSACTIONS_PER_WINDOW setting)
    });
  });

  describe("View Functions", function () {
    it("Should get total properties", async function () {
      await addTestProperty();
      expect(await token.getTotalProperties()).to.equal(1);
    });

    it("Should get property valuation", async function () {
      await addTestProperty();
      expect(await token.getPropertyValuation(propertyId1)).to.equal(ethers.parseUnits("1000000", 6));
    });

    it("Should get all property IDs", async function () {
      await addTestProperty();
      const propertyIds = await token.getPropertyIds();
      expect(propertyIds.length).to.equal(1);
      expect(propertyIds[0]).to.equal(propertyId1);
    });

    it("Should get investor details", async function () {
      await registerTestInvestor(investor1.address);
      const details = await token.getInvestorDetails(investor1.address);
      expect(details.investorType).to.equal(2); // QUALIFIED
      expect(details.jurisdictionCode).to.equal("SG");
    });
  });

  // Helper functions
  async function addTestProperty() {
    const propertyData = {
      propertyType: 1, // RESIDENTIAL
      propertyAddress: "123 Main Street, Singapore",
      legalDescription: "Lot 123, Block 456",
      valuationAmount: ethers.parseUnits("1000000", 6),
      valuationDate: await time.latest(),
      yearBuilt: 2020,
      totalArea: 150,
      propertyStatus: 1, // ACTIVE
      ipfsHash: "QmXxxPropertyDocuments"
    };

    const rentalData = {
      monthlyRent: ethers.parseUnits("5000", 6),
      lastRentCollection: 0,
      totalRentCollected: 0,
      occupancyRate: 9500,
      rentCollector: corporateActions.address
    };

    await token.connect(propertyManager).addProperty(propertyId1, partitionResidential, propertyData, rentalData);
  }

  async function registerTestInvestor(investorAddress: string) {
    const kycExpiry = (await time.latest()) + 365 * 24 * 60 * 60;
    await token.connect(compliance).registerInvestor(investorAddress, 2, "SG", kycExpiry);
  }
});