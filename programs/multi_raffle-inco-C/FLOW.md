# Multi Raffle Inco Auto - Auto-Assigned Encrypted Numbers (Option C)

## Overview

This is the **SIMPLEST** FHE raffle implementation. Users don't pick or guess anything - the system **automatically assigns** an encrypted random number to each participant. It's a pure lottery where users just join and hope their auto-assigned number wins!

## Architecture

### Account Structure

- **Raffle**: Main raffle state with encrypted `winning_number_handle`
- **Ticket**: Individual ticket with **AUTO-ASSIGNED** encrypted `number_handle`
- **Treasury**: Holds raffle funds

### Privacy Model

- ✅ **User's number is auto-assigned** - user doesn't pick anything
- ✅ **Number is encrypted** - user doesn't even know their own number!
- ✅ **Winning number is encrypted** - nobody knows the winning number
- ✅ **Winner verification is encrypted** - results are private
- ✅ **Maximum simplicity** - just click "Join Raffle"

## Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│           OPTION C: AUTO-ASSIGNED ENCRYPTED NUMBERS              │
│                    (Simplest UX - Pure Lottery)                  │
└─────────────────────────────────────────────────────────────────┘

1. CREATE RAFFLE
   ┌──────────────────────────────────────────────────────────┐
   │ create_raffle(                                            │
   │   raffle_id, max_number: 100,  // Number range 1-100     │
   │   ticket_price, metadata_uri, collection...              │
   │ )                                                         │
   └──────────────────────────────────────────────────────────┘
   │
   ├─ Creates Raffle account (status: Open)
   ├─ Creates Treasury PDA
   ├─ Sets max_number (e.g., 100 for range 1-100)
   └─ Sets winning_number_handle = 0 (not drawn yet)

2. JOIN RAFFLE (Users just join - NO input needed!)
   ┌──────────────────────────────────────────────────────────┐
   │ join_raffle()  ← NO PARAMETERS!                          │
   │                                                           │
   │ FHE Operations (System does this):                       │
   │   random = e_rand()                                       │
   │   bounded = e_rem(random, max_number)                     │
   │   number = e_add(bounded, 1)  // Auto-assign 1-100       │
   │   allow(number, user)  // Let user decrypt later         │
   └──────────────────────────────────────────────────────────┘
   │
   ├─ System generates encrypted random number FOR user
   ├─ Creates Ticket with auto-assigned number_handle
   ├─ Transfers ticket_price to Treasury
   ├─ Grants user permission to decrypt their number (optional)
   └─ ⚠️ User doesn't know their number (encrypted!)

3. DRAW WINNER (Authority only, when ready)
   ┌──────────────────────────────────────────────────────────┐
   │ draw_winner()                                             │
   │                                                           │
   │ FHE Operations:                                           │
   │   random = e_rand()                                       │
   │   bounded = e_rem(random, max_number)                     │
   │   winning_number = e_add(bounded, 1)  // 1-based         │
   └──────────────────────────────────────────────────────────┘
   │
   ├─ Generates encrypted random winning number (1 to max_number)
   ├─ Stores winning_number_handle (encrypted)
   ├─ Status = Drawn
   └─ ⚠️ Nobody knows the winning number (encrypted)

4. CHECK WINNER (Each ticket holder checks)
   ┌──────────────────────────────────────────────────────────┐
   │ check_winner()                                            │
   │                                                           │
   │ FHE Operations:                                           │
   │   is_winner = e_eq(number_handle, winning_number_handle) │
   │                                                           │
   │ Grants decryption permission:                             │
   │   allow(is_winner_handle, ticket_owner)                   │
   └──────────────────────────────────────────────────────────┘
   │
   ├─ Compares auto-assigned number with winning number
   ├─ Stores encrypted is_winner_handle in Ticket
   ├─ Grants ticket owner permission to decrypt result
   └─ User decrypts off-chain to learn if they won

5. WITHDRAW PRIZE (Winner only, with proof)
   ┌──────────────────────────────────────────────────────────┐
   │ withdraw_prize(                                           │
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
   ├─ Confirms ticket is winner
   ├─ Transfers prize from Treasury to winner
   └─ Marks raffle as claimed
```

## Key Features

### Maximum Simplicity

1. **No User Input**: Users just click "Join Raffle" - that's it!
2. **Auto-Assignment**: System generates encrypted number for user
3. **User Doesn't Know**: User doesn't even know their own number (encrypted)
4. **Pure Lottery**: Completely fair - system assigns randomly

### Privacy Guarantees

1. **Encrypted Numbers**: All numbers are encrypted
2. **Encrypted Winning Number**: Nobody knows the winning number
3. **Encrypted Results**: Only you know if you won
4. **No Guessing**: No user input means no bias

### Trade-offs

- ✅ **Simplest UX possible** - just join!
- ✅ **Maximum fairness** - system assigns randomly
- ✅ **No front-running** - no user input to front-run
- ✅ **No sniping** - no slots or numbers to snipe
- ❌ **Single winner only** - first to claim wins
- ❌ **Users can't pick "lucky numbers"**

## Instructions

### 1. `create_raffle`

Creates a new auto-assigned raffle.

**Parameters:**

- `raffle_id`: Unique identifier
- `max_number`: Maximum number in range (e.g., 100 for 1-100)
- `ticket_price`: Cost per ticket
- `metadata_uri`, `collection`, `prize_type`, `prize_amount`, etc.

**Accounts:**

- Raffle (init)
- Treasury (init)

### 2. `join_raffle`

User joins raffle - **NO PARAMETERS!**

**What happens:**

- System generates encrypted random number (1 to max_number)
- Assigns it to user's ticket
- User doesn't know what number they got!

**Accounts:**

- Raffle (mut)
- Ticket (init)
- Treasury (mut)
- IncoLightning program

**FHE Operations:**

- `e_rand()`: Generate random number
- `e_rem()`: Modulo operation
- `e_add()`: Add 1 for 1-based range
- `allow()`: Grant user permission to decrypt (optional)

### 3. `draw_winner`

Authority draws encrypted winning number using FHE.

**Accounts:**

- Raffle (mut)
- IncoLightning program

**FHE Operations:**

- `e_rand()`: Generate random number
- `e_rem()`: Modulo operation
- `e_add()`: Add 1 for 1-based range

### 4. `check_winner`

Ticket holder checks if their auto-assigned number matches winning number.

**Accounts:**

- Raffle
- Ticket (mut)
- IncoLightning program

**FHE Operations:**

- `e_eq()`: Compare auto-assigned number with winning number
- `allow()`: Grant ticket owner decryption permission

### 5. `withdraw_prize`

Winner claims prize with decryption proof.

**Parameters:**

- `handle`: Encrypted is_winner handle
- `plaintext`: Decrypted result (must be true)

**Accounts:**

- Raffle (mut)
- Ticket
- Treasury (mut)
- Instructions sysvar
- IncoLightning program

**Verification:**

- `is_validsignature()`: Verify Ed25519 signature proof

## Comparison with Other Options

| Feature                 | Option A (Slots)    | Option B (Guess)   | **Option C (Auto)**          |
| ----------------------- | ------------------- | ------------------ | ---------------------------- |
| User input              | Select slots        | Guess number       | **None!**                    |
| Input privacy           | ❌ Public           | ✅ Encrypted       | ✅ **N/A - no input**        |
| Number assignment       | User picks          | User guesses       | **System auto-assigns**      |
| User knows their number | ✅ Yes              | ✅ Yes             | ❌ **No (encrypted)**        |
| Multiple winners        | ❌ No               | ✅ Yes             | ❌ No                        |
| Prize type              | SOL                 | SPL Tokens         | SOL                          |
| Client complexity       | Low                 | High (FHE lib)     | **Lowest**                   |
| UX familiarity          | ✅ Traditional      | ❌ Different       | ✅ **Simplest**              |
| Front-running           | ✅ Protected (draw) | ✅ Fully protected | ✅ **Impossible (no input)** |
| Sniping                 | ❌ Possible         | ✅ Prevented       | ✅ **Impossible (no slots)** |

## Use Cases

Best for:

- ✅ **Pure lottery** - no number picking
- ✅ **Simplest UX** - just join and wait
- ✅ **Maximum fairness** - system assigns randomly
- ✅ **No user bias** - users can't pick "lucky numbers"
- ✅ **Quick raffles** - minimal user interaction

Not ideal for:

- ❌ Users who want to pick "lucky numbers"
- ❌ Multiple winners (only one winner)
- ❌ Token distribution (uses SOL)

## Example Flow

```
1. Alice creates raffle: range 1-100, 0.1 SOL per ticket
2. Bob joins:
   - Clicks "Join Raffle"
   - Pays 0.1 SOL
   - System auto-assigns encrypted number (e.g., 42)
   - Bob doesn't know he got 42!
3. Carol joins:
   - Clicks "Join Raffle"
   - Pays 0.1 SOL
   - System auto-assigns encrypted number (e.g., 7)
   - Carol doesn't know she got 7!
4. Dave joins:
   - Clicks "Join Raffle"
   - Pays 0.1 SOL
   - System auto-assigns encrypted number (e.g., 99)
   - Dave doesn't know he got 99!
5. Authority draws winner:
   - Encrypted winning number generated (e.g., 42)
   - Nobody knows the winning number yet
6. Bob checks: e_eq(42_encrypted, winning_number) → encrypted TRUE
   - Bob decrypts off-chain: "I won! 🎉"
7. Carol checks: e_eq(7_encrypted, winning_number) → encrypted FALSE
   - Carol decrypts off-chain: "I lost 😢"
8. Dave checks: e_eq(99_encrypted, winning_number) → encrypted FALSE
   - Dave decrypts off-chain: "I lost 😢"
9. Bob withdraws prize with proof
   - Provides decryption proof
   - On-chain verification succeeds
   - Prize transferred to Bob
```

## Privacy Guarantees

### What's Hidden

1. **User's Number**: User doesn't know their own number!
2. **Winning Number**: Nobody knows the winning number
3. **Winner Identity**: Nobody knows who won until they claim
4. **All Numbers**: All numbers are encrypted throughout

### What's Public

1. **Raffle Exists**: Raffle account is public
2. **Ticket Exists**: Ticket accounts are public (but numbers are encrypted)
3. **Wallet Addresses**: Participant addresses are visible
4. **Claim Event**: When someone claims, it's visible

## Security Considerations

1. **Fair Assignment**: System uses FHE random for assignment
2. **No User Bias**: Users can't pick numbers
3. **Proof Verification**: Ed25519 signature prevents fake claims
4. **Permission System**: Only allowed users can decrypt their results
5. **No Number Leakage**: Numbers remain encrypted throughout

## Cost Implications

FHE operations are expensive:

- `e_rand()`: ~100K compute units
- `e_rem()`: ~50K compute units
- `e_add()`: ~30K compute units
- `e_eq()`: ~40K compute units
- `allow()`: ~20K compute units

**Estimated costs:**

- Join raffle: ~200K CU (auto-assign number)
- Draw: ~200K CU
- Check: ~60K CU
- Withdraw: ~50K CU

Total per ticket: ~510K CU (vs ~10K for non-FHE)

## Client Integration

Users need minimal client code:

```typescript
// Join raffle - NO number picking!
await program.methods.joinRaffle().rpc();

// Check if you won
await program.methods.checkWinner().rpc();
const result = await fheClient.decrypt(ticket.is_winner_handle);
console.log(result ? "You won!" : "You lost");

// Claim prize
if (result) {
  const proof = await fheClient.generateProof(ticket.is_winner_handle);
  await program.methods.withdrawPrize(proof.handle, proof.plaintext).rpc();
}

// Optional: Decrypt your auto-assigned number (just for curiosity)
const myNumber = await fheClient.decrypt(ticket.number_handle);
console.log("My number was:", myNumber);
```

## Advantages

1. **Simplest UX**: Just click "Join" - that's it!
2. **Maximum Fairness**: System assigns randomly
3. **No Front-Running**: No user input to front-run
4. **No Sniping**: No slots or numbers to snipe
5. **Pure Lottery**: True random assignment
6. **Privacy**: Numbers encrypted throughout

## Disadvantages

1. **No Lucky Numbers**: Users can't pick their favorite numbers
2. **Single Winner**: Only one winner (vs distributed in Option B)
3. **Higher Costs**: FHE operations are expensive
4. **User Doesn't Know**: User doesn't know their number (some may not like this)

## Summary

**Option C is the SIMPLEST FHE raffle:**

- ✨ No user input needed
- 🎲 System auto-assigns encrypted numbers
- 🔒 Maximum privacy and fairness
- 🎯 Perfect for pure lottery use cases
