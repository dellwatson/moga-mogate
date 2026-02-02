# Multi Raffle Inco - Private Raffle Flow (Option A: Slot Semantics with FHE)

## Overview

This implementation maintains the **slot-based raffle mechanics** from the original `multi_raffle` program while adding **FHE privacy** for the draw and winner verification. Users still select specific slot numbers, but the winning slot and winner checks are encrypted.

## Architecture

### Account Structure

- **Raffle**: Main raffle state with encrypted `winning_slot_handle`
- **RaffleSlots**: Tracks which wallet owns which slot (public)
- **UserRaffle**: User's participation with encrypted `is_winner_handle`
- **Treasury**: Holds raffle funds

### Privacy Model

- ✅ **Winning slot is encrypted** - nobody knows which slot won until verified
- ✅ **Winner verification is encrypted** - users privately check if they won
- ❌ **Slot ownership is public** - anyone can see who owns which slots
- ❌ **Raffle fill state is public** - anyone can see how many slots are sold

## Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                    OPTION A: SLOT-BASED FHE                      │
└─────────────────────────────────────────────────────────────────┘

1. HOST RAFFLE
   ┌──────────────────────────────────────────────────────────┐
   │ private_host_raffle(                                      │
   │   raffle_id, total_slots, max_slots_per_address,         │
   │   metadata_uri, collection, prize_type, prize_amount...  │
   │ )                                                         │
   └──────────────────────────────────────────────────────────┘
   │
   ├─ Creates Raffle account (status: Open)
   ├─ Creates RaffleSlots account (all slots empty)
   ├─ Creates Treasury PDA
   └─ Sets winning_slot_handle = 0 (not drawn yet)

2. JOIN RAFFLE (Multiple users can join)
   ┌──────────────────────────────────────────────────────────┐
   │ private_join_raffle(                                      │
   │   slots: [1, 5, 10]  // User selects specific slots      │
   │ )                                                         │
   └──────────────────────────────────────────────────────────┘
   │
   ├─ Checks slot availability (public check)
   ├─ Assigns slots to user in RaffleSlots
   ├─ Creates UserRaffle account
   ├─ Transfers payment to Treasury
   └─ If all slots sold → status = Filled

3. DRAW WINNER (Authority only, after raffle filled)
   ┌──────────────────────────────────────────────────────────┐
   │ private_draw_winner()                                     │
   │                                                           │
   │ FHE Operations:                                           │
   │   random = e_rand()                                       │
   │   bounded = e_rem(random, total_slots)                    │
   │   winning_slot = e_add(bounded, 1)  // 1-based           │
   └──────────────────────────────────────────────────────────┘
   │
   ├─ Generates encrypted random winning slot (1 to total_slots)
   ├─ Stores winning_slot_handle (encrypted)
   ├─ Status = Drawn
   └─ ⚠️ Nobody knows which slot won (encrypted)

4. CHECK WINNER (Each user checks privately)
   ┌──────────────────────────────────────────────────────────┐
   │ private_check_winner()                                    │
   │                                                           │
   │ FHE Operations (for each user's slot):                    │
   │   slot_encrypted = as_euint128(slot_id)                   │
   │   slot_is_winner = e_eq(slot_encrypted, winning_slot)     │
   │   is_winner = e_or(is_winner, slot_is_winner)  // OR all │
   │                                                           │
   │ Grants decryption permission:                             │
   │   allow(is_winner_handle, user)                           │
   └──────────────────────────────────────────────────────────┘
   │
   ├─ Compares each user's slots with encrypted winning slot
   ├─ Stores encrypted is_winner_handle in UserRaffle
   ├─ Grants user permission to decrypt their result
   └─ User decrypts off-chain to learn if they won

5. WITHDRAW PRIZE (Winner only, with proof)
   ┌──────────────────────────────────────────────────────────┐
   │ private_withdraw_prize(                                   │
   │   handle: encrypted_is_winner,                            │
   │   plaintext: decrypted_result  // "1" or "true"          │
   │ )                                                         │
   │                                                           │
   │ On-chain verification:                                    │
   │   is_validsignature(handle, plaintext)  // Ed25519       │
   │   require(plaintext == true)                              │
   └──────────────────────────────────────────────────────────┘
   │
   ├─ Verifies decryption proof on-chain
   ├─ Confirms user is winner
   ├─ Transfers prize from Treasury to winner
   └─ Marks raffle as claimed
```

## Key Features

### Privacy Guarantees

1. **Encrypted Draw**: Winning slot is generated using FHE random number generation
2. **Private Winner Check**: Users can check if they won without revealing results to others
3. **Proof-Based Claiming**: Winners must provide valid decryption proof to claim

### Public Information

1. **Slot Ownership**: Anyone can see which wallet owns which slots
2. **Raffle Progress**: Total slots, sold slots, and fill status are public
3. **Participation**: User addresses and their slot selections are visible

### Trade-offs

- ✅ **Maintains slot semantics**: Compatible with existing UI/UX
- ✅ **Prevents result manipulation**: Winner is encrypted until verified
- ❌ **Slot sniping possible**: Users can see which slots are taken
- ❌ **Front-running possible**: Users can see raffle fill state

## Instructions

### 1. `private_host_raffle`

Creates a new private raffle with slot-based mechanics.

**Parameters:**

- `raffle_id`: Unique identifier
- `total_slots`: Number of slots (e.g., 100)
- `max_slots_per_address`: Max slots per user
- `metadata_uri`, `collection`, `prize_type`, `prize_amount`, etc.

**Accounts:**

- Raffle (init)
- RaffleSlots (init)
- Treasury (init)

### 2. `private_join_raffle`

User joins by selecting specific slot numbers.

**Parameters:**

- `slots`: Vec<u32> - Selected slot IDs (1-based)

**Accounts:**

- Raffle (mut)
- RaffleSlots (mut)
- UserRaffle (init)
- Treasury (mut)

### 3. `private_draw_winner`

Authority draws encrypted winning slot using FHE.

**Accounts:**

- Raffle (mut)
- IncoLightning program

**FHE Operations:**

- `e_rand()`: Generate random number
- `e_rem()`: Modulo operation
- `e_add()`: Add 1 for 1-based indexing

### 4. `private_check_winner`

User checks if any of their slots won.

**Accounts:**

- Raffle
- UserRaffle (mut)
- IncoLightning program

**FHE Operations:**

- `as_euint128()`: Convert slot to encrypted
- `e_eq()`: Compare with winning slot
- `e_or()`: Combine results for multiple slots
- `allow()`: Grant decryption permission

### 5. `private_withdraw_prize`

Winner claims prize with decryption proof.

**Parameters:**

- `handle`: Encrypted is_winner handle
- `plaintext`: Decrypted result (must be true)

**Accounts:**

- Raffle (mut)
- UserRaffle
- Treasury (mut)
- Instructions sysvar
- IncoLightning program

**Verification:**

- `is_validsignature()`: Verify Ed25519 signature proof

## Comparison with Original multi_raffle

| Feature                  | Original           | Inco (Option A)               |
| ------------------------ | ------------------ | ----------------------------- |
| Slot selection           | Public             | Public                        |
| Slot ownership           | Public             | Public                        |
| Winner draw              | Public random      | **Encrypted FHE random**      |
| Winner identity          | Public immediately | **Encrypted until verified**  |
| Prize claiming           | Direct             | **Requires decryption proof** |
| Front-running protection | ❌                 | ✅ (for draw)                 |
| Sniping protection       | ❌                 | ❌                            |

## Use Cases

Best for:

- ✅ Raffles where slot selection is important
- ✅ Preventing draw manipulation
- ✅ Hiding winner until verification
- ✅ Maintaining existing slot-based UX

Not ideal for:

- ❌ Complete anonymity (slot ownership is public)
- ❌ Preventing slot sniping
- ❌ Hiding raffle fill state

## Example Flow

```
1. Alice hosts raffle: 10 slots, 0.1 SOL each
2. Bob joins: selects slots [1, 3, 5]
3. Carol joins: selects slots [2, 4]
4. Dave joins: selects slots [6, 7, 8, 9, 10]
5. Raffle filled → Authority draws winner
   - Encrypted winning slot generated (e.g., slot 7)
   - Nobody knows which slot won yet
6. Bob checks: e_eq([1,3,5], winning_slot) → encrypted false
7. Carol checks: e_eq([2,4], winning_slot) → encrypted false
8. Dave checks: e_eq([6,7,8,9,10], winning_slot) → encrypted TRUE
   - Dave decrypts off-chain: "I won!"
9. Dave withdraws prize with proof
   - Provides decryption proof
   - On-chain verification succeeds
   - Prize transferred to Dave
```

## Security Considerations

1. **Encrypted Draw**: Uses Inco Lightning's FHE random number generation
2. **Proof Verification**: Ed25519 signature verification prevents fake claims
3. **Permission System**: Only allowed users can decrypt their results
4. **No Result Leakage**: Winner identity hidden until proof provided

## Cost Implications

FHE operations are expensive:

- `e_rand()`: ~100K compute units
- `e_rem()`: ~50K compute units
- `e_add()`: ~30K compute units
- `e_eq()`: ~40K compute units per slot
- `e_or()`: ~30K compute units per slot

**Estimated costs:**

- Draw: ~200K CU
- Check (3 slots): ~210K CU
- Withdraw: ~50K CU

Total: ~460K CU per raffle (vs ~10K for non-FHE)
