use anchor_lang::prelude::*;
use anchor_lang::system_program::{self, Transfer};
use light_sdk::{
    account::LightAccount,
    address::v2::derive_address,
    cpi::{v2::CpiAccounts, v2::LightSystemProgramCpi, InvokeLightSystemProgram, LightCpiInstruction},
    instruction::{PackedAddressTreeInfo, ValidityProof},
};
use crate::state::{Config, Raffle, RaffleSlots, UserRaffle, CompressedSlot};
use crate::error::RaffleError;
use crate::types::MultiRaffleStatus;
use crate::constants::{CONFIG_SEED, RAFFLE_SEED, SLOTS_SEED, USER_SEED, TREASURY_SEED, SLOT_SEED};
use crate::LIGHT_CPI_SIGNER;

#[derive(Accounts)]
#[instruction(
    slot_ids: Vec<u32>,
    commitments: Vec<[u8; 32]>,
    amount: u64,
    proof: ValidityProof,
    address_tree_info: PackedAddressTreeInfo,
    output_state_tree_index: u8,
    system_accounts_offset: u16
)]
pub struct UnsafeJoinRaffle<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,

    #[account(seeds = [CONFIG_SEED], bump)]
    pub config: Account<'info, Config>,

    #[account(mut, seeds = [RAFFLE_SEED, raffle.raffle_id.as_bytes()], bump = raffle.bump)]
    pub raffle: Account<'info, Raffle>,

    #[account(mut, seeds = [SLOTS_SEED, raffle.key().as_ref()], bump)]
    pub slots: Account<'info, RaffleSlots>,

    #[account(
        init_if_needed,
        payer = payer,
        space = 8 + UserRaffle::LEN,
        seeds = [USER_SEED, raffle.key().as_ref(), payer.key().as_ref()],
        bump
    )]
    pub user_raffle: Account<'info, UserRaffle>,

    /// Treasury PDA
    #[account(mut, seeds = [TREASURY_SEED, raffle.key().as_ref()], bump)]
    pub treasury: SystemAccount<'info>,

    pub system_program: Program<'info, System>,
}

pub fn handler<'info>(
    ctx: Context<'_, '_, '_, 'info, UnsafeJoinRaffle<'info>>,
    slot_ids: Vec<u32>,
    commitments: Vec<[u8; 32]>,
    amount: u64,
    proof: ValidityProof,
    address_tree_info: PackedAddressTreeInfo,
    output_state_tree_index: u8,
    system_accounts_offset: u16,
) -> Result<()> {
    require!(!slot_ids.is_empty(), RaffleError::NoSlots);
    require!(slot_ids.len() == commitments.len(), RaffleError::InvalidCommitment);

    let clock = Clock::get()?;
    let raffle = &mut ctx.accounts.raffle;
    let slots_acc = &mut ctx.accounts.slots;
    let user = &mut ctx.accounts.user_raffle;

    require!(raffle.status == MultiRaffleStatus::Open as u8, RaffleError::NotOpen);
    if raffle.expires_at != 0 {
        require!(clock.unix_timestamp <= raffle.expires_at, RaffleError::RaffleExpired);
    }

    // Validate slots
    let mut sorted_slots = slot_ids.clone();
    sorted_slots.sort_unstable();
    for i in 1..sorted_slots.len() {
        require!(sorted_slots[i] != sorted_slots[i - 1], RaffleError::DuplicateSlot);
    }

    for &slot_id in &slot_ids {
        require!(slot_id > 0 && slot_id <= raffle.total_slots, RaffleError::SlotOutOfRange);
    }

    let requested = slot_ids.len() as u32;
    let remaining = raffle.total_slots.saturating_sub(raffle.sold_slots);
    require!(requested <= remaining, RaffleError::OverCapacity);

    let existing = user.ticket_count;
    let new_total = existing
        .checked_add(requested)
        .ok_or(RaffleError::Overflow)?;
    require!(new_total <= raffle.max_slots_per_address, RaffleError::MaxSlotsPerAddress);

    // Transfer SOL to treasury
    let transfer_ctx = CpiContext::new(
        ctx.accounts.system_program.to_account_info(),
        Transfer {
            from: ctx.accounts.payer.to_account_info(),
            to: ctx.accounts.treasury.to_account_info(),
        },
    );
    system_program::transfer(transfer_ctx, amount)?;

    // Build LIGHT CPI accounts from remaining accounts (system accounts start at offset)
    let offset = system_accounts_offset as usize;
    require!(offset <= ctx.remaining_accounts.len(), RaffleError::InvalidSystemAccountsOffset);
    let cpi_slice = ctx
        .remaining_accounts
        .get(offset..)
        .ok_or(RaffleError::InvalidSystemAccountsOffset)?;
    let light_cpi_accounts = CpiAccounts::new(
        ctx.accounts.payer.as_ref(),
        cpi_slice,
        LIGHT_CPI_SIGNER,
    );

    // Validate Light tree config against stored slots config
    let address_tree_pubkey = address_tree_info
        .get_tree_pubkey(&light_cpi_accounts)
        .map_err(|_| RaffleError::InvalidProof)?;
    require!(address_tree_pubkey == slots_acc.address_tree, RaffleError::InvalidTreeConfig);

    let address_queue_pubkey = *light_cpi_accounts
        .get_tree_account_info(address_tree_info.address_queue_pubkey_index as usize)
        .map_err(|_| RaffleError::InvalidProof)?
        .key;
    require!(address_queue_pubkey == slots_acc.address_queue, RaffleError::InvalidTreeConfig);

    let state_queue_pubkey = *light_cpi_accounts
        .get_tree_account_info(output_state_tree_index as usize)
        .map_err(|_| RaffleError::InvalidProof)?
        .key;
    require!(state_queue_pubkey == slots_acc.state_queue, RaffleError::InvalidTreeConfig);

    // Create compressed slot accounts
    let mut light_cpi = LightSystemProgramCpi::new_cpi(LIGHT_CPI_SIGNER, proof);
    let mut new_address_params = Vec::with_capacity(slot_ids.len());

    for (i, slot_id) in slot_ids.iter().enumerate() {
        let slot_id_bytes = slot_id.to_le_bytes();
        let (slot_address, slot_seed) = derive_address(
            &[SLOT_SEED, raffle.key().as_ref(), &slot_id_bytes],
            &address_tree_pubkey,
            &crate::ID,
        );

        let mut compressed_slot = LightAccount::<CompressedSlot>::new_init(
            &crate::ID,
            Some(slot_address),
            output_state_tree_index,
        );

        compressed_slot.raffle = raffle.key();
        compressed_slot.slot_id = *slot_id;
        compressed_slot.owner_commitment = commitments[i];

        light_cpi = light_cpi.with_light_account(compressed_slot)?;

        let assigned_index = u8::try_from(i).map_err(|_| RaffleError::Overflow)?;
        let params = address_tree_info.into_new_address_params_assigned_packed(
            slot_seed,
            Some(assigned_index),
        );
        new_address_params.push(params);
    }

    light_cpi
        .with_new_addresses(&new_address_params)
        .invoke(light_cpi_accounts)?;

    // Update user raffle
    if user.ticket_count == 0 {
        user.raffle = raffle.key();
        user.user = ctx.accounts.payer.key();
    }
    user.ticket_count = new_total;
    user.paid = user.paid.checked_add(amount).ok_or(RaffleError::Overflow)?;

    // Update raffle stats
    raffle.sold_slots = raffle
        .sold_slots
        .checked_add(requested)
        .ok_or(RaffleError::OverCapacity)?;
    slots_acc.sold_slots = raffle.sold_slots;

    if raffle.sold_slots == raffle.total_slots {
        raffle.status = MultiRaffleStatus::Filled as u8;
    }

    msg!("Joined raffle with {} slots (commit-reveal + LIGHT)", slot_ids.len());
    msg!("   Slots: {:?}", slot_ids);
    msg!("   Amount paid: {} lamports", amount);

    Ok(())
}
