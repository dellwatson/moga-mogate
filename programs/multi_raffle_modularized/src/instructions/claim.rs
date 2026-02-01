use anchor_lang::prelude::*;
use anchor_spl::associated_token::AssociatedToken;
use anchor_spl::metadata::Metadata;
use anchor_spl::token::{Mint, Token, TokenAccount};

use crate::constants::{COLLECTION_AUTHORITY_SEED, PRIZE_MINT_SEED, RAFFLE_SEED};
use crate::error::RaffleError;
use crate::state::Raffle;
use crate::types::MultiRaffleStatus;
use crate::utils::mint_prize_internal;

#[derive(Accounts)]
#[instruction(is_sized_collection: bool)]
pub struct Claim<'info> {
    #[account(mut)]
    pub caller: Signer<'info>,
    #[account(mut, seeds = [RAFFLE_SEED, raffle.raffle_id.as_bytes()], bump = raffle.bump)]
    pub raffle: Account<'info, Raffle>,
    
    /// Prize mint PDA - deterministic on-chain generation
    #[account(
        init,
        payer = caller,
        mint::decimals = 0,
        mint::authority = prize_mint,
        mint::freeze_authority = prize_mint,
        seeds = [PRIZE_MINT_SEED, raffle.key().as_ref()],
        bump,
    )]
    pub prize_mint: Account<'info, Mint>,
    
    #[account(
        init,
        payer = caller,
        associated_token::mint = prize_mint,
        associated_token::authority = caller,
    )]
    pub winner_token_account: Account<'info, TokenAccount>,
    
    /// CHECK: Created by Metaplex
    #[account(mut)]
    pub metadata: UncheckedAccount<'info>,
    
    /// CHECK: Created by Metaplex
    #[account(mut)]
    pub master_edition: UncheckedAccount<'info>,
    
    /// Collection mint from raffle config
    #[account(mut, address = raffle.collection)]
    pub collection_mint: Account<'info, Mint>,
    
    /// CHECK: Collection metadata
    #[account(mut)]
    pub collection_metadata: UncheckedAccount<'info>,
    
    /// CHECK: Collection master edition
    #[account(mut)]
    pub collection_master_edition: UncheckedAccount<'info>,
    
    /// CHECK: Collection authority PDA - derived from collection mint
    #[account(
        seeds = [COLLECTION_AUTHORITY_SEED, collection_mint.key().as_ref()],
        bump,
    )]
    pub collection_authority: UncheckedAccount<'info>,
    
    /// CHECK: Collection authority record PDA (Metaplex Token Metadata)
    pub collection_authority_record_pda: UncheckedAccount<'info>,
    
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub token_metadata_program: Program<'info, Metadata>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

pub fn handler(ctx: Context<Claim>, is_sized_collection: bool) -> Result<()> {
    let raffle = &mut ctx.accounts.raffle;
    let caller = ctx.accounts.caller.key();

    require!(raffle.status == MultiRaffleStatus::Drawn as u8, RaffleError::NotDrawn);
    require!(!raffle.claimed, RaffleError::AlreadyClaimed);
    require!(raffle.winner == caller, RaffleError::NotWinner);

    // Manually derive bumps
    let raffle_key = raffle.key();
    let (_, prize_mint_bump) = Pubkey::find_program_address(
        &[PRIZE_MINT_SEED, raffle_key.as_ref()],
        ctx.program_id,
    );
    let (_, collection_authority_bump) = Pubkey::find_program_address(
        &[COLLECTION_AUTHORITY_SEED, raffle.collection.as_ref()],
        ctx.program_id,
    );

    // Call internal mint function
    mint_prize_internal(
        raffle,
        &ctx.accounts.caller,
        &ctx.accounts.prize_mint,
        &ctx.accounts.winner_token_account,
        &ctx.accounts.metadata,
        &ctx.accounts.master_edition,
        &ctx.accounts.collection_mint,
        &ctx.accounts.collection_metadata,
        &ctx.accounts.collection_master_edition,
        &ctx.accounts.collection_authority,
        &ctx.accounts.collection_authority_record_pda,
        &ctx.accounts.token_program,
        &ctx.accounts.token_metadata_program,
        &ctx.accounts.system_program,
        &ctx.accounts.rent,
        &prize_mint_bump,
        &collection_authority_bump,
        is_sized_collection,
    )?;
    raffle.claimed = true;
    Ok(())
}
