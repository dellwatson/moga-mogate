use anchor_lang::prelude::*;
use crate::constants::{MAX_RAFFLE_ID_LEN, MAX_URI_LEN, MAX_SLOTS_PER_USER, RAFFLE_SEED, SLOTS_SEED, TREASURY_SEED, USER_SEED};
use crate::error::RaffleError;
use crate::state::{Config, Raffle, RaffleSlots, UserRaffle};
use crate::types::MultiRaffleStatus;
use crate::utils::{handle_native_payment, join_raffle_internal};

#[derive(Accounts)]
#[instruction(raffle_id: String, total_slots: u32)]
pub struct UnsafeHostAndJoinRaffle<'info> {
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
    #[account(
        init,
        payer = payer,
        space = 8 + UserRaffle::space(),
        seeds = [USER_SEED, raffle.key().as_ref(), payer.key().as_ref()],
        bump,
    )]
    pub user_raffle: Account<'info, UserRaffle>,
    #[account(mut, seeds = [TREASURY_SEED, raffle.key().as_ref()], bump)]
    pub treasury: SystemAccount<'info>,
    pub system_program: Program<'info, System>,
}

#[allow(clippy::too_many_arguments)]
pub fn handler(
    ctx: Context<UnsafeHostAndJoinRaffle>,
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
    slot_ids: Vec<u32>,
    amount: u64,
    _bonus_free_slots: u32,
) -> Result<()> {
    require!(total_slots > 0, RaffleError::TotalSlotsZero);
    require!(max_slots_per_address > 0, RaffleError::MaxSlotsZero);
    require!(max_slots_per_address <= MAX_SLOTS_PER_USER, RaffleError::MaxSlotsPerAddress);
    require!(raffle_id.len() <= MAX_RAFFLE_ID_LEN, RaffleError::RaffleExists);
    require!(metadata_uri.len() <= MAX_URI_LEN, RaffleError::RaffleExists);
    require!(!slot_ids.is_empty(), RaffleError::NoSlots);

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

    let slots_acc = &mut ctx.accounts.slots;
    slots_acc.raffle = raffle.key();
    slots_acc.total_slots = total_slots;
    slots_acc.slot_owners = vec![Pubkey::default(); total_slots as usize];

    let user = &mut ctx.accounts.user_raffle;
    user.raffle = raffle.key();
    user.user = ctx.accounts.payer.key();
    user.paid = 0;
    user.slots = Vec::new();

    handle_native_payment(
        &ctx.accounts.payer,
        &ctx.accounts.treasury,
        &ctx.accounts.system_program,
        user,
        amount,
    )?;

    if raffle.expires_at != 0 {
        require!(clock.unix_timestamp <= raffle.expires_at, RaffleError::RaffleExpired);
    }

    let requested = slot_ids.len() as u32;
    let remaining = raffle.total_slots.saturating_sub(raffle.sold_slots);
    require!(requested <= remaining, RaffleError::OverCapacity);

    join_raffle_internal(
        raffle,
        slots_acc,
        user,
        &ctx.accounts.payer.key(),
        &slot_ids,
    )?;

    Ok(())
}
