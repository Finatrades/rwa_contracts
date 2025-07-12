// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/ERC20SnapshotUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

/**
 * @title FinatradesRWA
 * @author Finatrades Development Team
 * @notice ERC-1400 compliant security token for real-world asset tokenization
 * @dev Implements property tokenization with rental income distribution
 * @custom:security-contact security@finatrades.com
 * @custom:version 3.0.0
 */
contract FinatradesRWA_Final is 
    Initializable,
    ERC20Upgradeable,
    ERC20SnapshotUpgradeable,
    PausableUpgradeable,
    AccessControlUpgradeable,
    ReentrancyGuardUpgradeable,
    UUPSUpgradeable
{
    // ============ Custom Types ============
    
    /// @notice Types of properties that can be tokenized
    enum PropertyType { NONE, RESIDENTIAL, COMMERCIAL, INDUSTRIAL, AGRICULTURAL, MIXED_USE }
    
    /// @notice Current status of the property
    enum PropertyStatus { NONE, ACTIVE, UNDER_MANAGEMENT, FOR_SALE, SOLD, DEFAULTED }
    
    /// @notice Types of investors
    enum InvestorType { NONE, RETAIL, QUALIFIED, INSTITUTIONAL, PROFESSIONAL }
    
    // ============ Constants ============
    
    uint256 private constant MAX_SUPPLY = 1e12 * 10**18; // 1 trillion tokens max
    uint256 private constant MAX_PROPERTIES = 1000;      // Max properties per contract
    uint256 private constant MAX_DOCUMENTS = 10000;      // Max documents
    uint256 private constant MAX_DIVIDEND_AMOUNT = 1000000 * 10**18; // Max dividend per deposit
    uint256 private constant RATE_LIMIT_TIME = 1 hours;  // Rate limiting window
    uint256 private constant MAX_TRANSACTIONS_PER_WINDOW = 100; // Max txs per window
    bytes32 public constant DEFAULT_PARTITION = keccak256("DEFAULT");
    
    // ============ Roles ============
    
    bytes32 public constant CONTROLLER_ROLE = keccak256("CONTROLLER_ROLE");
    bytes32 public constant COMPLIANCE_ROLE = keccak256("COMPLIANCE_ROLE");
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant CORPORATE_ACTIONS_ROLE = keccak256("CORPORATE_ACTIONS_ROLE");
    bytes32 public constant UPGRADER_ROLE = keccak256("UPGRADER_ROLE");
    bytes32 public constant PROPERTY_MANAGER_ROLE = keccak256("PROPERTY_MANAGER_ROLE");
    
    // ============ Structs ============
    
    /**
     * @notice Property information structure
     * @param propertyType Type of property (residential, commercial, etc.)
     * @param propertyAddress Physical address of the property
     * @param legalDescription Legal description from deed
     * @param valuationAmount Current valuation in USD (6 decimals)
     * @param valuationDate Timestamp of last valuation
     * @param yearBuilt Year the property was built
     * @param totalArea Total area in square meters
     * @param propertyStatus Current status of property
     * @param ipfsHash IPFS hash containing property documents
     */
    struct Property {
        PropertyType propertyType;
        string propertyAddress;
        string legalDescription;
        uint256 valuationAmount;
        uint256 valuationDate;
        uint256 yearBuilt;
        uint256 totalArea;
        PropertyStatus propertyStatus;
        string ipfsHash;
    }
    
    /**
     * @notice Rental income information
     * @param monthlyRent Expected monthly rent in USD (6 decimals)
     * @param lastRentCollection Timestamp of last rent collection
     * @param totalRentCollected Total rent collected lifetime
     * @param occupancyRate Current occupancy rate (basis points, 10000 = 100%)
     * @param rentCollector Address authorized to deposit rent
     */
    struct RentalInfo {
        uint256 monthlyRent;
        uint256 lastRentCollection;
        uint256 totalRentCollected;
        uint256 occupancyRate;
        address rentCollector;
    }
    
    /**
     * @notice Investor information
     * @param investorType Type of investor
     * @param jurisdictionCode 2-letter country code
     * @param kycExpiry KYC expiration timestamp
     * @param amlCheckDate Last AML check timestamp
     * @param isActive Whether investor is active
     * @param totalInvested Total amount invested
     * @param totalDividendsClaimed Total dividends claimed
     */
    struct Investor {
        InvestorType investorType;
        string jurisdictionCode;
        uint256 kycExpiry;
        uint256 amlCheckDate;
        bool isActive;
        uint256 totalInvested;
        uint256 totalDividendsClaimed;
    }
    
    /**
     * @notice Document information for ERC-1400
     * @param uri Location of document (IPFS/URL)
     * @param documentHash Hash of document for verification
     * @param timestamp When document was added
     * @param docType Type of document
     */
    struct Document {
        string uri;
        bytes32 documentHash;
        uint256 timestamp;
        string docType;
    }
    
    // ============ State Variables ============
    
    // ERC-1400 Partition Management
    bytes32[] public totalPartitions;
    mapping(bytes32 => uint256) public totalSupplyByPartition;
    mapping(address => bytes32[]) public partitionsOf;
    mapping(address => mapping(bytes32 => uint256)) public balanceOfByPartition;
    mapping(bytes32 => string) public partitionNames;
    mapping(bytes32 => bool) public partitionRestricted;
    
    // Property Management
    mapping(bytes32 => Property) public properties;
    mapping(bytes32 => RentalInfo) public rentalInfo;
    mapping(bytes32 => bytes32) public partitionToProperty;
    bytes32[] public propertyIds;
    uint256 public totalProperties;
    
    // Document Management
    mapping(bytes32 => Document) public documents;
    bytes32[] public documentNames;
    uint256 public totalDocuments;
    
    // Investor Management
    mapping(address => Investor) public investors;
    mapping(string => bool) public allowedJurisdictions;
    address[] public investorList;
    
    // Dividend Management
    mapping(uint256 => uint256) public dividendAmounts;
    mapping(uint256 => uint256) public dividendSnapshots;
    mapping(uint256 => mapping(address => bool)) public dividendClaimed;
    mapping(uint256 => bytes32) public dividendProperty;
    uint256 public dividendIndex;
    uint256 public totalDividendsDistributed;
    
    // Compliance Settings
    uint256 public maxHolders;
    uint256 public currentHolders;
    uint256 public minInvestmentAmount;
    uint256 public maxInvestmentAmount;
    bool public isControllable;
    
    // Rate Limiting
    mapping(address => uint256) public lastActionTimestamp;
    mapping(address => uint256) public actionsInWindow;
    
    // Circuit Breakers
    bool public emergencyStop;
    uint256 public lastEmergencyTimestamp;
    
    // ============ Events ============
    
    // ERC-1400 Events
    event IssuedByPartition(bytes32 indexed partition, address indexed to, uint256 value, bytes data);
    event RedeemedByPartition(bytes32 indexed partition, address indexed from, uint256 value, bytes data);
    event TransferByPartition(
        bytes32 indexed fromPartition,
        address operator,
        address indexed from,
        address indexed to,
        uint256 value,
        bytes data,
        bytes operatorData
    );
    event ControllerTransfer(
        address indexed controller,
        address indexed from,
        address indexed to,
        uint256 value,
        bytes data,
        bytes operatorData
    );
    event DocumentUpdated(bytes32 indexed name, string uri, bytes32 documentHash);
    event PartitionCreated(bytes32 indexed partition, string name);
    
    // Property Events
    event PropertyAdded(bytes32 indexed propertyId, PropertyType propertyType, uint256 valuationAmount);
    event PropertyUpdated(bytes32 indexed propertyId, string field, string value);
    event PropertyStatusChanged(bytes32 indexed propertyId, PropertyStatus oldStatus, PropertyStatus newStatus);
    event PropertyValuationUpdated(bytes32 indexed propertyId, uint256 oldValuation, uint256 newValuation);
    event RentalIncomeDeposited(bytes32 indexed propertyId, uint256 amount, uint256 timestamp);
    
    // Investor Events
    event InvestorRegistered(address indexed investor, InvestorType investorType, string jurisdiction);
    event InvestorKYCUpdated(address indexed investor, uint256 oldExpiry, uint256 newExpiry);
    event InvestorDeactivated(address indexed investor, uint256 timestamp);
    event InvestorReactivated(address indexed investor, uint256 timestamp);
    
    // Dividend Events
    event DividendDeposited(uint256 indexed dividendIndex, uint256 amount, uint256 totalSupply, bytes32 propertyId);
    event DividendClaimed(address indexed investor, uint256 indexed dividendIndex, uint256 amount);
    event DividendRecycled(uint256 indexed dividendIndex, uint256 amount);
    
    // Compliance Events
    event ComplianceConfigurationUpdated(string parameter, uint256 oldValue, uint256 newValue);
    event JurisdictionUpdated(string jurisdiction, bool allowed);
    event PartitionRestrictionUpdated(bytes32 indexed partition, bool restricted);
    event MaxHoldersUpdated(uint256 oldMax, uint256 newMax);
    event InvestmentLimitsUpdated(uint256 oldMin, uint256 oldMax, uint256 newMin, uint256 newMax);
    
    // Emergency Events
    event EmergencyStopActivated(address indexed by, uint256 timestamp);
    event EmergencyStopDeactivated(address indexed by, uint256 timestamp);
    event EmergencyWithdrawal(address indexed to, uint256 amount);
    
    // ============ Modifiers ============
    
    /**
     * @notice Ensures caller is not rate limited
     */
    modifier rateLimited() {
        if (block.timestamp >= lastActionTimestamp[msg.sender] + RATE_LIMIT_TIME) {
            lastActionTimestamp[msg.sender] = block.timestamp;
            actionsInWindow[msg.sender] = 1;
        } else {
            actionsInWindow[msg.sender]++;
            require(actionsInWindow[msg.sender] <= MAX_TRANSACTIONS_PER_WINDOW, "Rate limit exceeded");
        }
        _;
    }
    
    /**
     * @notice Ensures system is not in emergency stop
     */
    modifier notInEmergency() {
        require(!emergencyStop, "Emergency stop activated");
        _;
    }
    
    /**
     * @notice Validates address is not zero
     */
    modifier validAddress(address addr) {
        require(addr != address(0), "Invalid zero address");
        _;
    }
    
    /**
     * @notice Validates amount is positive and within bounds
     */
    modifier validAmount(uint256 amount) {
        require(amount > 0, "Amount must be positive");
        require(amount <= MAX_SUPPLY, "Amount exceeds maximum");
        _;
    }
    
    // ============ Constructor ============
    
    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }
    
    // ============ Initializer ============
    
    /**
     * @notice Initializes the contract
     * @param tokenName Name of the token
     * @param tokenSymbol Symbol of the token
     * @param admin Initial admin address
     * @param timelockController Timelock controller address
     */
    function initialize(
        string memory tokenName,
        string memory tokenSymbol,
        address admin,
        address timelockController
    ) public initializer validAddress(admin) validAddress(timelockController) {
        __ERC20_init(tokenName, tokenSymbol);
        __ERC20Snapshot_init();
        __Pausable_init();
        __AccessControl_init();
        __ReentrancyGuard_init();
        __UUPSUpgradeable_init();
        
        _grantRole(DEFAULT_ADMIN_ROLE, timelockController);
        _grantRole(UPGRADER_ROLE, timelockController);
        _grantRole(CONTROLLER_ROLE, admin);
        _grantRole(COMPLIANCE_ROLE, admin);
        _grantRole(MINTER_ROLE, admin);
        _grantRole(CORPORATE_ACTIONS_ROLE, admin);
        _grantRole(PROPERTY_MANAGER_ROLE, admin);
        
        maxHolders = 10000;
        minInvestmentAmount = 1e18;
        maxInvestmentAmount = type(uint256).max;
        isControllable = true;
        
        totalPartitions.push(DEFAULT_PARTITION);
        partitionNames[DEFAULT_PARTITION] = "DEFAULT";
        emit PartitionCreated(DEFAULT_PARTITION, "DEFAULT");
    }
    
    // ============ Property Management Functions ============
    
    /**
     * @notice Adds a new property to the token system
     * @param propertyId Unique identifier for the property
     * @param partition Partition to assign property to
     * @param propertyData Property information
     * @param rentalData Rental information
     */
    function addProperty(
        bytes32 propertyId,
        bytes32 partition,
        Property calldata propertyData,
        RentalInfo calldata rentalData
    ) external onlyRole(PROPERTY_MANAGER_ROLE) notInEmergency {
        require(propertyId != bytes32(0), "Invalid property ID");
        require(properties[propertyId].valuationDate == 0, "Property already exists");
        require(propertyData.propertyType != PropertyType.NONE, "Invalid property type");
        require(propertyData.valuationAmount > 0, "Invalid valuation");
        require(totalProperties < MAX_PROPERTIES, "Max properties reached");
        
        properties[propertyId] = propertyData;
        rentalInfo[propertyId] = rentalData;
        propertyIds.push(propertyId);
        totalProperties++;
        
        if (partition != DEFAULT_PARTITION) {
            _createPartition(partition, propertyData.propertyAddress);
            partitionToProperty[partition] = propertyId;
        }
        
        emit PropertyAdded(propertyId, propertyData.propertyType, propertyData.valuationAmount);
    }
    
    /**
     * @notice Updates property valuation
     * @param propertyId Property to update
     * @param newValuation New valuation amount
     */
    function updatePropertyValuation(
        bytes32 propertyId,
        uint256 newValuation
    ) external onlyRole(PROPERTY_MANAGER_ROLE) {
        require(properties[propertyId].valuationDate > 0, "Property not found");
        require(newValuation > 0, "Invalid valuation");
        
        uint256 oldValuation = properties[propertyId].valuationAmount;
        properties[propertyId].valuationAmount = newValuation;
        properties[propertyId].valuationDate = block.timestamp;
        
        emit PropertyValuationUpdated(propertyId, oldValuation, newValuation);
    }
    
    /**
     * @notice Changes property status
     * @param propertyId Property to update
     * @param newStatus New status
     */
    function updatePropertyStatus(
        bytes32 propertyId,
        PropertyStatus newStatus
    ) external onlyRole(PROPERTY_MANAGER_ROLE) {
        require(properties[propertyId].valuationDate > 0, "Property not found");
        require(newStatus != PropertyStatus.NONE, "Invalid status");
        
        PropertyStatus oldStatus = properties[propertyId].propertyStatus;
        properties[propertyId].propertyStatus = newStatus;
        
        emit PropertyStatusChanged(propertyId, oldStatus, newStatus);
    }
    
    /**
     * @notice Records rental income for a property
     * @param propertyId Property that generated income
     * @param amount Rental amount
     */
    function recordRentalIncome(
        bytes32 propertyId,
        uint256 amount
    ) external onlyRole(CORPORATE_ACTIONS_ROLE) {
        require(properties[propertyId].valuationDate > 0, "Property not found");
        require(amount > 0, "Invalid amount");
        
        rentalInfo[propertyId].totalRentCollected += amount;
        rentalInfo[propertyId].lastRentCollection = block.timestamp;
        
        emit RentalIncomeDeposited(propertyId, amount, block.timestamp);
    }
    
    /**
     * @notice Finalizes property sale
     * @param propertyId Property being sold
     */
    function finalizePropertySale(bytes32 propertyId) 
        external 
        onlyRole(PROPERTY_MANAGER_ROLE) 
        nonReentrant 
    {
        require(properties[propertyId].valuationDate > 0, "Property not found");
        require(properties[propertyId].propertyStatus == PropertyStatus.FOR_SALE, "Property not for sale");
        
        properties[propertyId].propertyStatus = PropertyStatus.SOLD;
        
        // Restrict transfers for the property partition
        bytes32 partition = partitionToProperty[propertyId];
        if (partition != bytes32(0)) {
            partitionRestricted[partition] = true;
            emit PartitionRestrictionUpdated(partition, true);
        }
        
        emit PropertyStatusChanged(propertyId, PropertyStatus.FOR_SALE, PropertyStatus.SOLD);
    }
    
    // ============ ERC-1400 Partition Functions ============
    
    /**
     * @notice Creates a new partition
     * @param partition Partition identifier
     * @param name Human-readable name
     */
    function _createPartition(bytes32 partition, string memory name) internal {
        bool exists = false;
        for (uint256 i = 0; i < totalPartitions.length; i++) {
            if (totalPartitions[i] == partition) {
                exists = true;
                break;
            }
        }
        
        if (!exists) {
            totalPartitions.push(partition);
            partitionNames[partition] = name;
            emit PartitionCreated(partition, name);
        }
    }
    
    /**
     * @notice Issues tokens by partition
     * @param partition Partition to issue tokens for
     * @param to Recipient address
     * @param value Amount to issue
     * @param data Additional data
     */
    function issueByPartition(
        bytes32 partition,
        address to,
        uint256 value,
        bytes calldata data
    ) external onlyRole(MINTER_ROLE) whenNotPaused validAddress(to) validAmount(value) returns (bytes32) {
        require(partition != bytes32(0), "Invalid partition");
        require(investors[to].isActive, "Investor not registered");
        require(investors[to].kycExpiry > block.timestamp, "KYC expired");
        require(!partitionRestricted[partition], "Partition restricted");
        
        _issueByPartition(partition, to, value, data);
        investors[to].totalInvested += value;
        
        return partition;
    }
    
    /**
     * @notice Internal function to issue tokens
     */
    function _issueByPartition(
        bytes32 partition,
        address to,
        uint256 value,
        bytes memory data
    ) internal {
        require(totalSupply() + value <= MAX_SUPPLY, "Exceeds max supply");
        require(
            balanceOf(to) + value >= minInvestmentAmount || balanceOf(to) > 0,
            "Below minimum investment"
        );
        require(balanceOf(to) + value <= maxInvestmentAmount, "Exceeds maximum investment");
        
        balanceOfByPartition[to][partition] += value;
        totalSupplyByPartition[partition] += value;
        
        if (balanceOf(to) == 0) {
            currentHolders++;
            require(currentHolders <= maxHolders, "Max holders reached");
        }
        
        _addPartitionToHolder(to, partition);
        _mint(to, value);
        
        emit IssuedByPartition(partition, to, value, data);
    }
    
    /**
     * @notice Redeems tokens by partition
     * @param partition Partition to redeem from
     * @param value Amount to redeem
     * @param data Additional data
     */
    function redeemByPartition(
        bytes32 partition,
        uint256 value,
        bytes calldata data
    ) external whenNotPaused nonReentrant validAmount(value) {
        require(!partitionRestricted[partition], "Partition restricted");
        _redeemByPartition(partition, msg.sender, value, data);
    }
    
    /**
     * @notice Internal function to redeem tokens
     */
    function _redeemByPartition(
        bytes32 partition,
        address from,
        uint256 value,
        bytes memory data
    ) internal {
        require(balanceOfByPartition[from][partition] >= value, "Insufficient balance");
        
        balanceOfByPartition[from][partition] -= value;
        totalSupplyByPartition[partition] -= value;
        
        if (balanceOf(from) == value) {
            currentHolders--;
        }
        
        if (balanceOfByPartition[from][partition] == 0) {
            _removePartitionFromHolder(from, partition);
        }
        
        _burn(from, value);
        
        emit RedeemedByPartition(partition, from, value, data);
    }
    
    /**
     * @notice Transfers tokens by partition
     * @param partition Partition to transfer from
     * @param to Recipient address
     * @param value Amount to transfer
     * @param data Additional data
     */
    function transferByPartition(
        bytes32 partition,
        address to,
        uint256 value,
        bytes calldata data
    ) external whenNotPaused nonReentrant validAddress(to) validAmount(value) returns (bytes32) {
        require(!partitionRestricted[partition], "Partition restricted");
        _transferByPartition(partition, msg.sender, msg.sender, to, value, data, "");
        return partition;
    }
    
    /**
     * @notice Internal partition transfer
     */
    function _transferByPartition(
        bytes32 partition,
        address operator,
        address from,
        address to,
        uint256 value,
        bytes memory data,
        bytes memory operatorData
    ) internal {
        require(balanceOfByPartition[from][partition] >= value, "Insufficient partition balance");
        
        balanceOfByPartition[from][partition] -= value;
        balanceOfByPartition[to][partition] += value;
        
        _addPartitionToHolder(to, partition);
        
        if (balanceOfByPartition[from][partition] == 0) {
            _removePartitionFromHolder(from, partition);
        }
        
        emit TransferByPartition(partition, operator, from, to, value, data, operatorData);
    }
    
    // ============ Document Management ============
    
    /**
     * @notice Sets a document
     * @param name Document identifier
     * @param uri Document location
     * @param documentHash Document hash
     * @param docType Type of document
     */
    function setDocument(
        bytes32 name,
        string calldata uri,
        bytes32 documentHash,
        string calldata docType
    ) external onlyRole(CONTROLLER_ROLE) {
        require(name != bytes32(0), "Invalid document name");
        require(bytes(uri).length > 0, "Invalid URI");
        require(documentHash != bytes32(0), "Invalid document hash");
        require(totalDocuments < MAX_DOCUMENTS, "Max documents reached");
        
        if (documents[name].timestamp == 0) {
            documentNames.push(name);
            totalDocuments++;
        }
        
        documents[name] = Document({
            uri: uri,
            documentHash: documentHash,
            timestamp: block.timestamp,
            docType: docType
        });
        
        emit DocumentUpdated(name, uri, documentHash);
    }
    
    // ============ Investor Management ============
    
    /**
     * @notice Registers a new investor
     * @param investor Investor address
     * @param investorType Type of investor
     * @param jurisdictionCode 2-letter country code
     * @param kycExpiry KYC expiration timestamp
     */
    function registerInvestor(
        address investor,
        InvestorType investorType,
        string calldata jurisdictionCode,
        uint256 kycExpiry
    ) external onlyRole(COMPLIANCE_ROLE) validAddress(investor) {
        require(investorType != InvestorType.NONE, "Invalid investor type");
        require(bytes(jurisdictionCode).length == 2, "Invalid jurisdiction code");
        require(kycExpiry > block.timestamp, "KYC already expired");
        require(allowedJurisdictions[jurisdictionCode], "Jurisdiction not allowed");
        
        if (!investors[investor].isActive) {
            investorList.push(investor);
        }
        
        investors[investor] = Investor({
            investorType: investorType,
            jurisdictionCode: jurisdictionCode,
            kycExpiry: kycExpiry,
            amlCheckDate: block.timestamp,
            isActive: true,
            totalInvested: investors[investor].totalInvested,
            totalDividendsClaimed: investors[investor].totalDividendsClaimed
        });
        
        emit InvestorRegistered(investor, investorType, jurisdictionCode);
    }
    
    /**
     * @notice Updates investor KYC expiry
     * @param investor Investor address
     * @param newKycExpiry New KYC expiration
     */
    function updateInvestorKYC(
        address investor,
        uint256 newKycExpiry
    ) external onlyRole(COMPLIANCE_ROLE) {
        require(investors[investor].isActive, "Investor not registered");
        require(newKycExpiry > block.timestamp, "KYC already expired");
        
        uint256 oldExpiry = investors[investor].kycExpiry;
        investors[investor].kycExpiry = newKycExpiry;
        investors[investor].amlCheckDate = block.timestamp;
        
        emit InvestorKYCUpdated(investor, oldExpiry, newKycExpiry);
    }
    
    /**
     * @notice Deactivates an investor
     * @param investor Investor to deactivate
     */
    function deactivateInvestor(address investor) external onlyRole(COMPLIANCE_ROLE) {
        require(investors[investor].isActive, "Investor not active");
        require(balanceOf(investor) == 0, "Investor has balance");
        
        investors[investor].isActive = false;
        emit InvestorDeactivated(investor, block.timestamp);
    }
    
    /**
     * @notice Sets allowed jurisdictions
     * @param jurisdictions Array of jurisdiction codes
     * @param allowed Array of boolean flags
     */
    function setAllowedJurisdictions(
        string[] calldata jurisdictions,
        bool[] calldata allowed
    ) external onlyRole(COMPLIANCE_ROLE) {
        require(jurisdictions.length == allowed.length, "Length mismatch");
        
        for (uint256 i = 0; i < jurisdictions.length; i++) {
            require(bytes(jurisdictions[i]).length == 2, "Invalid jurisdiction code");
            allowedJurisdictions[jurisdictions[i]] = allowed[i];
            emit JurisdictionUpdated(jurisdictions[i], allowed[i]);
        }
    }
    
    // ============ Dividend Management ============
    
    /**
     * @notice Deposits dividend for a property
     * @param propertyId Property paying dividend
     */
    function depositDividendForProperty(bytes32 propertyId) 
        external 
        payable 
        onlyRole(CORPORATE_ACTIONS_ROLE) 
        nonReentrant 
        notInEmergency 
    {
        require(msg.value > 0 && msg.value <= MAX_DIVIDEND_AMOUNT, "Invalid dividend amount");
        require(properties[propertyId].valuationDate > 0, "Property not found");
        require(totalSupply() > 0, "No tokens issued");
        
        uint256 snapshotId = _snapshot();
        dividendAmounts[dividendIndex] = msg.value;
        dividendSnapshots[dividendIndex] = snapshotId;
        dividendProperty[dividendIndex] = propertyId;
        totalDividendsDistributed += msg.value;
        
        rentalInfo[propertyId].totalRentCollected += msg.value;
        rentalInfo[propertyId].lastRentCollection = block.timestamp;
        
        emit DividendDeposited(dividendIndex, msg.value, totalSupply(), propertyId);
        emit RentalIncomeDeposited(propertyId, msg.value, block.timestamp);
        
        dividendIndex++;
    }
    
    /**
     * @notice Claims dividend for a specific index
     * @param index Dividend index to claim
     */
    function claimDividend(uint256 index) external nonReentrant rateLimited {
        require(index < dividendIndex, "Invalid dividend index");
        require(!dividendClaimed[index][msg.sender], "Already claimed");
        
        uint256 balance = balanceOfAt(msg.sender, dividendSnapshots[index]);
        require(balance > 0, "No balance at snapshot");
        
        uint256 totalSupplyAtSnapshot = totalSupplyAt(dividendSnapshots[index]);
        uint256 amount = (dividendAmounts[index] * balance) / totalSupplyAtSnapshot;
        require(amount > 0, "No dividend to claim");
        
        dividendClaimed[index][msg.sender] = true;
        investors[msg.sender].totalDividendsClaimed += amount;
        
        (bool success, ) = msg.sender.call{value: amount}("");
        require(success, "Dividend transfer failed");
        
        emit DividendClaimed(msg.sender, index, amount);
    }
    
    /**
     * @notice Claims all unclaimed dividends
     */
    function claimAllDividends() external nonReentrant rateLimited {
        uint256 totalClaimed = 0;
        
        for (uint256 i = 0; i < dividendIndex; i++) {
            if (!dividendClaimed[i][msg.sender]) {
                uint256 balance = balanceOfAt(msg.sender, dividendSnapshots[i]);
                if (balance > 0) {
                    uint256 totalSupplyAtSnapshot = totalSupplyAt(dividendSnapshots[i]);
                    uint256 amount = (dividendAmounts[i] * balance) / totalSupplyAtSnapshot;
                    
                    if (amount > 0) {
                        dividendClaimed[i][msg.sender] = true;
                        totalClaimed += amount;
                        emit DividendClaimed(msg.sender, i, amount);
                    }
                }
            }
        }
        
        require(totalClaimed > 0, "No dividends to claim");
        investors[msg.sender].totalDividendsClaimed += totalClaimed;
        
        (bool success, ) = msg.sender.call{value: totalClaimed}("");
        require(success, "Dividend transfer failed");
    }
    
    // ============ Compliance Functions ============
    
    /**
     * @notice Sets maximum number of token holders
     * @param newMaxHolders New maximum
     */
    function setMaxHolders(uint256 newMaxHolders) external onlyRole(COMPLIANCE_ROLE) {
        require(newMaxHolders >= currentHolders, "Below current holders");
        require(newMaxHolders > 0, "Invalid max holders");
        
        uint256 oldMax = maxHolders;
        maxHolders = newMaxHolders;
        
        emit MaxHoldersUpdated(oldMax, newMaxHolders);
    }
    
    /**
     * @notice Sets investment limits
     * @param minAmount Minimum investment amount
     * @param maxAmount Maximum investment amount
     */
    function setInvestmentLimits(
        uint256 minAmount,
        uint256 maxAmount
    ) external onlyRole(COMPLIANCE_ROLE) {
        require(minAmount <= maxAmount, "Min exceeds max");
        require(maxAmount <= MAX_SUPPLY, "Max exceeds supply");
        
        uint256 oldMin = minInvestmentAmount;
        uint256 oldMax = maxInvestmentAmount;
        
        minInvestmentAmount = minAmount;
        maxInvestmentAmount = maxAmount;
        
        emit InvestmentLimitsUpdated(oldMin, oldMax, minAmount, maxAmount);
    }
    
    /**
     * @notice Controller transfer for compliance
     * @param from Source address
     * @param to Destination address
     * @param value Amount to transfer
     * @param data Additional data
     * @param operatorData Operator data
     */
    function controllerTransfer(
        address from,
        address to,
        uint256 value,
        bytes calldata data,
        bytes calldata operatorData
    ) external onlyRole(CONTROLLER_ROLE) whenNotPaused validAddress(from) validAddress(to) validAmount(value) {
        require(isControllable, "Controller transfers disabled");
        
        _transfer(from, to, value);
        emit ControllerTransfer(msg.sender, from, to, value, data, operatorData);
    }
    
    // ============ View Functions ============
    
    /**
     * @notice Checks if transfer is allowed
     * @param from Source address
     * @param to Destination address
     * @param partition Partition identifier
     * @param value Transfer amount
     * @return statusCode ERC-1400 status code
     * @return reasonCode Reason for failure
     * @return partition_ Partition used
     */
    function canTransferByPartition(
        address from,
        address to,
        bytes32 partition,
        uint256 value,
        bytes calldata
    ) external view returns (bytes1 statusCode, bytes32 reasonCode, bytes32 partition_) {
        if (partition == bytes32(0)) return (0x50, keccak256("Invalid partition"), partition);
        if (partitionRestricted[partition]) return (0x50, keccak256("Partition restricted"), partition);
        if (balanceOfByPartition[from][partition] < value) return (0x52, keccak256("Insufficient balance"), partition);
        if (!investors[from].isActive || !investors[to].isActive) return (0x54, keccak256("Invalid investor"), partition);
        if (investors[from].kycExpiry <= block.timestamp) return (0x55, keccak256("KYC expired"), partition);
        if (investors[to].kycExpiry <= block.timestamp) return (0x55, keccak256("KYC expired"), partition);
        if (paused()) return (0x54, keccak256("Token paused"), partition);
        if (emergencyStop) return (0x54, keccak256("Emergency stop"), partition);
        
        return (0x51, bytes32(0), partition);
    }
    
    /**
     * @notice Gets total number of properties
     * @return Total properties registered
     */
    function getTotalProperties() external view returns (uint256) {
        return totalProperties;
    }
    
    /**
     * @notice Gets property valuation
     * @param propertyId Property identifier
     * @return Current valuation amount
     */
    function getPropertyValuation(bytes32 propertyId) external view returns (uint256) {
        return properties[propertyId].valuationAmount;
    }
    
    /**
     * @notice Gets investor details
     * @param investor Investor address
     * @return Investor information
     */
    function getInvestorDetails(address investor) external view returns (Investor memory) {
        return investors[investor];
    }
    
    /**
     * @notice Gets unclaimed dividends for an investor
     * @param investor Investor address
     * @return unclaimedAmount Total unclaimed dividends
     */
    function getUnclaimedDividends(address investor) external view returns (uint256 unclaimedAmount) {
        for (uint256 i = 0; i < dividendIndex; i++) {
            if (!dividendClaimed[i][investor]) {
                uint256 balance = balanceOfAt(investor, dividendSnapshots[i]);
                if (balance > 0) {
                    uint256 totalSupplyAtSnapshot = totalSupplyAt(dividendSnapshots[i]);
                    unclaimedAmount += (dividendAmounts[i] * balance) / totalSupplyAtSnapshot;
                }
            }
        }
    }
    
    /**
     * @notice Gets property information
     * @param propertyId Property identifier
     * @return property Property details
     * @return rental Rental information
     */
    function getProperty(bytes32 propertyId) external view returns (Property memory property, RentalInfo memory rental) {
        return (properties[propertyId], rentalInfo[propertyId]);
    }
    
    /**
     * @notice Gets all property IDs
     * @return Array of property identifiers
     */
    function getPropertyIds() external view returns (bytes32[] memory) {
        return propertyIds;
    }
    
    /**
     * @notice Gets holder's partitions
     * @param holder Holder address
     * @return Array of partitions
     */
    function getPartitionsOf(address holder) external view returns (bytes32[] memory) {
        return partitionsOf[holder];
    }
    
    /**
     * @notice Gets document information
     * @param name Document identifier
     * @return uri Document location
     * @return documentHash Document hash
     * @return timestamp When added
     * @return docType Document type
     */
    function getDocument(bytes32 name) external view returns (
        string memory uri,
        bytes32 documentHash,
        uint256 timestamp,
        string memory docType
    ) {
        Document memory doc = documents[name];
        return (doc.uri, doc.documentHash, doc.timestamp, doc.docType);
    }
    
    /**
     * @notice Gets all document names
     * @return Array of document identifiers
     */
    function getAllDocuments() external view returns (bytes32[] memory) {
        return documentNames;
    }
    
    // ============ Emergency Functions ============
    
    /**
     * @notice Activates emergency stop
     */
    function activateEmergencyStop() external onlyRole(CONTROLLER_ROLE) {
        require(!emergencyStop, "Already activated");
        emergencyStop = true;
        lastEmergencyTimestamp = block.timestamp;
        emit EmergencyStopActivated(msg.sender, block.timestamp);
    }
    
    /**
     * @notice Deactivates emergency stop
     */
    function deactivateEmergencyStop() external onlyRole(CONTROLLER_ROLE) {
        require(emergencyStop, "Not activated");
        require(block.timestamp >= lastEmergencyTimestamp + 1 hours, "Too soon");
        emergencyStop = false;
        emit EmergencyStopDeactivated(msg.sender, block.timestamp);
    }
    
    /**
     * @notice Emergency withdrawal of stuck funds
     * @param to Recipient address
     * @param amount Amount to withdraw
     */
    function emergencyWithdraw(
        address payable to,
        uint256 amount
    ) external onlyRole(DEFAULT_ADMIN_ROLE) validAddress(to) nonReentrant {
        require(emergencyStop, "Not in emergency");
        require(amount <= address(this).balance, "Insufficient balance");
        
        (bool success, ) = to.call{value: amount}("");
        require(success, "Transfer failed");
        
        emit EmergencyWithdrawal(to, amount);
    }
    
    // ============ Internal Functions ============
    
    /**
     * @notice Hook called before token transfer
     */
    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 amount
    ) internal override(ERC20Upgradeable, ERC20SnapshotUpgradeable) whenNotPaused notInEmergency {
        if (from != address(0) && to != address(0)) {
            require(investors[from].isActive, "Sender not registered");
            require(investors[to].isActive, "Recipient not registered");
            require(investors[from].kycExpiry > block.timestamp, "Sender KYC expired");
            require(investors[to].kycExpiry > block.timestamp, "Recipient KYC expired");
            require(allowedJurisdictions[investors[to].jurisdictionCode], "Recipient jurisdiction not allowed");
            
            uint256 toBalance = balanceOf(to);
            require(
                toBalance + amount >= minInvestmentAmount || toBalance + amount == 0,
                "Below minimum investment"
            );
            require(toBalance + amount <= maxInvestmentAmount, "Exceeds maximum investment");
            
            if (balanceOf(from) == amount) currentHolders--;
            if (toBalance == 0) {
                currentHolders++;
                require(currentHolders <= maxHolders, "Max holders reached");
            }
        }
        
        super._beforeTokenTransfer(from, to, amount);
    }
    
    /**
     * @notice Adds partition to holder
     */
    function _addPartitionToHolder(address holder, bytes32 partition) internal {
        bytes32[] storage holderPartitions = partitionsOf[holder];
        bool exists = false;
        
        for (uint256 i = 0; i < holderPartitions.length; i++) {
            if (holderPartitions[i] == partition) {
                exists = true;
                break;
            }
        }
        
        if (!exists) {
            holderPartitions.push(partition);
        }
    }
    
    /**
     * @notice Removes partition from holder
     */
    function _removePartitionFromHolder(address holder, bytes32 partition) internal {
        bytes32[] storage holderPartitions = partitionsOf[holder];
        for (uint256 i = 0; i < holderPartitions.length; i++) {
            if (holderPartitions[i] == partition) {
                holderPartitions[i] = holderPartitions[holderPartitions.length - 1];
                holderPartitions.pop();
                break;
            }
        }
    }
    
    // ============ Admin Functions ============
    
    /**
     * @notice Pauses all token transfers
     */
    function pause() external onlyRole(CONTROLLER_ROLE) {
        _pause();
    }
    
    /**
     * @notice Unpauses token transfers
     */
    function unpause() external onlyRole(CONTROLLER_ROLE) {
        _unpause();
    }
    
    /**
     * @notice Authorizes contract upgrade
     * @param newImplementation New implementation address
     */
    function _authorizeUpgrade(address newImplementation) internal override onlyRole(UPGRADER_ROLE) {}
    
    /**
     * @notice Receives ETH for dividends
     */
    receive() external payable {
        require(msg.value > 0, "Zero value");
    }
}