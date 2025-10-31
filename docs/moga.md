# MOGA Token (Token-2022)

- **Standard**: SPL Token-2022
- **Mint (dev placeholder)**: `Moga111111111111111111111111111111111111111`
- **Decimals**: `6`
- **Extensions (future options)**:
  - TransferHook (compliance/policy)
  - NonTransferable (lock deposits)
  - DefaultAccountState
  - MintCloseAuthority
  - MetadataPointer

Notes:
- The above mint is a placeholder for docs/testing. For localnet, mint a real Token-2022 MOGA and use its address.
- Our program supports both Token and Token-2022 via `token_interface`, but we standardize on Token-2022.
