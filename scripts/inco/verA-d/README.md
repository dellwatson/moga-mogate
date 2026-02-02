# FHE Raffle Scripts (Inco Lightning)

Scripts for testing the FHE-enabled raffle programs (Version A: Slot-Based).

## ⚠️ Compilation Issue

Currently, the FHE programs cannot be compiled due to a Rust toolchain version issue:

```
error: feature `edition2024` is required
The package requires the Cargo feature called `edition2024`, but that feature is not stabilized in this version of Cargo (1.84.0).
```

**Solutions:**

1. Update to Rust nightly: `rustup default nightly`
2. Wait for stable Rust to support edition2024
3. Use a different inco-lightning version (if available)

## Scripts

### 1. `host-raffle-inco.ts`

Creates a new FHE raffle (Version A: Slot-Based with encrypted draw).

```bash
bun run scripts/inco/host-raffle-inco.ts <raffle-id> <collection-mint> <metadata-uri> [total-slots] [max-slots-per-address] [expires-in-seconds]
```

### 2. `join-raffle-inco.ts`

Joins an existing FHE raffle by selecting slots.

```bash
# Using SOL_PVT_KEY environment variable
SOL_PVT_KEY=<base58-key> bun run scripts/inco/join-raffle-inco.ts <raffle-id> "1,2,3" 0.5

# Using SOL_PVT_KEY_2 for second user
SOL_PVT_KEY=<base58-key-2> bun run scripts/inco/join-raffle-inco.ts <raffle-id> "4,5,6" 0.5
```

## Program Details

- **Program**: `multi_raffle-inco` (Version A)
- **Program ID**: `2J4FHGb2mesv6vgZUqUAKtDZe6xjyjiQAgW6nsFokx7P`
- **Type**: Slot-based raffle with FHE-encrypted draw
- **Privacy**: Winning slot is encrypted, slot ownership is public

## Flow

1. **Host creates raffle** - Sets up raffle with total slots
2. **Users join** - Select specific slots (public)
3. **Authority draws winner** - Encrypted random slot selection
4. **Users check** - Encrypted comparison with their slots
5. **Winner claims** - Provides decryption proof

## Note

These scripts are ready to use once the compilation issue is resolved. The TypeScript SDK functions will need to be created to match the FHE program's instruction format.
