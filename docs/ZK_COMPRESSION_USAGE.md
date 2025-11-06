# ZK Compression Usage

## Where We Use Compression

- **Refund Tickets (Compressed NFTs)**
  - Technology: Metaplex Bubblegum (compressed NFTs)
  - When: Only in refund path (deadline passed, quota not met)
  - Why: Minting many tickets is cheap and scalable; tradeable asset without on-chain rent
  - Policy: Tradeable by users; non-burnable by users; recycling controlled by platform

- **Prize NFTs (Optional, Many Prizes)**
  - If organizer supplies many prizes across raffles, mint them as compressed NFTs to save cost
  - Transfer to winner can be de-compressed or via ownership change, depending on product choice

- **Participant Receipts (Optional, Later)**
  - Technology: Light Protocol zk-compression for generic state
  - Use when participant counts become massive and we want receipt-like records with proofs
  - Not required for the base 1-TX join flow; defer until scale demands

## What We Do NOT Compress

- **Active Slot Ownership Map**
  - Stored directly on-chain in the `Raffle` PDA (bitmap + `slot_owners`) for fast checks and winner resolution
  - At 500–10k slots, this is small enough to remain on-chain

## Offchain Responsibilities

- Listen to `RefundTicketsRequested` events and mint compressed NFTs (1 per reserved slot)
- Optional: facilitate secondary market indexing and recycling flows under platform authority

## Devnet Strategy

- Use devnet trees and collections distinct from mainnet
- Disable royalties in dev until marketplace testing
- Provide a small faucet of refund tickets for `join_with_ticket` testing
