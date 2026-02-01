use anchor_lang::prelude::*;
use anchor_lang::system_program::{self, Transfer};
use crate::constants::{CONFIG_SEED, TREASURY_SEED};
use crate::error::RaffleError;
use crate::state::{Config, Raffle};

#[derive(Accounts)]
pub struct WithdrawProceeds<'info> {
    pub admin: Signer<'info>,
    #[account(seeds = [CONFIG_SEED], bump)]
    pub config: Account<'info, Config>,
    pub raffle: Account<'info, Raffle>,
    #[account(mut, seeds = [TREASURY_SEED, raffle.key().as_ref()], bump)]
    pub treasury: SystemAccount<'info>,
    /// CHECK: arbitrary recipient
    #[account(mut)]
    pub to: UncheckedAccount<'info>,
    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<WithdrawProceeds>, amount: u64) -> Result<()> {
    let cfg = &ctx.accounts.config;
    require!(cfg.admin == ctx.accounts.admin.key(), RaffleError::NotAdmin);

    let treasury_info = ctx.accounts.treasury.to_account_info();
    require!(**treasury_info.lamports.borrow() >= amount, RaffleError::NothingPaid);

    let raffle_key = ctx.accounts.raffle.key();
    let (_, bump) = Pubkey::find_program_address(
        &[TREASURY_SEED, raffle_key.as_ref()],
        ctx.program_id,
    );

    let seeds: &[&[u8]] = &[TREASURY_SEED, raffle_key.as_ref(), &[bump]];
    let signer_seeds: &[&[&[u8]]] = &[seeds];
    let cpi_accounts = Transfer {
        from: ctx.accounts.treasury.to_account_info(),
        to: ctx.accounts.to.to_account_info(),
    };
    let cpi_ctx = CpiContext::new_with_signer(
        ctx.accounts.system_program.to_account_info(),
        cpi_accounts,
        signer_seeds,
    );
    system_program::transfer(cpi_ctx, amount)?;

    Ok(())
}
