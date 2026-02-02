use anchor_lang::prelude::*;
use crate::constants::*;
use crate::state::{Config, Raffle, RaffleSlots};
use crate::types::MultiRaffleStatus;
use crate::error::RaffleError;

#[derive(Accounts)]
#[instruction(raffle_id: String, total_slots: u32)]
pub struct UnsafeHostRaffle<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    
    pub config: Account<'info, Config>,
    
    #[account(
        init,
        payer = payer,
        space = 8 + Raffle::LEN,
        seeds = [RAFFLE_SEED, raffle_id.as_bytes()],
        bump,
    )]
    pub raffle: Account<'info, Raffle>,
    
    #[account(
        init,
        payer = payer,
        space = RaffleSlots::LEN,
        seeds = [SLOTS_SEED, raffle.key().as_ref()],
        bump,
    )]
    pub slots: Account<'info, RaffleSlots>,
    
    /// CHECK: Treasury PDA for raffle proceeds
    #[account(mut, seeds = [TREASURY_SEED, raffle.key().as_ref()], bump)]
    pub treasury: SystemAccount<'info>,
    
    pub system_program: Program<'info, System>,
}

pub fn handler(
    ctx: Context<UnsafeHostRaffle>,
    raffle_id: String,
    total_slots: u32,
    max_slots_per_address: u32,
    metadata_uri: String,
    collection: Pubkey,
    premint_contract: bool,
    premint: bool,
    prize_type: u8,
    prize_amount: u64,
    auto_draw: bool,
    auto_claim: bool,
    expires_at: i64,
) -> Result<()> {
    require!(total_slots > 0, RaffleError::TotalSlotsZero);
    require!(max_slots_per_address > 0, RaffleError::MaxSlotsZero);
    require!(raffle_id.len() <= 64, RaffleError::RaffleExists);
    require!(metadata_uri.len() <= 256, RaffleError::RaffleExists);

    let clock = Clock::get()?;

    let raffle = &mut ctx.accounts.raffle;
    require!(raffle.raffle_id.is_empty(), RaffleError::RaffleExists);

    // Host authority (admin)
    raffle.authority = ctx.accounts.payer.key();

    raffle.raffle_id = raffle_id.clone();
    raffle.total_slots = total_slots;
    raffle.max_slots_per_address = max_slots_per_address;
    raffle.metadata_uri = metadata_uri;
    raffle.collection = collection;
    raffle.premint_contract = premint_contract;
    raffle.premint = premint;
    raffle.auto_draw = auto_draw;
    raffle.auto_claim = auto_claim;
    raffle.prize_type = prize_type;
    raffle.prize_amount = prize_amount;
    raffle.created_at = clock.unix_timestamp;
    raffle.expires_at = expires_at;
    raffle.status = MultiRaffleStatus::Open as u8;
    raffle.sold_slots = 0;
    raffle.winner_slot = 0;
    raffle.winner = Pubkey::default();
    raffle.claimed = false;
    raffle.winning_slot_handle = 0; // no winning slot yet (FHE will set this)
    
    let (_, raffle_bump) = Pubkey::find_program_address(
        &[RAFFLE_SEED, raffle.raffle_id.as_bytes()],
        ctx.program_id,
    );
    raffle.bump = raffle_bump;

    // Initialize slots metadata (actual slots stored in Light compressed accounts)
    let slots = &mut ctx.accounts.slots;
    slots.raffle = raffle.key();
    slots.total_slots = total_slots;
    slots.sold_slots = 0;
    
    msg!("✅ Raffle {} created with ZK-compression support", raffle_id);
    msg!("   Total slots: {}", total_slots);
    msg!("   Storage: {} bytes (constant!)", RaffleSlots::LEN);
    msg!("   Slot ownership will be stored in Light compressed accounts");

    Ok(())
}
