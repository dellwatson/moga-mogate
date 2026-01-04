# Casper NFT Scripts

## Active Scripts (Clean Version)

### 1. Delegate Mint

Mint NFT via Authority Mint V2 to PUBLIC CEP-95 collection.

```bash
node delegate-mint.js <token-id>
```

**Example:**

```bash
node delegate-mint.js 1000
```

### 2. Burn NFT

Burn an NFT and create a proof with metadata.

```bash
node burn-nft.js <token-id> <mint-deploy-hash>
```

**Example:**

```bash
node burn-nft.js 502 6cfa40c65ed8ee2057a34f2be65e5c802f647c4573c90f4f12e12ade74f43611
```

### 3. Verify Burn

Verify a burn transaction from just the deploy hash.

```bash
./verify-burn.sh <burn-deploy-hash>
```

**Example:**

```bash
./verify-burn.sh a8d89548c8307601cc5d579f7a2ac7b8c27f32292444cafbdc9ce2de55959441
```

## Contract Information

**PUBLIC CEP-95:**

- Contract Hash: `hash-4062978348fc7e42473c496bf67143e01c748cc279a92f2cf6487043355b0739`
- Package Hash: `contract-package-d5deb2361811d88a5ea274ce232fb400d676c187470b70b90242389a4d095ce9`

**Authority Mint V2:**

- Contract Hash: `hash-187345749048e98e2ecbbc4acbc2221a04c6a121cc8c32ddf12aaa706d3f7ef2`
- Package Hash: `hash-416204f80a9d08843d15035dd5bc4344133cd9da15d57aec7cf69ad0c418cbed`

## Workflow

1. **Mint NFT** → `delegate-mint.js` → Get deploy hash
2. **Wait 1-2 minutes** → Check on explorer
3. **Burn NFT** → `burn-nft.js` → Provide mint deploy hash
4. **Verify Burn** → `verify-burn.sh` → Confirm burn success

## Archive

Old/unused scripts are in `archive/` folder.
