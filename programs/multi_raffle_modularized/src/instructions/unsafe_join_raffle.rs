use anchor_lang::prelude::*;
use crate::constants::{RAFFLE_SEED, SLOTS_SEED, TREASURY_SEED, USER_SEED};
use crate::error::RaffleError;
use crate::state::{Config, Raffle, RaffleSlots, UserRaffle};
use crate::types::MultiRaffleStatus;
use crate::utils::{handle_native_payment, join_raffle_internal};

#[derive(Accounts)]
pub struct UnsafeJoinRaffle<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    pub config: Account<'info, Config>,
    #[account(mut, seeds = [RAFFLE_SEED, raffle.raffle_id.as_bytes()], bump = raffle.bump)]
    pub raffle: Account<'info, Raffle>,
    #[account(mut, seeds = [SLOTS_SEED, raffle.key().as_ref()], bump)]
    pub slots: Account<'info, RaffleSlots>,
    #[account(
        init,
        payer = payer,
        space = 8 + UserRaffle::space(),
        seeds = [USER_SEED, raffle.key().as_ref(), payer.key().as_ref()],
        bump,
    )]
    pub user_raffle: Account<'info, UserRaffle>,
    #[account(mut, seeds = [TREASURY_SEED, raffle.key().as_ref()], bump)]
    pub treasury: SystemAccount<'info>,
    pub system_program: Program<'info, System>,
}

pub fn handler(
    ctx: Context<UnsafeJoinRaffle>,
    slot_ids: Vec<u32>,
    amount: u64,
) -> Result<()> {
    require!(!slot_ids.is_empty(), RaffleError::NoSlots);

    let clock = Clock::get()?;
    let raffle = &mut ctx.accounts.raffle;
    let slots_acc = &mut ctx.accounts.slots;
    let user = &mut ctx.accounts.user_raffle;

    require!(raffle.status == MultiRaffleStatus::Open as u8, RaffleError::NotOpen);
    if raffle.expires_at != 0 {
        require!(clock.unix_timestamp <= raffle.expires_at, RaffleError::RaffleExpired);
    }

    // Transfer SOL into raffle treasury PDA and track paid amount
    handle_native_payment(
        &ctx.accounts.payer,
        &ctx.accounts.treasury,
        &ctx.accounts.system_program,
        user,
        amount,
    )?;

    // Initialize user_raffle account
    user.raffle = raffle.key();
    user.user = ctx.accounts.payer.key();

    join_raffle_internal(
        raffle,
        slots_acc,
        user,
        &ctx.accounts.payer.key(),
        &slot_ids,
    )?;

    Ok(())
}
