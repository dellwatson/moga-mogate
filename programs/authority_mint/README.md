# Authority Mint Faucet Program

**⚠️ DEVNET TESTING ONLY - DO NOT USE ON MAINNET!**

Simple NFT faucet program that allows anyone to mint NFTs from a collection for testing purposes.

## Purpose

This program is designed for **testing stage-2** (collection creation and minting) without needing to deploy the full raffle/direct-sell programs. It allows:

- ✅ Any user to mint NFTs from a collection
- ✅ Testing collection verification
- ✅ Testing metadata from GitHub URLs
- ✅ Simulating multiple users minting

## How It Works

1. Program has collection authority delegated to it (via Metaplex)
2. Any user can call `mint_nft` with metadata URL
3. Program mints NFT to the user's wallet
4. NFT is created with collection reference (not verified yet)

## Usage

### 1. Build and Deploy

```bash
# Build the program
anchor build

# Deploy to devnet
anchor deploy --provider.cluster devnet --program-name authority_mint
```

### 2. Create a Collection

```bash
# Create a collection first
bun run scripts/2-create-prize-collection.ts luxury
```

### 3. Mint NFTs via Faucet

```bash
# Mint an NFT to your wallet
bun run scripts/6-faucet-mint-nft.ts luxury

# Try with different collection types
bun run scripts/6-faucet-mint-nft.ts travel-sft
bun run scripts/6-faucet-mint-nft.ts travel-1of1
```

### 4. Test with Different Wallets

```bash
# Switch to a different wallet
export WALLET_PATH=~/.config/solana/test-wallet.json

# Mint to the new wallet
bun run scripts/6-faucet-mint-nft.ts luxury
```

## Program Instructions

### `mint_nft`

Mints a new NFT to the caller's wallet.

**Arguments:**
- `name: String` - NFT name (max 32 chars)
- `symbol: String` - NFT symbol (max 10 chars)  
- `uri: String` - Metadata URI (GitHub raw URL)

**Accounts:**
- `payer` - User who receives the NFT (signer)
- `authority` - Program authority PDA
- `collection_mint` - Collection mint address
- `mint` - New NFT mint (PDA per user)
- `token_account` - User's token account
- `metadata` - Metaplex metadata account
- `master_edition` - Metaplex master edition account

## Architecture

```
User Wallet
    │
    ├─> calls mint_nft(name, symbol, uri)
    │
    v
Authority Mint Program
    │
    ├─> Mints 1 token to user
    ├─> Creates Metaplex metadata
    ├─> Creates master edition (NFT)
    └─> References collection (not verified)
```

## Limitations

- ⚠️ NFTs are **not verified** in the collection (requires collection authority delegation)
- ⚠️ Each user can only mint **one NFT per collection** (PDA seed: `[b"mint", user_pubkey]`)
- ⚠️ No rate limiting or access control (anyone can mint)

## Security

**This program is intentionally insecure for testing purposes:**

- ❌ No access control
- ❌ No rate limiting
- ❌ No payment required
- ❌ Anyone can mint unlimited NFTs (one per wallet)

**DO NOT USE ON MAINNET!**

## Next Steps

After testing with this faucet:

1. Deploy your actual programs (`rwa_raffle`, `direct_sell`)
2. Delegate collection authority to those programs
3. Use proper minting logic with payment/raffle mechanics
4. Remove this faucet program from production

## Example Output

```bash
$ bun run scripts/6-faucet-mint-nft.ts luxury

🎫 Faucet Mint NFT (Testing)

Collection Type: luxury
Network: devnet
RPC: https://api.devnet.solana.com

Collection Mint: 7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU
Wallet: 2mdvoXMrxTPyqq9ETxAf7YLgLU7GHdefR88SLvQ5xC7r
Balance: 9.793 SOL

📝 Fetching NFT Metadata
────────────────────────────────────────────────────────────
URL: https://raw.githubusercontent.com/dellwatson/moga-mogate/refs/heads/master/metadata/nfts/luxury/1of1-rolex-submariner-blue.json
✅ Metadata fetched
   Name: Rolex Submariner Blue Dial - 41mm
   Symbol: LUXURY-WATCH

🚀 Minting NFT via Faucet Program...
────────────────────────────────────────────────────────────
✅ NFT Minted!
   Transaction: 5xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU
   Mint Address: 8vw3bLHJPQWBXmBwHNmNvk5FjKKQMKhCKqPNdHvDqJPz
   Owner: 2mdvoXMrxTPyqq9ETxAf7YLgLU7GHdefR88SLvQ5xC7r

🔗 View on Solana Explorer:
   https://explorer.solana.com/address/8vw3bLHJPQWBXmBwHNmNvk5FjKKQMKhCKqPNdHvDqJPz?cluster=devnet
```
