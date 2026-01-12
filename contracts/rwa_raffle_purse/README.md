# RWA Raffle CSPR Contract

Multi-raffle protocol on Casper native contracts using PUBLIC CEP-95.

## High-level

- **Multi-raffle:** identified by string `raffle_id` (unique).
- **Payment:** native CSPR. Tickets paid from a `source_purse` into a contract-owned purse.
- **Prize:** NFT minted via PUBLIC CEP-95 `mint(to, token_id, metadata)`.
- **Modes:**
  - `unsafe_host_raffle` / `unsafe_join_host_raffle` (no permit, for testing).
  - `host_raffle` (same as unsafe but with `permit` arg, verification TODO).
- **Raffle end:** when all slots are sold, contract pseudo-randomly picks a slot and mints to the winner (auto) or allows self-claim.

## Storage model

Per `raffle_id` (string):

- `total_slots: u64`
- `max_slots_per_address: u64`
- `price_per_slot: U512` (motes)
- `metadata_uri: String` (goes into CEP-95 `token_uri`)
- `collection_hash: ContractHash` (PUBLIC CEP-95)
- `premint_contract: bool` (reserved)
- `premint: bool` (reserved)
- `auto_claim: bool` (`true` => mint on last ticket, `false` => self-claim)
- `created_at: U512` (from `get_blocktime`)
- `expires_at: U512` (`0` = no expiry)
- `status: u8` (`0=Open,1=Filled,2=Drawn,3=Cancelled`)
- `sold_slots: u64`
- `winner_slot: u64` (only when drawn)
- `winner: Key` (only when drawn)
- `claimed: bool`

Slot ownership & per-user:

- `DICT_SLOT_OWNER[raffle_id|slot:u64] -> Key`
- `DICT_USER_SLOT_COUNT[raffle_id|user] -> u64`
- `DICT_USER_SLOTS[raffle_id|user] -> Vec<u64>`
- `DICT_USER_RAFFLES[user] -> Vec<String>` (all raffles the user has joined)

Contract purse and admin:

- `raffle_purse` – created once in `init`, receives all ticket sales.
- `raffle_admin` – the deployer account, allowed to `withdraw_proceeds`.

## Entry points

### Installation

- `call()`

  - Installs contract under name `rwa_raffle_cspr` and immediately calls `init()`.

- `init()`
  - Creates all dictionaries.
  - Creates `raffle_purse` (system purse) to collect CSPR.
  - Sets `raffle_admin = caller`.

### Host / create raffles

- `unsafe_host_raffle(raffle_id: String, total_slots: u64, max_slots_per_address: u64, price_per_slot: U512, metadata_uri: String, collection_hash: ContractHash, premint_contract: bool, premint: bool, auto_claim: bool, expires_at: U512)`

  - Creates a new raffle config.
  - Fails if `raffle_id` already exists, `total_slots == 0`, or `max_slots_per_address == 0`.

- `host_raffle(..., permit: List<U8>)`

  - Same parameters as `unsafe_host_raffle` plus `permit` bytes.
  - Currently behaves like `unsafe_host_raffle` (permit verification TODO/commented).

- `unsafe_join_host_raffle(raffle_config..., slot_ids: Vec<u64>, source_purse: URef)`
  - Convenience for “host + first join” with **free slots for host**.
  - Uses constant `FREE_SLOTS_FOR_HOST = 3`.
  - Example: `[1,10,200]` -> all 3 free, no CSPR charged (only gas).
  - Example: `[1,10,200,95]` -> 3 free, 1 paid.

### Join raffles

- `join_raffle(raffle_id: String, slot_ids: Vec<u64>, source_purse: URef)`
  - Checks raffle is open and not expired.
  - Checks each slot is in `[1, total_slots]` and not already taken.
  - Enforces `max_slots_per_address` per user.
  - Computes:
    - `requested = slot_ids.len()` (after dedupe)
    - `remaining = total_slots - sold_slots`
    - fails if `requested > remaining`.
  - Computes price:
    - `free_slots = min(bonus_free_slots, requested)` (normally 0)
    - `paid_slots = requested - free_slots`
    - `amount = price_per_slot * paid_slots`
  - Transfers CSPR:
    - `transfer_from_purse_to_purse(source_purse, raffle_purse, amount)`.
  - Persists bookings:
    - `DICT_SLOT_OWNER[raffle_id|slot] = caller`
    - `DICT_USER_SLOTS[raffle_id|caller]` append slot
    - `DICT_USER_SLOT_COUNT[raffle_id|caller]` + `requested`
    - `DICT_USER_RAFFLES[caller]` append `raffle_id` (if not present)
    - `sold_slots += requested`
  - If `sold_slots == total_slots`:
    - `status = Filled`
    - Calls internal `end_raffle_internal(raffle_id, caller)`.

### End / randomize / mint

- `end_raffle_internal(raffle_id: String, last_buyer: Key)` (internal helper)

  - Requires `status` is `Open` or `Filled`.
  - Pseudo-random winner index:
    - `winner_index = (blocktime % total_slots) + 1` (INSECURE, for testing only).
  - Winner owner: `winner = DICT_SLOT_OWNER[raffle_id|winner_index]`.
  - Sets:
    - `status = Drawn`
    - `winner_slot = winner_index`
    - `winner = winner`.
  - If `auto_claim == true`:
    - Calls `mint_prize_internal(raffle_id, winner)`.
    - `claimed = true`.
  - Else:
    - `claimed = false` and waits for `claim()`.

- `mint_prize_internal(raffle_id: &str, to: Key)`

  - Loads `collection_hash` and `metadata_uri`.
  - `token_id = U256::from(blocktime)` (timestamp-based ID).
  - `metadata = [("token_uri", metadata_uri)]`.
  - Calls PUBLIC CEP-95: `mint(to, token_id, metadata)`.

- `claim(raffle_id: String)`
  - For self-claim mode.
  - Requires:
    - `status == Drawn`
    - `claimed == false`
    - `winner == caller`.
  - Calls `mint_prize_internal` and sets `claimed = true`.

### Withdraw proceeds

- `withdraw_proceeds(to_purse: URef, amount: U512)`
  - Only `raffle_admin` (deployer) can call.
  - Transfers CSPR from `raffle_purse` to `to_purse`.

### Views / quick info

- `get_raffle_load(raffle_id: String) -> (u64 total_slots, u64 sold_slots, u8 status)`

  - Very cheap summary, ideal for carousel cards.

- `get_user_raffles(owner: Key) -> Vec<String>`

  - All `raffle_id`s where this address has at least one slot.

- `get_user_raffle_slots(raffle_id: String, owner: Key) -> Vec<u64>`

  - All slot numbers this user holds in a given raffle.

- `check_slots_availability(raffle_id: String, slot_ids: Vec<u64>) -> (bool all_available, Vec<u64> unavailable)`
  - Pure view: does not mutate state.
  - For each provided slot:
    - If out of range or already owned, it is returned in `unavailable`.
  - `all_available = unavailable.is_empty()`.

## Notes on "optional" params

Casper named arguments are **not** optional by default. In this contract:

- `price_per_slot` and others are **required** on host / join-host.
- If you want an "expected_total_price" safety check on join:
  - Extend `join_raffle` to accept `expected_total_price: Option<U512>` or `U512` where `0` means "ignore".
  - Compare it to `price_per_slot * paid_slots` and revert if mismatched.

Currently the implementation **does not** include `expected_total_price` – price is fully taken from on-chain config.

## Scripts

See `scripts/` for helpers:

- `scripts/deploy-rwa-raffle.sh`

  - Installs the contract and prints the deploy hash.
  - After finalization, get the contract hash named `rwa_raffle_cspr` from the deploy.

- `scripts/casper/rwa-raffle-demo.js`
  - Uses `casper-js-sdk`.
  - Hosts 3 example raffles via `unsafe_host_raffle`:
    - `rwa-demo-1` (200 slots, 30 CSPR, auto-claim)
    - `rwa-demo-2` (100 slots, 10 CSPR, self-claim)
    - `rwa-demo-3` (50 slots, 5 CSPR, auto-claim)
  - Optionally calls `join_raffle` on `rwa-demo-1` with slots `[1,10,200]` if you set `SOURCE_PURSE_UREF`.

You can reuse this contract + flow for other protocols by:

- Keeping the same storage layout (config + slot + user aggregates).
- Swapping the prize minting logic (e.g. different CEP-95 collection, fungible rewards, etc.).
- Adjusting how `price_per_slot` and `withdraw_proceeds` are used.
