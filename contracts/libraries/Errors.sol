// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @notice Custom errors for gas-efficient reverts
 * @dev Using custom errors saves ~50 gas per revert compared to string errors
 */

// Token errors
error InvalidAddress();
error InvalidAmount();
error InsufficientBalance();
error AddressFrozen();
error IdentityNotVerified();
error TransferNotCompliant();
error NoTokensToRecover();
error SameAddresses();
error ArrayLengthMismatch();
error BatchSizeTooLarge();
error InsufficientFrozenTokens();

// Access control errors
error NotAuthorized();
error OnlyAdmin();
error OnlyAgent();
error OnlyOwner();

// Asset errors
error AssetNotActive();
error AssetAlreadyExists();
error InvalidAssetStatus();
error InvalidAttributeType();

// Dividend errors
error InvalidDividend();
error AlreadyClaimed();
error NoAssetTokensAtSnapshot();
error AmountLessThanMinimum();
error TransferFailed();
error MinAmountZero();

// Compliance errors
error ModuleNotBound();
error ModuleAlreadyBound();

// Registry errors
error InvalidRegistry();
error NotVerified();