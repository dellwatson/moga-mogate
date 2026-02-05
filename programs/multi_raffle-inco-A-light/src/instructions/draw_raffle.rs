use anchor_lang::prelude::*;
use inco_lightning::{
    cpi::{accounts::Operation, as_euint128},
    program::IncoLightning,
    types::Euint128,
    ID as INCO_LIGHTNING_ID,
};
use crate::constants::{DRAW_DOMAIN, RAFFLE_SEED, SLOTS_SEED};
use crate::state::{Raffle, RaffleSlots};
use crate::types::MultiRaffleStatus;
use crate::error::RaffleError;

#[derive(Accounts)]
pub struct DrawRaffle<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(mut, seeds = [RAFFLE_SEED, raffle.raffle_id.as_bytes()], bump = raffle.bump)]
    pub raffle: Account<'info, Raffle>,

    #[account(seeds = [SLOTS_SEED, raffle.key().as_ref()], bump)]
    pub slots: Account<'info, RaffleSlots>,

    #[account(address = INCO_LIGHTNING_ID)]
    pub inco_lightning_program: Program<'info, IncoLightning>,
}

/// Phase 1: Pick winner slot deterministically and store FHE handle
pub fn handler(ctx: Context<DrawRaffle>) -> Result<()> {
    let raffle = &mut ctx.accounts.raffle;

    require!(raffle.authority == ctx.accounts.authority.key(), RaffleError::NotAdmin);
    require!(raffle.status == MultiRaffleStatus::Filled as u8, RaffleError::BadStatus);
    require!(raffle.sold_slots > 0, RaffleError::NoSlots);

    let clock = Clock::get()?;
    let hash = anchor_lang::solana_program::hash::hashv(&[
        DRAW_DOMAIN,
        raffle.key().as_ref(),
        &clock.slot.to_le_bytes(),
        &clock.unix_timestamp.to_le_bytes(),
    ]);
    let mut seed_bytes = [0u8; 8];
    seed_bytes.copy_from_slice(&hash.to_bytes()[..8]);
    let rand = u64::from_le_bytes(seed_bytes);

    let winner_slot = (rand % raffle.total_slots as u64) as u32 + 1;
    raffle.winner_slot = winner_slot;
    raffle.status = MultiRaffleStatus::WinnerSlotPicked as u8;

    // Store encrypted winning slot handle via Inco Lightning
    let inco = ctx.accounts.inco_lightning_program.to_account_info();
    let cpi_ctx = CpiContext::new(inco, Operation {
        signer: ctx.accounts.authority.to_account_info(),
    });
    let handle: Euint128 = as_euint128(cpi_ctx, winner_slot as u128)?;
    raffle.winning_slot_handle = handle.0;

    msg!("Winner slot picked: {}", winner_slot);
    msg!("Next: call finalize_winner with commit-reveal proof");

    Ok(())
}
