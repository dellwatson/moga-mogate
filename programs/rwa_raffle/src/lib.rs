use anchor_lang::prelude::*;
use anchor_spl::token_interface::{self as token, Mint, TokenAccount, TransferChecked};
use anchor_spl::token::Token;
use arcium_anchor::prelude::*;
use anchor_lang::solana_program::instruction::AccountMeta;
// Temporarily commented out - Light SDK incompatible with rustc 1.79.0 // 
// use light_sdk::{
//     account::LightAccount,
//     address::v1::derive_address,
//     cpi::{v1::CpiAccounts, CpiSigner},
//     derive_light_cpi_signer,
//     instruction::{PackedAddressTreeInfo, ValidityProof},
//     LightDiscriminator, LightHasher,
// };
// use light_sdk::cpi::{v1::LightSystemProgramCpi, InvokeLightSystemProgram, LightCpiInstruction};

#[cfg(feature = "bubblegum")]
use mpl_bubblegum::programs::MPL_BUBBLEGUM_ID;
#[cfg(feature = "bubblegum")]
use spl_account_compression::{program::SplAccountCompression, Noop};

// NOTE: Devnet program id
declare_id!("5xAQW7YPsYjHkeWfuqa55ZbeUDcLJtsRUiU4HcCLm12M");

const RAFFLE_SEED: &[u8] = b"raffle";
const TICKET_SEED: &[u8] = b"ticket";
const SLOTS_SEED: &[u8] = b"slots";

// pub const LIGHT_CPI_SIGNER: CpiSigner =
//     derive_light_cpi_signer!("5xAQW7YPsYjHkeWfuqa55ZbeUDcLJtsRUiU4HcCLm12M");

const COMP_DEF_OFFSET_DRAW: u32 = comp_def_offset("draw");

#[cfg_attr(not(feature = "arcium"), program)]
#[cfg_attr(feature = "arcium", arcium_program)]
pub mod rwa_raffle {
    use super::*;

    /// Initialize a new raffle. Escrow mint is the stable coin (e.g. USDC) and
    /// escrow ATA must be owned by the raffle PDA. This path requires only the
    /// organizer signature.
    pub fn initialize_raffle(
        ctx: Context<InitializeRaffle>,
        required_tickets: u64,
        deadline_unix_ts: i64,
        auto_draw: bool,
        ticket_mode: u8, // 0=disabled, 1=accept_without_burn, 2=require_burn
    ) -> Result<()> {
        require!(required_tickets > 0, RaffleError::InvalidAmount);
        require!(deadline_unix_ts > Clock::get()?.unix_timestamp, RaffleError::InvalidDeadline);

        // Get keys before mutable borrow
        let raffle_key = ctx.accounts.raffle.key();
        let organizer_key = ctx.accounts.organizer.key();
        let mint_key = ctx.accounts.mint.key();
        let escrow_key = ctx.accounts.escrow_ata.key();

        let raffle = &mut ctx.accounts.raffle;
        raffle.organizer = organizer_key;
        raffle.mint = mint_key;
        raffle.escrow = escrow_key;
        raffle.required_tickets = required_tickets;
        raffle.tickets_sold = 0;
        raffle.next_ticket_index = 1; // 1-based ticket numbers
        raffle.deadline = deadline_unix_ts;
        raffle.status = RaffleStatus::Selling as u8;
        raffle.winner_ticket = 0;
        raffle.proceeds_collected = false;
        raffle.auto_draw = auto_draw;
        raffle.ticket_mode = ticket_mode;
        raffle.bump = ctx.bumps.raffle;

        // Basic invariants for escrow
        require_keys_eq!(ctx.accounts.escrow_ata.mint, mint_key);
        require_keys_eq!(ctx.accounts.escrow_ata.owner, raffle_key);

        emit!(RaffleInitialized {
            raffle: raffle_key,
            organizer: organizer_key,
            mint: mint_key,
            required_tickets,
            deadline_unix_ts,
        });

        // Initialize RaffleSlots PDA for per-slot state
        let slots_acc = &mut ctx.accounts.slots;
        slots_acc.raffle = raffle_key;
        slots_acc.required_slots = required_tickets as u32;
        let bitmap_len = ((required_tickets + 7) / 8) as usize;
        slots_acc.bitmap = vec![0u8; bitmap_len];
        slots_acc.owners = vec![Pubkey::default(); required_tickets as usize];
        Ok(())
    }

/// Accounts for the organizer to collect proceeds after raffle completion.
#[derive(Accounts)]
pub struct CollectProceeds<'info> {
    /// The organizer who created the raffle and is authorized to collect proceeds.
    #[account(mut)]
    pub organizer: Signer<'info>,
    
    /// The raffle account. Must be in Completed status and match the organizer.
    #[account(mut, has_one = mint, constraint = raffle.organizer == organizer.key(), constraint = raffle.escrow == escrow_ata.key())]
    pub raffle: Account<'info, Raffle>,
    
    /// The escrow mint (USDC). Used for transfer_checked validation.
    pub mint: InterfaceAccount<'info, Mint>, // is this used for swap too?
    
    /// The organizer's token account (USDC) where proceeds will be sent.
    #[account(mut, constraint = organizer_ata.owner == organizer.key(), constraint = organizer_ata.mint == mint.key())]
    pub organizer_ata: InterfaceAccount<'info, TokenAccount>,
    
    /// The raffle's escrow token account (USDC) holding all participant deposits.
    /// Owned by the raffle PDA, which will sign the transfer.
    #[account(mut, constraint = escrow_ata.owner == raffle.key(), constraint = escrow_ata.mint == mint.key())]
    pub escrow_ata: InterfaceAccount<'info, TokenAccount>,
    
    /// SPL Token program for the transfer.
    pub token_program: Program<'info, Token>,
}

    /// **Organizer collects USDC proceeds from the raffle escrow after completion.** // might add time allowed to be taken too?
    ///
    /// # What it does
    /// - Transfers the entire USDC balance from the raffle's escrow account to the organizer's token account.
    /// - Marks `proceeds_collected` to prevent double-collection.
    ///
    /// # When to call
    /// - After the raffle is `Completed` (winner selected and claimed).
    /// - Only the organizer can call this (enforced by account constraints).
    ///
    /// # Security
    /// - Raffle PDA signs the transfer using its bump seed.
    /// - Single-use: `proceeds_collected` flag prevents re-entrancy.
    /// - Status check: only works when `status == Completed`.
    ///
    /// # Example flow
    /// 1. Raffle completes → winner claims prize.
    /// 2. Organizer calls `collect_proceeds()` → all USDC moved to organizer's wallet.
    pub fn collect_proceeds(ctx: Context<CollectProceeds>) -> Result<()> {
        // Get account infos before mutable borrow
        let raffle_account_info = ctx.accounts.raffle.to_account_info();
        let amount = ctx.accounts.escrow_ata.amount;
        let mint_key = ctx.accounts.mint.key();
        let organizer_key = ctx.accounts.organizer.key();
        
        let raffle = &mut ctx.accounts.raffle;
        
        // 1. Verify raffle is completed (winner selected)
        require!(raffle.status == RaffleStatus::Completed as u8, RaffleError::WrongStatus);
        
        // 2. Prevent double-collection
        require!(!raffle.proceeds_collected, RaffleError::AlreadyCollected);

        // 3. Get the full escrow balance (all participant USDC deposits)
        require!(amount > 0, RaffleError::InvalidAmount);

        // 4. Prepare the transfer: escrow → organizer
        let raffle_bump = raffle.bump;
        
        let cpi_accounts = TransferChecked {
            from: ctx.accounts.escrow_ata.to_account_info(),
            to: ctx.accounts.organizer_ata.to_account_info(),
            mint: ctx.accounts.mint.to_account_info(),
            authority: raffle_account_info, // Raffle PDA signs
        };
        let cpi_program = ctx.accounts.token_program.to_account_info();
        
        // 5. Derive PDA signer seeds (raffle PDA owns the escrow)
        let seeds: &[&[u8]] = &[
            RAFFLE_SEED,
            mint_key.as_ref(),
            organizer_key.as_ref(),
        ];
        let bump = [raffle_bump];
        let signer_seeds: &[&[u8]] = &[seeds[0], seeds[1], seeds[2], &bump];
        
        // 6. Execute the transfer with PDA signature
        token::transfer_checked(
            CpiContext::new_with_signer(cpi_program, cpi_accounts, &[signer_seeds]),
            amount,
            ctx.accounts.mint.decimals,
        )?;

        // 7. Mark as collected to prevent re-entrancy
        raffle.proceeds_collected = true;
        Ok(())
    }

#[derive(Accounts)]
#[instruction(required_tickets: u64, deadline_unix_ts: i64, permit_nonce: [u8; 16], permit_expiry_unix_ts: i64, auto_draw: bool, ticket_mode: u8)]
pub struct InitializeRaffleWithPermit<'info> {
    #[account(mut)]
    pub organizer: Signer<'info>,
    pub mint: InterfaceAccount<'info, Mint>,
    /// Escrow token account must be owned by raffle PDA and match the mint.
    pub escrow_ata: InterfaceAccount<'info, TokenAccount>,
    #[account(
        init,
        payer = organizer,
        space = 8 + Raffle::LEN,
        seeds = [RAFFLE_SEED, mint.key().as_ref(), organizer.key().as_ref()],
        bump,
    )]
    pub raffle: Account<'info, Raffle>,
    #[account(
        init,
        payer = organizer,
        space = 8 + RaffleSlots::space(required_tickets),
        seeds = [SLOTS_SEED, raffle.key().as_ref()],
        bump,
    )]
    pub slots: Account<'info, RaffleSlots>,
    /// CHECK: Instructions sysvar, used to verify ed25519 instruction
    #[account(address = anchor_lang::solana_program::sysvar::instructions::ID)]
    pub instructions_sysvar: AccountInfo<'info>,
    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
}

    /// Initialize a new raffle with an off-chain organizer permit (ed25519-like).
    /// This mirrors `initialize_raffle` but includes the instructions sysvar so
    /// we can verify an `ed25519` signature instruction emitted by the client.
    /// NOTE: Signature verification is TODO; current implementation behaves like
    /// `initialize_raffle` and will be upgraded to enforce the permit.
    pub fn initialize_raffle_with_permit(
        ctx: Context<InitializeRaffleWithPermit>,
        required_tickets: u64,
        deadline_unix_ts: i64,
        permit_nonce: [u8; 16],
        permit_expiry_unix_ts: i64,
        auto_draw: bool,
        ticket_mode: u8, // 0=disabled, 1=accept_without_burn, 2=require_burn
    ) -> Result<()> {
        // Get keys before mutable borrow
        let raffle_key = ctx.accounts.raffle.key();
        let organizer_key = ctx.accounts.organizer.key();
        let mint_key = ctx.accounts.mint.key();
        let escrow_key = ctx.accounts.escrow_ata.key();
        
        let raffle = &mut ctx.accounts.raffle;
        raffle.organizer = organizer_key;
        raffle.mint = mint_key;
        raffle.escrow = escrow_key;
        raffle.required_tickets = required_tickets;
        raffle.tickets_sold = 0;
        raffle.next_ticket_index = 1;
        raffle.deadline = deadline_unix_ts;
        raffle.status = RaffleStatus::Selling as u8;
        raffle.winner_ticket = 0;
        raffle.proceeds_collected = false;
        raffle.auto_draw = auto_draw;
        raffle.ticket_mode = ticket_mode;
        raffle.bump = ctx.bumps.raffle;

        require_keys_eq!(ctx.accounts.escrow_ata.mint, mint_key);
        require_keys_eq!(ctx.accounts.escrow_ata.owner, raffle_key);

        emit!(RaffleInitialized {
            raffle: raffle_key,
            organizer: organizer_key,
            mint: mint_key,
            required_tickets,
            deadline_unix_ts,
        });

        // Initialize RaffleSlots PDA for per-slot state
        let slots_acc = &mut ctx.accounts.slots;
        slots_acc.raffle = raffle_key;
        slots_acc.required_slots = required_tickets as u32;
        let bitmap_len = ((required_tickets + 7) / 8) as usize;
        slots_acc.bitmap = vec![0u8; bitmap_len];
        slots_acc.owners = vec![Pubkey::default(); required_tickets as usize];

        // Verify permit expiry
        require!(permit_expiry_unix_ts > Clock::get()?.unix_timestamp, RaffleError::PermitExpired);

        // Build canonical permit message (binary):
        // b"RWA_RAFFLE_PERMIT" || organizer(32) || nonce(16) || expiry(i64) ||
        // required_tickets(u64) || deadline(i64) || program_id(32) || auto_draw(u8) || ticket_mode(u8)
        let mut expected_msg: Vec<u8> = b"RWA_RAFFLE_PERMIT".to_vec();
        expected_msg.extend_from_slice(raffle.organizer.as_ref());
        expected_msg.extend_from_slice(&permit_nonce);
        expected_msg.extend_from_slice(&permit_expiry_unix_ts.to_le_bytes());
        expected_msg.extend_from_slice(&required_tickets.to_le_bytes());
        expected_msg.extend_from_slice(&deadline_unix_ts.to_le_bytes());
        expected_msg.extend_from_slice(crate::ID.as_ref());
        expected_msg.push(if raffle.auto_draw { 1 } else { 0 });
        expected_msg.push(raffle.ticket_mode);

        // Scan instructions sysvar for an ed25519 verify ix that matches
        use anchor_lang::solana_program::{ed25519_program, sysvar::instructions};

        let ixn_acc = &ctx.accounts.instructions_sysvar;
        let mut found = false;
        let mut idx = 0;
        // Iterate through instructions; stop if load fails
        loop {
            let loaded = instructions::load_instruction_at_checked(idx, ixn_acc);
            if loaded.is_err() { break; }
            let ix = loaded.unwrap();
            if ix.program_id == ed25519_program::id() {
                // Parse ed25519 instruction data (single signature format)
                let data = ix.data.as_slice();
                if data.len() < 16 { idx += 1; continue; }
                let num = data[0] as usize;
                if num != 1 { idx += 1; continue; }
                // Offsets are u16 LE starting at byte 2
                let sig_off = u16::from_le_bytes([data[2], data[3]]) as usize;
                let sig_len = u16::from_le_bytes([data[4], data[5]]) as usize;
                let pk_off = u16::from_le_bytes([data[6], data[7]]) as usize;
                let pk_len = u16::from_le_bytes([data[8], data[9]]) as usize;
                let msg_off = u16::from_le_bytes([data[10], data[11]]) as usize;
                let msg_len = u16::from_le_bytes([data[12], data[13]]) as usize;
                let msg_acc_idx = u16::from_le_bytes([data[14], data[15]]);

                // We only accept inline message (not from another account)
                if msg_acc_idx != u16::MAX { idx += 1; continue; }
                // Bounds checks
                if pk_len != 32 || sig_len != 64 { idx += 1; continue; }
                if pk_off.checked_add(pk_len).unwrap_or(usize::MAX) > data.len() { idx += 1; continue; }
                if msg_off.checked_add(msg_len).unwrap_or(usize::MAX) > data.len() { idx += 1; continue; }

                let pk_bytes = &data[pk_off..pk_off+pk_len];
                let msg_bytes = &data[msg_off..msg_off+msg_len];

                if pk_bytes == raffle.organizer.as_ref() && msg_bytes == expected_msg.as_slice() {
                    found = true;
                    break;
                }
            }
            idx += 1;
        }
        require!(found, RaffleError::PermitInvalid);
        Ok(())
    }

    // Temporarily commented out - Light SDK incompatible with rustc 1.79.0
    // /// Deposit using Light Protocol compressed accounts for the Ticket record.
    // pub fn deposit_compressed<'info>(
    //     ctx: Context<'_, '_, '_, 'info, DepositCompressed<'info>>,
    //     proof: ValidityProof,
    //     address_tree_info: PackedAddressTreeInfo,
    //     output_state_tree_index: u8,
    //     amount: u64,
    //     start_index: u64,
    // ) -> Result<()> {
    //     let clock = Clock::get()?;
    //     let raffle = &mut ctx.accounts.raffle;
    //     require!(raffle.status == RaffleStatus::Selling as u8, RaffleError::RaffleNotSelling);
    //     require!(clock.unix_timestamp <= raffle.deadline, RaffleError::PastDeadline);
    //     require!(amount > 0, RaffleError::InvalidAmount);
    //     require!(start_index == raffle.next_ticket_index, RaffleError::ConcurrentDeposit);
    //
    //     let unit = 10u64.pow(ctx.accounts.mint.decimals as u32);
    //     require!(amount % unit == 0, RaffleError::MustDepositWholeTokens);
    //     let tickets = amount / unit;
    //     require!(tickets > 0, RaffleError::InvalidAmount);
    //     require!(raffle.tickets_sold.saturating_add(tickets) <= raffle.required_tickets, RaffleError::OverSubscription);
    //
    //     // Transfer tokens into escrow
    //     let cpi_accounts = TransferChecked {
    //         from: ctx.accounts.payer_ata.to_account_info(),
    //         to: ctx.accounts.escrow_ata.to_account_info(),
    //         mint: ctx.accounts.mint.to_account_info(),
    //         authority: ctx.accounts.signer.to_account_info(),
    //     };
    //     let cpi_program = ctx.accounts.token_program.to_account_info();
    //     token::transfer_checked(CpiContext::new(cpi_program, cpi_accounts), amount, ctx.accounts.mint.decimals)?;
    //
    //     // Create compressed ticket account via Light
    //     let light_cpi_accounts = CpiAccounts::new(
    //         ctx.accounts.signer.as_ref(),
    //         ctx.remaining_accounts,
    //         crate::LIGHT_CPI_SIGNER,
    //     );
    //
    //     let (address, address_seed) = derive_address(
    //         &[b"ticket", raffle.key().as_ref(), ctx.accounts.signer.key().as_ref(), &start_index.to_le_bytes()],
    //         &address_tree_info
    //             .get_tree_pubkey(&light_cpi_accounts)
    //             .map_err(|_| error!(RaffleError::Overflow))?,
    //         &crate::ID,
    //     );
    //
    //     let new_address_params = address_tree_info.into_new_address_params_packed(address_seed);
    //
    //     let mut ticket_acc = LightAccount::<TicketCompressed>::new_init(
    //         &crate::ID,
    //         Some(address),
    //         output_state_tree_index,
    //     );
    //     ticket_acc.raffle = raffle.key();
    //     ticket_acc.owner = ctx.accounts.signer.key();
    //     ticket_acc.start = raffle.next_ticket_index;
    //     ticket_acc.count = tickets;
    //     ticket_acc.refunded = false;
    //     ticket_acc.claimed_win = false;
    //
    //     LightSystemProgramCpi::new_cpi(LIGHT_CPI_SIGNER, proof)
    //         .with_light_account(ticket_acc)?
    //         .with_new_addresses(&[new_address_params])
    //         .invoke(light_cpi_accounts)?;
    //
    //     // Update counters and emit
    //     raffle.tickets_sold = raffle.tickets_sold.checked_add(tickets).ok_or(RaffleError::Overflow)?;
    //     raffle.next_ticket_index = raffle.next_ticket_index.checked_add(tickets).ok_or(RaffleError::Overflow)?;
    //
    //     emit!(Deposited {
    //         raffle: raffle.key(),
    //         owner: ctx.accounts.signer.key(),
    //         start: start_index,
    //         count: tickets,
    //         tickets_sold: raffle.tickets_sold,
    //     });
    //
    //     if raffle.tickets_sold == raffle.required_tickets {
    //         raffle.status = RaffleStatus::Drawing as u8;
    //         emit!(ThresholdReached { raffle: raffle.key(), supply: raffle.required_tickets });
    //         if raffle.auto_draw { emit!(RandomnessRequested { raffle: raffle.key(), supply: raffle.required_tickets }); }
    //     }
    //
    //     Ok(())
    // }

    /// Deposit raw token amount (no swap; assumes payer holds the escrow mint, e.g. USDC) and
    /// receive a ticket range [start, start+count-1]. For devnet/legacy tests. Clients must pass
    /// `start_index = raffle.next_ticket_index` observed just before sending the transaction.
    pub fn deposit(
        ctx: Context<Deposit>,
        amount: u64,
        start_index: u64,
    ) -> Result<()> {
        let clock = Clock::get()?;
        let raffle = &mut ctx.accounts.raffle;
        require!(raffle.status == RaffleStatus::Selling as u8, RaffleError::RaffleNotSelling);
        require!(clock.unix_timestamp <= raffle.deadline, RaffleError::PastDeadline);
        require!(amount > 0, RaffleError::InvalidAmount);
        require!(start_index == raffle.next_ticket_index, RaffleError::ConcurrentDeposit);
        let unit = 10u64.pow(ctx.accounts.mint.decimals as u32);
        require!(amount % unit == 0, RaffleError::MustDepositWholeTokens);
        let tickets = amount / unit;
        require!(tickets > 0, RaffleError::InvalidAmount);
        require!(raffle.tickets_sold.saturating_add(tickets) <= raffle.required_tickets, RaffleError::OverSubscription);

        // Transfer tokens from payer into escrow
        let cpi_accounts = TransferChecked {
            from: ctx.accounts.payer_ata.to_account_info(),
            to: ctx.accounts.escrow_ata.to_account_info(),
            mint: ctx.accounts.mint.to_account_info(),
            authority: ctx.accounts.payer.to_account_info(),
        };
        let cpi_program = ctx.accounts.token_program.to_account_info();
        token::transfer_checked(CpiContext::new(cpi_program, cpi_accounts), amount, ctx.accounts.mint.decimals)?;

        // Mint ticket record (in ticket units)
        let ticket = &mut ctx.accounts.ticket;
        ticket.raffle = raffle.key();
        ticket.owner = ctx.accounts.payer.key();
        ticket.start = raffle.next_ticket_index;
        ticket.count = tickets; // 1 whole token == 1 ticket
        ticket.refunded = false;
        ticket.claimed_win = false;
        ticket.bump = ctx.bumps.ticket;

        // Update raffle counters
        raffle.tickets_sold = raffle.tickets_sold.checked_add(tickets).ok_or(RaffleError::Overflow)?;
        raffle.next_ticket_index = raffle.next_ticket_index.checked_add(tickets).ok_or(RaffleError::Overflow)?;

        emit!(Deposited {
            raffle: raffle.key(),
            owner: ticket.owner,
            start: ticket.start,
            count: ticket.count,
            tickets_sold: raffle.tickets_sold,
        });

        // Auto-transition to Drawing when threshold reached
        if raffle.tickets_sold == raffle.required_tickets {
            raffle.status = RaffleStatus::Drawing as u8;
            emit!(ThresholdReached { raffle: raffle.key(), supply: raffle.required_tickets });
        }

        Ok(())
    }

    /// **Join raffle with MOGA tokens (1-TX flow with swap).**
    ///
    /// # What it does
    /// - Validates requested slots are free in the `RaffleSlots` bitmap
    /// - Gets USDC price from Pyth oracle
    /// - Swaps MOGA → USDC via Jupiter CPI
    /// - Deposits USDC into raffle escrow
    /// - Reserves slots and mints ticket record
    ///
    /// # When to call
    /// - User has MOGA tokens and wants to join with specific slot numbers
    /// - Raffle is in `Selling` status and before deadline
    ///
    /// # Security
    /// - Slippage protection via `max_moga_in`
    /// - Slot reservation prevents double-booking
    /// - Pyth price staleness check
    ///
    /// # Feature-gated
    /// - Requires `pyth-jupiter` feature flag
    /// - TODO: Implement Pyth + Jupiter CPI logic
    #[cfg(feature = "pyth-jupiter")]
    pub fn join_with_moga(
        ctx: Context<JoinWithMoga>,
        slots: Vec<u32>,
        max_moga_in: u64,
    ) -> Result<()> {
        let clock = Clock::get()?;
        let raffle = &mut ctx.accounts.raffle;
        require!(raffle.status == RaffleStatus::Selling as u8, RaffleError::RaffleNotSelling);
        require!(clock.unix_timestamp <= raffle.deadline, RaffleError::PastDeadline);
        require!(!slots.is_empty(), RaffleError::InvalidAmount);
        require!(slots.len() as u64 + raffle.tickets_sold <= raffle.required_tickets, RaffleError::OverSubscription);

        // 1. Validate slots are free
        let slots_acc = &mut ctx.accounts.slots;
        for &slot_idx in &slots {
            require!(slot_idx < slots_acc.required_slots, RaffleError::InvalidSlot);
            let byte_idx = (slot_idx / 8) as usize;
            let bit_idx = slot_idx % 8;
            let is_taken = (slots_acc.bitmap[byte_idx] & (1 << bit_idx)) != 0;
            require!(!is_taken, RaffleError::SlotAlreadyTaken);
        }

        // 2. Get MOGA/USD price from Pyth oracle
        // NOTE: In production, you need to:
        // - Add pyth_price_account to JoinWithMoga accounts
        // - Parse Pyth price feed and check staleness
        // - Calculate MOGA amount needed for USDC equivalent
        // - Apply slippage tolerance
        //
        // Example implementation:
        // ```
        // #[cfg(feature = "pyth-jupiter")]
        // use pyth_sdk_solana::load_price_feed_from_account_info;
        //
        // let pyth_price = load_price_feed_from_account_info(&ctx.accounts.pyth_price_account)?;
        // let price_data = pyth_price.get_current_price()
        //     .ok_or(RaffleError::PythPriceUnavailable)?;
        //
        // // Check staleness (e.g., max 60 seconds old)
        // let clock = Clock::get()?;
        // require!(
        //     clock.unix_timestamp - price_data.publish_time < 60,
        //     RaffleError::PythPriceStale
        // );
        //
        // // Calculate MOGA needed (accounting for decimals)
        // let usdc_needed = slots.len() as u64 * 10u64.pow(ctx.accounts.usdc_mint.decimals as u32);
        // let moga_needed = calculate_moga_for_usdc(
        //     usdc_needed,
        //     price_data.price,
        //     price_data.expo,
        //     ctx.accounts.moga_mint.decimals,
        //     ctx.accounts.usdc_mint.decimals,
        // );
        //
        // // Check slippage
        // require!(moga_needed <= max_moga_in, RaffleError::SlippageExceeded);
        // ```

        // 3. Swap MOGA → USDC via Jupiter CPI
        // NOTE: Jupiter aggregator requires:
        // - Jupiter program account
        // - Source token account (payer's MOGA ATA)
        // - Destination token account (payer's USDC ATA)
        // - Intermediate accounts (depends on route)
        // - Quote data (from Jupiter API)
        //
        // Example CPI call (pseudo-code):
        // ```
        // let jupiter_ix = build_jupiter_swap_ix(
        //     &ctx.accounts.jupiter_program,
        //     &ctx.accounts.payer,
        //     &ctx.accounts.payer_moga_ata,
        //     &ctx.accounts.payer_usdc_ata,
        //     &ctx.accounts.moga_mint,
        //     &ctx.accounts.usdc_mint,
        //     moga_needed,
        //     usdc_needed, // minimum out
        //     // ... intermediate accounts from route
        // );
        //
        // invoke(
        //     &jupiter_ix,
        //     &[
        //         ctx.accounts.jupiter_program.to_account_info(),
        //         ctx.accounts.payer.to_account_info(),
        //         ctx.accounts.payer_moga_ata.to_account_info(),
        //         ctx.accounts.payer_usdc_ata.to_account_info(),
        //         // ... remaining accounts
        //     ],
        // )?;
        // ```
        //
        // TODO: Implement full Jupiter swap CPI when ready

        // 4. Transfer USDC into escrow (for now, assume direct transfer as placeholder)
        let usdc_amount = slots.len() as u64 * 10u64.pow(ctx.accounts.usdc_mint.decimals as u32);
        let cpi_accounts = TransferChecked {
            from: ctx.accounts.payer_usdc_ata.to_account_info(),
            to: ctx.accounts.escrow_ata.to_account_info(),
            mint: ctx.accounts.usdc_mint.to_account_info(),
            authority: ctx.accounts.payer.to_account_info(),
        };
        token::transfer_checked(
            CpiContext::new(ctx.accounts.token_program.to_account_info(), cpi_accounts),
            usdc_amount,
            ctx.accounts.usdc_mint.decimals,
        )?;

        // 5. Reserve slots in bitmap
        for &slot_idx in &slots {
            let byte_idx = (slot_idx / 8) as usize;
            let bit_idx = slot_idx % 8;
            slots_acc.bitmap[byte_idx] |= 1 << bit_idx;
            slots_acc.owners[slot_idx as usize] = ctx.accounts.payer.key();
        }

        // 6. Mint ticket record
        let ticket = &mut ctx.accounts.ticket;
        ticket.raffle = raffle.key();
        ticket.owner = ctx.accounts.payer.key();
        ticket.start = slots[0] as u64 + 1; // 1-based ticket numbers
        ticket.count = slots.len() as u64;
        ticket.refunded = false;
        ticket.claimed_win = false;
        ticket.bump = ctx.bumps.ticket;

        // 7. Update raffle counters
        raffle.tickets_sold = raffle.tickets_sold.checked_add(slots.len() as u64).ok_or(RaffleError::Overflow)?;

        emit!(Deposited {
            raffle: raffle.key(),
            owner: ticket.owner,
            start: ticket.start,
            count: ticket.count,
            tickets_sold: raffle.tickets_sold,
        });

        if raffle.tickets_sold == raffle.required_tickets {
            raffle.status = RaffleStatus::Drawing as u8;
            emit!(ThresholdReached { raffle: raffle.key(), supply: raffle.required_tickets });
        }

        Ok(())
    }

    /// **Join raffle with MRFT (refund ticket NFTs).**
    ///
    /// # What it does
    /// - Validates MRFT NFTs belong to the approved collection
    /// - Burns MRFT NFTs via Bubblegum tree authority
    /// - Reserves requested slots in `RaffleSlots`
    /// - Mints ticket record
    ///
    /// # When to call
    /// - User holds MRFT (refund tickets from previous raffles)
    /// - Raffle is in `Selling` status and before deadline
    ///
    /// # Security
    /// - Collection verification prevents fake tickets
    /// - Burn authority check via Bubblegum
    /// - Slot reservation prevents double-booking
    ///
    /// # Feature-gated
    /// - Requires `bubblegum` feature flag
    /// - TODO: Implement Bubblegum burn CPI logic
    #[cfg(feature = "bubblegum")]
    pub fn join_with_ticket(
        ctx: Context<JoinWithTicket>,
        slots: Vec<u32>,
        _nft_proofs: Vec<u8>, // Bubblegum proofs (placeholder)
    ) -> Result<()> {
        let clock = Clock::get()?;
        let raffle = &mut ctx.accounts.raffle;
        require!(raffle.status == RaffleStatus::Selling as u8, RaffleError::RaffleNotSelling);
        require!(clock.unix_timestamp <= raffle.deadline, RaffleError::PastDeadline);
        require!(!slots.is_empty(), RaffleError::InvalidAmount);
        require!(slots.len() as u64 + raffle.tickets_sold <= raffle.required_tickets, RaffleError::OverSubscription);

        // 1. Validate slots are free
        let slots_acc = &mut ctx.accounts.slots;
        for &slot_idx in &slots {
            require!(slot_idx < slots_acc.required_slots, RaffleError::InvalidSlot);
            let byte_idx = (slot_idx / 8) as usize;
            let bit_idx = slot_idx % 8;
            let is_taken = (slots_acc.bitmap[byte_idx] & (1 << bit_idx)) != 0;
            require!(!is_taken, RaffleError::SlotAlreadyTaken);
        }

        // 2. Optionally verify MRFT collection and burn NFTs when required
        if raffle.ticket_mode == 1 {
            // TODO: perform Bubblegum burn CPI using provided proofs/accounts
            // For now, only enforce that proofs vector is non-empty when burn is required
            require!(!_nft_proofs.is_empty(), RaffleError::TicketBurnRequired);
        }
        // NOTE: In production, you need to:
        // - Parse the merkle tree to get NFT metadata
        // - Verify the collection mint matches your MRFT collection
        // - Call bubblegum burn instruction with proper proofs
        //
        // For now, we assume the frontend/SDK has already verified the NFTs
        // and we trust the payer is burning valid MRFTs.
        //
        // Full implementation requires:
        // - merkle_tree: AccountInfo (the compressed NFT tree)
        // - tree_authority: PDA of the tree
        // - leaf_owner: payer (must match)
        // - leaf_delegate: payer or None
        // - merkle_proof: Vec<AccountInfo> (proof path)
        // - root: [u8; 32] (current tree root)
        // - data_hash: [u8; 32] (NFT data hash)
        // - creator_hash: [u8; 32] (creator hash)
        // - nonce: u64 (leaf nonce)
        // - index: u32 (leaf index)
        //
        // Example CPI call (pseudo-code):
        // ```
        // use mpl_bubblegum::instructions::BurnCpiBuilder;
        // BurnCpiBuilder::new(&ctx.accounts.bubblegum_program)
        //     .tree_config(&ctx.accounts.tree_config)
        //     .leaf_owner(&ctx.accounts.payer)
        //     .leaf_delegate(&ctx.accounts.payer)
        //     .merkle_tree(&ctx.accounts.merkle_tree)
        //     .log_wrapper(&ctx.accounts.log_wrapper)
        //     .compression_program(&ctx.accounts.compression_program)
        //     .system_program(&ctx.accounts.system_program)
        //     .root(root)
        //     .data_hash(data_hash)
        //     .creator_hash(creator_hash)
        //     .nonce(nonce)
        //     .index(index)
        //     .invoke()?;
        // ```
        //
        // TODO: Implement full Bubblegum burn CPI when ready

        // 4. Reserve slots in bitmap
        for &slot_idx in &slots {
            let byte_idx = (slot_idx / 8) as usize;
            let bit_idx = slot_idx % 8;
            slots_acc.bitmap[byte_idx] |= 1 << bit_idx;
            slots_acc.owners[slot_idx as usize] = ctx.accounts.payer.key();
        }

        // 5. Mint ticket record
        let ticket = &mut ctx.accounts.ticket;
        ticket.raffle = raffle.key();
        ticket.owner = ctx.accounts.payer.key();
        ticket.start = slots[0] as u64 + 1; // 1-based ticket numbers
        ticket.count = slots.len() as u64;
        ticket.refunded = false;
        ticket.claimed_win = false;
        ticket.bump = ctx.bumps.ticket;

        // 6. Update raffle counters
        raffle.tickets_sold = raffle.tickets_sold.checked_add(slots.len() as u64).ok_or(RaffleError::Overflow)?;

        emit!(Deposited {
            raffle: raffle.key(),
            owner: ticket.owner,
            start: ticket.start,
            count: ticket.count,
            tickets_sold: raffle.tickets_sold,
        });

        if raffle.tickets_sold == raffle.required_tickets {
            raffle.status = RaffleStatus::Drawing as u8;
            emit!(ThresholdReached { raffle: raffle.key(), supply: raffle.required_tickets });
        }

        Ok(())
    }

    /// Organizer requests randomness (offchain worker watches event and uses Arcium).
    pub fn request_draw(ctx: Context<RequestDraw>) -> Result<()> {
        let raffle = &mut ctx.accounts.raffle;
        require!(ctx.accounts.organizer.key() == raffle.organizer, RaffleError::Unauthorized);
        require!(raffle.status == RaffleStatus::Drawing as u8, RaffleError::WrongStatus);
        emit!(RandomnessRequested { raffle: raffle.key(), supply: raffle.required_tickets });
        Ok(())
    }

    /// Offchain settles with winner ticket index in [1..required_tokens].
    /// Proof verification via Arcium will be added in a later iteration.
    pub fn settle_draw(ctx: Context<SettleDraw>, winner_ticket: u64) -> Result<()> {
        let raffle = &mut ctx.accounts.raffle;
        require!(raffle.status == RaffleStatus::Drawing as u8, RaffleError::WrongStatus);
        require!(winner_ticket >= 1 && winner_ticket <= raffle.required_tickets, RaffleError::InvalidWinner);
        raffle.winner_ticket = winner_ticket;
        raffle.status = RaffleStatus::Completed as u8;
        emit!(WinnerSelected { raffle: raffle.key(), winner_ticket });
        Ok(())
    }

    /// Users can claim refund after deadline if threshold not met.
    pub fn claim_refund(ctx: Context<ClaimRefund>) -> Result<()> {
        let clock = Clock::get()?;
        let raffle = &mut ctx.accounts.raffle;
        require!(raffle.status == RaffleStatus::Selling as u8 || raffle.status == RaffleStatus::Refunding as u8, RaffleError::WrongStatus);
        require!(clock.unix_timestamp > raffle.deadline, RaffleError::NotRefundableYet);
        // lock status to Refunding on first claim
        raffle.status = RaffleStatus::Refunding as u8;

        let ticket = &mut ctx.accounts.ticket;
        require!(ticket.raffle == raffle.key(), RaffleError::WrongRaffle);
        require!(ticket.owner == ctx.accounts.payer.key(), RaffleError::Unauthorized);
        require!(!ticket.refunded, RaffleError::AlreadyRefunded);

        // Mark refunded and emit refund ticket request event for offchain minting.
        ticket.refunded = true;
        emit!(RefundTicketsRequested {
            raffle: raffle.key(),
            owner: ticket.owner,
            start: ticket.start,
            count: ticket.count,
        });
        Ok(())
    }

    /// Batch-mark tickets as refunded and emit refund ticket requests for offchain minting.
    /// Caller passes Ticket accounts as remaining_accounts; safe to call by anyone.
    pub fn refund_batch<'info>(ctx: Context<'_, '_, 'info, 'info, RefundBatch<'info>>) -> Result<()> {
        let clock = Clock::get()?;
        let raffle = &mut ctx.accounts.raffle;
        require!(raffle.status == RaffleStatus::Selling as u8 || raffle.status == RaffleStatus::Refunding as u8, RaffleError::WrongStatus);
        require!(clock.unix_timestamp > raffle.deadline, RaffleError::NotRefundableYet);
        // Enter refunding state
        raffle.status = RaffleStatus::Refunding as u8;

        for acc in ctx.remaining_accounts.iter() {
            let mut ticket: Account<Ticket> = Account::try_from(acc)?;
            if ticket.raffle != raffle.key() { continue; }
            if ticket.refunded { continue; }
            ticket.refunded = true;
            emit!(RefundTicketsRequested {
                raffle: raffle.key(),
                owner: ticket.owner,
                start: ticket.start,
                count: ticket.count,
            });
        }
        Ok(())
    }

    /// Winner can mark claim on-chain; offchain RWA delivery handled externally.
    pub fn claim_win(ctx: Context<ClaimWin>) -> Result<()> {
        let raffle = &mut ctx.accounts.raffle;
        require!(raffle.status == RaffleStatus::Completed as u8, RaffleError::WrongStatus);
        let ticket = &mut ctx.accounts.ticket;
        require!(ticket.raffle == raffle.key(), RaffleError::WrongRaffle);
        require!(ticket.owner == ctx.accounts.winner.key(), RaffleError::Unauthorized);
        require!(!ticket.claimed_win, RaffleError::AlreadyClaimedWin);

        let start = ticket.start;
        let end = ticket.start.checked_add(ticket.count).ok_or(RaffleError::Overflow)?.saturating_sub(1);
        require!(raffle.winner_ticket >= start && raffle.winner_ticket <= end, RaffleError::NotWinningTicket);

        ticket.claimed_win = true;
        emit!(WinClaimed { raffle: raffle.key(), owner: ticket.owner, winner_ticket: raffle.winner_ticket });
        Ok(())
    }

    /// Set the prize NFT by escrowing a pre-minted NFT into the raffle. This path is used
    /// for `PreEscrow` prize mode. Future update: enforce Metaplex Verified Collection so
    /// organizers can only escrow NFTs from their approved collection.
    pub fn set_prize_nft(ctx: Context<SetPrizeNft>) -> Result<()> {
        let raffle = &mut ctx.accounts.raffle;
        require!(ctx.accounts.organizer.key() == raffle.organizer, RaffleError::Unauthorized);
        require!(!raffle.prize_set, RaffleError::PrizeAlreadySet);
        require!(ctx.accounts.prize_mint.decimals == 0, RaffleError::PrizeMustBeNft);
        require_keys_eq!(ctx.accounts.prize_escrow.owner, raffle.key());
        require_keys_eq!(ctx.accounts.prize_escrow.mint, ctx.accounts.prize_mint.key());

        let cpi_accounts = TransferChecked {
            from: ctx.accounts.organizer_prize_ata.to_account_info(),
            to: ctx.accounts.prize_escrow.to_account_info(),
            mint: ctx.accounts.prize_mint.to_account_info(),
            authority: ctx.accounts.organizer.to_account_info(),
        };
        let cpi_program = ctx.accounts.token_program.to_account_info();
        token::transfer_checked(CpiContext::new(cpi_program, cpi_accounts), 1, 0)?;

        raffle.prize_mint = ctx.accounts.prize_mint.key();
        raffle.prize_escrow = ctx.accounts.prize_escrow.key();
        raffle.prize_set = true;
        raffle.prize_claimed = false;

        emit!(PrizeSet { raffle: raffle.key(), prize_mint: raffle.prize_mint });
        Ok(())
    }

    pub fn claim_prize(ctx: Context<ClaimPrize>) -> Result<()> {
        // Get account info before mutable borrow
        let raffle_account_info = ctx.accounts.raffle.to_account_info();
        
        let raffle = &mut ctx.accounts.raffle;
        require!(raffle.status == RaffleStatus::Completed as u8, RaffleError::WrongStatus);
        require!(raffle.prize_set, RaffleError::PrizeNotSet);
        require!(!raffle.prize_claimed, RaffleError::PrizeAlreadyClaimed);
        require_keys_eq!(raffle.prize_mint, ctx.accounts.prize_mint.key());
        require_keys_eq!(raffle.prize_escrow, ctx.accounts.prize_escrow.key());
        require!(ctx.accounts.prize_mint.decimals == 0, RaffleError::PrizeMustBeNft);

        let ticket = &ctx.accounts.ticket;
        let raffle_key = raffle.key();
        require!(ticket.raffle == raffle_key, RaffleError::WrongRaffle);
        require!(ticket.owner == ctx.accounts.winner.key(), RaffleError::Unauthorized);
        require!(ticket.claimed_win, RaffleError::MustClaimWinFirst);

        let raffle_mint = raffle.mint;
        let raffle_organizer = raffle.organizer;
        let raffle_bump = raffle.bump;
        let prize_mint_key = raffle.prize_mint;
        
        let seeds: &[&[u8]] = &[
            RAFFLE_SEED,
            raffle_mint.as_ref(),
            raffle_organizer.as_ref(),
            &[raffle_bump],
        ];
        let signer = &[seeds];
        let cpi_accounts = TransferChecked {
            from: ctx.accounts.prize_escrow.to_account_info(),
            to: ctx.accounts.winner_prize_ata.to_account_info(),
            mint: ctx.accounts.prize_mint.to_account_info(),
            authority: raffle_account_info,
        };
        let cpi_program = ctx.accounts.token_program.to_account_info();
        token::transfer_checked(CpiContext::new_with_signer(cpi_program, cpi_accounts, signer), 1, 0)?;

        raffle.prize_claimed = true;
        emit!(PrizeClaimed { raffle: raffle_key, winner: ctx.accounts.winner.key(), prize_mint: prize_mint_key });
        Ok(())
    }

    // Arcium functions temporarily disabled - requires compiled .arcis files
    // pub fn init_draw_comp_def(ctx: Context<InitDrawCompDef>) -> Result<()> {
    //     init_comp_def(ctx.accounts, true, 0, None, None)?;
    //     Ok(())
    // }
    //
    // pub fn request_draw_arcium(
    //     ctx: Context<RequestDrawArcium>,
    //     computation_offset: u64,
    // ) -> Result<()> {
    //     let raffle = &ctx.accounts.raffle;
    //     require!(raffle.status == RaffleStatus::Drawing as u8, RaffleError::WrongStatus);
    //
    //     let args = vec![Argument::PlaintextU64(raffle.required_tickets)];
    //
    //     ctx.accounts.sign_pda_account.bump = ctx.bumps.sign_pda_account;
    //
    //     let cb_ix = DrawCallback::callback_ix(&[AccountMeta::new(ctx.accounts.raffle.key(), false)]);
    //     queue_computation(ctx.accounts, computation_offset, args, None, vec![cb_ix])?;
    //
    //     Ok(())
    // }
    //
    // #[arcium_callback(encrypted_ix = "draw")]
    // pub fn draw_callback(
    //     ctx: Context<DrawCallback>,
    //     output: ComputationOutputs<DrawOutput>,
    // ) -> Result<()> {
    //     let winner_ticket = match output {
    //         ComputationOutputs::Success(DrawOutput { field_0 }) => field_0,
    //         _ => return Err(ArcError::AbortedComputation.into()),
    //     };
    //
    //     let raffle = &mut ctx.accounts.raffle;
    //     require!(raffle.status == RaffleStatus::Drawing as u8, RaffleError::WrongStatus);
    //     require!(winner_ticket >= 1 && winner_ticket <= raffle.required_tickets, RaffleError::InvalidWinner);
    //     raffle.winner_ticket = winner_ticket;
    //     raffle.status = RaffleStatus::Completed as u8;
    //     emit!(WinnerSelected { raffle: raffle.key(), winner_ticket });
    //     Ok(())
    // }
}

#[derive(Accounts)]
#[instruction(required_tickets: u64, deadline_unix_ts: i64, auto_draw: bool, ticket_mode: u8)]
pub struct InitializeRaffle<'info> {
    #[account(mut)]
    pub organizer: Signer<'info>,
    pub mint: InterfaceAccount<'info, Mint>,
    /// Escrow token account must be owned by raffle PDA and match the mint.
    pub escrow_ata: InterfaceAccount<'info, TokenAccount>,
    #[account(
        init,
        payer = organizer,
        space = 8 + Raffle::LEN,
        seeds = [RAFFLE_SEED, mint.key().as_ref(), organizer.key().as_ref()],
        bump,
    )]
    pub raffle: Account<'info, Raffle>,
    #[account(
        init,
        payer = organizer,
        space = 8 + RaffleSlots::space(required_tickets),
        seeds = [SLOTS_SEED, raffle.key().as_ref()],
        bump,
    )]
    pub slots: Account<'info, RaffleSlots>,
    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct RefundBatch<'info> {
    pub caller: Signer<'info>,
    #[account(mut)]
    pub raffle: Account<'info, Raffle>,
}

// Arcium account structs temporarily disabled - requires compiled .arcis files
// #[queue_computation_accounts("draw", payer)]
// #[derive(Accounts)]
// #[instruction(computation_offset: u64)]
// pub struct RequestDrawArcium<'info> {
//     #[account(mut)]
//     pub payer: Signer<'info>,
//     #[account(mut)]
//     pub raffle: Account<'info, Raffle>,
//     #[account(
//         init_if_needed,
//         space = 9,
//         payer = payer,
//         seeds = [&SIGN_PDA_SEED],
//         bump,
//         address = derive_sign_pda!(),
//     )]
//     pub sign_pda_account: Account<'info, SignerAccount>,
//     #[account(address = derive_mxe_pda!())]
//     pub mxe_account: Account<'info, MXEAccount>,
//     #[account(mut, address = derive_mempool_pda!())]
//     /// CHECK: mempool_account, checked by the arcium program
//     pub mempool_account: UncheckedAccount<'info>,
//     #[account(mut, address = derive_execpool_pda!())]
//     /// CHECK: executing_pool, checked by the arcium program
//     pub executing_pool: UncheckedAccount<'info>,
//     #[account(mut, address = derive_comp_pda!(computation_offset))]
//     /// CHECK: computation_account, checked by the arcium program.
//     pub computation_account: UncheckedAccount<'info>,
//     #[account(address = derive_comp_def_pda!(COMP_DEF_OFFSET_DRAW))]
//     pub comp_def_account: Account<'info, ComputationDefinitionAccount>,
//     #[account(mut, address = derive_cluster_pda!(mxe_account))]
//     pub cluster_account: Account<'info, Cluster>,
//     #[account(mut, address = ARCIUM_FEE_POOL_ACCOUNT_ADDRESS)]
//     pub pool_account: Account<'info, FeePool>,
//     #[account(address = ARCIUM_CLOCK_ACCOUNT_ADDRESS)]
//     pub clock_account: Account<'info, ClockAccount>,
//     pub system_program: Program<'info, System>,
//     pub arcium_program: Program<'info, Arcium>,
// }
//
// #[callback_accounts("draw")]
// #[derive(Accounts)]
// pub struct DrawCallback<'info> {
//     pub arcium_program: Program<'info, Arcium>,
//     #[account(address = derive_comp_def_pda!(COMP_DEF_OFFSET_DRAW))]
//     pub comp_def_account: Account<'info, ComputationDefinitionAccount>,
//     #[account(address = ::anchor_lang::solana_program::sysvar::instructions::ID)]
//     /// CHECK: instructions_sysvar, checked by the account constraint
//     pub instructions_sysvar: AccountInfo<'info>,
//     #[account(mut)]
//     pub raffle: Account<'info, Raffle>,
// }
//
// #[init_computation_definition_accounts("draw", payer)]
// #[derive(Accounts)]
// pub struct InitDrawCompDef<'info> {
//     #[account(mut)]
//     pub payer: Signer<'info>,
//     #[account(mut, address = derive_mxe_pda!())]
//     pub mxe_account: Box<Account<'info, MXEAccount>>,
//     #[account(mut)]
//     /// CHECK: comp_def_account, checked by arcium program (not initialized yet)
//     pub comp_def_account: UncheckedAccount<'info>,
//     pub arcium_program: Program<'info, Arcium>,
//     pub system_program: Program<'info, System>,
// }

// Temporarily commented out - Light SDK incompatible with rustc 1.79.0
// #[derive(Accounts)]
// pub struct DepositCompressed<'info> {
//     #[account(mut)]
//     pub signer: Signer<'info>,
//     #[account(mut, has_one = mint, constraint = raffle.escrow == escrow_ata.key())]
//     pub raffle: Account<'info, Raffle>,
//     pub mint: InterfaceAccount<'info, Mint>,
//     #[account(mut, constraint = payer_ata.owner == signer.key(), constraint = payer_ata.mint == mint.key())]
//     pub payer_ata: InterfaceAccount<'info, TokenAccount>,
//     #[account(mut, constraint = escrow_ata.owner == raffle.key(), constraint = escrow_ata.mint == mint.key())]
//     pub escrow_ata: InterfaceAccount<'info, TokenAccount>,
//     pub token_program: Program<'info, Token>,
// }

#[derive(Accounts)]
#[instruction(amount: u64, start_index: u64)]
pub struct Deposit<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(mut, has_one = mint, constraint = raffle.escrow == escrow_ata.key())]
    pub raffle: Account<'info, Raffle>,
    pub mint: InterfaceAccount<'info, Mint>,
    #[account(mut, constraint = payer_ata.owner == payer.key(), constraint = payer_ata.mint == mint.key())]
    pub payer_ata: InterfaceAccount<'info, TokenAccount>,
    #[account(mut, constraint = escrow_ata.owner == raffle.key(), constraint = escrow_ata.mint == mint.key())]
    pub escrow_ata: InterfaceAccount<'info, TokenAccount>,
    #[account(
        init,
        payer = payer,
        space = 8 + Ticket::LEN,
        seeds = [TICKET_SEED, raffle.key().as_ref(), payer.key().as_ref(), &start_index.to_le_bytes()],
        bump,
    )]
    pub ticket: Account<'info, Ticket>,
    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
}

/// Accounts for joining raffle with MOGA tokens (swap flow).
#[cfg(feature = "pyth-jupiter")]
#[derive(Accounts)]
#[instruction(slots: Vec<u32>, max_moga_in: u64)]
pub struct JoinWithMoga<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    
    #[account(mut, has_one = mint)]
    pub raffle: Account<'info, Raffle>,
    
    #[account(mut, seeds = [SLOTS_SEED, raffle.key().as_ref()], bump)]
    pub slots: Account<'info, RaffleSlots>,
    
    /// USDC mint (escrow mint)
    #[account(address = raffle.mint)]
    pub usdc_mint: InterfaceAccount<'info, Mint>,
    
    /// MOGA mint (user's input token)
    pub moga_mint: InterfaceAccount<'info, Mint>,
    
    /// Payer's MOGA token account
    #[account(mut, constraint = payer_moga_ata.owner == payer.key(), constraint = payer_moga_ata.mint == moga_mint.key())]
    pub payer_moga_ata: InterfaceAccount<'info, TokenAccount>,
    
    /// Payer's USDC token account (receives swap output)
    #[account(mut, constraint = payer_usdc_ata.owner == payer.key(), constraint = payer_usdc_ata.mint == usdc_mint.key())]
    pub payer_usdc_ata: InterfaceAccount<'info, TokenAccount>,
    
    /// Raffle escrow (USDC)
    #[account(mut, constraint = escrow_ata.owner == raffle.key(), constraint = escrow_ata.mint == usdc_mint.key())]
    pub escrow_ata: InterfaceAccount<'info, TokenAccount>,
    
    /// Ticket PDA (created for this join)
    #[account(
        init,
        payer = payer,
        space = 8 + Ticket::LEN,
        seeds = [TICKET_SEED, raffle.key().as_ref(), payer.key().as_ref(), &slots[0].to_le_bytes()],
        bump,
    )]
    pub ticket: Account<'info, Ticket>,
    
    // TODO: Add Pyth price account
    // /// CHECK: Pyth price account for MOGA/USD
    // pub pyth_price_account: AccountInfo<'info>,
    
    // TODO: Add Jupiter swap accounts
    // pub jupiter_program: Program<'info, Jupiter>,
    // ... remaining Jupiter accounts
    
    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    pub mint: InterfaceAccount<'info, Mint>,
}

/// Accounts for joining raffle with MRFT (refund ticket NFTs).
#[cfg(feature = "bubblegum")]
#[derive(Accounts)]
#[instruction(slots: Vec<u32>, _nft_proofs: Vec<u8>)]
pub struct JoinWithTicket<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    
    #[account(mut)]
    pub raffle: Account<'info, Raffle>,
    
    #[account(mut, seeds = [SLOTS_SEED, raffle.key().as_ref()], bump)]
    pub slots: Account<'info, RaffleSlots>,
    
    /// Ticket PDA (created for this join)
    #[account(
        init,
        payer = payer,
        space = 8 + Ticket::LEN,
        seeds = [TICKET_SEED, raffle.key().as_ref(), payer.key().as_ref(), &slots[0].to_le_bytes()],
        bump,
    )]
    pub ticket: Account<'info, Ticket>,
    
    // TODO: Add Bubblegum accounts for NFT burn
    // /// CHECK: Merkle tree account
    // pub merkle_tree: AccountInfo<'info>,
    // /// CHECK: Tree authority
    // pub tree_authority: AccountInfo<'info>,
    // pub bubblegum_program: Program<'info, Bubblegum>,
    
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct RequestDraw<'info> {
    pub organizer: Signer<'info>,
    #[account(mut)]
    pub raffle: Account<'info, Raffle>,
}

#[derive(Accounts)]
pub struct SettleDraw<'info> {
    #[account(mut)]
    pub raffle: Account<'info, Raffle>,
}

#[derive(Accounts)]
pub struct ClaimRefund<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(mut, has_one = mint, constraint = raffle.escrow == escrow_ata.key())]
    pub raffle: Account<'info, Raffle>,
    pub mint: InterfaceAccount<'info, Mint>,
    #[account(mut, constraint = payer_ata.owner == payer.key(), constraint = payer_ata.mint == mint.key())]
    pub payer_ata: InterfaceAccount<'info, TokenAccount>,
    #[account(mut, constraint = escrow_ata.owner == raffle.key(), constraint = escrow_ata.mint == mint.key())]
    pub escrow_ata: InterfaceAccount<'info, TokenAccount>,
    #[account(mut, seeds = [TICKET_SEED, raffle.key().as_ref(), payer.key().as_ref(), &ticket.start.to_le_bytes()], bump = ticket.bump)]
    pub ticket: Account<'info, Ticket>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct ClaimWin<'info> {
    pub winner: Signer<'info>,
    #[account(mut)]
    pub raffle: Account<'info, Raffle>,
    #[account(mut, seeds = [TICKET_SEED, raffle.key().as_ref(), winner.key().as_ref(), &ticket.start.to_le_bytes()], bump = ticket.bump)]
    pub ticket: Account<'info, Ticket>,
}

#[derive(Accounts)]
pub struct SetPrizeNft<'info> {
    #[account(mut)]
    pub organizer: Signer<'info>,
    #[account(mut)]
    pub raffle: Account<'info, Raffle>,
    pub prize_mint: InterfaceAccount<'info, Mint>,
    #[account(mut, constraint = organizer_prize_ata.owner == organizer.key(), constraint = organizer_prize_ata.mint == prize_mint.key())]
    pub organizer_prize_ata: InterfaceAccount<'info, TokenAccount>,
    #[account(mut, constraint = prize_escrow.owner == raffle.key(), constraint = prize_escrow.mint == prize_mint.key())]
    pub prize_escrow: InterfaceAccount<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct ClaimPrize<'info> {
    pub winner: Signer<'info>,
    #[account(mut)]
    pub raffle: Account<'info, Raffle>,
    pub prize_mint: InterfaceAccount<'info, Mint>,
    #[account(mut, constraint = prize_escrow.owner == raffle.key(), constraint = prize_escrow.mint == prize_mint.key())]
    pub prize_escrow: InterfaceAccount<'info, TokenAccount>,
    #[account(mut, constraint = winner_prize_ata.owner == winner.key(), constraint = winner_prize_ata.mint == prize_mint.key())]
    pub winner_prize_ata: InterfaceAccount<'info, TokenAccount>,
    #[account(seeds = [TICKET_SEED, raffle.key().as_ref(), winner.key().as_ref(), &ticket.start.to_le_bytes()], bump = ticket.bump)]
    pub ticket: Account<'info, Ticket>,
    pub token_program: Program<'info, Token>,
}

#[account]
pub struct Raffle {
    pub organizer: Pubkey,
    pub mint: Pubkey,
    pub escrow: Pubkey,
    pub required_tickets: u64,
    pub tickets_sold: u64,
    pub next_ticket_index: u64,
    pub deadline: i64,
    pub status: u8,
    pub winner_ticket: u64,
    pub bump: u8,
    pub prize_mint: Pubkey,
    pub prize_escrow: Pubkey,
    pub prize_set: bool,
    pub prize_claimed: bool,
    pub proceeds_collected: bool,
    pub auto_draw: bool,
    pub ticket_mode: u8, // 0=disabled, 1=require_burn, 2=accept_without_burn
}

impl Raffle {
    pub const LEN: usize = 32 + 32 + 32 + 8 + 8 + 8 + 8 + 1 + 8 + 1 + 32 + 32 + 1 + 1 + 1 + 1 + 1;
}

#[account]
pub struct Ticket {
    pub raffle: Pubkey,
    pub owner: Pubkey,
    pub start: u64,
    pub count: u64,
    pub refunded: bool,
    pub claimed_win: bool,
    pub bump: u8,
}

#[account]
pub struct RaffleSlots {
    pub raffle: Pubkey,
    pub required_slots: u32,
    pub bitmap: Vec<u8>,
    pub owners: Vec<Pubkey>,
}

impl RaffleSlots {
    pub fn space(required_slots: u64) -> usize {
        // discriminator (8) added by caller; this returns struct size only
        let s = required_slots as usize;
        let bitmap_bytes = (s + 7) / 8;
        32 + 4 + 4 + bitmap_bytes + 4 + (32 * s)
    }
}

impl Ticket {
    pub const LEN: usize = 32 + 32 + 8 + 8 + 1 + 1 + 1;
}

// Temporarily commented out - Light SDK incompatible with rustc 1.79.0
// #[derive(Clone, Debug, Default, LightDiscriminator, LightHasher)]
// pub struct TicketCompressed {
//     #[hash]
//     pub raffle: Pubkey,
//     #[hash]
//     pub owner: Pubkey,
//     pub start: u64,
//     pub count: u64,
//     pub refunded: bool,
//     pub claimed_win: bool,
// }

#[event]
pub struct RaffleInitialized {
    pub raffle: Pubkey,
    pub organizer: Pubkey,
    pub mint: Pubkey,
    pub required_tickets: u64,
    pub deadline_unix_ts: i64,
}

#[event]
pub struct Deposited {
    pub raffle: Pubkey,
    pub owner: Pubkey,
    pub start: u64,
    pub count: u64,
    pub tickets_sold: u64,
}

#[event]
pub struct ThresholdReached {
    pub raffle: Pubkey,
    pub supply: u64,
}

#[event]
pub struct RandomnessRequested {
    pub raffle: Pubkey,
    pub supply: u64,
}

#[event]
pub struct WinnerSelected {
    pub raffle: Pubkey,
    pub winner_ticket: u64,
}

#[event]
pub struct Refunded {
    pub raffle: Pubkey,
    pub owner: Pubkey,
    pub amount: u64,
}

#[event]
pub struct RefundTicketsRequested {
    pub raffle: Pubkey,
    pub owner: Pubkey,
    pub start: u64,
    pub count: u64,
}

#[event]
pub struct WinClaimed {
    pub raffle: Pubkey,
    pub owner: Pubkey,
    pub winner_ticket: u64,
}

#[event]
pub struct PrizeSet {
    pub raffle: Pubkey,
    pub prize_mint: Pubkey,
}

#[event]
pub struct PrizeClaimed {
    pub raffle: Pubkey,
    pub winner: Pubkey,
    pub prize_mint: Pubkey,
}

#[error_code]
pub enum RaffleError {
    #[msg("Unauthorized")] Unauthorized,
    #[msg("Invalid amount")] InvalidAmount,
    #[msg("Invalid deadline")] InvalidDeadline,
    #[msg("Overflow")] Overflow,
    #[msg("Raffle not selling")] RaffleNotSelling,
    #[msg("Past deadline")] PastDeadline,
    #[msg("Concurrent deposit; refresh raffle and pass current start_index")] ConcurrentDeposit,
    #[msg("Over-subscription")] OverSubscription,
    #[msg("Wrong status")] WrongStatus,
    #[msg("Invalid winner index")] InvalidWinner,
    #[msg("Not refundable yet")] NotRefundableYet,
    #[msg("Wrong raffle for ticket")] WrongRaffle,
    #[msg("Already refunded")] AlreadyRefunded,
    #[msg("Already claimed win")] AlreadyClaimedWin,
    #[msg("Not winning ticket range")] NotWinningTicket,
    #[msg("Must deposit whole tokens")] MustDepositWholeTokens,
    #[msg("Prize already set")] PrizeAlreadySet,
    #[msg("Prize must be an NFT (decimals = 0)")] PrizeMustBeNft,
    #[msg("Prize not set")] PrizeNotSet,
    #[msg("Prize already claimed")] PrizeAlreadyClaimed,
    #[msg("Must claim win first")] MustClaimWinFirst,
    #[msg("Proceeds already collected")] AlreadyCollected,
    #[msg("Invalid slot index")] InvalidSlot,
    #[msg("Slot already taken")] SlotAlreadyTaken,
    #[msg("Slippage exceeded")] SlippageExceeded,
    #[msg("Invalid NFT collection")] InvalidCollection,
    #[msg("Permit expired")] PermitExpired,
    #[msg("Permit invalid")] PermitInvalid,
    #[msg("Ticket mode disabled")] TicketModeDisabled,
    #[msg("Ticket burn required")] TicketBurnRequired,
    #[msg("Pyth price unavailable")] PythPriceUnavailable,
    #[msg("Pyth price stale")] PythPriceStale,
}

#[repr(u8)]
pub enum RaffleStatus {
    Selling = 0,
    Drawing = 1,
    Completed = 2,
    Refunding = 3,
}

#[error_code]
pub enum ArcError {
    #[msg("The computation was aborted")] AbortedComputation,
    #[msg("The cluster is not set")] ClusterNotSet,
}
