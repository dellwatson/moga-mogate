use anchor_lang::prelude::*;
use light_sdk::{
    cpi::CpiSigner,
    derive_light_cpi_signer,
    instruction::{PackedAddressTreeInfo, ValidityProof},
};

pub mod constants;
pub mod error;
pub mod instructions;
pub mod state;
pub mod types;

use instructions::*;

// Updated program ID for multi_raffle-inco-A-light
declare_id!("86okKaT6umcjVHcwpcgH1FWKfov2PywWrnTbsYWfmo5o");

// Light Protocol CPI signer for compressed account operations
pub const LIGHT_CPI_SIGNER: CpiSigner =
    derive_light_cpi_signer!("86okKaT6umcjVHcwpcgH1FWKfov2PywWrnTbsYWfmo5o");

#[program]
pub mod multi_raffle_inco_a_light {
    use super::*;

    /// Initialize global config (one-time setup)
    pub fn initialize_config(ctx: Context<InitializeConfig>, refund_fee_bps: u16) -> Result<()> {
        instructions::initialize_config::handler(ctx, refund_fee_bps)
    }

    /// Unsafe host: create raffle without any off-chain signature (LIGHT + Inco FHE)
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

    /// Unsafe join: pay SOL and take explicit slots with FHE privacy (Inco) and LIGHT compression
    pub fn unsafe_join_raffle<'info>(
        ctx: Context<'_, '_, '_, 'info, UnsafeJoinRaffle<'info>>,
        slot_ids: Vec<u32>,
        amount: u64,
        proof: ValidityProof,
        address_tree_info: PackedAddressTreeInfo,
        output_state_tree_index: u8,
    ) -> Result<()> {
        instructions::unsafe_join_raffle::handler(ctx, slot_ids, amount, proof, address_tree_info, output_state_tree_index)
    }

    /// Draw winner with FHE-encrypted slot index
    pub fn unsafe_draw_winner(ctx: Context<UnsafeDrawWinner>) -> Result<()> {
        instructions::unsafe_draw_winner::handler(ctx)
    }

    /// Check winner with FHE comparison (delayed transparency)
    pub fn unsafe_check_winner(ctx: Context<UnsafeCheckWinner>) -> Result<()> {
        instructions::unsafe_check_winner::handler(ctx)
    }

    /// Withdraw prize with FHE proof (handle + plaintext)
    pub fn unsafe_withdraw_prize(
        ctx: Context<UnsafeWithdrawPrize>,
        handle: Vec<u8>,
        plaintext: Vec<u8>,
    ) -> Result<()> {
        instructions::unsafe_withdraw_prize::handler(ctx, handle, plaintext)
    }

    /// Admin withdraws proceeds (from LIGHT implementation)
    pub fn withdraw_proceeds(ctx: Context<WithdrawProceeds>, amount: u64) -> Result<()> {
        instructions::withdraw_proceeds::handler(ctx, amount)
    }

    /// User claims refund for expired raffle (from LIGHT implementation)
    pub fn claim_refund(ctx: Context<ClaimRefund>) -> Result<()> {
        instructions::claim_refund::handler(ctx)
    }

    // View helpers
    pub fn get_raffle_load(ctx: Context<GetRaffleLoad>) -> Result<(u32, u32, u8)> {
        instructions::get_raffle_load::handler(ctx)
    }
}
