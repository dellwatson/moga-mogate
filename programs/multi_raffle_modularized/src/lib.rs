use anchor_lang::prelude::*;

pub mod constants;
pub mod error;
pub mod instructions;
pub mod state;
pub mod types;
pub mod utils;

use instructions::*;
use types::*;

declare_id!("2qaxQY3shNquV8STxFPoJW6bL9FUAEzUqinZSP163znG");

#[program]
pub mod multi_raffle {
    use super::*;

    /// Initialize global config (one-time setup)
    pub fn initialize_config(ctx: Context<InitializeConfig>, refund_fee_bps: u16) -> Result<()> {
        instructions::initialize_config::handler(ctx, refund_fee_bps)
    }

    /// Unsafe host: create raffle without any off-chain signature
    pub fn unsafe_host_raffle(
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
        instructions::unsafe_host_raffle::handler(
            ctx,
            raffle_id,
            total_slots,
            max_slots_per_address,
            metadata_uri,
            collection,
            premint_contract,
            premint,
            prize_type,
            prize_amount,
            auto_draw,
            auto_claim,
            expires_at,
        )
    }

    /// Unsafe join: pay SOL and take explicit slots
    pub fn unsafe_join_raffle(
        ctx: Context<UnsafeJoinRaffle>,
        slot_ids: Vec<u32>,
        amount: u64,
    ) -> Result<()> {
        instructions::unsafe_join_raffle::handler(ctx, slot_ids, amount)
    }

    /// Unsafe host+join combined
    pub fn unsafe_host_and_join_raffle(
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
        bonus_free_slots: u32,
    ) -> Result<()> {
        instructions::unsafe_host_and_join_raffle::handler(
            ctx,
            raffle_id,
            total_slots,
            max_slots_per_address,
            metadata_uri,
            collection,
            premint_contract,
            premint,
            prize_type,
            prize_amount,
            auto_draw,
            auto_claim,
            expires_at,
            slot_ids,
            amount,
            bonus_free_slots,
        )
    }

    /// Manual draw for filled raffles (when auto_draw is false)
    pub fn draw_raffle(ctx: Context<DrawRaffle>) -> Result<()> {
        instructions::draw_raffle::handler(ctx)
    }

    /// Claim the prize for a raffle where the caller is the recorded winner
    pub fn claim(ctx: Context<Claim>, is_sized_collection: bool) -> Result<()> {
        instructions::claim::handler(ctx, is_sized_collection)
    }

    /// Admin withdraws proceeds
    pub fn withdraw_proceeds(ctx: Context<WithdrawProceeds>, amount: u64) -> Result<()> {
        instructions::withdraw_proceeds::handler(ctx, amount)
    }

    /// User claims refund for expired raffle
    pub fn claim_refund(ctx: Context<ClaimRefund>) -> Result<()> {
        instructions::claim_refund::handler(ctx)
    }

    // =========================
    // View helpers
    // =========================

    /// Basic raffle load (legacy, kept for compatibility)
    pub fn get_raffle_load(ctx: Context<GetRaffleLoad>) -> Result<(u32, u32, u8)> {
        view_helpers::get_raffle_load_handler(ctx)
    }

    /// Comprehensive raffle information
    pub fn get_raffle_load_detail(ctx: Context<GetRaffleLoad>) -> Result<RaffleDetailView> {
        view_helpers::get_raffle_load_detail_handler(ctx)
    }

    /// Get refund status for a user
    pub fn get_refund_status(ctx: Context<GetRefundStatus>) -> Result<RefundStatusView> {
        view_helpers::get_refund_status_handler(ctx)
    }

    /// Winner and prize information
    pub fn get_raffle_result(ctx: Context<GetRaffleLoad>) -> Result<RaffleResultView> {
        view_helpers::get_raffle_result_handler(ctx)
    }

    /// Admin function to update refund fee
    pub fn set_refund_fee_bps(ctx: Context<SetRefundFeeBps>, new_fee_bps: u16) -> Result<()> {
        view_helpers::set_refund_fee_bps_handler(ctx, new_fee_bps)
    }

    /// Batch basic load
    pub fn get_raffles_load<'info>(
        ctx: Context<'_, '_, 'info, 'info, GetRafflesLoadBatch>,
        raffle_ids: Vec<String>,
    ) -> Result<RafflesLoadView> {
        view_helpers::get_raffles_load_handler(ctx, raffle_ids)
    }

    /// Batch detailed load
    pub fn get_raffles_load_detail<'info>(
        ctx: Context<'_, '_, 'info, 'info, GetRafflesLoadBatch>,
        raffle_ids: Vec<String>,
    ) -> Result<RafflesLoadDetailView> {
        view_helpers::get_raffles_load_detail_handler(ctx, raffle_ids)
    }

    pub fn get_user_raffle_slots(ctx: Context<GetUserRaffleSlots>) -> Result<Vec<u32>> {
        view_helpers::get_user_raffle_slots_handler(ctx)
    }

    pub fn check_slots_availability(
        ctx: Context<CheckSlotsAvailability>,
        slot_ids: Vec<u32>,
    ) -> Result<Vec<u32>> {
        view_helpers::check_slots_availability_handler(ctx, slot_ids)
    }

    pub fn get_taken_slots_in_range(
        ctx: Context<GetSlotsInRange>,
        start_slot: u32,
        end_slot: u32,
    ) -> Result<Vec<u32>> {
        view_helpers::get_taken_slots_in_range_handler(ctx, start_slot, end_slot)
    }

    pub fn get_available_slots_in_range(
        ctx: Context<GetSlotsInRange>,
        start_slot: u32,
        end_slot: u32,
    ) -> Result<Vec<u32>> {
        view_helpers::get_available_slots_in_range_handler(ctx, start_slot, end_slot)
    }
}

// Safe (permit-based) variants currently stubbed out to match Solidity API
#[derive(Accounts)]
pub struct HostRaffle {}

#[derive(Accounts)]
pub struct JoinRaffle {}

#[derive(Accounts)]
pub struct HostAndJoinRaffle {}
