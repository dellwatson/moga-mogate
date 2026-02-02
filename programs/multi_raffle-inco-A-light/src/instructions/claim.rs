use anchor_lang::prelude::*;
use crate::state::Raffle;
use crate::error::RaffleError;

pub const RAFFLE_SEED: &[u8] = b"raffle";

#[derive(Accounts)]
pub struct Claim<'info> {
    #[account(mut)]
    pub caller: Signer<'info>,
    
    #[account(mut, seeds = [RAFFLE_SEED, raffle.raffle_id.as_bytes()], bump = raffle.bump)]
    pub raffle: Account<'info, Raffle>,
    
    // TODO: Add prize minting accounts (SPL, Metaplex, etc.)
}

pub fn handler(ctx: Context<Claim>, is_sized_collection: bool) -> Result<()> {
    let raffle = &mut ctx.accounts.raffle;
    
    // TODO: Implement prize claiming logic
    // 1. Verify winner
    // 2. Mint prize NFT
    // 3. Mark as claimed
    
    msg!("Claim prize (TODO: implement minting)");
    
    err!(RaffleError::NotImplemented)
}
