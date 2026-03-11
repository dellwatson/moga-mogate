## mogate_bridge_gateway.aleo (Bridge Gateway)

This program mints bridged NFTs into `mogate_arc721_multiprivate.aleo`.
It is gated by a relayer signature to avoid open minting.

### Flow (Polygon -> Aleo)
1. User locks ERC‑721 on Polygon (BridgeVault emits `Locked` event).
2. Relayer verifies event and builds a `bridge_claim`.
3. Relayer signs the claim and calls `mint_bridged`.
4. `mint_bridged` mints a private NFT in the specified collection.

### Key Types
`bridge_claim` includes:
- `collection_id`
- `recipient`
- `origin_chain_id`
- `origin_collection` (string encoded to `[field;4]`)
- `origin_token_id` (u64)
- `metadata` (URL encoded to `[field;4]`)
- `nonce`

### Notes
- `origin_token_id` is cast to `scalar` for `edition`. Use u64 token IDs.
- Duplicate claims are prevented by `claim_used`.
