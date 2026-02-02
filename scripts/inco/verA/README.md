# ver-A FHE Raffle Scripts

Clean, minimal scripts for hosting and joining ver-A raffles with FHE privacy.

## Scripts

### `host.ts`

Host a new ver-A raffle with auto-draw and auto-claim enabled.

```bash
bun run host.ts
```

Features:

- Auto-draw: Automatically draws winner when slots fill up
- Auto-claim: Automatically claims prizes for winners
- FHE privacy: Slot ownership is encrypted
- 10 total slots, 5 max per address

### `join.ts`

Join an existing ver-A raffle with specified slots.

```bash
bun run join.ts <raffle_id> <slots> <amount_sol>
```

Example:

```bash
bun run join.ts vera-1234567890 "1,2,3" 0.1
```

Wallet Priority:

1. `SOL_PVT_KEY_2` (if valid 88-char base58)
2. `SOL_PVT_KEY` (if valid 88-char base58)
3. CLI wallet (fallback)

## Environment Variables

```bash
SOL_PVT_KEY=your_88_char_base58_private_key
SOL_PVT_KEY_2=your_88_char_base58_private_key
SOLANA_NETWORK=devnet
SOLANA_RPC_URL=https://api.devnet.solana.com
WALLET_PATH=~/.config/solana/id.json
```

## Program Details

- **Program ID**: `9pVdJ6spKDoMAPTFjcXMochpzMkj9yABkHEW5QLkhRXC`
- **Network**: Devnet
- **Features**: FHE privacy, auto-draw, auto-claim

## FHE Privacy

- Slot ownership is encrypted with `slots_handle`
- Private until draw/claim
- On-chain encryption using INCO network

## Quick Test

1. Host a raffle:

```bash
bun run host.ts
```

2. Join with slots:

```bash
bun run join.ts <raffle_id_from_host> "5,6" 0.1
```

## Status

✅ Working - Successfully tested with:

- CLI wallet hosting
- SOL_PVT_KEY_2 joining
- FHE encryption active
- Auto-features enabled.
