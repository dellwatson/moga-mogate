# NFT Metadata Names Fixed - 32 Byte Limit

## The Issue

**Collections vs NFTs:**
- ✅ **Collection metadata** (stage-2a) - Fixed earlier ✓
- ❌ **NFT metadata** (stage-2b) - Was still too long!

**Each NFT** in the collection also has the same limits:
- Name: Max 32 bytes
- Symbol: Max 10 bytes

## What Was Fixed

### 1of1 Flight NFTs (Before → After)

| File | Old Name | Bytes | New Name | Bytes |
|------|----------|-------|----------|-------|
| qatar-business | `🇶🇦 Qatar Airways Business Round Trip - 🇶🇦 DOH to 🇬🇧 LHR` | ~70 ❌ | `Qatar Business DOH-LHR` | 23 ✅ |
| ana-first | `ANA First Class - Tokyo to London` | 35 ❌ | `ANA First NRT-LHR` | 19 ✅ |
| emirates-first | `Emirates First Class - 🇦🇪 DXB to 🇺🇸 JFK` | ~50 ❌ | `Emirates First DXB-JFK` | 24 ✅ |
| singapore-suites | `🇸🇬 Singapore Airlines Suites - 🇸🇬 SIN to 🇺🇸 LAX` | ~60 ❌ | `Singapore Suites SIN-LAX` | 26 ✅ |
| credit-3000 | `$3000 Premium Economy Credit - Voucher #001` | 45 ❌ | `$3K Premium Economy #001` | 26 ✅ |
| credit-5000 | `$5000 Business Class Credit - Voucher #001` | 44 ❌ | `$5K Business Class #001` | 25 ✅ |
| credit-10000 | `$10000 First Class Credit - Voucher #001` | 42 ❌ | `$10K First Class #001` | 23 ✅ |

### Symbols (Before → After)

| File | Old Symbol | Bytes | New Symbol | Bytes |
|------|------------|-------|------------|-------|
| qatar-business | `FLIGHT-QR-BIZ` | 14 ❌ | `QR-BIZ` | 6 ✅ |
| ana-first | `FLIGHT-NH-FIRST` | 16 ❌ | `NH-FIRST` | 8 ✅ |
| emirates-first | `FLIGHT-EK-FIRST` | 16 ❌ | `EK-FIRST` | 8 ✅ |
| singapore-suites | `FLIGHT-SQ-SUITES` | 17 ❌ | `SQ-SUITES` | 9 ✅ |
| credit-3000 | `FLIGHT-3K-PREM-001` | 18 ❌ | `3K-PREM` | 7 ✅ |
| credit-5000 | `FLIGHT-5K-BIZ-001` | 17 ❌ | `5K-BIZ` | 6 ✅ |
| credit-10000 | `FLIGHT-10K-FIRST-001` | 21 ❌ | `10K-FIRST` | 9 ✅ |

## Why This Happened

**Two separate issues:**

1. **Collection names** (stage-2a) - Fixed in first round
   - Collections have their own metadata
   - Each collection has name/symbol limits

2. **NFT names** (stage-2b) - Fixed now
   - Each NFT in the collection also has name/symbol limits
   - **Emojis count as 4 bytes each!** 🇶🇦 = 8 bytes
   - Long descriptive names exceeded 32 bytes

## Key Lesson

**Metaplex limits apply to:**
- ✅ Collection metadata (32/10 bytes)
- ✅ **Every NFT** metadata (32/10 bytes)
- ✅ Emojis are expensive (4 bytes each)

## Next Steps

1. **Commit to GitHub:**
   ```bash
   cd metadata/nfts/flights
   git add *.json
   git commit -m "Fix: Shorten NFT names/symbols to meet 32/10 byte limits"
   git push origin master
   ```

2. **Wait 1-2 minutes** for GitHub CDN

3. **Try minting again:**
   ```bash
   bun run scripts/2b-mint-collection-nfts.ts shared-1of1
   ```

## All NFTs Now Valid ✅

All 7 flight NFTs now comply with Metaplex limits!
