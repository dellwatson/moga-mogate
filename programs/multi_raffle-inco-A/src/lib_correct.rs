#![allow(unexpected_cfgs)]

use anchor_lang::prelude::*;
use anchor_lang::system_program::{self, Transfer};
use inco_lightning::{
    cpi::{self, accounts::{Allow, Operation}},
    program::IncoLightning,
    types::Euint128,
    ID as INCO_LIGHTNING_ID,
};

pub mod constants;
pub mod error;
pub mod instructions;
pub mod state;

use instructions::*;

declare_id!("4CZWbG4LTceMHF9GnxS8g1aLVSG7w6HTARwAQ1juRLa4");

#[program]
pub mod private_raffle {
    use super::*;

    /// Unsafe host: create raffle without any off-chain signature (your original design)
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
        instructions::unsafe_host_raffle::handler(ctx, raffle_id, total_slots, max_slots_per_address, metadata_uri, collection, premint_contract, premint, prize_type, prize_amount, auto_draw, auto_claim, expires_at)
    }

    /// Unsafe join: pay SOL and take explicit slots with FHE privacy (your design + delayed transparency)
    pub fn unsafe_join_raffle(
        ctx: Context<UnsafeJoinRaffle>,
        slot_ids: Vec<u32>,
        amount: u64,
        encrypted_slots: Vec<u8>, // FHE encrypted slot selection
    ) -> Result<()> {
        instructions::unsafe_join_raffle::handler(ctx, slot_ids, amount, encrypted_slots)
    }

    /// Draw winner with FHE decryption of slot ownership
    pub fn unsafe_draw_winner<'info>(
        ctx: Context<'_, '_, '_, 'info, UnsafeDrawWinner<'info>>,
    ) -> Result<()> {
        instructions::unsafe_draw_winner::handler(ctx)
    }

    /// Check winner with FHE comparison
    pub fn unsafe_check_winner<'info>(ctx: Context<'_, '_, '_, 'info, UnsafeCheckWinner<'info>>) -> Result<()> {
        instructions::unsafe_check_winner::handler(ctx)
    }

    /// Withdraw prize with FHE proof
    pub fn unsafe_withdraw_prize(
        ctx: Context<UnsafeWithdrawPrize>,
        handle: Vec<u8>,
        plaintext: Vec<u8>,
    ) -> Result<()> {
        instructions::unsafe_withdraw_prize::handler(ctx, handle, plaintext)
    }
}
