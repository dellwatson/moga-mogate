# Flight NFT Minting Guide

## 🎯 Quick Reference

**Total Modes**: 15 (11 SFTs + 4 1/1s)  
**Total Supply**: 9,104 NFTs  
**All metadata**: GitHub-hosted (free, no Arweave costs for devnet)

## 📦 Minting Strategy

### Phase 1: SFT Credits (11 modes, 9,100 supply)

Mint in order of rarity (common → epic):

```typescript
// Common Tier (3,500 total)
await mintSFT("sft-credit-500-any.json", 2000);           // $500 Any Airline
await mintSFT("sft-credit-2000-southeast-asia.json", 1500); // $2000 SEA

// Uncommon Tier (3,900 total)
await mintSFT("sft-economy-domestic-indonesia.json", 1200); // Economy Indonesia
await mintSFT("sft-economy-asia-exclude-china.json", 1000); // Economy Asia
await mintSFT("sft-economy-exclude-usa-china.json", 900);   // Economy Worldwide
await mintSFT("sft-premium-economy-usa.json", 800);         // Premium Economy USA

// Rare Tier (1,250 total)
await mintSFT("sft-credit-8000-business.json", 500);        // $8000 Business
await mintSFT("sft-business-roundtrip-europe.json", 400);   // Business Europe RT
await mintSFT("sft-business-transatlantic.json", 350);      // Business Transatlantic

// Epic Tier (450 total)
await mintSFT("sft-first-class-middle-east.json", 250);     // First Class ME
await mintSFT("sft-first-class-15000.json", 200);           // $15000 First Class
```

### Phase 2: 1/1 Bookings (4 unique)

Mint legendary 1/1s:

```typescript
// Legendary Tier (4 unique)
await mint1of1("1of1-qatar-business-roundtrip.json");       // Qatar Business
await mint1of1("1of1-ana-first-nrt-lhr.json");              // ANA First
await mint1of1("1of1-emirates-first-dxb-jfk.json");         // Emirates First
await mint1of1("1of1-singapore-suites-sin-lax.json");       // Singapore Suites
```

## 🔧 Implementation

### SFT Minting Function

```typescript
async function mintSFT(filename: string, maxSupply: number) {
  const uri = `https://raw.githubusercontent.com/dellwatson/moga-mogate/main/metadata/nfts/flights/${filename}`;
  
  const { nft } = await metaplex.nfts().create({
    uri,
    name: "Flight Credit", // Will be overridden by metadata
    sellerFeeBasisPoints: 0,
    maxSupply,
    collection: travelSftCollection,
    collectionAuthority: collectionAuthority,
  });
  
  console.log(`✅ Minted SFT: ${filename} (${maxSupply} max supply)`);
  return nft;
}
```

### 1/1 Minting Function

```typescript
async function mint1of1(filename: string) {
  const uri = `https://raw.githubusercontent.com/dellwatson/moga-mogate/main/metadata/nfts/flights/${filename}`;
  
  const { nft } = await metaplex.nfts().create({
    uri,
    name: "Flight Booking", // Will be overridden by metadata
    sellerFeeBasisPoints: 0,
    maxSupply: 1,
    collection: travel1of1Collection,
    collectionAuthority: collectionAuthority,
  });
  
  console.log(`✅ Minted 1/1: ${filename}`);
  return nft;
}
```

## 📊 Supply Allocation

### Recommended Distribution

For a raffle with 10,000 entries:

| Tier | Modes | Supply | % | Raffle Allocation |
|------|-------|--------|---|-------------------|
| Common | 2 | 3,500 | 38.4% | 3,840 entries |
| Uncommon | 4 | 3,900 | 42.8% | 4,280 entries |
| Rare | 3 | 1,250 | 13.7% | 1,370 entries |
| Epic | 2 | 450 | 4.9% | 490 entries |
| Legendary | 4 | 4 | 0.04% | 4 entries (guaranteed winners) |

### Scaling to 12,000+

To increase supply to 12,000:

```typescript
// Increase common tier
await mintSFT("sft-credit-500-any.json", 3500);  // +1500
await mintSFT("sft-credit-2000-southeast-asia.json", 2500);  // +1000

// Total: 11,000+
```

## 🎲 Raffle Integration

### Prize Pool Setup

```typescript
const prizePool = [
  // Legendary (4 prizes)
  { uri: ONEOF1_SINGAPORE, weight: 1, rarity: "Legendary" },
  { uri: ONEOF1_EMIRATES, weight: 1, rarity: "Legendary" },
  { uri: ONEOF1_ANA, weight: 1, rarity: "Legendary" },
  { uri: ONEOF1_QATAR, weight: 1, rarity: "Legendary" },
  
  // Epic (450 prizes)
  { uri: SFT_15000_FIRST, weight: 200, rarity: "Epic" },
  { uri: SFT_FIRST_ME, weight: 250, rarity: "Epic" },
  
  // Rare (1,250 prizes)
  { uri: SFT_BIZ_TRANS, weight: 350, rarity: "Rare" },
  { uri: SFT_BIZ_EUROPE, weight: 400, rarity: "Rare" },
  { uri: SFT_8000_BIZ, weight: 500, rarity: "Rare" },
  
  // Uncommon (3,900 prizes)
  { uri: SFT_PREM_USA, weight: 800, rarity: "Uncommon" },
  { uri: SFT_ECO_WORLDWIDE, weight: 900, rarity: "Uncommon" },
  { uri: SFT_ECO_ASIA, weight: 1000, rarity: "Uncommon" },
  { uri: SFT_ECO_INDONESIA, weight: 1200, rarity: "Uncommon" },
  
  // Common (3,500 prizes)
  { uri: SFT_2000_SEA, weight: 1500, rarity: "Common" },
  { uri: SFT_500_ANY, weight: 2000, rarity: "Common" },
];
```

## 📝 Minting Script Template

```typescript
import { Metaplex, keypairIdentity } from "@metaplex-foundation/js";
import { Connection, Keypair } from "@solana/web3.js";

const BASE_URL = "https://raw.githubusercontent.com/dellwatson/moga-mogate/main/metadata/nfts/flights";

const SFT_MODES = [
  { file: "sft-credit-500-any.json", supply: 2000 },
  { file: "sft-credit-2000-southeast-asia.json", supply: 1500 },
  { file: "sft-economy-domestic-indonesia.json", supply: 1200 },
  { file: "sft-economy-asia-exclude-china.json", supply: 1000 },
  { file: "sft-economy-exclude-usa-china.json", supply: 900 },
  { file: "sft-premium-economy-usa.json", supply: 800 },
  { file: "sft-credit-8000-business.json", supply: 500 },
  { file: "sft-business-roundtrip-europe.json", supply: 400 },
  { file: "sft-business-transatlantic.json", supply: 350 },
  { file: "sft-first-class-middle-east.json", supply: 250 },
  { file: "sft-first-class-15000.json", supply: 200 },
];

const ONEOF1_MODES = [
  "1of1-qatar-business-roundtrip.json",
  "1of1-ana-first-nrt-lhr.json",
  "1of1-emirates-first-dxb-jfk.json",
  "1of1-singapore-suites-sin-lax.json",
];

async function mintAllFlights() {
  console.log("🚀 Minting Flight NFTs\n");
  
  // Mint SFTs
  console.log("📦 Minting SFT Credits...");
  for (const mode of SFT_MODES) {
    await mintSFT(mode.file, mode.supply);
  }
  
  // Mint 1/1s
  console.log("\n🎯 Minting 1/1 Bookings...");
  for (const mode of ONEOF1_MODES) {
    await mint1of1(mode);
  }
  
  console.log("\n✅ All flights minted!");
  console.log(`Total: ${SFT_MODES.reduce((a, b) => a + b.supply, 0) + ONEOF1_MODES.length} NFTs`);
}

mintAllFlights().catch(console.error);
```

## 🎨 Image Placeholders (Optional for Devnet)

For devnet testing, you can use placeholder images:

```typescript
// In metadata JSON, use placeholder service
"image": "https://via.placeholder.com/500x500.png?text=Flight+Credit+$500"

// Or create simple colored squares
"image": "https://placehold.co/500x500/0ea5e9/white?text=Business+Class"
```

For production, upload actual images to `metadata/images/flights/` and push to GitHub.

## ✅ Verification

After minting, verify:

```bash
# Check metadata loads
curl https://raw.githubusercontent.com/dellwatson/moga-mogate/main/metadata/nfts/flights/sft-credit-500-any.json

# Verify on Solana Explorer
# https://explorer.solana.com/address/[MINT_ADDRESS]?cluster=devnet
```

## 🚀 Next Steps

1. **Push metadata to GitHub**
   ```bash
   git add metadata/
   git commit -m "Add flight NFT metadata"
   git push origin main
   ```

2. **Create minting script**
   - Use template above
   - Add to `scripts/4-mint-flight-nfts.ts`

3. **Test on devnet**
   - Mint a few samples first
   - Verify metadata displays correctly

4. **Scale for production**
   - Add real images
   - Increase supplies as needed
   - Deploy to mainnet

## 📞 Support

All flights created by: **emiless.com**  
Redeemable at: **https://emiless.com**
