# Multi Raffle Inco Full - Pure FHE Guess Raffle (Option B)

## Overview

This implementation is a **pure FHE guess-based raffle** similar to Inco's private-raffle example. Users submit **encrypted guesses** (1-N), and the system generates an **encrypted random winning number**. Everything is encrypted - guesses, winning number, and results.

## Architecture

### Account Structure

- **Raffle**: Main raffle state with encrypted `winning_number_handle`
- **Ticket**: Individual ticket with encrypted `guess_handle` and `is_winner_handle`
- **Treasury**: Holds raffle funds

### Privacy Model

- ✅ **Guesses are encrypted** - nobody knows what number you picked
- ✅ **Winning number is encrypted** - nobody knows the winning number
- ✅ **Winner verification is encrypted** - results are private
- ✅ **No slot ownership tracking** - maximum privacy
- ✅ **No public raffle state** - participation is private

## Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                   OPTION B: PURE FHE GUESS GAME                  │
└─────────────────────────────────────────────────────────────────┘

1. CREATE RAFFLE
   ┌──────────────────────────────────────────────────────────┐
   │ create_raffle(                                            │
   │   raffle_id, max_number: 100,  // Guess range 1-100      │
   │   ticket_price, metadata_uri, collection...              │
   │ )                                                         │
   └──────────────────────────────────────────────────────────┘
   │
   ├─ Creates Raffle account (status: Open)
   ├─ Creates Treasury PDA
   ├─ Sets max_number (e.g., 100 for guesses 1-100)
   └─ Sets winning_number_handle = 0 (not drawn yet)

2. BUY TICKET (Each user buys independently)
   ┌──────────────────────────────────────────────────────────┐
   │ buy_ticket(                                               │
   │   encrypted_guess: Vec<u8>  // User's encrypted number   │
   │ )                                                         │
   │                                                           │
   │ FHE Operations:                                           │
   │   guess_handle = new_euint128(encrypted_guess)            │
   │   allow(guess_handle, buyer)  // Grant decrypt permission│
   └──────────────────────────────────────────────────────────┘
   │
   ├─ Creates Ticket account with encrypted guess
   ├─ Stores guess_handle (encrypted)
   ├─ Transfers ticket_price to Treasury
   ├─ Grants buyer permission to decrypt their own guess
   └─ ⚠️ Nobody knows what number was guessed (encrypted)

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
   │   is_winner = e_eq(guess_handle, winning_number_handle)   │
   │                                                           │
   │ Grants decryption permission:                             │
   │   allow(is_winner_handle, ticket_owner)                   │
   └──────────────────────────────────────────────────────────┘
   │
   ├─ Compares encrypted guess with encrypted winning number
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

### Maximum Privacy

1. **Encrypted Guesses**: Nobody knows what number you picked
2. **Encrypted Winning Number**: Nobody knows the winning number
3. **Encrypted Results**: Only you know if you won
4. **No Public Tracking**: No slot ownership or participation tracking

### Pure FHE Operations

1. **Client-side Encryption**: Users encrypt their guess before submitting
2. **FHE Comparison**: All comparisons happen on encrypted data
3. **Proof-Based Claiming**: Winners prove they won without revealing the number

### Trade-offs

- ✅ **Maximum privacy**: Guesses and results are private
- ✅ **No front-running**: Nobody can see what others guessed
- ✅ **No sniping**: No concept of slots to snipe
- ❌ **Different UX**: Users don't select slots, they guess numbers
- ❌ **Higher complexity**: Requires client-side FHE encryption

## Instructions

### 1. `create_raffle`

Creates a new guess-based raffle.

**Parameters:**

- `raffle_id`: Unique identifier
- `max_number`: Maximum guess value (e.g., 100 for 1-100)
- `ticket_price`: Cost per ticket
- `metadata_uri`, `collection`, `prize_type`, `prize_amount`, etc.

**Accounts:**

- Raffle (init)
- Treasury (init)

### 2. `buy_ticket`

User buys a ticket with encrypted guess.

**Parameters:**

- `encrypted_guess`: Vec<u8> - Client-encrypted guess (1 to max_number)

**Accounts:**

- Raffle (mut)
- Ticket (init)
- Treasury (mut)
- IncoLightning program

**FHE Operations:**

- `new_euint128()`: Create encrypted handle from ciphertext
- `allow()`: Grant buyer decryption permission

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

Ticket holder checks if their guess matches winning number.

**Accounts:**

- Raffle
- Ticket (mut)
- IncoLightning program

**FHE Operations:**

- `e_eq()`: Compare encrypted guess with encrypted winning number
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

## Comparison with Option A (Slot-Based)

| Feature                  | Option A (Slots) | Option B (Guess)  |
| ------------------------ | ---------------- | ----------------- |
| User input               | Select slots     | Guess number      |
| Input privacy            | ❌ Public        | ✅ Encrypted      |
| Slot ownership           | ✅ Tracked       | ❌ No slots       |
| Participation tracking   | ✅ Public        | ✅ Private        |
| Winner draw              | Encrypted slot   | Encrypted number  |
| Winner identity          | Encrypted        | Encrypted         |
| Prize claiming           | Proof required   | Proof required    |
| Front-running protection | ✅ (for draw)    | ✅ (complete)     |
| Sniping protection       | ❌               | ✅ (no slots)     |
| UX familiarity           | ✅ Traditional   | ❌ Different      |
| Client complexity        | Low              | High (encryption) |

## Use Cases

Best for:

- ✅ Maximum privacy requirements
- ✅ Preventing all forms of front-running
- ✅ Lottery-style raffles (guess a number)
- ✅ When participation should be private

Not ideal for:

- ❌ Traditional slot-based raffles
- ❌ When users want to see slot ownership
- ❌ Simple UX requirements (requires FHE client)

## Example Flow

```
1. Alice creates raffle: guess 1-100, 0.1 SOL per ticket
2. Bob buys ticket:
   - Picks number 42
   - Encrypts 42 client-side → encrypted_guess
   - Submits buy_ticket(encrypted_guess)
   - Nobody knows Bob guessed 42
3. Carol buys ticket:
   - Picks number 7
   - Encrypts 7 client-side → encrypted_guess
   - Submits buy_ticket(encrypted_guess)
   - Nobody knows Carol guessed 7
4. Dave buys ticket:
   - Picks number 42 (same as Bob!)
   - Encrypts 42 client-side → encrypted_guess
   - Submits buy_ticket(encrypted_guess)
   - Nobody knows Dave also guessed 42
5. Authority draws winner:
   - Encrypted winning number generated (e.g., 42)
   - Nobody knows the winning number yet
6. Bob checks: e_eq(42_encrypted, winning_number) → encrypted TRUE
   - Bob decrypts off-chain: "I won!"
7. Carol checks: e_eq(7_encrypted, winning_number) → encrypted FALSE
   - Carol decrypts off-chain: "I lost"
8. Dave checks: e_eq(42_encrypted, winning_number) → encrypted TRUE
   - Dave decrypts off-chain: "I won too!"
9. Bob withdraws prize first with proof
   - Provides decryption proof
   - On-chain verification succeeds
   - Prize transferred to Bob
   - Raffle marked as claimed
10. Dave tries to withdraw but raffle already claimed
```

## Privacy Guarantees

### What's Hidden

1. **User Guesses**: Nobody knows what number you picked
2. **Winning Number**: Nobody knows the winning number
3. **Winner Identity**: Nobody knows who won until they claim
4. **Participation**: Nobody knows who participated (except on-chain addresses)

### What's Public

1. **Raffle Exists**: Raffle account is public
2. **Ticket Exists**: Ticket accounts are public (but guesses are encrypted)
3. **Wallet Addresses**: Participant addresses are visible
4. **Claim Event**: When someone claims, it's visible

## Security Considerations

1. **Client-Side Encryption**: Users must encrypt guesses properly
2. **Proof Verification**: Ed25519 signature prevents fake claims
3. **Permission System**: Only allowed users can decrypt their results
4. **No Guess Leakage**: Guesses remain encrypted throughout
5. **First-Come-First-Serve**: Multiple winners possible, first to claim wins

## Cost Implications

FHE operations are expensive:

- `new_euint128()`: ~80K compute units
- `e_rand()`: ~100K compute units
- `e_rem()`: ~50K compute units
- `e_add()`: ~30K compute units
- `e_eq()`: ~40K compute units
- `allow()`: ~20K compute units

**Estimated costs:**

- Buy ticket: ~100K CU
- Draw: ~200K CU
- Check: ~60K CU
- Withdraw: ~50K CU

Total per ticket: ~410K CU (vs ~10K for non-FHE)

## Client Integration Requirements

Users need FHE client library to:

1. **Encrypt guesses** before submitting
2. **Decrypt results** after checking
3. **Generate proofs** for claiming

Example (pseudocode):

```typescript
// Buy ticket
const guess = 42;
const encrypted = await fheClient.encrypt(guess);
await program.methods.buyTicket(encrypted).rpc();

// Check winner
await program.methods.checkWinner().rpc();
const result = await fheClient.decrypt(ticket.is_winner_handle);
console.log(result ? "You won!" : "You lost");

// Claim prize
if (result) {
  const proof = await fheClient.generateProof(ticket.is_winner_handle);
  await program.methods.withdrawPrize(proof.handle, proof.plaintext).rpc();
}
```

## Advantages Over Option A

1. **Complete Privacy**: Guesses are encrypted, not just results
2. **No Front-Running**: Nobody can see what others guessed
3. **No Sniping**: No concept of slots to snipe
4. **Fair Draw**: Truly random encrypted number generation
5. **Multiple Winners**: Multiple people can guess the same number

## Disadvantages vs Option A

1. **Different UX**: Not traditional slot-based raffle
2. **Client Complexity**: Requires FHE encryption library
3. **Higher Costs**: More FHE operations per ticket
4. **First-Come Claiming**: If multiple winners, first to claim wins
5. **Less Familiar**: Users may not understand guess-based raffles
