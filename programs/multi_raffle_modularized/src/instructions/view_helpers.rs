use anchor_lang::prelude::*;
use crate::constants::{CONFIG_SEED, RAFFLE_SEED, SLOTS_SEED, USER_SEED};
use crate::error::RaffleError;
use crate::state::{Config, Raffle, RaffleSlots, UserRaffle};
use crate::types::{
    MultiRaffleStatus, RaffleDetailView, RaffleResultView, RafflesLoadDetailView,
    RafflesLoadView, RefundStatusView, prize_type_to_string, status_to_string,
};

// FOR DEVELOPMENT PURPOSE ONLY, FE SHOULD DIRECT CALL ACCOUNT

// ============= Get Raffle Load =============
#[derive(Accounts)]
pub struct GetRaffleLoad<'info> {
    #[account(seeds = [RAFFLE_SEED, raffle.raffle_id.as_bytes()], bump = raffle.bump)]
    pub raffle: Account<'info, Raffle>,
}

pub fn get_raffle_load_handler(ctx: Context<GetRaffleLoad>) -> Result<(u32, u32, u8)> {
    let raffle = &ctx.accounts.raffle;
    Ok((raffle.total_slots, raffle.sold_slots, raffle.status))
}

pub fn get_raffle_load_detail_handler(ctx: Context<GetRaffleLoad>) -> Result<RaffleDetailView> {
    let raffle = &ctx.accounts.raffle;
    let status_string = status_to_string(raffle.status);
    let prize_type_string = prize_type_to_string(raffle.prize_type);
    Ok(RaffleDetailView {
        total_slots: raffle.total_slots,
        sold_slots: raffle.sold_slots,
        max_slots_per_address: raffle.max_slots_per_address,
        metadata_uri: raffle.metadata_uri.clone(),
        collection: raffle.collection,
        premint_contract: raffle.premint_contract,
        premint: raffle.premint,
        auto_draw: raffle.auto_draw,
        auto_claim: raffle.auto_claim,
        created_at: raffle.created_at,
        expires_at: raffle.expires_at,
        status: raffle.status,
        status_string,
        winner_slot: raffle.winner_slot,
        winner: raffle.winner,
        prize_amount: raffle.prize_amount,
        prize_type: raffle.prize_type,
        prize_type_string,
        claimed: raffle.claimed,
    })
}

pub fn get_raffle_result_handler(ctx: Context<GetRaffleLoad>) -> Result<RaffleResultView> {
    let raffle = &ctx.accounts.raffle;
    let status_string = status_to_string(raffle.status);
    let prize_type_string = prize_type_to_string(raffle.prize_type);
    Ok(RaffleResultView {
        winner_slot: raffle.winner_slot,
        winner: raffle.winner,
        status: raffle.status,
        status_string,
        claimed: raffle.claimed,
        collection: raffle.collection,
        prize_amount: raffle.prize_amount,
        prize_type: raffle.prize_type,
        prize_type_string,
    })
}

// ============= Get User Raffle Slots =============
#[derive(Accounts)]
pub struct GetUserRaffleSlots<'info> {
    #[account(seeds = [RAFFLE_SEED, raffle.raffle_id.as_bytes()], bump = raffle.bump)]
    pub raffle: Account<'info, Raffle>,
    #[account(seeds = [USER_SEED, raffle.key().as_ref(), user.key().as_ref()], bump)]
    pub user_raffle: Account<'info, UserRaffle>,
    /// CHECK: User pubkey for PDA derivation
    pub user: UncheckedAccount<'info>,
}

pub fn get_user_raffle_slots_handler(ctx: Context<GetUserRaffleSlots>) -> Result<Vec<u32>> {
    let user_raffle = &ctx.accounts.user_raffle;
    Ok(user_raffle.slots.clone())
}

// ============= Get Refund Status =============
#[derive(Accounts)]
pub struct GetRefundStatus<'info> {
    #[account(seeds = [CONFIG_SEED], bump)]
    pub config: Account<'info, Config>,
    #[account(seeds = [RAFFLE_SEED, raffle.raffle_id.as_bytes()], bump = raffle.bump)]
    pub raffle: Account<'info, Raffle>,
    #[account(seeds = [USER_SEED, raffle.key().as_ref(), user.key().as_ref()], bump)]
    pub user_raffle: Account<'info, UserRaffle>,
    /// CHECK: User pubkey for PDA derivation
    pub user: UncheckedAccount<'info>,
}

pub fn get_refund_status_handler(ctx: Context<GetRefundStatus>) -> Result<RefundStatusView> {
    let raffle = &ctx.accounts.raffle;
    let user_raffle = &ctx.accounts.user_raffle;
    let config = &ctx.accounts.config;
    let clock = Clock::get()?;

    let paid = user_raffle.paid;
    let expired = raffle.expires_at != 0 && clock.unix_timestamp > raffle.expires_at;
    let not_filled = raffle.sold_slots < raffle.total_slots;
    
    let refundable_amount = if paid > 0 {
        let refund_bps = 10_000u64.saturating_sub(config.refund_fee_bps as u64);
        paid.saturating_mul(refund_bps).checked_div(10_000).unwrap_or(0)
    } else {
        0
    };

    let can_claim = expired
        && not_filled
        && (raffle.status == MultiRaffleStatus::Open as u8 || raffle.status == MultiRaffleStatus::Cancelled as u8)
        && paid > 0;

    Ok(RefundStatusView {
        paid,
        refundable_amount,
        expired,
        can_claim,
        status: raffle.status,
    })
}

// ============= Batch Views =============
#[derive(Accounts)]
pub struct GetRafflesLoadBatch {}

pub fn get_raffles_load_handler<'info>(
    ctx: Context<'_, '_, 'info, 'info, GetRafflesLoadBatch>,
    raffle_ids: Vec<String>,
) -> Result<RafflesLoadView> {
    let mut total_slots = Vec::with_capacity(raffle_ids.len());
    let mut sold_slots = Vec::with_capacity(raffle_ids.len());
    let mut status = Vec::with_capacity(raffle_ids.len());

    let mut acc_iter = ctx.remaining_accounts.iter();
    for expected_id in raffle_ids.iter() {
        let acc_info = acc_iter.next().ok_or(RaffleError::RaffleNotFound)?;
        let raffle: Account<Raffle> = Account::try_from(acc_info)?;
        require!(raffle.raffle_id == *expected_id, RaffleError::RaffleNotFound);
        total_slots.push(raffle.total_slots);
        sold_slots.push(raffle.sold_slots);
        status.push(raffle.status);
    }

    Ok(RafflesLoadView {
        total_slots,
        sold_slots,
        status,
    })
}

pub fn get_raffles_load_detail_handler<'info>(
    ctx: Context<'_, '_, 'info, 'info, GetRafflesLoadBatch>,
    raffle_ids: Vec<String>,
) -> Result<RafflesLoadDetailView> {
    let len = raffle_ids.len();
    let mut total_slots = Vec::with_capacity(len);
    let mut sold_slots = Vec::with_capacity(len);
    let mut max_slots_per_address = Vec::with_capacity(len);
    let mut metadata_uri = Vec::with_capacity(len);
    let mut collection = Vec::with_capacity(len);
    let mut premint_contract = Vec::with_capacity(len);
    let mut premint = Vec::with_capacity(len);
    let mut auto_draw = Vec::with_capacity(len);
    let mut auto_claim = Vec::with_capacity(len);
    let mut created_at = Vec::with_capacity(len);
    let mut expires_at = Vec::with_capacity(len);
    let mut status = Vec::with_capacity(len);
    let mut winner_slot = Vec::with_capacity(len);
    let mut winner = Vec::with_capacity(len);
    let mut prize_amount = Vec::with_capacity(len);
    let mut prize_type = Vec::with_capacity(len);
    let mut claimed = Vec::with_capacity(len);

    let mut acc_iter = ctx.remaining_accounts.iter();
    for expected_id in raffle_ids.iter() {
        let acc_info = acc_iter.next().ok_or(RaffleError::RaffleNotFound)?;
        let raffle: Account<Raffle> = Account::try_from(acc_info)?;
        require!(raffle.raffle_id == *expected_id, RaffleError::RaffleNotFound);

        total_slots.push(raffle.total_slots);
        sold_slots.push(raffle.sold_slots);
        max_slots_per_address.push(raffle.max_slots_per_address);
        metadata_uri.push(raffle.metadata_uri.clone());
        collection.push(raffle.collection);
        premint_contract.push(raffle.premint_contract);
        premint.push(raffle.premint);
        auto_draw.push(raffle.auto_draw);
        auto_claim.push(raffle.auto_claim);
        created_at.push(raffle.created_at);
        expires_at.push(raffle.expires_at);
        status.push(raffle.status);
        winner_slot.push(raffle.winner_slot);
        winner.push(raffle.winner);
        prize_amount.push(raffle.prize_amount);
        prize_type.push(raffle.prize_type);
        claimed.push(raffle.claimed);
    }

    Ok(RafflesLoadDetailView {
        total_slots,
        sold_slots,
        max_slots_per_address,
        metadata_uri,
        collection,
        premint_contract,
        premint,
        auto_draw,
        auto_claim,
        created_at,
        expires_at,
        status,
        winner_slot,
        winner,
        prize_amount,
        prize_type,
        claimed,
    })
}

// ============= Slots Availability =============
#[derive(Accounts)]
pub struct CheckSlotsAvailability<'info> {
    #[account(seeds = [RAFFLE_SEED, raffle.raffle_id.as_bytes()], bump = raffle.bump)]
    pub raffle: Account<'info, Raffle>,
    #[account(seeds = [SLOTS_SEED, raffle.key().as_ref()], bump)]
    pub slots: Account<'info, RaffleSlots>,
}

pub fn check_slots_availability_handler(
    ctx: Context<CheckSlotsAvailability>,
    slot_ids: Vec<u32>,
) -> Result<Vec<u32>> {
    let raffle = &ctx.accounts.raffle;
    let slots = &ctx.accounts.slots;
    let mut unavailable = Vec::new();

    for slot in slot_ids {
        if slot < 1 || slot > raffle.total_slots {
            unavailable.push(slot);
        } else {
            let idx = (slot - 1) as usize;
            if slots.slot_owners[idx] != Pubkey::default() {
                unavailable.push(slot);
            }
        }
    }

    Ok(unavailable)
}

// ============= Get Slots in Range =============
#[derive(Accounts)]
pub struct GetSlotsInRange<'info> {
    #[account(seeds = [RAFFLE_SEED, raffle.raffle_id.as_bytes()], bump = raffle.bump)]
    pub raffle: Account<'info, Raffle>,
    #[account(seeds = [SLOTS_SEED, raffle.key().as_ref()], bump)]
    pub slots: Account<'info, RaffleSlots>,
}

pub fn get_taken_slots_in_range_handler(
    ctx: Context<GetSlotsInRange>,
    start_slot: u32,
    end_slot: u32,
) -> Result<Vec<u32>> {
    let raffle = &ctx.accounts.raffle;
    let slots = &ctx.accounts.slots;
    
    require!(start_slot >= 1 && end_slot >= start_slot && end_slot <= raffle.total_slots, RaffleError::SlotOutOfRange);

    let mut taken = Vec::new();
    for slot in start_slot..=end_slot {
        let idx = (slot - 1) as usize;
        if slots.slot_owners[idx] != Pubkey::default() {
            taken.push(slot);
        }
    }

    Ok(taken)
}

pub fn get_available_slots_in_range_handler(
    ctx: Context<GetSlotsInRange>,
    start_slot: u32,
    end_slot: u32,
) -> Result<Vec<u32>> {
    let raffle = &ctx.accounts.raffle;
    let slots = &ctx.accounts.slots;
    
    require!(start_slot >= 1 && end_slot >= start_slot && end_slot <= raffle.total_slots, RaffleError::SlotOutOfRange);

    let mut available = Vec::new();
    for slot in start_slot..=end_slot {
        let idx = (slot - 1) as usize;
        if slots.slot_owners[idx] == Pubkey::default() {
            available.push(slot);
        }
    }

    Ok(available)
}

// ============= Set Refund Fee =============
#[derive(Accounts)]
pub struct SetRefundFeeBps<'info> {
    pub admin: Signer<'info>,
    #[account(mut, seeds = [CONFIG_SEED], bump, has_one = admin)]
    pub config: Account<'info, Config>,
}

pub fn set_refund_fee_bps_handler(
    ctx: Context<SetRefundFeeBps>,
    new_fee_bps: u16,
) -> Result<()> {
    require!(new_fee_bps <= 10_000, RaffleError::BadStatus);
    let config = &mut ctx.accounts.config;
    config.refund_fee_bps = new_fee_bps;
    Ok(())
}
