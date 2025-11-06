# Refund Ticket (Compressed NFT) Specification

## Purpose
- Represent refundable credit when a raffle fails to meet the quota by deadline.
- Tradeable by users on NFT marketplaces.
- Non-burnable by users; only program/back-end can recycle.
- One NFT ticket corresponds to one slot ($1 USDC value) for the failed raffle.

## Properties
- Standard: Metaplex Bubblegum (compressed NFTs)
- Mint Authority: Program/Tree Authority (platform-controlled)
- Burn Authority: Program/Tree Authority only (users cannot burn)
- Supply: 1 per slot reserved (e.g., 3 slots → 3 NFTs)
- Royalty: Configurable (e.g., 2.5%) on secondary markets

## Metadata
- name: "MOGA Raffle Refund Ticket"
- symbol: "MRFT"
- attributes:
  - raffle_id: Pubkey (raffle PDA)
  - usdc_value: 1.00 (per NFT)
  - original_slot: u32 (the slot number released)
  - refund_date: i64
- description: "Refund credit for failed raffle"

## Minting Flow
- Trigger: `RefundTicketsRequested` event emitted by program during `claim_refund()`.
- Off-chain worker listens and mints via Bubblegum `mint_to_collection_v1`:
  - Tree authority = platform
  - Leaf owner = user
  - One mint per slot in the user's ticket range (or per exact slot if tracked individually)

## Redemption / Recycling
- Users cannot call burn.
- Recycling (two options):
  1. `join_with_ticket` instruction:
     - User submits N refund NFTs → program verifies collection/metadata → burns via tree authority → reserves N slots in a new raffle.
  2. Off-chain buy-back (optional):
     - Platform buys back NFTs and burns them off-chain using tree authority.

## Security / Anti-Abuse
- Validate MRFT collection address in program when accepting NFTs.
- Enforce one-time use via burn under tree authority.
- Index NFTs by `(raffle_id, original_slot, owner)` to prevent double-use.

## Devnet Strategy
- Use a dedicated devnet Bubblegum tree.
- Disable royalties in dev until marketplace testing.

## Notes
- This spec purposefully avoids minting NFTs during normal join. NFTs are minted only on refund. This keeps the happy-path a single transaction while preserving tradeability in failure mode.
