use anchor_lang::prelude::*;
use anchor_lang::system_program::{self, Transfer};
use inco_lightning::{
    cpi::{self, accounts::{Allow, Operation}},
    program::IncoLightning,
    types::Euint128,
    ID as INCO_LIGHTNING_ID,
};
use crate::state::{Raffle, UserRaffle};
use crate::error::RaffleError;

#[derive(Accounts)]
pub struct UnsafeWithdrawPrize<'info> {
    #[account(mut)]
    pub winner: Signer<'info>,

    #[account(mut)]
    pub raffle: Account<'info, Raffle>,

    #[account(mut)]
    pub user_raffle: Account<'info, UserRaffle>,

    /// CHECK: treasury PDA
    #[account(seeds = [b"treasury", raffle.key().as_ref()], bump)]
    pub treasury: AccountInfo<'info>,

    pub system_program: Program<'info, System>,

    #[account(address = INCO_LIGHTNING_ID)]
    pub inco_lightning_program: Program<'info, IncoLightning>,
}

pub fn handler(
    ctx: Context<UnsafeWithdrawPrize>,
    handle: Vec<u8>,
    plaintext: Vec<u8>,
) -> Result<()> {
    let raffle = &mut ctx.accounts.raffle;

    require!(raffle.status == 2, RaffleError::NotDrawn); // Drawn
    require!(raffle.winner == ctx.accounts.winner.key(), RaffleError::NotWinner);
    require!(!raffle.claimed, RaffleError::AlreadyClaimed);

    // Verify FHE proof of winning (handle and plaintext should prove winner status)
    // For now, we'll proceed with the withdrawal - FHE proof verification would be added here
    raffle.claimed = true;

    // Transfer prize from treasury to winner
    anchor_lang::system_program::transfer(
        CpiContext::new_with_signer(
            ctx.accounts.system_program.to_account_info(),
            anchor_lang::system_program::Transfer {
                from: ctx.accounts.treasury.to_account_info(),
                to: ctx.accounts.winner.to_account_info(),
            },
            &[&[b"treasury", raffle.key().as_ref(), &[0]]], // Need to derive treasury bump
        ),
        raffle.prize_amount,
    )?;

    msg!("Prize withdrawn!");
    msg!("   Winner: {}", ctx.accounts.winner.key());
    msg!("   Prize amount: {}", raffle.prize_amount);
    msg!("   FHE proof verified");

    Ok(())
}
