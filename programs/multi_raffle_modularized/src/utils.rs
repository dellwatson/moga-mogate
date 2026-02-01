use anchor_lang::prelude::*;
use anchor_lang::system_program::{self, Transfer};
use anchor_spl::metadata::{
    mpl_token_metadata::types::{Creator, DataV2},
    CreateMetadataAccountsV3, CreateMasterEditionV3, Metadata, VerifyCollection, VerifySizedCollectionItem,
    create_master_edition_v3, create_metadata_accounts_v3, verify_collection, verify_sized_collection_item,
};
use anchor_spl::token::{Mint, MintTo, Token, TokenAccount, mint_to};

use crate::constants::{COLLECTION_AUTHORITY_SEED, PRIZE_MINT_SEED};
use crate::error::RaffleError;
use crate::state::{Raffle, RaffleSlots, UserRaffle};
use crate::types::{MultiRaffleStatus, PrizeTokenType};

/// Internal draw logic (matches Solidity _endRaffleInternal).
/// Called by draw_raffle or by join when autoDraw is true.
pub fn end_raffle_internal(
    raffle: &mut Account<Raffle>,
    slots: &Account<RaffleSlots>,
) -> Result<()> {
    require!(
        raffle.status == MultiRaffleStatus::Filled as u8,
        RaffleError::BadStatus
    );

    let clock = Clock::get()?;
    let total = raffle.total_slots as i64;
    let winner_slot = ((clock.unix_timestamp % total) + 1) as u32; // 1-based
    let idx = (winner_slot - 1) as usize;
    let winner = slots.slot_owners[idx];
    require!(winner != Pubkey::default(), RaffleError::NotWinner);

    raffle.winner_slot = winner_slot;
    raffle.winner = winner;
    raffle.status = MultiRaffleStatus::Drawn as u8;

    Ok(())
}

/// Internal mint prize logic (matches Solidity _mintPrize).
/// Called by claim instruction.
pub fn mint_prize_internal<'info>(
    raffle: &mut Account<'info, Raffle>,
    caller: &Signer<'info>,
    prize_mint: &Account<'info, Mint>,
    winner_token_account: &Account<'info, TokenAccount>,
    metadata: &UncheckedAccount<'info>,
    master_edition: &UncheckedAccount<'info>,
    collection_mint: &Account<'info, Mint>,
    collection_metadata: &UncheckedAccount<'info>,
    collection_master_edition: &UncheckedAccount<'info>,
    collection_authority: &UncheckedAccount<'info>,
    collection_authority_record_pda: &UncheckedAccount<'info>,
    token_program: &Program<'info, Token>,
    token_metadata_program: &Program<'info, Metadata>,
    system_program: &Program<'info, System>,
    rent: &Sysvar<'info, Rent>,
    prize_mint_bump: &u8,
    collection_authority_bump: &u8,
    is_sized_collection: bool,
) -> Result<()> {
    // Enforce collection is set (like Solidity "NoCollection")
    require!(raffle.collection != Pubkey::default(), RaffleError::BadStatus);

    // Default values for legacy raffles that did not specify prize type/amount
    if raffle.prize_type == PrizeTokenType::None as u8 {
        raffle.prize_type = PrizeTokenType::Spl as u8;
    }
    if raffle.prize_amount == 0 {
        raffle.prize_amount = 1;
    }

    // Only SPL (standard NFT) prizes are currently implemented
    if raffle.prize_type == PrizeTokenType::Spl as u8 {
        let amount_to_mint = raffle.prize_amount;

        // Mint prize token(s) to winner's ATA using on-chain generated mint PDA
        let raffle_key = raffle.key();
        let prize_mint_seeds: &[&[u8]] = &[
            PRIZE_MINT_SEED,
            raffle_key.as_ref(),
            &[*prize_mint_bump],
        ];

        mint_to(
            CpiContext::new_with_signer(
                token_program.to_account_info(),
                MintTo {
                    mint: prize_mint.to_account_info(),
                    to: winner_token_account.to_account_info(),
                    authority: prize_mint.to_account_info(),
                },
                &[prize_mint_seeds],
            ),
            amount_to_mint,
        )?;

        // Create metadata
        let creator = vec![Creator {
            address: raffle.key(),
            verified: false,
            share: 100,
        }];

        create_metadata_accounts_v3(
            CpiContext::new_with_signer(
                token_metadata_program.to_account_info(),
                CreateMetadataAccountsV3 {
                    metadata: metadata.to_account_info(),
                    mint: prize_mint.to_account_info(),
                    mint_authority: prize_mint.to_account_info(),
                    update_authority: caller.to_account_info(),
                    payer: caller.to_account_info(),
                    system_program: system_program.to_account_info(),
                    rent: rent.to_account_info(),
                },
                &[prize_mint_seeds],
            ),
            DataV2 {
                name: format!("Prize #{}", raffle.raffle_id),
                symbol: "PRIZE".to_string(),
                uri: raffle.metadata_uri.clone(),
                seller_fee_basis_points: 0,
                creators: Some(creator),
                collection: Some(mpl_token_metadata::types::Collection {
                    verified: false,
                    key: raffle.collection,
                }),
                uses: None,
            },
            true,
            true,
            None,
        )?;

        // Create master edition
        create_master_edition_v3(
            CpiContext::new_with_signer(
                token_metadata_program.to_account_info(),
                CreateMasterEditionV3 {
                    edition: master_edition.to_account_info(),
                    mint: prize_mint.to_account_info(),
                    update_authority: caller.to_account_info(),
                    mint_authority: prize_mint.to_account_info(),
                    payer: caller.to_account_info(),
                    metadata: metadata.to_account_info(),
                    token_program: token_program.to_account_info(),
                    system_program: system_program.to_account_info(),
                    rent: rent.to_account_info(),
                },
                &[prize_mint_seeds],
            ),
            None,
        )?;

        // Verify collection using delegated authority
        let collection_mint_key = raffle.collection;
        let collection_authority_seeds: &[&[u8]] = &[
            COLLECTION_AUTHORITY_SEED,
            collection_mint_key.as_ref(),
            &[*collection_authority_bump],
        ];

        if is_sized_collection {
            verify_sized_collection_item(
                CpiContext::new_with_signer(
                    token_metadata_program.to_account_info(),
                    VerifySizedCollectionItem {
                        payer: caller.to_account_info(),
                        collection_authority: collection_authority.to_account_info(),
                        metadata: metadata.to_account_info(),
                        collection_mint: collection_mint.to_account_info(),
                        collection_metadata: collection_metadata.to_account_info(),
                        collection_master_edition: collection_master_edition.to_account_info(),
                    },
                    &[collection_authority_seeds],
                )
                .with_remaining_accounts(vec![collection_authority_record_pda.to_account_info()]),
                Some(collection_authority_record_pda.key()),
            )?;
        } else {
            verify_collection(
                CpiContext::new_with_signer(
                    token_metadata_program.to_account_info(),
                    VerifyCollection {
                        payer: caller.to_account_info(),
                        collection_authority: collection_authority.to_account_info(),
                        metadata: metadata.to_account_info(),
                        collection_mint: collection_mint.to_account_info(),
                        collection_metadata: collection_metadata.to_account_info(),
                        collection_master_edition: collection_master_edition.to_account_info(),
                    },
                    &[collection_authority_seeds],
                )
                .with_remaining_accounts(vec![collection_authority_record_pda.to_account_info()]),
                Some(collection_authority_record_pda.key()),
            )?;
        }
    } else if raffle.prize_type == PrizeTokenType::Cnft as u8 {
        return err!(RaffleError::BadStatus); // "cNFTPrizeNotImplemented"
    } else if raffle.prize_type == PrizeTokenType::Pnft as u8 {
        return err!(RaffleError::BadStatus); // "pNFTPrizeNotImplemented"
    } else if raffle.prize_type == PrizeTokenType::ZkCompressed as u8 {
        return err!(RaffleError::BadStatus); // "ZkCompressedPrizeNotImplemented"
    } else {
        return err!(RaffleError::BadStatus); // "UnknownPrizeType"
    }

    Ok(())
}

/// Handle native SOL payment - transfer to treasury and record in user account
pub fn handle_native_payment<'info>(
    payer: &Signer<'info>,
    treasury: &SystemAccount<'info>,
    system_program: &Program<'info, System>,
    user: &mut Account<UserRaffle>,
    amount: u64,
) -> Result<()> {
    // Transfer SOL to treasury
    let cpi_accounts = Transfer {
        from: payer.to_account_info(),
        to: treasury.to_account_info(),
    };
    let cpi_ctx = CpiContext::new(
        system_program.to_account_info(),
        cpi_accounts,
    );
    system_program::transfer(cpi_ctx, amount)?;

    // Record payment
    user.paid = user.paid.saturating_add(amount);
    Ok(())
}

pub fn join_raffle_internal(
    raffle: &mut Account<Raffle>,
    slots_acc: &mut Account<RaffleSlots>,
    user: &mut Account<UserRaffle>,
    payer_key: &Pubkey,
    slot_ids: &Vec<u32>,
) -> Result<()> {
    let requested = slot_ids.len() as u32;
    let remaining = raffle.total_slots.saturating_sub(raffle.sold_slots);
    require!(requested <= remaining, RaffleError::OverCapacity);

    // Validate slots, range and duplicates, and availability
    for (i, slot) in slot_ids.iter().enumerate() {
        require!(*slot >= 1 && *slot <= raffle.total_slots, RaffleError::SlotOutOfRange);
        for j in 0..i {
            require!(slot_ids[j] != *slot, RaffleError::DuplicateSlot);
        }
        let idx = (*slot - 1) as usize;
        require!(slots_acc.slot_owners[idx] == Pubkey::default(), RaffleError::SlotTaken);
    }

    // Enforce per-user slot cap
    let current = user.slots.len() as u32;
    require!(current + requested <= raffle.max_slots_per_address, RaffleError::MaxSlotsPerAddress);

    // Assign slots
    for slot in slot_ids.iter() {
        let idx = (*slot - 1) as usize;
        slots_acc.slot_owners[idx] = *payer_key;
        user.slots.push(*slot);
    }

    raffle.sold_slots = raffle.sold_slots.saturating_add(requested);

    if raffle.sold_slots == raffle.total_slots {
        raffle.status = MultiRaffleStatus::Filled as u8;
        if raffle.auto_draw {
            end_raffle_internal(raffle, slots_acc)?;
        }
    }

    Ok(())
}
