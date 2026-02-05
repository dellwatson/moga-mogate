use anchor_lang::prelude::*;
use anchor_lang::system_program::{self, Transfer};
use crate::constants::{CONFIG_SEED, RAFFLE_SEED, SLOTS_SEED, TREASURY_SEED, USER_SEED};
use crate::error::RaffleError;
use crate::state::{Config, Raffle, RaffleSlots, UserRaffle};
use crate::types::MultiRaffleStatus;

#[derive(Accounts)]
pub struct ClaimRefund<'info> {
    #[account(mut)]
    pub caller: Signer<'info>,
    #[account(seeds = [CONFIG_SEED], bump)]
    pub config: Account<'info, Config>,

    #[account(mut, seeds = [RAFFLE_SEED, raffle.raffle_id.as_bytes()], bump = raffle.bump)]
    pub raffle: Account<'info, Raffle>,

    #[account(seeds = [SLOTS_SEED, raffle.key().as_ref()], bump)]
    pub slots: Account<'info, RaffleSlots>,

    #[account(
        mut,
        seeds = [USER_SEED, raffle.key().as_ref(), caller.key().as_ref()],
        bump,
    )]
    pub user_raffle: Account<'info, UserRaffle>,

    #[account(mut, seeds = [TREASURY_SEED, raffle.key().as_ref()], bump)]
    pub treasury: SystemAccount<'info>,

    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<ClaimRefund>) -> Result<()> {
    let clock = Clock::get()?;
    let cfg = &ctx.accounts.config;
    let raffle = &mut ctx.accounts.raffle;
    let user = &mut ctx.accounts.user_raffle;

    require!(
        raffle.expires_at != 0 && clock.unix_timestamp > raffle.expires_at,
        RaffleError::RaffleExpired
    );
    require!(raffle.sold_slots < raffle.total_slots, RaffleError::OverCapacity);
    require!(
        raffle.status == MultiRaffleStatus::Open as u8
            || raffle.status == MultiRaffleStatus::Cancelled as u8,
        RaffleError::BadStatus
    );

    let paid = user.paid;
    require!(paid > 0, RaffleError::NothingPaid);

    if raffle.status == MultiRaffleStatus::Open as u8 {
        raffle.status = MultiRaffleStatus::Cancelled as u8;
    }

    user.paid = 0;
    user.ticket_count = 0;

    let refund_bps = 10_000u64.saturating_sub(cfg.refund_fee_bps as u64);
    let refund_amount = paid
        .saturating_mul(refund_bps)
        .checked_div(10_000)
        .ok_or(RaffleError::NothingPaid)?;

    let raffle_key = raffle.key();
    let (_, bump) = Pubkey::find_program_address(
        &[TREASURY_SEED, raffle_key.as_ref()],
        ctx.program_id,
    );
    let seeds: &[&[u8]] = &[TREASURY_SEED, raffle_key.as_ref(), &[bump]];
    let signer_seeds: &[&[&[u8]]] = &[seeds];

    let cpi_accounts = Transfer {
        from: ctx.accounts.treasury.to_account_info(),
        to: ctx.accounts.caller.to_account_info(),
    };
    let cpi_ctx = CpiContext::new_with_signer(
        ctx.accounts.system_program.to_account_info(),
        cpi_accounts,
        signer_seeds,
    );
    system_program::transfer(cpi_ctx, refund_amount)?;

    Ok(())
}
