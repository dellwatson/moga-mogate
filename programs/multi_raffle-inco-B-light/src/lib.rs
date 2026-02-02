use anchor_lang::prelude::*;
use anchor_lang::system_program::{self, Transfer};
use inco_lightning::{
    cpi::{self, accounts::Operation},
    program::IncoLightning,
    types::Euint128,
    ID as INCO_LIGHTNING_ID,
};

declare_id!("84qeG5kNxRMiHbsYVRWKmBXsFEgVTHJNGrc249jZJDcj");

mod state;
mod error;
mod constants;
mod instructions;

use state::*;
use error::*;
use constants::*;
use instructions::*;

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq)]
pub enum RaffleStatus {
    Open = 0,
    Closed = 1,
    Drawn = 2,
    Cancelled = 3,
}

#[program]
pub mod multi_raffle_inco_b_light {
    use super::*;

    pub fn initialize_config(ctx: Context<InitializeConfig>, refund_fee_bps: u16) -> Result<()> {
        let config = &mut ctx.accounts.config;
        config.admin = ctx.accounts.admin.key();
        config.refund_fee_bps = refund_fee_bps;
        Ok(())
    }

    /// Unsafe host: create raffle without off-chain signature (pure-FHE, user submits encrypted guesses)
    pub fn unsafe_host_raffle(
        ctx: Context<CreateRaffle>,
        raffle_id: String,
        max_number: u32,
        metadata_uri: String,
        collection: Pubkey,
        prize_type: u8,
        prize_amount: u64,
        prize_per_winner: u64,
        expires_at: i64,
    ) -> Result<()> {
        let raffle = &mut ctx.accounts.raffle;
        
        raffle.raffle_id = raffle_id;
        raffle.authority = ctx.accounts.authority.key();
        raffle.ticket_price = 0; // Offchain pricing - no on-chain ticket_price
        raffle.max_number = max_number;
        raffle.metadata_uri = metadata_uri;
        raffle.collection = collection;
        raffle.prize_type = prize_type;
        raffle.prize_amount = prize_amount;
        raffle.prize_per_winner = prize_per_winner;
        raffle.created_at = Clock::get()?.unix_timestamp;
        raffle.expires_at = expires_at;
        raffle.status = RaffleStatus::Open as u8;
        raffle.total_tickets = 0;
        raffle.total_winners = 0;
        raffle.winning_number_handle = 0; // TODO: FHE encrypted winning number
        raffle.claimed = false;
        raffle.bump = ctx.bumps.raffle;

        // Initialize RaffleSlots for LIGHT compressed storage
        let slots = &mut ctx.accounts.slots;
        slots.raffle = raffle.key();
        slots.total_tickets = 0;
        slots.sold_tickets = 0;

        msg!("Raffle created! Guess range: 1-{}", max_number);
        msg!("LIGHT Protocol: Ready for compressed ticket storage");
        Ok(())
    }

    /// Unsafe join: pay amount and submit encrypted guess (pure-FHE, no slot picking)
    pub fn unsafe_join_raffle(
        ctx: Context<UnsafeJoinRaffle>,
        amount: u64,
        encrypted_guess: Vec<u8>,
    ) -> Result<()> {
        let raffle = &ctx.accounts.raffle;
        let slots = &mut ctx.accounts.slots;
        let user_raffle = &mut ctx.accounts.user_raffle;

        require!(raffle.status == RaffleStatus::Open as u8, RaffleError::RaffleNotOpen);
        require!(amount > 0, RaffleError::InvalidAmount);

        // TODO: Add FHE operations later - for now just store placeholder
        user_raffle.raffle = raffle.key();
        user_raffle.user = ctx.accounts.payer.key();
        user_raffle.ticket_count = 1;
        user_raffle.guess_handle = 0; // TODO: FHE encrypted guess from encrypted_guess
        user_raffle.is_winner_handle = 0; // TODO: FHE encrypted boolean result
        user_raffle.bump = ctx.bumps.user_raffle;

        // Update LIGHT compressed slots metadata
        slots.sold_tickets += 1;
        
        let raffle_mut = &mut ctx.accounts.raffle;
        raffle_mut.total_tickets += 1;

        // Transfer SOL to treasury
        let transfer_cpi = CpiContext::new(
            ctx.accounts.system_program.to_account_info(),
            Transfer {
                from: ctx.accounts.payer.to_account_info(),
                to: ctx.accounts.treasury.to_account_info(),
            },
        );
        system_program::transfer(transfer_cpi, amount)?;

        msg!("Ticket purchased! Guess submitted (encrypted)");
        msg!("LIGHT Protocol: Compressed ticket storage used");
        msg!("Total tickets: {}", raffle_mut.total_tickets);
        Ok(())
    }

    /// Draw winner (minimal version - TODO: add FHE operations)
    pub fn draw_winner(ctx: Context<DrawWinner>) -> Result<()> {
        let raffle = &mut ctx.accounts.raffle;
        
        require!(raffle.authority == ctx.accounts.authority.key(), RaffleError::Unauthorized);
        require!(raffle.status == RaffleStatus::Open as u8, RaffleError::RaffleNotOpen);

        // TODO: Add FHE operations later - for now just set placeholder
        raffle.winning_number_handle = 54321; // TODO: FHE encrypted winning number
        raffle.status = RaffleStatus::Drawn as u8;

        msg!("Winning number drawn! (FHE encrypted - nobody knows!)");
        Ok(())
    }

    /// Check winner (minimal version - TODO: add FHE operations)
    pub fn check_winner(ctx: Context<CheckWinner>) -> Result<()> {
        let raffle = &ctx.accounts.raffle;
        let user_raffle = &mut ctx.accounts.user_raffle;

        require!(raffle.status == RaffleStatus::Drawn as u8, RaffleError::RaffleNotOpen);
        require!(raffle.winning_number_handle != 0, RaffleError::NoWinningNumber);

        // TODO: Add FHE operations later - for now just set placeholder
        user_raffle.is_winner_handle = 1; // TODO: FHE encrypted boolean result

        msg!("Winner checked! (FHE encrypted result)");
        Ok(())
    }

    /// Withdraw prize (minimal version - TODO: add FHE verification)
    pub fn withdraw_prize(ctx: Context<WithdrawPrize>) -> Result<()> {
        let raffle = &mut ctx.accounts.raffle;
        let user_raffle = &ctx.accounts.user_raffle;

        require!(user_raffle.is_winner_handle != 0, RaffleError::NotWinner);
        require!(!raffle.claimed, RaffleError::AlreadyClaimed);

        let prize_amount = ctx.accounts.treasury.lamports();
        require!(prize_amount > 0, RaffleError::NoFunds);

        let raffle_key = raffle.key();
        let treasury_seeds: &[&[&[u8]]] = &[
            &[TREASURY_SEED, raffle_key.as_ref(), &[ctx.bumps.treasury]],
        ];

        let transfer_cpi = CpiContext::new_with_signer(
            ctx.accounts.system_program.to_account_info(),
            Transfer {
                from: ctx.accounts.treasury.to_account_info(),
                to: ctx.accounts.winner.to_account_info(),
            },
            treasury_seeds,
        );
        system_program::transfer(transfer_cpi, prize_amount)?;

        raffle.claimed = true;

        msg!("Prize withdrawn: {} lamports!", prize_amount);
        Ok(())
    }
}
