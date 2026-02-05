use anchor_lang::prelude::*;
use inco_lightning::{
    cpi::{accounts::{Operation, Allow}, as_euint128, e_eq, allow},
    program::IncoLightning,
    types::{Ebool, Euint128},
    ID as INCO_LIGHTNING_ID,
};
use crate::state::Raffle;
use crate::types::MultiRaffleStatus;
use crate::error::RaffleError;

#[derive(Accounts)]
#[instruction(slot_id: u32)]
pub struct UnsafeCheckWinner<'info> {
    pub checker: Signer<'info>,

    #[account(mut)]
    pub raffle: Account<'info, Raffle>,

    pub system_program: Program<'info, System>,

    #[account(address = INCO_LIGHTNING_ID)]
    pub inco_lightning_program: Program<'info, IncoLightning>,
}

/// Optional: encrypted check of a slot against the winning slot handle.
/// This does NOT prove ownership; it only lets the caller decrypt the result off-chain.
pub fn handler(ctx: Context<UnsafeCheckWinner>, slot_id: u32) -> Result<()> {
    let raffle = &mut ctx.accounts.raffle;

    require!(
        raffle.status == MultiRaffleStatus::WinnerSlotPicked as u8
            || raffle.status == MultiRaffleStatus::WinnerIdentified as u8,
        RaffleError::BadStatus
    );

    let inco = ctx.accounts.inco_lightning_program.to_account_info();
    let signer = ctx.accounts.checker.to_account_info();

    // Compare provided slot id with winning slot handle (FHE comparison)
    let cpi_ctx_slot = CpiContext::new(inco.clone(), Operation { signer: signer.clone() });
    let slot_handle: Euint128 = as_euint128(cpi_ctx_slot, slot_id as u128)?;

    let cpi_ctx_eq = CpiContext::new(inco.clone(), Operation { signer: signer.clone() });
    let owns_winning_slot: Ebool = e_eq(
        cpi_ctx_eq,
        slot_handle,
        Euint128(raffle.winning_slot_handle),
        0,
    )?;

    // Allow user to decrypt the result off-chain (optional remaining accounts)
    if ctx.remaining_accounts.len() >= 2 {
        let cpi_ctx_allow = CpiContext::new(inco, Allow {
            allowance_account: ctx.remaining_accounts[0].clone(),
            signer: ctx.accounts.checker.to_account_info(),
            allowed_address: ctx.remaining_accounts[1].clone(),
            system_program: ctx.accounts.system_program.to_account_info(),
        });
        allow(cpi_ctx_allow, owns_winning_slot.0, true, ctx.accounts.checker.key())?;
    }

    Ok(())
}
