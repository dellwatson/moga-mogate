# Collection Scripts

Scripts for managing the mogate_nft_collection_rwa.aleo program.

## Scripts

### `init-collection.sh`

Initialize the collection and set up the gateway as an authorized minter.

**Usage:**

```bash
cd /Users/dellwatson/Desktop/nov2025/mogate-rwa-raffle-monorepo-ALEO
./scripts/collection/init-collection.sh
```

**What it does:**

1. Initializes the collection with the owner address
2. Sets `mogate_authority_mint_v2.aleo` as an authorized minter

**Prerequisites:**

- Collection must be deployed first
- `.env` file must contain `PRIVATE_KEY`
- Owner must have enough credits for transaction fees (~0.005 credits)

**Configuration:**

Edit the script to change:

- `OWNER_ADDRESS`: The collection owner address
- `GATEWAY_PROGRAM`: The gateway program that can mint
- `ENDPOINT`: The Aleo API endpoint
- `NETWORK`: The network (testnet/mainnet)

---

### `burn-nft.sh`

Burn (permanently delete) an NFT from the collection.

**Usage:**

```bash
./scripts/collection/burn-nft.sh <TOKEN_ID> <OWNER_ADDRESS> <URI_HASH> <COLLECTION_ADDRESS>
```

**Example:**

```bash
./scripts/collection/burn-nft.sh 1 aleo1yv0wuzhwr68dkstlcl4tcw7rs6wynw86xnm7w9ume49t6gtnx5zqalxdf2 123456field mogate_nft_collection_rwa.aleo
```

**What it does:**

- Removes the NFT from the collection mappings
- Permanently deletes token ownership and URI data

**Prerequisites:**

- You must own the NFT record (private NFT data)
- You need: token_id, owner address, uri hash, and collection address

---

### `burn-nft-simple.js`

JavaScript version of the burn script for easier use.

**Usage:**

```bash
node scripts/collection/burn-nft-simple.js <TOKEN_ID> [OWNER] [URI_HASH]
```

**Example:**

```bash
node scripts/collection/burn-nft-simple.js 1
node scripts/collection/burn-nft-simple.js 1 aleo1yv0wuzhwr68dkstlcl4tcw7rs6wynw86xnm7w9ume49t6gtnx5zqalxdf2 123456field
```

**What it does:**

- Same as burn-nft.sh but with Node.js
- Defaults to standard owner address if not provided

---

### `query-nft.sh`

Query NFT information from the blockchain.

**Usage:**

```bash
./scripts/collection/query-nft.sh <TOKEN_ID>
```

**Example:**

```bash
./scripts/collection/query-nft.sh 1
```

**What it does:**

- Queries the token owner for a given token ID
- Queries the token URI for a given token ID
- Useful for verifying NFT data before burning

## Transaction IDs

### Initialize

- TX ID: `at1g90hnhd7ws896rpr4fzptkvvfkjtm8zaettf3gknevxyr537xqfqx2wfl9`
- Fee: 0.002317 credits

### Set Minter

- TX ID: `at12pfq0esar4m57mr2s2up6y3g5378ap98yjq8wmyxs2cndcaxvypqnq25xh`
- Fee: 0.002157 credits
- Minter: `mogate_authority_mint_v2.aleo` (address: `aleo1fy27eg3hhszp7stu6jp6a3z7tj0vup0e4v8el3p0dar26z9zp5zsxdlx46`)

## Notes

- The collection requires minter permissions - only authorized minters can mint NFTs
- This is NOT a public mint collection
- To add more minters, use: `leo execute set_minter <ADDRESS> true`
- To remove a minter, use: `leo execute set_minter <ADDRESS> false`
