# Polygon Mainnet - Fresh Deployment (July 2025)

## Summary
All 10 contracts have been freshly deployed to Polygon Mainnet for audit and production use.

## Deployed Contracts

| # | Contract | Proxy Address | Implementation | Purpose |
|---|----------|---------------|----------------|---------|
| 1 | ClaimTopicsRegistry | [`0xeCf537CADeBd2951776f3AC3c1e9b76218d6ecE4`](https://polygonscan.com/address/0xeCf537CADeBd2951776f3AC3c1e9b76218d6ecE4) | `0x0E5184813A774f32472F189260275cE1323a837F` | KYC/AML claim definitions |
| 2 | IdentityRegistry | [`0x59A1923E694061b9A49b2eC92AeeF99077f42532`](https://polygonscan.com/address/0x59A1923E694061b9A49b2eC92AeeF99077f42532) | `0xD2705bfE082dBD18a92a05cB91756b321c5C43Dc` | Investor identity management |
| 3 | ClaimIssuer | [`0x625986DD1A10859C7F6326eE50B9901D5AD82170`](https://polygonscan.com/address/0x625986DD1A10859C7F6326eE50B9901D5AD82170) | `0xC67E20354AaE72F669cdE0a66C37c1C5cc0dd752` | KYC/AML claim issuance |
| 4 | CountryRestrictModule | [`0x620818526106cc35ab598D2500632A62e0176619`](https://polygonscan.com/address/0x620818526106cc35ab598D2500632A62e0176619) | `0xCed593f751F1F93d1Dd3B8Cc571A7A221661B27B` | Country-based restrictions |
| 5 | TransferLimitModule | [`0xbb109a19000dF7ca3062161794405DAC026DB4E5`](https://polygonscan.com/address/0xbb109a19000dF7ca3062161794405DAC026DB4E5) | `0xDfD80d60BCA3D63190041b710380bA6Ab280f6E2` | Daily/monthly limits |
| 6 | MaxBalanceModule | [`0x64BC91aba0EF92F4565b076Ea1382B2d82d418cD`](https://polygonscan.com/address/0x64BC91aba0EF92F4565b076Ea1382B2d82d418cD) | `0xf7131BBB9a2e38Fab57b8D2FE3032cb1340a6170` | Maximum balance caps |
| 7 | ModularCompliance | [`0x115f87dC7bB192924069b4291DAF0Dcd39C0A76b`](https://polygonscan.com/address/0x115f87dC7bB192924069b4291DAF0Dcd39C0A76b) | `0x63684A1B79F57cD5eD3b89bA7D0BAE1339207C83` | Compliance orchestration |
| 8 | FinatradesRWA_ERC3643 | [`0x414A484985771C2CFDA215FB20C48ed037eE409b`](https://polygonscan.com/address/0x414A484985771C2CFDA215FB20C48ed037eE409b) | `0x9Ac29886373E517fe4806CC9D55Cd53b9AB7AC56` | Main security token |
| 9 | AssetRegistry | [`0xB678e16e773790B0FD56D36a516731dfA8761b77`](https://polygonscan.com/address/0xB678e16e773790B0FD56D36a516731dfA8761b77) | `0x3eb39039b860Fc8476A28aF1d33d51562bcBaa6d` | Universal asset registry |
| 10 | Timelock | [`0xCF3FA612F1eF813e31Af012B2D77eA8f3d191F82`](https://polygonscan.com/address/0xCF3FA612F1eF813e31Af012B2D77eA8f3d191F82) | N/A (non-proxy) | 48-hour governance delay |

## Key Information

- **Network**: Polygon Mainnet
- **Chain ID**: 137
- **Deployer**: `0xCE982AC6bc316Cf9d875652B84C7626B62a899eA`
- **Deployment Date**: July 13, 2025
- **Total Contracts**: 10
- **Contract Standard**: ERC-3643 (T-REX)
- **Upgrade Pattern**: UUPS

## For Auditors

1. All contracts are freshly deployed and configured
2. Implementation contracts are being verified on Polygonscan
3. Full ERC-3643 compliance implemented
4. Modular architecture allows adding/removing compliance rules
5. UUPS upgrade pattern with role-based access control
6. Timelock ensures 48-hour delay for critical operations

## For Web Developers

Key contracts to integrate:
- **Token**: `0x414A484985771C2CFDA215FB20C48ed037eE409b`
- **IdentityRegistry**: `0x59A1923E694061b9A49b2eC92AeeF99077f42532`
- **AssetRegistry**: `0xB678e16e773790B0FD56D36a516731dfA8761b77`
- **ModularCompliance**: `0x115f87dC7bB192924069b4291DAF0Dcd39C0A76b`

ABIs location: `artifacts/contracts/[ContractName].sol/[ContractName].json`

## Verification Status

Implementation contracts verification is in progress on Polygonscan. All proxy contracts are active and functioning.