use anchor_lang::prelude::*;
use anchor_lang::system_program::{self, Transfer};
use inco_lightning::{
    cpi::{self, accounts::{Allow, Operation}},
    program::IncoLightning,
    types::Euint128,
    ID as INCO_LIGHTNING_ID,
};
use crate::state::{Raffle, RaffleSlots, UserRaffle};
use crate::error::RaffleError;

#[derive(Accounts)]
#[instruction(amount: u64)]
pub struct UnsafeJoinRaffle<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,

    #[account(mut)]
    pub raffle: Account<'info, Raffle>,

    #[account(mut)]
    pub slots: Account<'info, RaffleSlots>,

    #[account(
        init,
        payer = payer,
        space = UserRaffle::LEN,
        seeds = [b"user", raffle.key().as_ref(), payer.key().as_ref()],
        bump
    )]
    pub user_raffle: Account<'info, UserRaffle>,

    /// CHECK: treasury PDA
    #[account(seeds = [b"treasury", raffle.key().as_ref()], bump)]
    pub treasury: AccountInfo<'info>,

    pub system_program: Program<'info, System>,

    #[account(address = INCO_LIGHTNING_ID)]
    pub inco_lightning_program: Program<'info, IncoLightning>,
}

pub fn handler<'info>(
    ctx: Context<'_, '_, '_, 'info, UnsafeJoinRaffle<'info>>,
    slot_ids: Vec<u32>,
    amount: u64,
) -> Result<()> {
    require!(!slot_ids.is_empty(), RaffleError::NoSlots);

    let clock = Clock::get()?;
    let raffle = &mut ctx.accounts.raffle;
    let slots_acc = &mut ctx.accounts.slots;
    let user = &mut ctx.accounts.user_raffle;

    require!(raffle.status == 0, RaffleError::NotOpen); // Open
    if raffle.expires_at != 0 {
        require!(clock.unix_timestamp <= raffle.expires_at, RaffleError::RaffleExpired);
    }

    // Validate slots (preserve original logic)
    require!(slot_ids.len() <= raffle.max_slots_per_address as usize, RaffleError::MaxSlotsPerAddress);
    require!(slot_ids.len() as u32 + slots_acc.total_slots <= raffle.total_slots, RaffleError::OverCapacity);

    for &slot_id in &slot_ids {
        require!(slot_id > 0 && slot_id <= raffle.total_slots, RaffleError::SlotOutOfRange);
        let idx = (slot_id - 1) as usize;
        require!(slots_acc.slot_owners[idx] == Pubkey::default(), RaffleError::SlotTaken);
    }

    // Transfer SOL to treasury (preserve original amount parameter logic)
    anchor_lang::system_program::transfer(
        CpiContext::new(
            ctx.accounts.system_program.to_account_info(),
            anchor_lang::system_program::Transfer {
                from: ctx.accounts.payer.to_account_info(),
                to: ctx.accounts.treasury.to_account_info(),
            },
        ),
        amount,
    )?;

    // Mark slots as taken publicly (practical delayed transparency)
    for &slot_id in &slot_ids {
        let idx = (slot_id - 1) as usize;
        slots_acc.slot_owners[idx] = ctx.accounts.payer.key();
    }

    // Create encrypted slots ownership handle ON-CHAIN (FHE privacy for delayed transparency)
    let inco = ctx.accounts.inco_lightning_program.to_account_info();
    let cpi_ctx = CpiContext::new(inco.clone(), Operation { 
        signer: ctx.accounts.payer.to_account_info() 
    });
    
    // Convert slot_ids to encrypted representation on-chain
    let mut slot_data = Vec::new();
    for &slot_id in &slot_ids {
        slot_data.push(slot_id.to_le_bytes().to_vec());
    }
    let combined_data: Vec<u8> = slot_data.concat();
    
    // Encrypt slot ownership on-chain
    let slots_handle: Euint128 = cpi::new_euint128(cpi_ctx, combined_data, 0)?;

    // Store encrypted ownership mapping instead of plain slots
    user.raffle = raffle.key();
    user.user = ctx.accounts.payer.key();
    user.slots_handle = slots_handle.0; // FHE: encrypted slot ownership
    user.paid = amount;

    // Update raffle stats
    raffle.sold_slots += slot_ids.len() as u32;
    if raffle.sold_slots == raffle.total_slots {
        raffle.status = 1; // Filled
    }

    msg!("Joined raffle with {} slots", slot_ids.len());
    msg!("   Slots: {:?}", slot_ids);
    msg!("   Amount paid: {} lamports", amount);
    msg!("   Ownership encrypted (delayed transparency)");

    Ok(())
}
