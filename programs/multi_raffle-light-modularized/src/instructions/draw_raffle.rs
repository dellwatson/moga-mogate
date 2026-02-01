use anchor_lang::prelude::*;
use crate::state::{Raffle, RaffleSlots};
use crate::types::MultiRaffleStatus;
use crate::error::RaffleError;

pub const RAFFLE_SEED: &[u8] = b"raffle";
pub const SLOTS_SEED: &[u8] = b"slots";

#[derive(Accounts)]
pub struct DrawRaffle<'info> {
    #[account(mut, seeds = [RAFFLE_SEED, raffle.raffle_id.as_bytes()], bump = raffle.bump)]
    pub raffle: Account<'info, Raffle>,
    
    #[account(seeds = [SLOTS_SEED, raffle.key().as_ref()], bump)]
    pub slots: Account<'info, RaffleSlots>,
}

/// Phase 1: Pick winner slot deterministically
/// Does NOT set winner yet - requires proof in Phase 2
pub fn handler(ctx: Context<DrawRaffle>) -> Result<()> {
    let raffle = &mut ctx.accounts.raffle;
    
    require!(
        raffle.status == MultiRaffleStatus::Filled as u8,
        RaffleError::BadStatus
    );
    
    // Pick winner slot using on-chain randomness
    let clock = Clock::get()?;
    let total = raffle.total_slots as i64;
    let winner_slot = ((clock.unix_timestamp % total) + 1) as u32;
    
    raffle.winner_slot = winner_slot;
    raffle.status = MultiRaffleStatus::WinnerSlotPicked as u8;
    
    msg!("Winner slot picked: {}", winner_slot);
    msg!("Next: Call finalize_winner with Merkle proof");
    
    Ok(())
}
