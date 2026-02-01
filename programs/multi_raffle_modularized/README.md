# Multi Raffle - Modularized

This is a modularized version of the `multi_raffle` program, restructured for better code organization and maintainability.

## Structure

```
src/
├── lib.rs                          # Main program entry point
├── constants.rs                    # PDA seeds and size constraints
├── error.rs                        # Error definitions
├── types.rs                        # Enums and view return types
├── utils.rs                        # Helper functions (mint, payment, join logic)
├── state/                          # Account state definitions
│   ├── mod.rs
│   ├── config.rs                   # Global config account
│   ├── raffle.rs                   # Raffle account
│   ├── raffle_slots.rs             # Raffle slots tracking
│   └── user_raffle.rs              # User participation tracking
└── instructions/                   # Instruction handlers
    ├── mod.rs
    ├── initialize_config.rs        # Initialize global config
    ├── unsafe_host_raffle.rs       # Create raffle (unsafe)
    ├── unsafe_join_raffle.rs       # Join raffle (unsafe)
    ├── unsafe_host_and_join_raffle.rs  # Combined host+join
    ├── draw_raffle.rs              # Draw winner
    ├── claim.rs                    # Claim prize
    ├── withdraw_proceeds.rs        # Admin withdraw
    ├── claim_refund.rs             # User refund
    └── view_helpers.rs             # View/query functions
```

## Key Features

- **Modular Design**: Each instruction is in its own file with clear separation of concerns
- **Reusable Utils**: Common logic extracted into utility functions
- **Type Safety**: Enums and types defined separately for clarity
- **Clean State Management**: State structs organized by domain

## Differences from Original

1. **File Organization**: Single 1489-line `lib.rs` split into 20+ focused modules
2. **Helper Functions**: Extracted `mint_prize_internal`, `end_raffle_internal`, `join_raffle_internal`, and `handle_native_payment` into `utils.rs`
3. **View Helpers**: All view/query functions consolidated in `view_helpers.rs`
4. **Constants**: All seeds and constraints in dedicated `constants.rs`

## Building

```bash
anchor build
```

## Program ID

Same as original: `2qaxQY3shNquV8STxFPoJW6bL9FUAEzUqinZSP163znG`

## Instructions

### Core Instructions

- `initialize_config` - One-time setup
- `unsafe_host_raffle` - Create new raffle
- `unsafe_join_raffle` - Join existing raffle
- `unsafe_host_and_join_raffle` - Combined create+join
- `draw_raffle` - Draw winner (manual)
- `claim` - Winner claims prize
- `withdraw_proceeds` - Admin withdraws funds
- `claim_refund` - User claims refund for expired raffle

### View Instructions

- `get_raffle_load` - Basic raffle info
- `get_raffle_load_detail` - Detailed raffle info
- `get_raffle_result` - Winner info
- `get_refund_status` - User refund eligibility
- `get_user_raffle_slots` - User's slots
- `check_slots_availability` - Check if slots are available
- `get_taken_slots_in_range` - Get taken slots in range
- `get_available_slots_in_range` - Get available slots in range
- `get_raffles_load` - Batch basic info
- `get_raffles_load_detail` - Batch detailed info
- `set_refund_fee_bps` - Admin update refund fee

## Notes

This modularized version maintains 100% functional parity with the original `multi_raffle` program while providing better code organization for development and maintenance.
