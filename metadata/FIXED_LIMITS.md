# Metaplex Token Metadata Limits - FIXED

## The Problem

Metaplex Token Metadata program has strict limits:
- **Name: Max 32 bytes**
- **Symbol: Max 10 bytes**

## What Was Fixed

### Collection Names (Before → After)

| Collection | Old Name | Bytes | New Name | Bytes | Status |
|------------|----------|-------|----------|-------|--------|
| shared-1of1 | `Mogate Marketplace - Unique Items` | 36 ❌ | `Mogate Unique Items` | 20 ✅ |
| shared-sft | `Mogate Marketplace - Credits & Vouchers` | 42 ❌ | `Mogate Credits & Vouchers` | 28 ✅ |
| travel-1of1 | `Mogate Travel - Unique Bookings` | 33 ❌ | `Mogate Travel Bookings` | 25 ✅ |
| travel-sft | `Mogate Travel - Credits` | 26 ✅ | `Mogate Travel - Credits` | 26 ✅ |
| luxury | `Mogate Luxury RWA` | 18 ✅ | `Mogate Luxury RWA` | 18 ✅ |

### Collection Symbols (Before → After)

| Collection | Old Symbol | Bytes | New Symbol | Bytes | Status |
|------------|------------|-------|------------|-------|--------|
| shared-1of1 | `MOGATE-1OF1` | 12 ❌ | `MOGA-1OF1` | 10 ✅ |
| shared-sft | `MOGATE-SFT` | 11 ❌ | `MOGA-SFT` | 9 ✅ |
| travel-1of1 | `MOGATE-TRAVEL` | 14 ❌ | `MOGA-TRV` | 8 ✅ |
| travel-sft | `MOGATE-CREDIT` | 14 ❌ | `MOGA-CRED` | 9 ✅ |
| luxury | `MOGATE-LUX` | 11 ❌ | `MOGA-LUX` | 9 ✅ |

## All Collections Now Valid ✅

All metadata files have been updated to comply with Metaplex limits.

## Next Steps

1. **Commit changes to GitHub:**
   ```bash
   cd metadata
   git add collections/
   git commit -m "Fix: Shorten collection names and symbols to meet Metaplex limits"
   git push origin master
   ```

2. **Wait 1-2 minutes** for GitHub to update the raw URLs

3. **Try creating collection again:**
   ```bash
   bun run scripts/2-create-prize-collection.ts shared-1of1
   bun run scripts/2-create-prize-collection.ts luxury
   bun run scripts/2-create-prize-collection.ts travel-sft
   ```

## Validation Rules

When creating new metadata, always check:

```typescript
// Name validation
if (Buffer.from(name).length > 32) {
  throw new Error(`Name too long: ${Buffer.from(name).length} bytes (max 32)`);
}

// Symbol validation
if (Buffer.from(symbol).length > 10) {
  throw new Error(`Symbol too long: ${Buffer.from(symbol).length} bytes (max 10)`);
}
```

## Why This Happened

The metadata files were created without validating against Metaplex's on-chain limits. This is a common mistake when:
- Focusing on JSON structure
- Not testing actual on-chain creation
- Missing validation in scripts

**Lesson:** Always validate metadata against on-chain program constraints before deployment.
