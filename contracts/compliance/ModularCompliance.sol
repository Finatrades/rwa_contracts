// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "./ICompliance.sol";
import "./modular/IModule.sol";
import "../token/IToken.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

/**
 * @title ModularCompliance
 * @author Finatrades
 * @notice Modular compliance system for ERC-3643 security tokens
 * @dev Implements a flexible compliance framework with pluggable modules
 * 
 * @custom:security-contact security@finatrades.com
 * 
 * This contract serves as the central compliance engine for the token system.
 * It allows for dynamic addition and removal of compliance modules, each
 * implementing specific regulatory requirements.
 * 
 * Key features:
 * - Dynamic module management (add/remove at runtime)
 * - Module execution in sequence with AND logic
 * - Transfer validation before execution
 * - Post-transfer state updates
 * - Emergency pause functionality
 * 
 * Compliance flow:
 * 1. Token calls canTransfer() before any transfer
 * 2. Each active module is checked in sequence
 * 3. All modules must approve for transfer to proceed
 * 4. After transfer, transferred() updates module states
 */
contract ModularCompliance is ICompliance, Initializable, AccessControlUpgradeable, UUPSUpgradeable {
    bytes32 public constant OWNER_ROLE = keccak256("OWNER_ROLE");
    bytes32 public constant UPGRADER_ROLE = keccak256("UPGRADER_ROLE");
    
    IModule[] public modules;
    mapping(address => bool) public moduleBound;
    IToken public token;
    
    event ModuleAdded(address indexed module);
    event ModuleRemoved(address indexed module);
    event ModuleInteraction(address indexed target, bytes4 selector);
    
    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }
    
    function initialize(address _admin) public initializer {
        __AccessControl_init();
        __UUPSUpgradeable_init();
        
        _grantRole(DEFAULT_ADMIN_ROLE, _admin);
        _grantRole(OWNER_ROLE, _admin);
        _grantRole(UPGRADER_ROLE, _admin);
    }
    
    function bindToken(address _token) external override onlyRole(OWNER_ROLE) {
        require(_token != address(0), "Invalid token address");
        token = IToken(_token);
        emit TokenBound(_token);
    }
    
    function unbindToken(address _token) external override onlyRole(OWNER_ROLE) {
        require(_token == address(token), "Token not bound");
        token = IToken(address(0));
        emit TokenUnbound(_token);
    }
    
    function addModule(address _module) external onlyRole(OWNER_ROLE) {
        require(!moduleBound[_module], "Module already added");
        require(_module != address(0), "Invalid module address");
        
        modules.push(IModule(_module));
        moduleBound[_module] = true;
        
        emit ModuleAdded(_module);
    }
    
    function removeModule(address _module) external onlyRole(OWNER_ROLE) {
        require(moduleBound[_module], "Module not found");
        
        uint256 length = modules.length;
        for (uint256 i = 0; i < length; i++) {
            if (address(modules[i]) == _module) {
                modules[i] = modules[length - 1];
                modules.pop();
                break;
            }
        }
        
        moduleBound[_module] = false;
        emit ModuleRemoved(_module);
    }
    
    function isTransferValid(
        address _from,
        address _to,
        uint256 _amount
    ) external view override returns (bool) {
        for (uint256 i = 0; i < modules.length; i++) {
            if (!modules[i].isTransferValid(_from, _to, _amount)) {
                return false;
            }
        }
        return true;
    }
    
    function canTransfer(
        address _from,
        address _to,
        uint256 _amount
    ) external view override returns (bool) {
        if (modules.length == 0) {
            return true;
        }
        
        for (uint256 i = 0; i < modules.length; i++) {
            if (!modules[i].canTransfer(_from, _to, _amount)) {
                return false;
            }
        }
        return true;
    }
    
    function transferred(
        address _from,
        address _to,
        uint256 _amount
    ) external override {
        require(msg.sender == address(token), "Only token can call");
        
        for (uint256 i = 0; i < modules.length; i++) {
            modules[i].transferred(_from, _to, _amount);
        }
    }
    
    function created(address _to, uint256 _amount) external override {
        require(msg.sender == address(token), "Only token can call");
        
        for (uint256 i = 0; i < modules.length; i++) {
            modules[i].created(_to, _amount);
        }
    }
    
    function destroyed(address _from, uint256 _amount) external override {
        require(msg.sender == address(token), "Only token can call");
        
        for (uint256 i = 0; i < modules.length; i++) {
            modules[i].destroyed(_from, _amount);
        }
    }
    
    function getModules() external view returns (IModule[] memory) {
        return modules;
    }
    
    function _authorizeUpgrade(address newImplementation) internal override onlyRole(UPGRADER_ROLE) {}
}