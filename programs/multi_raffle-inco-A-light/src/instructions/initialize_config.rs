use anchor_lang::prelude::*;
use crate::state::Config;
use crate::constants::CONFIG_SEED;

#[derive(Accounts)]
pub struct InitializeConfig<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,
    #[account(
        init,
        payer = admin,
        space = 8 + Config::LEN,
        seeds = [CONFIG_SEED],
        bump,
    )]
    pub config: Account<'info, Config>,
    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<InitializeConfig>, refund_fee_bps: u16) -> Result<()> {
    let cfg = &mut ctx.accounts.config;
    cfg.admin = ctx.accounts.admin.key();
    cfg.refund_fee_bps = refund_fee_bps;
    
    msg!("Config initialized");
    msg!("  Admin: {}", cfg.admin);
    msg!("  Refund fee: {}bps", refund_fee_bps);
    
    Ok(())
}
