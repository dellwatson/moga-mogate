use anchor_lang::prelude::*;
use anchor_lang::system_program::{self, Transfer};
use inco_lightning::{
    cpi::{self, accounts::Operation},
    program::IncoLightning,
    types::Euint128,
    ID as INCO_LIGHTNING_ID,
};
use crate::state::{Raffle, UserRaffle};
use crate::error::RaffleError;
use crate::constants::TREASURY_SEED;

#[derive(Accounts)]
pub struct UnsafeWithdrawPrize<'info> {
    #[account(mut)]
    pub winner: Signer<'info>,

    #[account(mut)]
    pub raffle: Account<'info, Raffle>,

    #[account(mut)]
    pub user_raffle: Account<'info, UserRaffle>,

    /// CHECK: treasury PDA
    #[account(mut, seeds = [TREASURY_SEED, raffle.key().as_ref()], bump)]
    pub treasury: SystemAccount<'info>,

    pub system_program: Program<'info, System>,

    #[account(address = INCO_LIGHTNING_ID)]
    pub inco_lightning_program: Program<'info, IncoLightning>,
}

pub fn handler(
    ctx: Context<UnsafeWithdrawPrize>,
    _handle: Vec<u8>,
    _plaintext: Vec<u8>,
) -> Result<()> {
    let raffle = &mut ctx.accounts.raffle;

    require!(raffle.status == 2, RaffleError::NotDrawn); // Drawn
    require!(raffle.winner == ctx.accounts.winner.key(), RaffleError::NotWinner);
    require!(!raffle.claimed, RaffleError::AlreadyClaimed);

    // TODO: verify FHE proof of winning using handle/plaintext if desired
    raffle.claimed = true;

    // Transfer prize from treasury to winner
    let raffle_key = raffle.key();
    let (treasury_pda, bump) = Pubkey::find_program_address(
        &[TREASURY_SEED, raffle_key.as_ref()],
        ctx.program_id,
    );
    require!(treasury_pda == ctx.accounts.treasury.key(), RaffleError::BadStatus);

    let seeds: &[&[u8]] = &[TREASURY_SEED, raffle_key.as_ref(), &[bump]];
    let signer_seeds: &[&[&[u8]]] = &[seeds];

    let transfer_ctx = CpiContext::new_with_signer(
        ctx.accounts.system_program.to_account_info(),
        Transfer {
            from: ctx.accounts.treasury.to_account_info(),
            to: ctx.accounts.winner.to_account_info(),
        },
        signer_seeds,
    );
    system_program::transfer(transfer_ctx, raffle.prize_amount)?;

    msg!("Prize withdrawn!");
    msg!("   Winner: {}", ctx.accounts.winner.key());
    msg!("   Prize amount: {}", raffle.prize_amount);

    Ok(())
}
