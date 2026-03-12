## mogate_arc721_multiprivate_v2.aleo (Multi‑Collection Private ARC‑721)

This program hosts multiple private NFT collections under one program ID.
Ownership and transfers are record‑based (private). **Metadata URI is public** (marketplaces/backends can read it).

### Key Concepts
- **collection_id (field)**: Public ID for a collection.
- **Private ownership**: Each NFT is a private `PrivateNFT` record (holder is not stored in public state).
- **Public metadata**: Written to `nft_contents[nft_commit]` at mint.
- **Public token_id mode (optional)**: If enabled per collection, token IDs are indexed in `token_to_commit`.
- **Bridged vs native**: `collection_meta` includes `is_bridged`, `origin_chain_id`, `origin_collection`.

### Setup Flow
1. **Initialize program (once)**
   - `initialize(admin)`
2. **Create a collection**
   - `create_collection(collection_id, admin, name, symbol, metadata_url, public_token_id, is_bridged, origin_chain_id, origin_collection, max_mintable, max_first_edition)`
3. **Allow a minter**
   - `set_minter(collection_id, minter, allowed)`

### Mint Flow
- Hidden token_id collections:
  - `mint_private(collection_id, recipient, nft_data, token_id)` (token_id is private)
- Public token_id collections:
  - `mint_private_public_id(collection_id, recipient, nft_data, token_id)` (token_id is public)

### Transfer / Burn
- `transfer_private(PrivateNFT, to)` (to is private)
- `burn_private(PrivateNFT)`
- `burn_private_with_receipt(PrivateNFT)`
- `burn_private_with_receipt_to(PrivateNFT, receipt_owner)`

### Bridge Notes
- For bridged collections, set `is_bridged=true` and record `origin_chain_id` + `origin_collection`.
- If you need origin token IDs, either:
  - enable `public_token_id=true` and set `token_id = origin_token_id`, or
  - keep token_id private and store origin info in off‑chain metadata.
