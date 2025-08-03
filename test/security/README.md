# Security Test Suite

This directory contains comprehensive security-focused tests designed to verify the robustness and safety of the Finatrades RWA smart contracts. These tests are specifically crafted to address common security concerns and demonstrate the contract's resilience against various attack vectors.

## Test Categories

### 1. Access Control Tests (`AccessControl.test.js`)
- **Purpose**: Verify that all privileged functions are properly protected
- **Coverage**: 
  - Role-based access control (RBAC) enforcement
  - Unauthorized access prevention
  - Role hierarchy validation
  - Critical function protection
  - Upgrade access control

### 2. Reentrancy Protection Tests (`ReentrancyGuard.test.js`)
- **Purpose**: Ensure protection against reentrancy attacks
- **Coverage**:
  - Dividend claim reentrancy protection
  - Transfer callback safety
  - Cross-function reentrancy prevention
  - State consistency during external calls
  - Check-Effects-Interactions pattern verification

### 3. Edge Cases and Boundary Tests (`EdgeCases.test.js`)
- **Purpose**: Test system behavior at extreme values and edge conditions
- **Coverage**:
  - Zero value operations
  - Maximum value handling
  - Address edge cases (zero address, self-transfers)
  - Balance boundaries
  - Freezing edge cases
  - Asset management boundaries
  - Dividend rounding and precision
  - Compliance module edge cases

### 4. System Invariants Tests (`Invariants.test.js`)
- **Purpose**: Verify that critical system properties are always maintained
- **Coverage**:
  - Supply invariants (total supply = sum of balances)
  - Balance invariants (no negative balances)
  - Identity and compliance invariants
  - Dividend distribution invariants
  - Asset management invariants
  - Snapshot immutability
  - Role system invariants
  - Pause state invariants

### 5. Overflow/Underflow Protection Tests (`OverflowUnderflow.test.js`)
- **Purpose**: Verify arithmetic safety and protection against numeric errors
- **Coverage**:
  - Supply overflow protection
  - Balance underflow protection
  - Frozen balance arithmetic safety
  - Asset balance calculations
  - Dividend calculation safety
  - Timestamp handling
  - Compliance module calculations
  - Edge value arithmetic (0, 1 wei, max values)

## Running Security Tests

```bash
# Run all security tests
npx hardhat test test/security/*.test.js

# Run specific test category
npx hardhat test test/security/AccessControl.test.js
npx hardhat test test/security/ReentrancyGuard.test.js
npx hardhat test test/security/EdgeCases.test.js
npx hardhat test test/security/Invariants.test.js
npx hardhat test test/security/OverflowUnderflow.test.js

# Run with gas reporting
REPORT_GAS=true npx hardhat test test/security/*.test.js

# Run with coverage
npx hardhat coverage --testfiles "test/security/*.test.js"
```

## Key Security Properties Verified

1. **Access Control**
   - All administrative functions require appropriate roles
   - Role hierarchy is properly enforced
   - Unauthorized users cannot perform privileged operations

2. **State Consistency**
   - State changes follow Check-Effects-Interactions pattern
   - No unexpected state modifications during external calls
   - Invariants are maintained across all operations

3. **Numeric Safety**
   - All arithmetic operations are protected against overflow/underflow
   - Balance calculations maintain precision
   - No loss of funds due to rounding errors

4. **Reentrancy Protection**
   - External calls cannot re-enter sensitive functions
   - State is properly updated before external interactions
   - No vulnerability to recursive calls

5. **Edge Case Handling**
   - System behaves correctly at boundary values
   - Zero values are handled appropriately
   - Maximum values don't cause unexpected behavior

## Audit Considerations

These tests demonstrate:
- Comprehensive coverage of security-critical functionality
- Proactive identification and testing of potential vulnerabilities
- Adherence to security best practices
- Robust handling of edge cases and exceptional conditions

The test suite serves as both verification of security properties and documentation of expected behavior under various conditions.

## Test Maintenance

When modifying contracts:
1. Update relevant security tests to cover new functionality
2. Add new edge cases for any new features
3. Verify all invariants still hold
4. Ensure new code paths are tested for security vulnerabilities
5. Run the full security test suite before deployment