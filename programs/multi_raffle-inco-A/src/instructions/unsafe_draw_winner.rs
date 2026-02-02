use anchor_lang::prelude::*;
use inco_lightning::{
    cpi::{self, accounts::Operation, e_rand, e_rem, e_add, as_euint128},
    program::IncoLightning,
    types::Euint128,
    ID as INCO_LIGHTNING_ID,
};
use crate::state::{Raffle};
use crate::error::RaffleError;

#[derive(Accounts)]
pub struct UnsafeDrawWinner<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(mut)]
    pub raffle: Account<'info, Raffle>,

    pub system_program: Program<'info, System>,

    #[account(address = INCO_LIGHTNING_ID)]
    pub inco_lightning_program: Program<'info, IncoLightning>,
}

pub fn handler(ctx: Context<UnsafeDrawWinner>) -> Result<()> {
    let raffle = &mut ctx.accounts.raffle;

    require!(raffle.authority == ctx.accounts.authority.key(), RaffleError::NotAdmin);
    require!(raffle.status == 1, RaffleError::NotDrawn); // Filled
    require!(raffle.sold_slots > 0, RaffleError::NoSlots);

    // Generate encrypted winning slot using FHE randomness (1..total_slots)
    let inco = ctx.accounts.inco_lightning_program.to_account_info();
    let signer = ctx.accounts.authority.to_account_info();

    // Get random number
    let cpi_ctx = CpiContext::new(inco.clone(), Operation { signer: signer.clone() });
    let random: Euint128 = e_rand(cpi_ctx, 0)?;

    // Convert random to slot range (1..total_slots)
    let cpi_ctx_mod = CpiContext::new(inco.clone(), Operation { signer: signer.clone() });
    let total_slots_euint = Euint128(raffle.total_slots as u128);
    let random_mod: Euint128 = e_rem(cpi_ctx_mod, random, total_slots_euint, 0)?;

    // Add 1 to make it 1-indexed (slots are 1..total_slots)
    let cpi_ctx_one = CpiContext::new(inco.clone(), Operation { signer: signer.clone() });
    let one = as_euint128(cpi_ctx_one, 1u128)?;
    
    let cpi_ctx_add = CpiContext::new(inco.clone(), Operation { signer: signer.clone() });
    let winning_slot: Euint128 = e_add(cpi_ctx_add, random_mod, one, 0)?;

    // Store encrypted winning slot (FHE: nobody knows the winning number until reveal)
    raffle.winning_slot_handle = winning_slot.0;
    raffle.status = 2; // Drawn

    msg!("Winner drawn!");
    msg!("   Total slots: {}", raffle.total_slots);
    msg!("   Winning slot encrypted: {}", winning_slot.0);
    msg!("   (Slot ownership mapping will be revealed in check_winner)");

    Ok(())
}
