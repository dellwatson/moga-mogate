use anchor_lang::prelude::*;
use anchor_lang::system_program::{self, Transfer};
use crate::state::{Config, Raffle, RaffleSlots};
use crate::constants::{RAFFLE_SEED, SLOTS_SEED, TREASURY_SEED};

#[derive(Accounts)]
#[instruction(raffle_id: String, max_number: u32, metadata_uri: String, collection: Pubkey, prize_type: u8, prize_amount: u64, expires_at: i64)]
pub struct CreateRaffle<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(
        init,
        payer = authority,
        space = Raffle::LEN,
        seeds = [RAFFLE_SEED, raffle_id.as_bytes()],
        bump
    )]
    pub raffle: Account<'info, Raffle>,

    #[account(
        init,
        payer = authority,
        space = RaffleSlots::LEN,
        seeds = [SLOTS_SEED, raffle.key().as_ref()],
        bump
    )]
    pub slots: Account<'info, RaffleSlots>,

    /// CHECK: Treasury PDA
    #[account(
        init,
        payer = authority,
        space = 0,
        seeds = [TREASURY_SEED, raffle.key().as_ref()],
        bump
    )]
    pub treasury: AccountInfo<'info>,

    pub system_program: Program<'info, System>,
}

pub fn handler(
    ctx: Context<CreateRaffle>,
    raffle_id: String,
    max_number: u32,
    metadata_uri: String,
    collection: Pubkey,
    prize_type: u8,
    prize_amount: u64,
    expires_at: i64,
) -> Result<()> {
    let raffle = &mut ctx.accounts.raffle;
    let slots = &mut ctx.accounts.slots;
    
    raffle.raffle_id = raffle_id;
    raffle.authority = ctx.accounts.authority.key();
    raffle.ticket_price = 0; // Offchain pricing
    raffle.max_number = max_number;
    raffle.metadata_uri = metadata_uri;
    raffle.collection = collection;
    raffle.prize_type = prize_type;
    raffle.prize_amount = prize_amount;
    raffle.created_at = Clock::get()?.unix_timestamp;
    raffle.expires_at = expires_at;
    raffle.status = 0; // Open
    raffle.total_tickets = 0;
    raffle.winning_number_handle = 0; // TODO: FHE encrypted winning number
    raffle.claimed = false;
    raffle.bump = ctx.bumps.raffle;

    // Initialize RaffleSlots for LIGHT compressed storage
    slots.raffle = raffle.key();
    slots.total_tickets = 0;
    slots.sold_tickets = 0;

    msg!("Raffle created! Auto-assigned range: 1-{}", max_number);
    msg!("LIGHT Protocol: Ready for compressed ticket storage");
    Ok(())
}
