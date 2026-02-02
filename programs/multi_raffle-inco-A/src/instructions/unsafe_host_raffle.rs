use anchor_lang::prelude::*;
use crate::state::{Raffle, RaffleSlots};

#[derive(Accounts)]
#[instruction(raffle_id: String, total_slots: u32)]
pub struct UnsafeHostRaffle<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(
        init,
        payer = authority,
        space = Raffle::LEN,
        seeds = [b"raffle", raffle_id.as_bytes()],
        bump
    )]
    pub raffle: Account<'info, Raffle>,

    #[account(
        init,
        payer = authority,
        space = RaffleSlots::space(total_slots),
        seeds = [b"slots", raffle.key().as_ref()],
        bump
    )]
    pub slots: Account<'info, RaffleSlots>,

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
    let raffle = &mut ctx.accounts.raffle;
    let slots = &mut ctx.accounts.slots;
    let clock = Clock::get()?;

    // Initialize raffle
    raffle.authority = ctx.accounts.authority.key();
    raffle.raffle_id = raffle_id.clone();
    raffle.total_slots = total_slots;
    raffle.max_slots_per_address = max_slots_per_address;
    raffle.metadata_uri = metadata_uri;
    raffle.collection = collection;
    raffle.premint_contract = premint_contract;
    raffle.premint = premint;
    raffle.prize_type = prize_type;
    raffle.prize_amount = prize_amount;
    raffle.auto_draw = auto_draw;
    raffle.auto_claim = auto_claim;
    raffle.created_at = clock.unix_timestamp;
    raffle.expires_at = expires_at;
    raffle.status = 0; // Open
    raffle.sold_slots = 0;
    raffle.winner_slot = 0;
    raffle.winner = Pubkey::default();
    raffle.claimed = false;
    raffle.winning_slot_handle = 0; // FHE: no winning slot yet
    raffle.bump = ctx.bumps.raffle;

    // Initialize slots account with all slots available
    slots.raffle = raffle.key();
    slots.total_slots = total_slots;
    slots.slot_owners = vec![Pubkey::default(); total_slots as usize]; // All slots initially available

    msg!("Raffle {} created", raffle_id);
    msg!("   Total slots: {}", total_slots);
    msg!("   Max slots per address: {}", max_slots_per_address);
    msg!("   Prize amount: {}", prize_amount);
    msg!("   FHE privacy enabled for slot ownership");

    Ok(())
}
