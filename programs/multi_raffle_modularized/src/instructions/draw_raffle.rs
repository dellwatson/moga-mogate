use anchor_lang::prelude::*;
use crate::constants::{RAFFLE_SEED, SLOTS_SEED};
use crate::error::RaffleError;
use crate::state::{Raffle, RaffleSlots};
use crate::types::MultiRaffleStatus;
use crate::utils::end_raffle_internal;

#[derive(Accounts)]
pub struct DrawRaffle<'info> {
    #[account(mut, seeds = [RAFFLE_SEED, raffle.raffle_id.as_bytes()], bump = raffle.bump)]
    pub raffle: Account<'info, Raffle>,
    #[account(seeds = [SLOTS_SEED, raffle.key().as_ref()], bump)]
    pub slots: Account<'info, RaffleSlots>,
}

pub fn handler(ctx: Context<DrawRaffle>) -> Result<()> {
    let raffle = &mut ctx.accounts.raffle;
    let slots = &ctx.accounts.slots;
    
    require!(raffle.status == MultiRaffleStatus::Filled as u8, RaffleError::BadStatus);
    end_raffle_internal(raffle, slots)?;
    Ok(())
}
