use anchor_lang::prelude::*;
use inco_lightning::{
    cpi::{self, accounts::{Operation, Allow}, e_eq, allow},
    program::IncoLightning,
    types::{Ebool, Euint128},
    ID as INCO_LIGHTNING_ID,
};
use crate::state::{Raffle, UserRaffle};
use crate::error::RaffleError;

#[derive(Accounts)]
pub struct UnsafeCheckWinner<'info> {
    pub checker: Signer<'info>,

    #[account(mut)]
    pub raffle: Account<'info, Raffle>,

    #[account(mut)]
    pub user_raffle: Account<'info, UserRaffle>,

    pub system_program: Program<'info, System>,

    #[account(address = INCO_LIGHTNING_ID)]
    pub inco_lightning_program: Program<'info, IncoLightning>,
}

pub fn handler(ctx: Context<UnsafeCheckWinner>) -> Result<()> {
    let raffle = &mut ctx.accounts.raffle;
    let user_raffle = &mut ctx.accounts.user_raffle;

    require!(raffle.status == 2, RaffleError::NotDrawn); // Drawn
    require!(user_raffle.user == ctx.accounts.checker.key(), RaffleError::NotWinner);

    let inco = ctx.accounts.inco_lightning_program.to_account_info();
    let signer = ctx.accounts.checker.to_account_info();

    // Compare user's encrypted slots handle with winning slot handle (FHE comparison)
    let cpi_ctx = CpiContext::new(inco.clone(), Operation { signer: signer.clone() });
    let owns_winning_slot: Ebool = e_eq(
        cpi_ctx,
        Euint128(user_raffle.slots_handle),
        Euint128(raffle.winning_slot_handle),
        0,
    )?;

    // If user owns winning slot, set them as winner (delayed transparency revealed)
    if owns_winning_slot.0 != 0 {
        raffle.winner = user_raffle.user;
        // Note: We can't know the actual slot number without decryption
        raffle.winner_slot = 0; // Unknown until off-chain decryption
        
        msg!("Winner identified!");
        msg!("   Winner: {}", user_raffle.user);
        msg!("   FHE comparison confirmed ownership");
        msg!("   (Delayed transparency: slot ownership revealed)");
    } else {
        msg!("User does not own winning slot");
    }

    // Allow user to access the result
    let cpi_ctx_allow = CpiContext::new(inco, Allow { 
        allowance_account: ctx.accounts.user_raffle.to_account_info(),
        signer: ctx.accounts.checker.to_account_info(),
        allowed_address: ctx.accounts.checker.to_account_info(),
        system_program: ctx.accounts.system_program.to_account_info(),
    });
    allow(cpi_ctx_allow, owns_winning_slot.0, true, ctx.accounts.checker.key())?;

    Ok(())
}
