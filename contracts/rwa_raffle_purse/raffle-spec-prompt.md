I want a Casper native smart contract (no_std, Rust) that implements a multi-raffle system similar to the following:

- Each raffle is identified by a `String` `raffle_id`.
- Off-chain config defines what we host, but key parameters are stored on-chain:

  - `total_slots: u64`
  - `max_slots_per_address: u64`
  - `price_per_slot: U512`
  - `metadata_uri: String`
  - `collection_hash: ContractHash` (CEP-95 or equivalent NFT collection to mint from)
  - `premint_contract: bool` and `premint: bool` (reserved flags)
  - `auto_claim: bool` (auto mint on draw vs manual claim)
  - `created_at: U512` and `expires_at: U512` (0 = no expiry)
  - `status: u8` (OPEN / FILLED / DRAWN / CANCELLED)
  - `sold_slots: u64`
  - `winner_slot: u64`, `winner: Key`, `claimed: bool`

- Use dictionaries / mappings extensively:

  - Per-raffle dictionaries/mappings keyed by `raffle_id` for the fields above.
  - A `raffle_slot_owner` dictionary keyed by `"raffle_id|slot_number"` -> `Key` / address.
  - A `raffle_user_slot_count` and `raffle_user_slots` keyed by `"raffle_id|<owner_key_string>"`.
  - A `raffle_user_raffles` keyed by `<owner_key_string>` -> `Vec<String>` / string[] of raffle IDs.

- Global named keys / globals:

  - A dedicated purse / balance store `RAFFLE_PURSE_KEY` to receive native tokens from joins.
  - An `ADMIN_KEY` set to the installer / deployer account.

- Entry points / public functions:

  - `init`: create dictionaries/mappings, purse/balance store, and store admin.
  - `unsafe_host_raffle`: host a raffle with the config above; no auth.
  - `host_raffle`: same as unsafe version but accepts a `permit: bytes` (for future off-chain auth).
  - `join_raffle(raffle_id, slot_ids: u64[], source_purse_or_caller_balance)`:
    - Validate raffle is OPEN and not expired; enforce slot ranges and availability.
    - Enforce `max_slots_per_address`.
    - Charge `price_per_slot * number_of_slots` and transfer from caller/source to the raffle purse/balance.
    - Record slot owners and user raffles.
    - When `sold_slots == total_slots`, mark FILLED and end the raffle.
  - `unsafe_join_host_raffle`: host then join in one call, with a configurable number of free slots for the host.
  - `claim(raffle_id)`: only winner can call, only if DRAWN and not already claimed; mint prize NFT and mark claimed.
  - `withdraw_proceeds(to, amount)`: only admin; move native tokens from raffle purse/balance to `to`.

- Raffle ending logic:

  - An internal `end_raffle_internal(raffle_id, last_buyer)` that:
    - Computes `winner_slot` from blocktime (or equivalent) modulo `total_slots` (1-based).
    - Reads the winning `Key` / address from `raffle_slot_owner`.
    - Stores `winner_slot`, `winner`, sets status to DRAWN.
    - If `auto_claim = true`, immediately calls internal prize mint and marks claimed.

- Prize minting:

  - Internal `mint_prize_internal(raffle_id, to)` that:
    - Reads `collection_hash` / NFT collection reference and `metadata_uri`.
    - Uses blocktime or a monotonic counter to derive a unique `token_id`.
    - Builds metadata with at least `("token_uri", metadata_uri)`.
    - Calls a public NFT contract at `collection_hash` (or equivalent) to mint to `to` with that metadata.

- View / read-only entry points:

  - `get_raffle_load(raffle_id) -> (total_slots: u64, sold_slots: u64, status: u8)`.
  - `get_user_raffles(owner) -> string[]`.
  - `get_user_raffle_slots(raffle_id, owner) -> u64[]`.
  - `check_slots_availability(raffle_id, slot_ids) -> (all_available: bool, unavailable: u64[])`.

- The implementation can target Casper (native Rust, no_std) or EVM (Solidity/Vyper) but should closely follow this storage and flow model, using idiomatic patterns for the chosen chain (e.g. purses/dictionaries on Casper, mappings on EVM).
