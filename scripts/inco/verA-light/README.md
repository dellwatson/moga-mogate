# verA-light (multi_raffle_inco_a_light)

End-to-end guide for deploying and testing the **verA-light** raffle variant:

- Program: `multi_raffle_inco_a_light` (Rust / Anchor)
- Features: LIGHT zk-compressed tickets **+** Inco Lightning FHE privacy
- Scripts: `host.ts`, `join.ts`, `join-test.ts`, `simple-test.ts`

---

## 1. Prerequisites

- **Solana CLI** installed and configured
- **Anchor** CLI `0.31.1`
- **Node** (via `nvm`), **bun** for running scripts
- **Devnet wallet** at `~/.config/solana/id.json` with **> 3.1 SOL**
- **Helius devnet RPC** (or other RPC that supports ZK Compression)
- **Light stateless client** already installed in this repo:
  - `@lightprotocol/stateless.js`
  - `@solana/web3.js`

> Note: For verA-light we do **not** use the old `zk-compression-cli prove` flow. Instead we call the Light stateless client directly from `generate-ligh-proof.ts` against your Helius devnet RPC.

---

## 2. Deploying `multi_raffle_inco_a_light` to devnet

From the repo root (`mogate-rwa-raffle-monorepo-SOL`):

### 2.1. Fund devnet wallet

```bash
solana address         # should be 2mdvoXMrxTPyqq9ETxAf7YLgLU7GHdefR88SLvQ5xC7r
solana balance

# Airdrop until you have > 3.1 SOL on devnet
solana airdrop 2 --url https://api.devnet.solana.com
solana airdrop 2 --url https://api.devnet.solana.com
solana balance
```

### 2.2. Build the program

```bash
# Build the verA-light program and generate IDL
anchor build -p multi_raffle_inco_a_light
```

This produces:

- Program binary: `programs/multi_raffle-inco-A-light/target/deploy/multi_raffle_inco_a_light.so`
- IDL: `target/idl/multi_raffle_inco_a_light.json`

### 2.3. Ensure .so is visible to Anchor deploy

If `target/deploy/multi_raffle_inco_a_light.so` does **not** exist at the workspace root, copy it from the program folder:

```bash
cp programs/multi_raffle-inco-A-light/target/deploy/multi_raffle_inco_a_light.so target/deploy/
```

### 2.4. Deploy to devnet

`Anchor.toml` already registers the devnet program id.

Deploy (or re-deploy) with:

```bash
anchor deploy -p multi_raffle_inco_a_light
```

This command was already run once from this repo, which is why your devnet
wallet balance dropped (deploy fees and rent). Re-running it will consume
additional SOL.

---

## 3. LIGHT proof data (`light-proof.json`)

The `unsafe_join_raffle` instruction accepts these arguments:

- `slot_ids: Vec<u32>` – which slots you buy
- `amount: u64` – lamports you pay
- `proof: ValidityProof` – zk proof that the address is fresh and any compressed state exists
- `address_tree_info: PackedAddressTreeInfo` – which LIGHT address tree + accounts are used
- `output_state_tree_index: u8` – which state tree leaf should go into

Our **TypeScript join scripts** (`join.ts`, `join-test.ts`) expect a local file:

```text
scripts/inco/verA-light/light-proof.json
```

with the following structured shape (no base64 needed):

```jsonc
{
  "proof": { "0": "<compressedProof-bytes-from-Light>" },
  "addressTreeInfo": {
    "rootIndex": 0,
    "addressMerkleTreePubkeyIndex": 0,
    "addressQueuePubkeyIndex": 0,
  },
  "outputStateTreeIndex": 0,
  "systemAccountsOffset": 0,
  "remainingAccounts": [
    { "pubkey": "<pubkey>", "isSigner": false, "isWritable": true },
    { "pubkey": "<pubkey>", "isSigner": false, "isWritable": false },
  ],
  "lightStateTree": "<LIGHT state tree pubkey>",
  "lightSystemProgram": "<LIGHT system program pubkey>",
  "ticketAddress": "<compressed ticket address>",
}
```

### 3.1. How do you actually get this?

We use the local helper script `generate-ligh-proof.ts`, which wraps
`@lightprotocol/stateless.js` in the same way as the official Light
`program-examples`.

1. Ensure your **devnet Helius RPC** is exported, for example:

   ```bash
   export HELIUS_RPC_URL="https://devnet.helius-rpc.com/?api-key=YOUR_KEY"
   ```

2. Run the verA-light host script once to create a raffle and
   write `raffle-info.json`:

   ```bash
   bun run scripts/inco/verA-light/host.ts
   ```

3. Generate the LIGHT proof JSON for that raffle/user combo:

   ```bash
   bun run scripts/inco/verA-light/generate-ligh-proof.ts
   ```

   This script will:
   - Use `createRpc(HELIUS_RPC_URL, HELIUS_RPC_URL, HELIUS_RPC_URL)`.
   - Derive the compressed ticket address with
     `deriveAddressSeedV2(["ticket", raffle, user])` and
     `deriveAddressV2`.
   - Call `rpc.getValidityProofV0` to fetch a validity proof for that
     compressed address.
   - Build `PackedAddressTreeInfo`, `outputStateTreeIndex`, and the
     `remainingAccounts` array expected by the LIGHT CPI.
   - Write `light-proof.json` matching the schema above.

4. Now `join.ts` / `join-test.ts` can load this structured JSON and pass the
   proof, tree info, and `remainingAccounts` directly into
   `unsafeJoinRaffle`.

---

## 4. Running the verA-light scripts

All paths below assume you run from the **repo root** and use **bun**.

### 4.1. Host a verA-light raffle

This uses `scripts/inco/verA-light/host.ts` and the Anchor IDL.

```bash
bun run scripts/inco/verA-light/host.ts
```

This script will:

- Connect to devnet via `SOLANA_RPC_URL` or the default Anchor provider.
- Use the wallet at `~/.config/solana/id.json` as the host.
- Derive PDAs for:
  - Config
  - Raffle
  - Slots
  - Treasury
- Call `unsafe_host_raffle` on `multi_raffle_inco_a_light`.
- Save a `raffle-info.json` file in this folder containing:

```jsonc
{
  "raffleId": "...",
  "configPda": "...",
  "rafflePda": "...",
  "slotsPda": "...",
  "treasuryPda": "...",
  "totalSlots": 1000000,
  "maxSlotsPerAddress": 100,
  "expiresAt": 0,
  "tx": "<host transaction signature>",
}
```

You can then inspect the raffle on Solana explorer using the printed PDA and tx signature.

### 4.2. Join the raffle (Anchor / verA-light)

Ensure:

- `raffle-info.json` exists (from `host.ts`).
- `light-proof.json` exists (from your Light client helper script).

Then run:

```bash
bun run scripts/inco/verA-light/join.ts
```

This script will:

- Load your CLI wallet and connect to devnet.
- Load the `multi_raffle_inco_a_light` IDL from `target/idl`.
- Read `raffle-info.json` (config/raffle/slots/treasury PDAs).
- Read `light-proof.json` (proof, tree info, LIGHT program addresses).
- Call:

```ts
unsafeJoinRaffle(slotIds, amount, proof, addressTreeInfo, outputStateTreeIndex);
```

with accounts:

- `payer`: your wallet
- `config`: config PDA
- `raffle`: raffle PDA
- `slots`: slots PDA
- `userRaffle`: PDA derived as `["user", raffle, payer]`
- `lightStateTree`: from `light-proof.json`
- `lightSystemProgram`: from `light-proof.json`
- `treasury`: treasury PDA
- `systemProgram`: `SystemProgram.programId`
- `incoLightningProgram`: Inco Lightning program id (hardcoded in script)

On success, it logs the transaction signature and saves `join-info.json` with details.

### 4.3. Raw-test variant (`join-test.ts`)

`join-test.ts` is a lower-level variant that also:

- Loads `light-proof.json`.
- Uses Anchor Program API (not manual instruction serialization) to call `unsafeJoinRaffle` on a previously created `raffle` from `simple-test.ts` / `test-result.json`.

Run with:

```bash
bun run scripts/inco/verA-light/join-test.ts
```

---

## 5. System architecture: LIGHT zk + Inco FHE

The verA-light system combines:

1. **Traditional Anchor accounts** for control & accounting:
   - `Config`: global settings (e.g. refund fee bps).
   - `Raffle`: raffle state (id, total_slots, sold_slots, status, pricing, etc.).
   - `RaffleSlots`: compact metadata for slot counts / sold slots.
   - `UserRaffle`: per-user record that stores **encrypted** ownership handle.
   - `Treasury`: PDA that receives the SOL payments.

2. **Inco Lightning FHE** for private slot ownership:
   - `unsafe_join_raffle`:
     - Transfers `amount` SOL from `payer` → `treasury`.
     - Builds a byte array encoding the chosen `slot_ids`.
     - Calls Inco Lightning via CPI to create an `Euint128` handle:
       - This ciphertext encodes which slots the user owns, but the mapping is **not** readable on-chain.
     - Stores the ciphertext handle in `UserRaffle.slots_handle`.

   - Other instructions (draw/check/withdraw) use FHE operations to:
     - Draw a winning (encrypted) slot.
     - Prove a user is the winner without revealing everyone’s slots early (delayed transparency).

3. **LIGHT zk-compression** for scalable ticket storage:
   - `unsafe_join_raffle` also creates a **compressed ticket** using LIGHT:
     - Builds `CpiAccounts` from remaining accounts (`light_state_tree`, state trees, etc.).
     - Uses `address_tree_info.get_tree_pubkey(&light_cpi_accounts)` to get the LIGHT address tree pubkey.
     - Derives a compressed ticket address with:

       ```text
       seeds = [b"ticket", raffle_pubkey, user_pubkey]
       ```

     - Instantiates a `LightAccount<CompressedTicket>` with fields:
       - `raffle: Pubkey`
       - `user: Pubkey`
       - `slot_ids: Vec<u32>`
       - `amount: u64`
       - `created_at: i64`

     - Calls `LightSystemProgramCpi::new_cpi(LIGHT_CPI_SIGNER, proof)` with:
       - `proof: ValidityProof` (from off-chain SDK)
       - New address params derived from `address_tree_info.into_new_address_params_assigned_packed(ticket_seed, Some(0))`

     - LIGHT system program verifies the proof and updates its **Merkle trees** (state tree + address tree) to include this compressed ticket as a new leaf.

   - Result: you can have **1M+ tickets** without 1M on-chain accounts:
     - Only LIGHT’s tree roots and your compressed leaves are stored.
     - Your program sees tickets via `LightAccount<CompressedTicket>` and zk proofs.

4. **Why both FHE + zk-compression?**

- **FHE (Inco)** gives _privacy_ over which slots each user owns and allows encrypted draws.
- **LIGHT zk-compression** gives _scalability_ and _cost reduction_ by putting per-user tickets in compressed Merkle trees instead of normal Solana accounts.
- Combined:
  - You keep the control plane and critical accounting in standard Anchor PDAs.
  - You offload massive per-user/per-slot data into compressed structures while still being verifiable and updatable.

---

This folder (`scripts/inco/verA-light`) is your **integration harness**:

- Deploy once to devnet.
- Host a test raffle with `bun run .../host.ts`.
- Generate proof data with Light’s client SDK and write `light-proof.json`.
- Join the raffle with `bun run .../join.ts` to exercise the full **Inco FHE + LIGHT zk-compression** path end-to-end.
