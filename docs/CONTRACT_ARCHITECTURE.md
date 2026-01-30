# Aleo Contract Architecture

## Overview

Your Aleo contracts use a **two-layer architecture** with public minting controlled by a gateway contract.

---

## Contract Interaction Flow

```
┌─────────────────────────────────────────────────┐
│  User / External Caller                         │
└────────────────┬────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────┐
│  mogate_authority_mint_gateway.aleo             │
│  ┌───────────────────────────────────────────┐  │
│  │ mint() - Owner only                       │  │
│  │ • Checks: caller == owner                 │  │
│  │ • Calls: collection.mint_with_token_id()  │  │
│  └───────────────────────────────────────────┘  │
│  ┌───────────────────────────────────────────┐  │
│  │ mint_nft() - Public faucet                │  │
│  │ • No checks (open access)                 │  │
│  │ • Calls: collection.mint_to()             │  │
│  └───────────────────────────────────────────┘  │
└────────────────┬────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────┐
│  mogate_nft_collection_rwa.aleo                 │
│  ┌───────────────────────────────────────────┐  │
│  │ mint_to() - PUBLIC                        │  │
│  │ • Auto-incrementing token ID              │  │
│  │ • No permission checks                    │  │
│  └───────────────────────────────────────────┘  │
│  ┌───────────────────────────────────────────┐  │
│  │ mint_with_token_id() - PUBLIC             │  │
│  │ • Specific token ID                       │  │
│  │ • No permission checks                    │  │
│  │ • Checks: token doesn't exist             │  │
│  └───────────────────────────────────────────┘  │
└─────────────────────────────────────────────────┘
```

---

## How Contract Calls Work in Leo

### Importing Programs

```leo
import mogate_nft_collection_rwa.aleo;
```

### Calling External Transitions

```leo
// Syntax: program_name.aleo/transition_name(args)
let (nft, future): (mogate_nft_collection_rwa.aleo/NFT, Future) =
    mogate_nft_collection_rwa.aleo/mint_to(to, uri_hash);
```

### No Addresses Needed!

- **Program name = Program address**
- `mogate_nft_collection_rwa.aleo` is both:
  - The import name
  - The on-chain identifier
  - The "address" of the contract

---

## Security Model

### Collection Contract (mogate_nft_collection_rwa.aleo)

**Access Control:** ⚠️ **PUBLIC - No restrictions**

| Function               | Access         | Description                            |
| ---------------------- | -------------- | -------------------------------------- |
| `mint_to()`            | PUBLIC         | Anyone can mint with auto-increment ID |
| `mint_with_token_id()` | PUBLIC         | Anyone can mint with specific ID       |
| `transfer()`           | Owner only     | Only NFT owner can transfer            |
| `burn()`               | Owner only     | Only NFT owner can burn                |
| `set_minter()`         | Owner/Operator | Legacy function (not used)             |

**Why public?**

- Gateway contract handles all access control
- Direct minting is allowed but discouraged
- Simplifies cross-contract calls

---

### Gateway Contract (mogate_authority_mint_gateway.aleo)

**Access Control:** ✅ **Protected**

| Function                   | Access     | Description                        |
| -------------------------- | ---------- | ---------------------------------- |
| `mint()`                   | Owner only | Mints with specific token ID       |
| `mint_nft()`               | PUBLIC     | Faucet-style mint (auto-increment) |
| `set_collection_allowed()` | Owner only | Whitelist collections (legacy)     |
| `initialize()`             | Anyone     | Set initial owner                  |

**Security checks:**

```leo
// In finalize_mint()
let owner: address = gateway_owner.get(0u8);
assert_eq(caller, owner);  // Only owner can call mint()
```

---

## Two-Phase Execution Model

Leo uses a unique execution model:

### Phase 1: Transition (Off-chain)

```leo
async transition mint_to(...) -> (NFT, Future) {
    // Creates NFT record locally
    let nft: NFT = NFT { ... };

    // Returns future for on-chain work
    return (nft, finalize_mint_to(...));
}
```

**What happens:**

- Runs immediately on client
- Creates private records (like NFT)
- **Cannot access mappings** (global state)
- Returns a `Future` for on-chain execution

### Phase 2: Finalize (On-chain)

```leo
async function finalize_mint_to(...) {
    // Updates global state
    let current_id: u64 = next_token_id.get(0u8);
    next_token_id.set(0u8, current_id + 1u64);

    // Stores token data
    token_owners.set(new_id, to);
}
```

**What happens:**

- Runs when transaction is confirmed
- **Can read/write mappings** (global state)
- Updates counters and storage
- Enforces on-chain logic

---

## Cross-Contract Calls

### How Gateway Calls Collection

```leo
// In gateway's mint() transition
let (nft, mint_future): (mogate_nft_collection_rwa.aleo/NFT, Future) =
    mogate_nft_collection_rwa.aleo/mint_with_token_id(to, token_id, uri_hash);

return finalize_mint(self.caller, mint_future);
```

**Flow:**

1. Gateway's `mint()` transition calls collection's `mint_with_token_id()`
2. Collection returns `(NFT record, Future)`
3. Gateway's `finalize_mint()` awaits the collection's future
4. Both finalize functions execute on-chain sequentially

### Awaiting Futures

```leo
async function finalize_mint(caller: address, mint_future: Future) {
    // Check gateway permissions
    let owner: address = gateway_owner.get(0u8);
    assert_eq(caller, owner);

    // Execute collection's finalize
    mint_future.await();
}
```

---

## Deployment Order

**IMPORTANT:** Deploy in this order:

1. **First:** `mogate_nft_collection_rwa.aleo`

   - No dependencies
   - Must be deployed before gateway

2. **Second:** `mogate_authority_mint_gateway.aleo`
   - Imports collection
   - Requires collection to be deployed first

---

## Usage Examples

### Direct Minting (Public - No Gateway)

```bash
# Anyone can call this directly
leo run mint_to \
  "aleo1..." \
  "123456field"
```

### Gateway-Controlled Minting (Owner Only)

```bash
# Only gateway owner can call this
leo run mint \
  "aleo1..." \
  "123456field" \
  "1u64"
```

### Faucet Minting (Public via Gateway)

```bash
# Anyone can call this
leo run mint_nft \
  "aleo1..." \
  "123456field"
```

---

## Key Differences from Solidity

| Aspect                | Solidity                        | Leo/Aleo                          |
| --------------------- | ------------------------------- | --------------------------------- |
| **Contract Address**  | `0x123...`                      | Program name (`collection.aleo`)  |
| **Calling Contracts** | `IContract(address).function()` | `program.aleo/function()`         |
| **Access Control**    | Modifiers (`onlyOwner`)         | Assert in finalize                |
| **State Updates**     | Immediate                       | Two-phase (transition + finalize) |
| **Private Data**      | Not possible                    | Records (private by default)      |
| **Public Data**       | Storage variables               | Mappings (always public)          |

---

## Important Notes

1. **Collection is PUBLIC** - Anyone can mint directly, but gateway provides controlled access
2. **Program names are addresses** - No separate address concept
3. **Finalize functions are required** - For any state updates (mappings)
4. **Futures must be awaited** - Cross-contract calls return futures
5. **Deploy order matters** - Collection before gateway

---

## Next Steps

1. ✅ Collection deployed: `at1as952eycv6h7ypdph0rj8tfzr0c89arg7gtsyztsr8x08n9hkc9sf62wjd`
2. ⏳ Deploy gateway: `docker-compose run --rm deploy-gateway`
3. Initialize contracts with owner addresses
4. Test minting through gateway
