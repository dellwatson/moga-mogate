use anchor_lang::prelude::*;
use anchor_lang::solana_program::hash::hashv;
use light_sdk::{
    account::LightAccount,
    address::v2::derive_address,
    cpi::{v2::CpiAccounts, v2::LightSystemProgramCpi, InvokeLightSystemProgram, LightCpiInstruction},
    instruction::{account_meta::CompressedAccountMetaReadOnly, PackedStateTreeInfo, ValidityProof},
};
use crate::constants::{COMMITMENT_DOMAIN, RAFFLE_SEED, SLOTS_SEED, SLOT_SEED};
use crate::state::{Raffle, RaffleSlots, CompressedSlot};
use crate::types::MultiRaffleStatus;
use crate::error::RaffleError;
use crate::LIGHT_CPI_SIGNER;

#[derive(Accounts)]
#[instruction(
    slot_id: u32,
    salt: [u8; 32],
    proof: ValidityProof,
    state_tree_info: PackedStateTreeInfo,
    system_accounts_offset: u16
)]
pub struct FinalizeWinner<'info> {
    #[account(mut)]
    pub claimer: Signer<'info>,

    #[account(mut, seeds = [RAFFLE_SEED, raffle.raffle_id.as_bytes()], bump = raffle.bump)]
    pub raffle: Account<'info, Raffle>,

    #[account(seeds = [SLOTS_SEED, raffle.key().as_ref()], bump)]
    pub slots: Account<'info, RaffleSlots>,
}

/// Phase 2: Finalize winner with commit-reveal + LIGHT proof
pub fn handler<'info>(
    ctx: Context<'_, '_, '_, 'info, FinalizeWinner<'info>>,
    slot_id: u32,
    salt: [u8; 32],
    proof: ValidityProof,
    state_tree_info: PackedStateTreeInfo,
    system_accounts_offset: u16,
) -> Result<()> {
    let raffle = &mut ctx.accounts.raffle;
    let slots = &ctx.accounts.slots;

    require!(
        raffle.status == MultiRaffleStatus::WinnerSlotPicked as u8,
        RaffleError::BadStatus
    );
    require!(slot_id == raffle.winner_slot, RaffleError::NotWinner);

    // Build commitment from claimer + salt
    let commitment = hashv(&[
        COMMITMENT_DOMAIN,
        raffle.key().as_ref(),
        &slot_id.to_le_bytes(),
        ctx.accounts.claimer.key().as_ref(),
        &salt,
    ])
    .to_bytes();

    // Derive compressed slot address from slot id
    let (slot_address, _) = derive_address(
        &[SLOT_SEED, raffle.key().as_ref(), &slot_id.to_le_bytes()],
        &slots.address_tree,
        &crate::ID,
    );

    // Build LIGHT CPI accounts (system accounts start at offset)
    let offset = system_accounts_offset as usize;
    require!(offset <= ctx.remaining_accounts.len(), RaffleError::InvalidSystemAccountsOffset);
    let cpi_slice = ctx
        .remaining_accounts
        .get(offset..)
        .ok_or(RaffleError::InvalidSystemAccountsOffset)?;
    let light_cpi_accounts = CpiAccounts::new(
        ctx.accounts.claimer.as_ref(),
        cpi_slice,
        LIGHT_CPI_SIGNER,
    );

    // Validate state tree config against stored slots config
    let state_tree_pubkey = *light_cpi_accounts
        .get_tree_account_info(state_tree_info.merkle_tree_pubkey_index as usize)
        .map_err(|_| RaffleError::InvalidProof)?
        .key;
    require!(state_tree_pubkey == slots.state_tree, RaffleError::InvalidTreeConfig);

    let state_queue_pubkey = *light_cpi_accounts
        .get_tree_account_info(state_tree_info.queue_pubkey_index as usize)
        .map_err(|_| RaffleError::InvalidProof)?
        .key;
    require!(state_queue_pubkey == slots.state_queue, RaffleError::InvalidTreeConfig);

    // Build read-only compressed slot account
    let meta = CompressedAccountMetaReadOnly {
        tree_info: state_tree_info,
        address: slot_address,
    };
    let compressed_slot = CompressedSlot {
        raffle: raffle.key(),
        slot_id,
        owner_commitment: commitment,
    };

    let tree_pubkeys = light_cpi_accounts.tree_pubkeys().map_err(|_| RaffleError::InvalidProof)?;
    let read_only = LightAccount::<CompressedSlot>::new_read_only(
        &crate::ID,
        &meta,
        compressed_slot,
        &tree_pubkeys,
    )?;

    LightSystemProgramCpi::new_cpi(LIGHT_CPI_SIGNER, proof)
        .with_light_account(read_only)?
        .invoke(light_cpi_accounts)?;

    raffle.winner = ctx.accounts.claimer.key();
    raffle.status = MultiRaffleStatus::WinnerIdentified as u8;

    msg!("Winner finalized: {}", raffle.winner);
    Ok(())
}
