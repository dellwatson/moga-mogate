use anchor_lang::prelude::*;
use light_sdk::{
    cpi::CpiSigner,
    derive_light_cpi_signer,
};

pub mod constants;
pub mod error;
pub mod instructions;
pub mod state;
pub mod types;

use instructions::*;

declare_id!("6Y8EAiRxwfT7AHNvRpVWjihWfpncLEi5f66bBmGEgZ44");

// Light Protocol CPI signer for compressed account operations
pub const LIGHT_CPI_SIGNER: CpiSigner =
    derive_light_cpi_signer!("6Y8EAiRxwfT7AHNvRpVWjihWfpncLEi5f66bBmGEgZ44");

#[program]
pub mod multi_raffle {
    use super::*;

    /// Initialize global config (one-time setup)
    pub fn initialize_config(ctx: Context<InitializeConfig>, refund_fee_bps: u16) -> Result<()> {
        instructions::initialize_config::handler(ctx, refund_fee_bps)
    }

    /// Create a new raffle (ZK-compressed slots)
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

    /// Join raffle with Merkle proofs (ZK-compressed)
    pub fn unsafe_join_raffle(
        ctx: Context<UnsafeJoinRaffle>,
        slot_ids: Vec<u32>,
        amount: u64,
        merkle_proofs: Vec<Vec<[u8; 32]>>,
    ) -> Result<()> {
        instructions::unsafe_join_raffle::handler(ctx, slot_ids, amount, merkle_proofs)
    }

    /// Phase 1: Pick winner slot deterministically
    pub fn draw_raffle(ctx: Context<DrawRaffle>) -> Result<()> {
        instructions::draw_raffle::handler(ctx)
    }

    /// Phase 2: Finalize winner with proof
    pub fn finalize_winner(
        ctx: Context<FinalizeWinner>,
        claimed_winner: Pubkey,
        merkle_proof: Vec<[u8; 32]>,
    ) -> Result<()> {
        instructions::finalize_winner::handler(ctx, claimed_winner, merkle_proof)
    }

    /// Winner claims prize NFT
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

    // View helpers
    pub fn get_raffle_load(ctx: Context<GetRaffleLoad>) -> Result<(u32, u32, u8)> {
        instructions::get_raffle_load::handler(ctx)
    }

    pub fn get_user_raffle_slots(ctx: Context<GetUserRaffleSlots>) -> Result<Vec<u32>> {
        instructions::get_user_raffle_slots::handler(ctx)
    }
}
