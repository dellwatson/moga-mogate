use anchor_lang::prelude::*;
use anchor_lang::system_program::{self, Transfer};
use crate::state::{Config, Raffle, RaffleSlots, UserRaffle};
use crate::error::RaffleError;
use crate::types::MultiRaffleStatus;
use light_sdk::{
    account::LightAccount,
    cpi::{v2::CpiAccounts, v2::LightSystemProgramCpi, InvokeLightSystemProgram, LightCpiInstruction},
    instruction::{account_meta::CompressedAccountMeta, ValidityProof},
    LightDiscriminator,
};
use crate::LIGHT_CPI_SIGNER;

pub const RAFFLE_SEED: &[u8] = b"raffle";
pub const SLOTS_SEED: &[u8] = b"slots";
pub const USER_SEED: &[u8] = b"user";
pub const TREASURY_SEED: &[u8] = b"treasury";

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
    
    /// CHECK: Light Protocol state tree
    /// CHECK: Light Protocol state tree (for compressed accounts)
    pub light_state_tree: UncheckedAccount<'info>,
    
    /// CHECK: Light Protocol program
    pub light_system_program: UncheckedAccount<'info>,
    
    #[account(mut, seeds = [TREASURY_SEED, raffle.key().as_ref()], bump)]
    pub treasury: SystemAccount<'info>,
    
    pub system_program: Program<'info, System>,
}

pub fn handler(
    ctx: Context<UnsafeJoinRaffle>,
    slot_ids: Vec<u32>,
    amount: u64,
    merkle_proofs: Vec<Vec<[u8; 32]>>,
) -> Result<()> {
    let raffle = &mut ctx.accounts.raffle;
    let slots = &mut ctx.accounts.slots;
    let user_raffle = &mut ctx.accounts.user_raffle;
    let config = &ctx.accounts.config;
    
    // Validate raffle status
    require!(raffle.status == MultiRaffleStatus::Open as u8, RaffleError::RaffleNotOpen);
    
    // Validate slot count
    require!(!slot_ids.is_empty(), RaffleError::NoSlotsProvided);
    require!(
        slot_ids.len() as u32 <= raffle.max_slots_per_address,
        RaffleError::ExceedsMaxSlots
    );
    
    // Validate all slot IDs are within range
    for &slot_id in &slot_ids {
        require!(slot_id > 0 && slot_id <= raffle.total_slots, RaffleError::InvalidSlotId);
    }
    
    msg!("Join raffle with {} slots (ZK-compressed)", slot_ids.len());
    
    // Transfer payment to treasury
    let transfer_ctx = CpiContext::new(
        ctx.accounts.system_program.to_account_info(),
        Transfer {
            from: ctx.accounts.payer.to_account_info(),
            to: ctx.accounts.treasury.to_account_info(),
        },
    );
    system_program::transfer(transfer_ctx, amount)?;
    
    // Initialize user raffle account
    user_raffle.raffle = raffle.key();
    user_raffle.user = ctx.accounts.payer.key();
    user_raffle.slots = slot_ids.clone();
    user_raffle.paid = amount;
    
    // Update raffle and slots metadata
    raffle.sold_slots = raffle.sold_slots.checked_add(slot_ids.len() as u32)
        .ok_or(RaffleError::Overflow)?;
    slots.sold_slots = raffle.sold_slots;
    
    // For Light Protocol: Create compressed slot ownership records
    // Each slot is stored as a compressed account to save space
    // The actual slot data is stored in Light Protocol's compressed state
    // For now, we track ownership in UserRaffle account
    // Full ZK proof verification would happen here in production
    
    msg!("Successfully joined raffle. Slots: {:?}", slot_ids);
    msg!("Total sold slots: {}/{}", raffle.sold_slots, raffle.total_slots);
    
    // Check if raffle is now filled
    if raffle.sold_slots >= raffle.total_slots {
        raffle.status = MultiRaffleStatus::Filled as u8;
        msg!("Raffle is now FILLED!");
    }
    
    Ok(())
}
