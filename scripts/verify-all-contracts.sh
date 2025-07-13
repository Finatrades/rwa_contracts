#!/bin/bash

echo "🔍 Verifying all contracts on Polygonscan..."

# Core contracts
echo "1. Verifying ClaimTopicsRegistry..."
npx hardhat verify --network polygon 0x315a3f5d4a482204eA7EaE89D05e64b6B90a919E

echo "2. Verifying IdentityRegistry..."
npx hardhat verify --network polygon 0x1D6f1Ca3Df3d601A079E02dCaBd809D5Bd95fe80

echo "3. Verifying ClaimIssuer..."
npx hardhat verify --network polygon 0x55106CFA1217A15A6bcedc7dFf9Ca0897f4E378a

echo "4. Verifying CountryRestrictModule..."
npx hardhat verify --network polygon 0x952E87D7f2f5FDe3f387bE9bd6CE59Ad98BbD3A7

echo "5. Verifying TransferLimitModule..."
npx hardhat verify --network polygon 0xAC4d1d37b307DE646A82A65F9a19a5a54F4D8f00

echo "6. Verifying MaxBalanceModule..."
npx hardhat verify --network polygon 0x60540b959652Ef4E955385C6E28529520a25dcd2

echo "7. Verifying ModularCompliance..."
npx hardhat verify --network polygon 0x9Db249617E876c18248Bf5Cd1289fA33A725170d

echo "8. Verifying FinatradesRWA_ERC3643..."
npx hardhat verify --network polygon 0x10375fdf730D39774eF1fD20424CD0504ef35afb

echo "9. Verifying Timelock..."
npx hardhat verify --network polygon 0xc929923D0d52Df0b72C8cf00C7c6156DB24232dE \
  172800 \
  '["0xCE982AC6bc316Cf9d875652B84C7626B62a899eA","0x0000000000000000000000000000000000000000"]' \
  '["0xCE982AC6bc316Cf9d875652B84C7626B62a899eA"]' \
  0xCE982AC6bc316Cf9d875652B84C7626B62a899eA

echo "✅ Verification complete!"