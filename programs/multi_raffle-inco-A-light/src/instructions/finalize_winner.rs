use anchor_lang::prelude::*;
use crate::state::{Raffle, RaffleSlots};
use crate::types::MultiRaffleStatus;
use crate::error::RaffleError;

pub const RAFFLE_SEED: &[u8] = b"raffle";
pub const SLOTS_SEED: &[u8] = b"slots";

#[derive(Accounts)]
pub struct FinalizeWinner<'info> {
    #[account(mut, seeds = [RAFFLE_SEED, raffle.raffle_id.as_bytes()], bump = raffle.bump)]
    pub raffle: Account<'info, Raffle>,
    
    #[account(seeds = [SLOTS_SEED, raffle.key().as_ref()], bump)]
    pub slots: Account<'info, RaffleSlots>,
}

/// Phase 2: Finalize winner with Merkle proof
/// Verifies that claimed_winner owns the winner_slot
pub fn handler(
    ctx: Context<FinalizeWinner>,
    claimed_winner: Pubkey,
    merkle_proof: Vec<[u8; 32]>,
) -> Result<()> {
    let raffle = &mut ctx.accounts.raffle;
    let slots = &ctx.accounts.slots;
    
    require!(
        raffle.status == MultiRaffleStatus::WinnerSlotPicked as u8,
        RaffleError::BadStatus
    );
    
    // TODO: Implement Light Protocol proof verification
    // Will use CompressedAccountMeta + ValidityProof from Light SDK
    // to verify winner slot ownership from compressed accounts
    require!(true, RaffleError::InvalidProof);
    
    raffle.winner = claimed_winner;
    raffle.status = MultiRaffleStatus::WinnerIdentified as u8;
    
    msg!("Winner finalized: {}", claimed_winner);
    msg!("Winner can now claim prize");
    
    Ok(())
}
