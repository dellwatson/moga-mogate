# Aleo Smart Contracts Migration

This directory contains the Aleo Leo programs migrated from the original Solidity contracts.

## Overview

The migration transforms EVM-based NFT contracts into privacy-preserving Aleo programs using the Leo language.

## Programs

### 1. Collection (`collection.aleo`)

**Original**: `contracts/Collection.sol`  
**Location**: `aleo_contracts/collection/src/main.leo`

NFT collection program with role-based access control and minting capabilities.

#### Key Features:

- **NFT Records**: Private NFT ownership using Aleo's record model
- **Role Management**: Owner, operators, and minters
- **Minting**: Auto-increment or specific token ID minting
- **Transfer & Burn**: Standard NFT operations
- **Public Mappings**: Track token ownership and metadata on-chain

#### Main Transitions:

- `initialize(owner)` - Initialize collection with owner
- `set_operator(operator, allowed)` - Manage operator permissions
- `set_minter(minter, allowed)` - Manage minter permissions
- `mint_to(to, uri_hash)` - Mint with auto-incrementing ID
- `mint_with_token_id(to, token_id, uri_hash)` - Mint with specific ID
- `transfer(nft, to)` - Transfer NFT ownership
- `burn(nft)` - Burn NFT

### 2. Authority Mint Gateway (`authority_mint_gateway.aleo`)

**Original**: `contracts/AuthorityMintGateway.sol`  
**Location**: `aleo_contracts/authority_mint_gateway/src/main.leo`

Gateway program for managing cross-collection minting authority.

#### Key Features:

- **Collection Allowlist**: Owner-controlled collection permissions
- **Authority Minting**: Owner-only controlled mints
- **Faucet Mode**: Open-access minting for testing (`mint_nft`)

#### Main Transitions:

- `initialize(owner)` - Initialize gateway with owner
- `set_collection_allowed(collection, allowed)` - Manage allowed collections
- `mint(collection, to, uri_hash, token_id)` - Authority mint (owner + allowlist check)
- `mint_nft(collection, to, uri_hash, token_id)` - Faucet mint (no checks)

## Key Differences from Solidity

### 1. **Privacy by Default**

- Aleo uses **records** for private state (NFT ownership)
- Public mappings for on-chain queryable data
- Users hold NFT records privately in their wallets

### 2. **URI Storage**

- URIs stored as `field` (hash) instead of strings
- Off-chain storage recommended for full metadata
- Use IPFS/Arweave hash converted to field element

### 3. **No Events**

- Aleo doesn't have events like Solidity
- Use public mappings for queryable state
- Off-chain indexers can track state changes

### 4. **Access Control**

- Implemented via public mappings and assertions
- `self.caller` equivalent to `msg.sender`
- Finalize blocks handle public state validation

### 5. **Two-Phase Execution**

- **Transition**: Executes off-chain, creates records
- **Finalize**: Executes on-chain, updates public state
- Enables privacy + public state coexistence

## Installation & Setup

### Prerequisites

```bash
# Install Aleo CLI
curl -L https://raw.githubusercontent.com/AleoHQ/aleo/testnet3/install.sh | bash

# Install Leo
cargo install leo-lang

# Verify installation
leo --version
aleo --version
```

### Build Programs

```bash
# Build collection program
cd aleo_contracts/collection
leo build

# Build authority mint gateway
cd ../authority_mint_gateway
leo build
```

### Run Tests

```bash
# Test collection
cd aleo_contracts/collection
leo run initialize aleo1...

# Test minting
leo run mint_to aleo1... 12345field
```

## Deployment

### 1. Deploy Collection

```bash
cd aleo_contracts/collection

# Deploy to testnet
snarkos developer deploy \
  --private-key <YOUR_PRIVATE_KEY> \
  --query https://api.explorer.aleo.org/v1 \
  --path . \
  --broadcast https://api.explorer.aleo.org/v1/testnet3/transaction/broadcast \
  --fee 1000000 \
  --record <FEE_RECORD>
```

### 2. Deploy Gateway

```bash
cd aleo_contracts/authority_mint_gateway

# Deploy to testnet
snarkos developer deploy \
  --private-key <YOUR_PRIVATE_KEY> \
  --query https://api.explorer.aleo.org/v1 \
  --path . \
  --broadcast https://api.explorer.aleo.org/v1/testnet3/transaction/broadcast \
  --fee 1000000 \
  --record <FEE_RECORD>
```

## Usage Examples

### Initialize Collection

```bash
leo run initialize aleo1owner...
```

### Set Minter Permission

```bash
leo run set_minter aleo1gateway... true
```

### Mint NFT

```bash
# Auto-increment ID
leo run mint_to aleo1recipient... 987654321field

# Specific ID
leo run mint_with_token_id aleo1recipient... 42u64 987654321field
```

### Transfer NFT

```bash
leo run transfer "{
  owner: aleo1...,
  token_id: 42u64,
  uri: 987654321field,
  collection: aleo1collection...
}" aleo1newowner...
```

### Gateway Mint

```bash
# Authority mint (requires owner + allowed collection)
leo run mint aleo1collection... aleo1recipient... 123456field 1u64

# Faucet mint (open access)
leo run mint_nft aleo1collection... aleo1recipient... 123456field 1u64
```

## URI Hash Conversion

Since Aleo uses `field` type for efficiency, convert URIs to field elements:

```javascript
// Example: Convert IPFS hash to field
const ipfsHash = "QmX..."; // Your IPFS hash
const fieldValue = hashToField(ipfsHash); // Implement hash function
```

Store mapping off-chain or use a separate metadata service.

## Migration Checklist

- [x] Collection contract → `collection.aleo`
- [x] AuthorityMintGateway → `authority_mint_gateway.aleo`
- [ ] Deploy to Aleo testnet
- [ ] Test all transitions
- [ ] Update frontend to use Aleo SDK
- [ ] Implement URI hash conversion
- [ ] Set up off-chain metadata storage
- [ ] Configure gateway permissions

## Resources

- **Aleo Docs**: https://developer.aleo.org/
- **Leo Language**: https://developer.aleo.org/leo/
- **Aleo SDK**: https://github.com/AleoHQ/sdk
- **Explorer**: https://explorer.aleo.org/

## Notes

1. **Gas/Fees**: Aleo uses credits for transaction fees, different from ETH gas
2. **Privacy**: NFT ownership is private by default, only revealed when needed
3. **Testing**: Use Leo's built-in testing framework for unit tests
4. **Mainnet**: Currently on testnet3, mainnet coming soon

## Next Steps

1. Test programs locally with Leo
2. Deploy to Aleo testnet
3. Integrate with frontend using Aleo SDK
4. Migrate remaining contracts (Raffle, etc.)
5. Update deployment scripts for Aleo

---

**Migration Status**: ✅ Core contracts migrated  
**Network**: Aleo Testnet3  
**Last Updated**: 2026-01-24
