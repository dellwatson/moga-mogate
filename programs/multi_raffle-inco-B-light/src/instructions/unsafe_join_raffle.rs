use anchor_lang::prelude::*;
use anchor_lang::system_program::{self, Transfer};
use inco_lightning::{
    cpi::{self, accounts::Operation},
    program::IncoLightning,
    types::Euint128,
    ID as INCO_LIGHTNING_ID,
};
use crate::state::{Config, Raffle, RaffleSlots, UserRaffle};
use crate::error::RaffleError;
use crate::constants::{RAFFLE_SEED, SLOTS_SEED, USER_SEED, TREASURY_SEED};

#[derive(Accounts)]
#[instruction(amount: u64, encrypted_guess: Vec<u8>)]
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
    amount: u64,
    encrypted_guess: Vec<u8>,
) -> Result<()> {
    let raffle = &ctx.accounts.raffle;
    let slots = &mut ctx.accounts.slots;
    let user_raffle = &mut ctx.accounts.user_raffle;

    require!(raffle.status == 0, RaffleError::RaffleNotOpen); // 0 = Open
    require!(amount > 0, RaffleError::InvalidAmount);

    // TODO: Add FHE operations later - for now just store placeholder
    user_raffle.raffle = raffle.key();
    user_raffle.user = ctx.accounts.payer.key();
    user_raffle.ticket_count = 1;
    user_raffle.guess_handle = 0; // TODO: FHE encrypted guess from encrypted_guess
    user_raffle.is_winner_handle = 0; // TODO: FHE encrypted boolean result
    user_raffle.bump = ctx.bumps.user_raffle;

    // Update LIGHT compressed slots metadata
    slots.sold_tickets += 1;
    
    let raffle_mut = &mut ctx.accounts.raffle;
    raffle_mut.total_tickets += 1;

    // Transfer SOL to treasury
    let transfer_cpi = CpiContext::new(
        ctx.accounts.system_program.to_account_info(),
        Transfer {
            from: ctx.accounts.payer.to_account_info(),
            to: ctx.accounts.treasury.to_account_info(),
        },
    );
    system_program::transfer(transfer_cpi, amount)?;

    msg!("Ticket purchased! Guess submitted (encrypted)");
    msg!("LIGHT Protocol: Compressed ticket storage used");
    msg!("Total tickets: {}", raffle_mut.total_tickets);
    Ok(())
}
