#!/bin/bash

echo "🔍 Verifying contracts on Polygonscan with rate limiting..."

# Function to wait between verifications
wait_for_rate_limit() {
    echo "⏳ Waiting 3 seconds to avoid rate limit..."
    sleep 3
}

# Try to verify each contract individually
echo "Attempting to verify ClaimTopicsRegistry..."
npx hardhat verify --network polygon 0x315a3f5d4a482204eA7EaE89D05e64b6B90a919E 2>/dev/null || echo "Already verified or proxy contract"
wait_for_rate_limit

echo "Attempting to verify IdentityRegistry..."
npx hardhat verify --network polygon 0x1D6f1Ca3Df3d601A079E02dCaBd809D5Bd95fe80 2>/dev/null || echo "Already verified or proxy contract"
wait_for_rate_limit

echo "Attempting to verify ClaimIssuer..."
npx hardhat verify --network polygon 0x55106CFA1217A15A6bcedc7dFf9Ca0897f4E378a 2>/dev/null || echo "Already verified or proxy contract"
wait_for_rate_limit

echo "Attempting to verify CountryRestrictModule..."
npx hardhat verify --network polygon 0x952E87D7f2f5FDe3f387bE9bd6CE59Ad98BbD3A7 2>/dev/null || echo "Already verified or proxy contract"
wait_for_rate_limit

echo "Attempting to verify TransferLimitModule..."
npx hardhat verify --network polygon 0xAC4d1d37b307DE646A82A65F9a19a5a54F4D8f00 2>/dev/null || echo "Already verified or proxy contract"
wait_for_rate_limit

echo "Attempting to verify MaxBalanceModule..."
npx hardhat verify --network polygon 0x60540b959652Ef4E955385C6E28529520a25dcd2 2>/dev/null || echo "Already verified or proxy contract"
wait_for_rate_limit

echo "Attempting to verify ModularCompliance..."
npx hardhat verify --network polygon 0x9Db249617E876c18248Bf5Cd1289fA33A725170d 2>/dev/null || echo "Already verified or proxy contract"
wait_for_rate_limit

echo "Attempting to verify FinatradesRWA_ERC3643..."
npx hardhat verify --network polygon 0x10375fdf730D39774eF1fD20424CD0504ef35afb 2>/dev/null || echo "Already verified or proxy contract"
wait_for_rate_limit

echo "Attempting to verify Timelock with constructor args..."
npx hardhat verify --network polygon 0xc929923D0d52Df0b72C8cf00C7c6156DB24232dE \
  172800 \
  '["0xCE982AC6bc316Cf9d875652B84C7626B62a899eA","0x0000000000000000000000000000000000000000"]' \
  '["0xCE982AC6bc316Cf9d875652B84C7626B62a899eA"]' \
  0xCE982AC6bc316Cf9d875652B84C7626B62a899eA 2>/dev/null || echo "Already verified or needs different args format"

echo "
✅ Verification attempts complete!

Note: Many contracts may already be verified on Polygonscan.
Proxy contracts need special handling for verification.

You can check verification status at:
https://polygonscan.com/address/CONTRACT_ADDRESS#code

Main Token Contract:
https://polygonscan.com/address/0x10375fdf730D39774eF1fD20424CD0504ef35afb#code
"