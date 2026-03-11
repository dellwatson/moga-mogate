## mogate_arc721_multiprivate.aleo (Multi‑Collection Private ARC‑721)

This program hosts multiple private NFT collections under one program ID.
Ownership and transfers are record‑based (private). Metadata is public only when published.

### Key Concepts
- **collection_id (field)**: Public ID for a collection.
- **Private ownership**: Each NFT is a private record.
- **Public metadata**: Written to `nft_contents` only when `publish_*` is called.
- **Bridged vs native**: `collection_meta` includes `is_bridged`, `origin_chain_id`, `origin_collection`.

### Setup Flow
1. **Initialize program (once)**
   - `initialize(admin)`
2. **Create a collection**
   - `create_collection(collection_id, admin, name, symbol, metadata_url, is_bridged, origin_chain_id, origin_collection, max_mintable, max_first_edition)`
3. **Allow a minter**
   - `set_minter(collection_id, minter, allowed)`

### Mint Flow
- `mint_private(collection_id, recipient, nft_data, edition)`

### Publish Metadata (optional)
- `publish_nft_content_owner(PrivateNFT)`
- `publish_nft_content_admin(collection_id, nft_data, edition)`

### Transfer / Burn
- `transfer_private(PrivateNFT, to)`
- `burn_private(PrivateNFT)`
- `burn_private_with_receipt(PrivateNFT)`
- `burn_private_with_receipt_to(PrivateNFT, receipt_owner)`

### Bridge Notes
- For bridged collections, set `is_bridged=true` and record `origin_chain_id` + `origin_collection`.
- If you need origin token IDs, set `edition = origin_token_id` on mint, or include it in off‑chain metadata.
