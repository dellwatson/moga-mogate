use anchor_lang::prelude::*;

declare_id!("Fd4izp6LrhuDdEUMfukXkgw2Rg9e8VY3rTL5hNokuvyR");

#[account]
pub struct TestState {
    pub value: u64,
}

#[derive(Accounts)]
pub struct SetValue<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,

    #[account(
        init_if_needed,
        payer = payer,
        seeds = [b"state", payer.key().as_ref()],
        bump,
        space = 8 + 8,
    )]
    pub state: Account<'info, TestState>,

    pub system_program: Program<'info, System>,
}

#[program]
pub mod ant_mint_test {
    use super::*;

    pub fn set_value(ctx: Context<SetValue>, value: u64) -> Result<()> {
        let state = &mut ctx.accounts.state;
        state.value = value;
        Ok(())
    }
}
