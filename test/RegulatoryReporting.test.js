const { expect } = require("chai");
const { ethers, upgrades } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

describe("RegulatoryReporting", function () {
    let regulatoryReporting;
    let token;
    let identityRegistry;
    let assetRegistry;
    let compliance;
    let owner, agent, investor1, investor2, reporter, complianceOfficer;
    
    beforeEach(async function () {
        [owner, agent, investor1, investor2, reporter, complianceOfficer] = await ethers.getSigners();
        
        // Deploy mock contracts (in production, these would be the actual contracts)
        const MockIdentityRegistry = await ethers.getContractFactory("IdentityRegistry");
        identityRegistry = await upgrades.deployProxy(MockIdentityRegistry);
        
        const MockCompliance = await ethers.getContractFactory("ModularCompliance");
        compliance = await upgrades.deployProxy(MockCompliance);
        
        const MockAssetRegistry = await ethers.getContractFactory("AssetRegistry");
        assetRegistry = await upgrades.deployProxy(MockAssetRegistry);
        
        // Deploy FinatradesRWA_Enterprise
        const FinatradesRWAEnterprise = await ethers.getContractFactory("FinatradesRWA_Enterprise");
        token = await upgrades.deployProxy(
            FinatradesRWAEnterprise,
            [
                identityRegistry.address,
                compliance.address,
                "Finatrades RWA Token",
                "FRWA",
                18,
                owner.address // onchainID
            ]
        );
        
        // Deploy RegulatoryReporting
        const RegulatoryReporting = await ethers.getContractFactory("RegulatoryReporting");
        regulatoryReporting = await upgrades.deployProxy(
            RegulatoryReporting,
            [
                token.address,
                identityRegistry.address,
                assetRegistry.address,
                compliance.address
            ]
        );
        
        // Set regulatory reporting in token
        await token.setRegulatoryReporting(regulatoryReporting.address);
        
        // Grant roles
        await regulatoryReporting.grantRole(await regulatoryReporting.REPORTER_ROLE(), reporter.address);
        await regulatoryReporting.grantRole(await regulatoryReporting.COMPLIANCE_OFFICER_ROLE(), complianceOfficer.address);
        
        // Setup identities for investors
        await identityRegistry.registerIdentity(investor1.address, investor1.address, 1); // US
        await identityRegistry.registerIdentity(investor2.address, investor2.address, 2); // Canada
    });
    
    describe("Report Generation", function () {
        it("Should generate investor report", async function () {
            // Mint tokens to investors
            await token.connect(agent).mint(investor1.address, ethers.utils.parseEther("1000"));
            await token.connect(agent).mint(investor2.address, ethers.utils.parseEther("2000"));
            
            // Generate report
            const report = await regulatoryReporting.connect(reporter).generateInvestorReport(10, 0);
            
            expect(report.length).to.be.greaterThan(0);
            expect(report[0].wallet).to.equal(investor1.address);
            expect(report[0].country).to.equal(1);
            expect(report[0].balance).to.equal(ethers.utils.parseEther("1000"));
        });
        
        it("Should generate jurisdictional report", async function () {
            // Mint tokens to investors from different countries
            await token.connect(agent).mint(investor1.address, ethers.utils.parseEther("1000"));
            await token.connect(agent).mint(investor2.address, ethers.utils.parseEther("2000"));
            
            // Generate report
            const report = await regulatoryReporting.connect(reporter).generateJurisdictionalReport();
            
            expect(report.length).to.equal(2);
            expect(report[0].countryCode).to.equal(1); // US
            expect(report[0].totalHoldings).to.equal(ethers.utils.parseEther("1000"));
            expect(report[1].countryCode).to.equal(2); // Canada
            expect(report[1].totalHoldings).to.equal(ethers.utils.parseEther("2000"));
        });
    });
    
    describe("Compliance Violation Tracking", function () {
        it("Should record compliance violations", async function () {
            // Record a violation
            await regulatoryReporting.connect(complianceOfficer).recordComplianceViolation(
                investor1.address,
                investor2.address,
                ethers.utils.parseEther("500"),
                "Country restriction violated",
                "CountryRestrictModule"
            );
            
            // Generate violation report
            const fromTime = await time.latest() - 3600;
            const toTime = await time.latest() + 3600;
            
            const violations = await regulatoryReporting.connect(complianceOfficer)
                .generateComplianceViolationReport(fromTime, toTime);
            
            expect(violations.length).to.equal(1);
            expect(violations[0].attemptedBy).to.equal(investor1.address);
            expect(violations[0].reason).to.equal("Country restriction violated");
        });
    });
    
    describe("Transaction Reporting", function () {
        it("Should record successful transactions", async function () {
            // Setup compliance to allow transfers
            await compliance.setTokenCompliance(token.address);
            
            // Mint and transfer tokens
            await token.connect(agent).mint(investor1.address, ethers.utils.parseEther("1000"));
            await token.connect(investor1).transfer(investor2.address, ethers.utils.parseEther("100"));
            
            // Check investor statistics
            const stats = await regulatoryReporting.getInvestorStatistics(investor1.address);
            expect(stats.totalTransactions).to.be.greaterThan(0);
        });
    });
    
    describe("Ownership Distribution", function () {
        it("Should calculate ownership distribution correctly", async function () {
            const assetId = "ASSET001";
            
            // For this test, we'll use regular minting since asset-specific minting
            // would require full asset registry setup
            await token.connect(agent).mint(investor1.address, ethers.utils.parseEther("300"));
            await token.connect(agent).mint(investor2.address, ethers.utils.parseEther("700"));
            
            // Generate ownership report
            const report = await regulatoryReporting.connect(reporter)
                .generateOwnershipDistributionReport(assetId);
            
            expect(report.totalSupply).to.equal(ethers.utils.parseEther("1000"));
            expect(report.totalHolders).to.equal(2);
            expect(report.top10Percentage).to.equal(100); // All holdings in top 10
        });
    });
    
    describe("Export Functionality", function () {
        it("Should export report data", async function () {
            // Mint tokens
            await token.connect(agent).mint(investor1.address, ethers.utils.parseEther("1000"));
            
            // Export investor list
            const exportData = await regulatoryReporting.connect(reporter).exportReportData(
                0, // INVESTOR_LIST
                0,
                0
            );
            
            expect(exportData).to.not.be.empty;
            
            // Decode and verify
            const decoded = ethers.utils.defaultAbiCoder.decode(
                ["tuple(address,address,uint16,uint256,uint256,uint256,bool,bool)[]"],
                exportData
            );
            expect(decoded[0].length).to.be.greaterThan(0);
        });
    });
    
    describe("Compliance Statistics", function () {
        it("Should track compliance statistics", async function () {
            // Setup some transactions and violations
            await token.connect(agent).mint(investor1.address, ethers.utils.parseEther("1000"));
            
            // Record violation
            await regulatoryReporting.connect(complianceOfficer).recordComplianceViolation(
                investor1.address,
                investor2.address,
                ethers.utils.parseEther("500"),
                "Test violation",
                "TestModule"
            );
            
            // Get statistics
            const fromTime = await time.latest() - 3600;
            const toTime = await time.latest() + 3600;
            
            const stats = await regulatoryReporting.connect(complianceOfficer)
                .getComplianceStatistics(fromTime, toTime);
            
            expect(stats.violationCount).to.equal(1);
            expect(stats.uniqueViolators).to.equal(1);
        });
    });
    
    describe("Access Control", function () {
        it("Should enforce role-based access", async function () {
            // Try to generate report without proper role
            await expect(
                regulatoryReporting.connect(investor1).generateInvestorReport(10, 0)
            ).to.be.revertedWith("Not authorized");
            
            // Try to record violation without proper role
            await expect(
                regulatoryReporting.connect(investor1).recordComplianceViolation(
                    investor1.address,
                    investor2.address,
                    100,
                    "Test",
                    "Test"
                )
            ).to.be.revertedWith("Not authorized");
        });
    });
});