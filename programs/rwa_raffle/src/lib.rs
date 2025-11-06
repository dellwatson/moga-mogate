use anchor_lang::prelude::*;
use anchor_spl::token_interface::{self as token, Mint, TokenAccount, TokenInterface, TransferChecked};
use arcium_anchor::prelude::*;
use anchor_lang::solana_program::instruction::AccountMeta;
use light_sdk::{
    account::LightAccount,
    address::v1::derive_address,
    cpi::{v1::CpiAccounts, CpiSigner},
    derive_light_cpi_signer,
    instruction::{PackedAddressTreeInfo, ValidityProof},
    LightDiscriminator, LightHasher,
};
use light_sdk::cpi::{v1::LightSystemProgramCpi, InvokeLightSystemProgram, LightCpiInstruction};

// NOTE: Devnet program id
declare_id!("5xAQW7YPsYjHkeWfuqa55ZbeUDcLJtsRUiU4HcCLm12M");

const RAFFLE_SEED: &[u8] = b"raffle";
const TICKET_SEED: &[u8] = b"ticket";
const SLOTS_SEED: &[u8] = b"slots";

pub const LIGHT_CPI_SIGNER: CpiSigner =
    derive_light_cpi_signer!("5xAQW7YPsYjHkeWfuqa55ZbeUDcLJtsRUiU4HcCLm12M");

const COMP_DEF_OFFSET_DRAW: u32 = comp_def_offset("draw");

#[arcium_program]
pub mod rwa_raffle {
    use super::*;

    /// Initialize a new raffle. Escrow mint is the stable coin (e.g. USDC) and
    /// escrow ATA must be owned by the raffle PDA. This path requires only the
    /// organizer signature.
    pub fn initialize_raffle(
        ctx: Context<InitializeRaffle>,
        required_tickets: u64,
        deadline_unix_ts: i64,
    ) -> Result<()> {
        require!(required_tickets > 0, RaffleError::InvalidAmount);
        require!(deadline_unix_ts > Clock::get()?.unix_timestamp, RaffleError::InvalidDeadline);

        let raffle = &mut ctx.accounts.raffle;
        raffle.organizer = ctx.accounts.organizer.key();
        raffle.mint = ctx.accounts.mint.key();
        raffle.escrow = ctx.accounts.escrow_ata.key();
        raffle.required_tickets = required_tickets;
        raffle.tickets_sold = 0;
        raffle.next_ticket_index = 1; // 1-based ticket numbers
        raffle.deadline = deadline_unix_ts;
        raffle.status = RaffleStatus::Selling as u8;
        raffle.winner_ticket = 0;
        raffle.proceeds_collected = false;
        raffle.bump = ctx.bumps.raffle;

        // Basic invariants for escrow
        require_keys_eq!(ctx.accounts.escrow_ata.mint, raffle.mint);
        require_keys_eq!(ctx.accounts.escrow_ata.owner, ctx.accounts.raffle.key());

        emit!(RaffleInitialized {
            raffle: raffle.key(),
            organizer: raffle.organizer,
            mint: raffle.mint,
            required_tickets,
            deadline_unix_ts,
        });

        // Initialize RaffleSlots PDA for per-slot state
        let slots_acc = &mut ctx.accounts.slots;
        slots_acc.raffle = raffle.key();
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
    pub mint: InterfaceAccount<'info, Mint>,
    
    /// The organizer's token account (USDC) where proceeds will be sent.
    #[account(mut, constraint = organizer_ata.owner == organizer.key(), constraint = organizer_ata.mint == mint.key())]
    pub organizer_ata: InterfaceAccount<'info, TokenAccount>,
    
    /// The raffle's escrow token account (USDC) holding all participant deposits.
    /// Owned by the raffle PDA, which will sign the transfer.
    #[account(mut, constraint = escrow_ata.owner == raffle.key(), constraint = escrow_ata.mint == mint.key())]
    pub escrow_ata: InterfaceAccount<'info, TokenAccount>,
    
    /// SPL Token program for the transfer.
    pub token_program: Program<'info, TokenInterface>,
}

    /// **Organizer collects USDC proceeds from the raffle escrow after completion.**
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
        let raffle = &mut ctx.accounts.raffle;
        
        // 1. Verify raffle is completed (winner selected)
        require!(raffle.status == RaffleStatus::Completed as u8, RaffleError::WrongStatus);
        
        // 2. Prevent double-collection
        require!(!raffle.proceeds_collected, RaffleError::AlreadyCollected);

        // 3. Get the full escrow balance (all participant USDC deposits)
        let amount = ctx.accounts.escrow_ata.amount;
        require!(amount > 0, RaffleError::InvalidAmount);

        // 4. Prepare the transfer: escrow → organizer
        let cpi_accounts = TransferChecked {
            from: ctx.accounts.escrow_ata.to_account_info(),
            to: ctx.accounts.organizer_ata.to_account_info(),
            mint: ctx.accounts.mint.to_account_info(),
            authority: ctx.accounts.raffle.to_account_info(), // Raffle PDA signs
        };
        let cpi_program = ctx.accounts.token_program.to_account_info();
        
        // 5. Derive PDA signer seeds (raffle PDA owns the escrow)
        let seeds: &[&[u8]] = &[
            RAFFLE_SEED,
            ctx.accounts.mint.key().as_ref(),
            ctx.accounts.organizer.key().as_ref(),
        ];
        let bump = [raffle.bump];
        let signer_seeds: &[&[u8]] = &[seeds[0], seeds[1], seeds[2], &bump];
        
        // 6. Execute the transfer with PDA signature
        token::transfer_checked(
            CpiContext::new_with_signer(cpi_program, cpi_accounts, &[signer_seeds]),
            amount,
            ctx.accounts.mint.decimals,
        )?;

        // 7. Mark as collected to prevent re-entrancy
        raffle.proceeds_collected = true;
        Ok()
    }

#[derive(Accounts)]
#[instruction(required_tickets: u64, deadline_unix_ts: i64, _permit_nonce: [u8; 16], _permit_expiry_unix_ts: i64)]
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
    pub token_program: Program<'info, TokenInterface>,
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
        _permit_nonce: [u8; 16],
        _permit_expiry_unix_ts: i64,
    ) -> Result<()> {
        let organizer = &ctx.accounts.organizer;
        let raffle = &mut ctx.accounts.raffle;
        raffle.organizer = organizer.key();
        raffle.mint = ctx.accounts.mint.key();
        raffle.escrow = ctx.accounts.escrow_ata.key();
        raffle.required_tickets = required_tickets;
        raffle.tickets_sold = 0;
        raffle.next_ticket_index = 1;
        raffle.deadline = deadline_unix_ts;
        raffle.status = RaffleStatus::Selling as u8;
        raffle.winner_ticket = 0;
        raffle.prize_set = false;
        raffle.prize_claimed = false;
        raffle.proceeds_collected = false;
        raffle.bump = ctx.bumps.raffle;

        require_keys_eq!(ctx.accounts.escrow_ata.mint, raffle.mint);
        require_keys_eq!(ctx.accounts.escrow_ata.owner, ctx.accounts.raffle.key());

        emit!(RaffleInitialized {
            raffle: raffle.key(),
            organizer: raffle.organizer,
            mint: raffle.mint,
            required_tickets,
            deadline_unix_ts,
        });

        // Initialize RaffleSlots PDA for per-slot state
        let slots_acc = &mut ctx.accounts.slots;
        slots_acc.raffle = raffle.key();
        slots_acc.required_slots = required_tickets as u32;
        let bitmap_len = ((required_tickets + 7) / 8) as usize;
        slots_acc.bitmap = vec![0u8; bitmap_len];
        slots_acc.owners = vec![Pubkey::default(); required_tickets as usize];

        // TODO: Verify ed25519 signature in instructions sysvar for the organizer permit.
        Ok(())
    }

    /// Deposit using Light Protocol compressed accounts for the Ticket record.
    pub fn deposit_compressed<'info>(
        ctx: Context<'_, '_, '_, 'info, DepositCompressed<'info>>,
        proof: ValidityProof,
        address_tree_info: PackedAddressTreeInfo,
        output_state_tree_index: u8,
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

        // Transfer tokens into escrow
        let cpi_accounts = TransferChecked {
            from: ctx.accounts.payer_ata.to_account_info(),
            to: ctx.accounts.escrow_ata.to_account_info(),
            mint: ctx.accounts.mint.to_account_info(),
            authority: ctx.accounts.signer.to_account_info(),
        };
        let cpi_program = ctx.accounts.token_program.to_account_info();
        token::transfer_checked(CpiContext::new(cpi_program, cpi_accounts), amount, ctx.accounts.mint.decimals)?;

        // Create compressed ticket account via Light
        let light_cpi_accounts = CpiAccounts::new(
            ctx.accounts.signer.as_ref(),
            ctx.remaining_accounts,
            crate::LIGHT_CPI_SIGNER,
        );

        let (address, address_seed) = derive_address(
            &[b"ticket", raffle.key().as_ref(), ctx.accounts.signer.key().as_ref(), &start_index.to_le_bytes()],
            &address_tree_info
                .get_tree_pubkey(&light_cpi_accounts)
                .map_err(|_| error!(RaffleError::Overflow))?,
            &crate::ID,
        );

        let new_address_params = address_tree_info.into_new_address_params_packed(address_seed);

        let mut ticket_acc = LightAccount::<TicketCompressed>::new_init(
            &crate::ID,
            Some(address),
            output_state_tree_index,
        );
        ticket_acc.raffle = raffle.key();
        ticket_acc.owner = ctx.accounts.signer.key();
        ticket_acc.start = raffle.next_ticket_index;
        ticket_acc.count = tickets;
        ticket_acc.refunded = false;
        ticket_acc.claimed_win = false;

        LightSystemProgramCpi::new_cpi(LIGHT_CPI_SIGNER, proof)
            .with_light_account(ticket_acc)?
            .with_new_addresses(&[new_address_params])
            .invoke(light_cpi_accounts)?;

        // Update counters and emit
        raffle.tickets_sold = raffle.tickets_sold.checked_add(tickets).ok_or(RaffleError::Overflow)?;
        raffle.next_ticket_index = raffle.next_ticket_index.checked_add(tickets).ok_or(RaffleError::Overflow)?;

        emit!(Deposited {
            raffle: raffle.key(),
            owner: ctx.accounts.signer.key(),
            start: start_index,
            count: tickets,
            tickets_sold: raffle.tickets_sold,
        });

        if raffle.tickets_sold == raffle.required_tickets {
            raffle.status = RaffleStatus::Drawing as u8;
            emit!(ThresholdReached { raffle: raffle.key(), supply: raffle.required_tickets });
        }

        Ok(())
    }

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
    pub fn refund_batch(ctx: Context<RefundBatch>) -> Result<()> {
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
        let raffle = &mut ctx.accounts.raffle;
        require!(raffle.status == RaffleStatus::Completed as u8, RaffleError::WrongStatus);
        require!(raffle.prize_set, RaffleError::PrizeNotSet);
        require!(!raffle.prize_claimed, RaffleError::PrizeAlreadyClaimed);
        require_keys_eq!(raffle.prize_mint, ctx.accounts.prize_mint.key());
        require_keys_eq!(raffle.prize_escrow, ctx.accounts.prize_escrow.key());
        require!(ctx.accounts.prize_mint.decimals == 0, RaffleError::PrizeMustBeNft);

        let ticket = &ctx.accounts.ticket;
        require!(ticket.raffle == raffle.key(), RaffleError::WrongRaffle);
        require!(ticket.owner == ctx.accounts.winner.key(), RaffleError::Unauthorized);
        require!(ticket.claimed_win, RaffleError::MustClaimWinFirst);

        let seeds: &[&[u8]] = &[
            RAFFLE_SEED,
            raffle.mint.as_ref(),
            raffle.organizer.as_ref(),
            &[raffle.bump],
        ];
        let signer = &[seeds];
        let cpi_accounts = TransferChecked {
            from: ctx.accounts.prize_escrow.to_account_info(),
            to: ctx.accounts.winner_prize_ata.to_account_info(),
            mint: ctx.accounts.prize_mint.to_account_info(),
            authority: ctx.accounts.raffle.to_account_info(),
        };
        let cpi_program = ctx.accounts.token_program.to_account_info();
        token::transfer_checked(CpiContext::new_with_signer(cpi_program, cpi_accounts, signer), 1, 0)?;

        raffle.prize_claimed = true;
        emit!(PrizeClaimed { raffle: raffle.key(), winner: ctx.accounts.winner.key(), prize_mint: raffle.prize_mint });
        Ok(())
    }

    pub fn init_draw_comp_def(ctx: Context<InitDrawCompDef>) -> Result<()> {
        init_comp_def(ctx.accounts, true, 0, None, None)?;
        Ok(())
    }

    pub fn request_draw_arcium(
        ctx: Context<RequestDrawArcium>,
        computation_offset: u64,
    ) -> Result<()> {
        let raffle = &ctx.accounts.raffle;
        require!(raffle.status == RaffleStatus::Drawing as u8, RaffleError::WrongStatus);

        let args = vec![Argument::PlaintextU64(raffle.required_tickets)];

        ctx.accounts.sign_pda_account.bump = ctx.bumps.sign_pda_account;

        let cb_ix = DrawCallback::callback_ix(&[AccountMeta::new(ctx.accounts.raffle.key(), false)]);
        queue_computation(ctx.accounts, computation_offset, args, None, vec![cb_ix])?;

        Ok(())
    }

    #[arcium_callback(encrypted_ix = "draw")]
    pub fn draw_callback(
        ctx: Context<DrawCallback>,
        output: ComputationOutputs<DrawOutput>,
    ) -> Result<()> {
        let winner_ticket = match output {
            ComputationOutputs::Success(DrawOutput { field_0 }) => field_0,
            _ => return Err(ArcError::AbortedComputation.into()),
        };

        let raffle = &mut ctx.accounts.raffle;
        require!(raffle.status == RaffleStatus::Drawing as u8, RaffleError::WrongStatus);
        require!(winner_ticket >= 1 && winner_ticket <= raffle.required_tickets, RaffleError::InvalidWinner);
        raffle.winner_ticket = winner_ticket;
        raffle.status = RaffleStatus::Completed as u8;
        emit!(WinnerSelected { raffle: raffle.key(), winner_ticket });
        Ok(())
    }
}

#[derive(Accounts)]
#[instruction(required_tickets: u64, deadline_unix_ts: i64)]
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
    pub token_program: Program<'info, TokenInterface>,
}

#[derive(Accounts)]
pub struct RefundBatch<'info> {
    pub caller: Signer<'info>,
    #[account(mut)]
    pub raffle: Account<'info, Raffle>,
}

#[queue_computation_accounts("draw", payer)]
#[derive(Accounts)]
#[instruction(computation_offset: u64)]
pub struct RequestDrawArcium<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(mut)]
    pub raffle: Account<'info, Raffle>,
    #[account(
        init_if_needed,
        space = 9,
        payer = payer,
        seeds = [&SIGN_PDA_SEED],
        bump,
        address = derive_sign_pda!(),
    )]
    pub sign_pda_account: Account<'info, SignerAccount>,
    #[account(address = derive_mxe_pda!())]
    pub mxe_account: Account<'info, MXEAccount>,
    #[account(mut, address = derive_mempool_pda!())]
    /// CHECK: mempool_account, checked by the arcium program
    pub mempool_account: UncheckedAccount<'info>,
    #[account(mut, address = derive_execpool_pda!())]
    /// CHECK: executing_pool, checked by the arcium program
    pub executing_pool: UncheckedAccount<'info>,
    #[account(mut, address = derive_comp_pda!(computation_offset))]
    /// CHECK: computation_account, checked by the arcium program.
    pub computation_account: UncheckedAccount<'info>,
    #[account(address = derive_comp_def_pda!(COMP_DEF_OFFSET_DRAW))]
    pub comp_def_account: Account<'info, ComputationDefinitionAccount>,
    #[account(mut, address = derive_cluster_pda!(mxe_account))]
    pub cluster_account: Account<'info, Cluster>,
    #[account(mut, address = ARCIUM_FEE_POOL_ACCOUNT_ADDRESS)]
    pub pool_account: Account<'info, FeePool>,
    #[account(address = ARCIUM_CLOCK_ACCOUNT_ADDRESS)]
    pub clock_account: Account<'info, ClockAccount>,
    pub system_program: Program<'info, System>,
    pub arcium_program: Program<'info, Arcium>,
}

#[callback_accounts("draw")]
#[derive(Accounts)]
pub struct DrawCallback<'info> {
    pub arcium_program: Program<'info, Arcium>,
    #[account(address = derive_comp_def_pda!(COMP_DEF_OFFSET_DRAW))]
    pub comp_def_account: Account<'info, ComputationDefinitionAccount>,
    #[account(address = ::anchor_lang::solana_program::sysvar::instructions::ID)]
    /// CHECK: instructions_sysvar, checked by the account constraint
    pub instructions_sysvar: AccountInfo<'info>,
    #[account(mut)]
    pub raffle: Account<'info, Raffle>,
}

#[init_computation_definition_accounts("draw", payer)]
#[derive(Accounts)]
pub struct InitDrawCompDef<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(mut, address = derive_mxe_pda!())]
    pub mxe_account: Box<Account<'info, MXEAccount>>,
    #[account(mut)]
    /// CHECK: comp_def_account, checked by arcium program (not initialized yet)
    pub comp_def_account: UncheckedAccount<'info>,
    pub arcium_program: Program<'info, Arcium>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct DepositCompressed<'info> {
    #[account(mut)]
    pub signer: Signer<'info>,
    #[account(mut, has_one = mint, constraint = raffle.escrow == escrow_ata.key())]
    pub raffle: Account<'info, Raffle>,
    pub mint: InterfaceAccount<'info, Mint>,
    #[account(mut, constraint = payer_ata.owner == signer.key(), constraint = payer_ata.mint == mint.key())]
    pub payer_ata: InterfaceAccount<'info, TokenAccount>,
    #[account(mut, constraint = escrow_ata.owner == raffle.key(), constraint = escrow_ata.mint == mint.key())]
    pub escrow_ata: InterfaceAccount<'info, TokenAccount>,
    pub token_program: Program<'info, TokenInterface>,
}

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
    pub token_program: Program<'info, TokenInterface>,
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
    pub token_program: Program<'info, TokenInterface>,
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
    pub token_program: Program<'info, TokenInterface>,
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
    pub token_program: Program<'info, TokenInterface>,
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
}

impl Raffle {
    pub const LEN: usize = 32 + 32 + 32 + 8 + 8 + 8 + 8 + 1 + 8 + 1 + 32 + 32 + 1 + 1 + 1;
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

#[derive(Clone, Debug, Default, LightDiscriminator, LightHasher)]
pub struct TicketCompressed {
    #[hash]
    pub raffle: Pubkey,
    #[hash]
    pub owner: Pubkey,
    pub start: u64,
    pub count: u64,
    pub refunded: bool,
    pub claimed_win: bool,
}

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
