# Minting Instructions

## Gateway V2 Deployed! ✅

**Program:** `mogate_authority_mint_v2.aleo`  
**TX ID:** `at1h5uauul7hvn63qpka495vxtpglgvfjkp4y5eh06cdwqwtrznwv8qrkl2uj`  
**Status:** PUBLIC - Anyone can mint!

## How to Mint

### Option 1: Using Leo CLI (Recommended)

```bash
cd programs/authority_mint_gateway

# Mint with specific token ID
leo execute --network testnet --endpoint https://api.provable.com/v2 \
  mint \
  "aleo1yv0wuzhwr68dkstlcl4keu4j6s0d3fzhqz0fzge6fz4w3wjwmq9s6jza3u" \
  "123456789field" \
  "1769768300000u64" \
  --broadcast https://api.provable.com/v2/testnet/transaction/broadcast
```

### Option 2: Using Deploy Script

```bash
cd programs/authority_mint_gateway
./deploy-cli-broadcast.sh
```

Then select "execute" instead of "deploy"

## Functions Available

### 1. `mint` - Specific Token ID

```leo
mint(
  to: address,           // Recipient address
  uri_hash: field,       // NFT metadata hash
  token_id: u64          // Specific token ID (use Unix timestamp)
)
```

### 2. `mint_nft` - Auto-increment Token ID

```leo
mint_nft(
  to: address,           // Recipient address
  uri_hash: field        // NFT metadata hash
)
```

### 3. `mint_with_signature` - Placeholder (Not Implemented Yet)

```leo
mint_with_signature(
  to: address,
  uri_hash: field,
  token_id: u64,
  signature: signature   // TODO: Implement verification
)
```

## Notes

- ✅ **No initialization needed** - Gateway works immediately after deployment
- ✅ **Public access** - Anyone can call mint functions
- ✅ **Cross-contract calls** - Gateway calls collection contract
- ⚠️ **Signature verification** - Coming soon

## Troubleshooting

If you get parsing errors with `snarkos`, use `leo execute` instead. The Leo CLI handles input parsing better.

## Next Steps

1. Test minting with `leo execute`
2. Implement signature verification in `mint_with_signature`
3. Add rate limiting or other access controls if needed
