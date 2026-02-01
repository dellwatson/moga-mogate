use anchor_lang::prelude::*;
use crate::constants::{MAX_RAFFLE_ID_LEN, MAX_URI_LEN, MAX_SLOTS_PER_USER, RAFFLE_SEED, SLOTS_SEED, TREASURY_SEED};
use crate::error::RaffleError;
use crate::state::{Config, Raffle, RaffleSlots};
use crate::types::MultiRaffleStatus;

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
        space = 8 + RaffleSlots::space(total_slots),
        seeds = [SLOTS_SEED, raffle.key().as_ref()],
        bump,
    )]
    pub slots: Account<'info, RaffleSlots>,
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
    require!(max_slots_per_address <= MAX_SLOTS_PER_USER, RaffleError::MaxSlotsPerAddress);
    require!(raffle_id.len() <= MAX_RAFFLE_ID_LEN, RaffleError::RaffleExists);
    require!(metadata_uri.len() <= MAX_URI_LEN, RaffleError::RaffleExists);

    let clock = Clock::get()?;

    let raffle = &mut ctx.accounts.raffle;
    require!(raffle.raffle_id.is_empty(), RaffleError::RaffleExists);

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
    
    // Manually derive bump
    let (_, raffle_bump) = Pubkey::find_program_address(
        &[RAFFLE_SEED, raffle_id.as_bytes()],
        ctx.program_id,
    );
    raffle.bump = raffle_bump;

    // Initialize slots owners as empty
    let slots = &mut ctx.accounts.slots;
    slots.raffle = raffle.key();
    slots.total_slots = total_slots;
    slots.slot_owners = vec![Pubkey::default(); total_slots as usize];

    Ok(())
}
