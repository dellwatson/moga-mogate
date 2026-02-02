use anchor_lang::prelude::*;
use anchor_lang::system_program::{self, Transfer};
use inco_lightning::{
	cpi::{self, accounts::Operation},
	program::IncoLightning,
	types::Euint128,
	ID as INCO_LIGHTNING_ID,
};
use light_sdk::{
    account::LightAccount,
    address::v2::derive_address,
    instruction::{account_meta::CompressedAccountMeta, PackedAddressTreeInfo, ValidityProof},
    LightDiscriminator,
};
use light_sdk::cpi::{v2::CpiAccounts, InvokeLightSystemProgram, LightCpiInstruction, v2::LightSystemProgramCpi};
use crate::state::{Config, Raffle, RaffleSlots, UserRaffle, CompressedTicket};
use crate::error::RaffleError;
use crate::types::MultiRaffleStatus;
use crate::constants::{RAFFLE_SEED, SLOTS_SEED, USER_SEED, TREASURY_SEED};
use crate::LIGHT_CPI_SIGNER;

#[derive(Accounts)]
#[instruction(slot_ids: Vec<u32>, amount: u64, proof: ValidityProof, address_tree_info: PackedAddressTreeInfo, output_state_tree_index: u8)]
pub struct UnsafeJoinRaffle<'info> {
	#[account(mut)]
	pub payer: Signer<'info>,

	pub config: Account<'info, Config>,

	#[account(mut, seeds = [RAFFLE_SEED, raffle.raffle_id.as_bytes()], bump = raffle.bump)]
	pub raffle: Account<'info, Raffle>,

	#[account(mut, seeds = [SLOTS_SEED, raffle.key().as_ref()], bump)]
	pub slots: Account<'info, RaffleSlots>,

	#[account(
		init,
		payer = payer,
		space = 8 + UserRaffle::LEN,
		seeds = [USER_SEED, raffle.key().as_ref(), payer.key().as_ref()],
		bump
	)]
	pub user_raffle: Account<'info, UserRaffle>,

	/// CHECK: Light Protocol state tree (for compressed accounts)
	pub light_state_tree: UncheckedAccount<'info>,

	/// CHECK: Light Protocol program (kept for future full ZK integration)
	pub light_system_program: UncheckedAccount<'info>,

	/// Treasury PDA
	#[account(mut, seeds = [TREASURY_SEED, raffle.key().as_ref()], bump)]
	pub treasury: SystemAccount<'info>,

	pub system_program: Program<'info, System>,

	#[account(address = INCO_LIGHTNING_ID)]
	pub inco_lightning_program: Program<'info, IncoLightning>,
}

pub fn handler<'info>(
	ctx: Context<'_, '_, '_, 'info, UnsafeJoinRaffle<'info>>,
	slot_ids: Vec<u32>,
	amount: u64,
	proof: ValidityProof,
	address_tree_info: PackedAddressTreeInfo,
	output_state_tree_index: u8,
) -> Result<()> {
	require!(!slot_ids.is_empty(), RaffleError::NoSlots);

	let clock = Clock::get()?;
	let raffle = &mut ctx.accounts.raffle;
	let slots_acc = &mut ctx.accounts.slots;
	let user = &mut ctx.accounts.user_raffle;

	require!(raffle.status == MultiRaffleStatus::Open as u8, RaffleError::NotOpen);
	if raffle.expires_at != 0 {
		require!(clock.unix_timestamp <= raffle.expires_at, RaffleError::RaffleExpired);
	}

	// Validate slots (similar to inco ver-A, but without per-slot bitmap to stay scalable)
	require!(slot_ids.len() <= raffle.max_slots_per_address as usize, RaffleError::MaxSlotsPerAddress);
	let requested = slot_ids.len() as u32;
	let remaining = raffle.total_slots.saturating_sub(raffle.sold_slots);
	require!(requested <= remaining, RaffleError::OverCapacity);

	for &slot_id in &slot_ids {
		require!(slot_id > 0 && slot_id <= raffle.total_slots, RaffleError::SlotOutOfRange);
	}

	// Transfer SOL to treasury (same pattern as before)
	let transfer_ctx = CpiContext::new(
		ctx.accounts.system_program.to_account_info(),
		Transfer {
			from: ctx.accounts.payer.to_account_info(),
			to: ctx.accounts.treasury.to_account_info(),
		},
	);
	system_program::transfer(transfer_ctx, amount)?;

	// FHE: create encrypted slots ownership handle on-chain via Inco Lightning
	let inco = ctx.accounts.inco_lightning_program.to_account_info();
	let cpi_ctx = CpiContext::new(inco, Operation {
		signer: ctx.accounts.payer.to_account_info(),
	});

	let mut slot_data = Vec::new();
	for &slot_id in &slot_ids {
		slot_data.push(slot_id.to_le_bytes().to_vec());
	}
	let combined_data: Vec<u8> = slot_data.concat();

	let slots_handle: Euint128 = cpi::new_euint128(cpi_ctx, combined_data, 0)?;

	// Store encrypted ownership mapping instead of plain slots
	user.raffle = raffle.key();
	user.user = ctx.accounts.payer.key();
	user.slots_handle = slots_handle.0;
	user.paid = amount;

	// Update raffle stats + slots metadata (Light-style constant-size slots account)
	raffle.sold_slots = raffle
		.sold_slots
		.checked_add(slot_ids.len() as u32)
		.ok_or(RaffleError::OverCapacity)?;
	slots_acc.sold_slots = raffle.sold_slots;

	if raffle.sold_slots == raffle.total_slots {
		raffle.status = MultiRaffleStatus::Filled as u8;
	}

	// === LIGHT ZK-COMPRESSION: Create compressed ticket ===
	// Build LIGHT CPI accounts from remaining accounts (address/state trees)
	let light_cpi_accounts = CpiAccounts::new(
		ctx.accounts.payer.as_ref(),
		ctx.remaining_accounts,
		LIGHT_CPI_SIGNER,
	);

	// Get the address tree pubkey from the packed tree info
	let address_tree_pubkey = address_tree_info
		.get_tree_pubkey(&light_cpi_accounts)
		.map_err(|_| RaffleError::InvalidProof)?;

	// Derive compressed ticket address: [b"ticket", raffle, user]
	let (ticket_address, ticket_seed) = derive_address(
		&[b"ticket", raffle.key().as_ref(), ctx.accounts.payer.key().as_ref()],
		&address_tree_pubkey,
		&crate::ID,
	);

	// Create compressed ticket with real data
	let mut compressed_ticket = LightAccount::<CompressedTicket>::new_init(
		&crate::ID,
		Some(ticket_address),
		output_state_tree_index,
	);

	compressed_ticket.raffle = raffle.key();
	compressed_ticket.user = ctx.accounts.payer.key();
	compressed_ticket.slot_ids = slot_ids.clone();
	compressed_ticket.amount = amount;
	compressed_ticket.created_at = clock.unix_timestamp;

	// Build new address parameters for the compressed ticket
	let new_address_params = address_tree_info
		.into_new_address_params_assigned_packed(ticket_seed, Some(0));

	// Invoke LIGHT system program to create compressed ticket
	LightSystemProgramCpi::new_cpi(LIGHT_CPI_SIGNER, proof)
		.with_light_account(compressed_ticket)?
		.with_new_addresses(&[new_address_params])
		.invoke(light_cpi_accounts)?;

	msg!("Joined raffle with {} slots (FHE + LIGHT compression)", slot_ids.len());
	msg!("   Slots: {:?}", slot_ids);
	msg!("   Amount paid: {} lamports", amount);
	msg!("   Compressed ticket created at: {:?}", ticket_address);
	msg!("   Ownership encrypted (delayed transparency)");

	Ok(())
}
