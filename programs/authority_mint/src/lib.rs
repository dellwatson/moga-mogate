use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    metadata::{
        create_master_edition_v3, create_metadata_accounts_v3, verify_sized_collection_item,
        mpl_token_metadata::types::{Creator, DataV2},
        CreateMasterEditionV3, CreateMetadataAccountsV3, Metadata, VerifySizedCollectionItem,
    },
    token::{mint_to, Mint, MintTo, Token, TokenAccount},
};
// Bubblegum imports commented out to avoid dependency conflicts
// use mpl_bubblegum::instructions::MintToCollectionV1CpiBuilder;
// use mpl_bubblegum::types::{
//     MetadataArgs as BubblegumMetadataArgs,
//     Collection as BubblegumCollection,
//     TokenProgramVersion,
//     TokenStandard,
//     Creator as BubblegumCreator,
// };

declare_id!("84PWFy3Zoq88vTBJwU5yPxEJdspEMZ3aAGqovNLgFZxs");

#[derive(Accounts)]
pub struct MintNFT<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,

    #[account(mut)]
    pub collection_mint: Account<'info, Mint>,

    /// CHECK: Collection metadata account
    #[account(mut)]
    pub collection_metadata: UncheckedAccount<'info>,

    /// CHECK: Collection master edition account
    #[account(mut)]
    pub collection_master_edition: UncheckedAccount<'info>,

    /// CHECK: Collection authority PDA - derived from collection mint
    #[account(
        mut,
        seeds = [b"collection_authority", collection_mint.key().as_ref()],
        bump,
    )]
    pub collection_authority: UncheckedAccount<'info>,

    /// CHECK: Collection authority record PDA (Metaplex Token Metadata)
    pub collection_authority_record_pda: UncheckedAccount<'info>,

    /// CHECK: Mint account - using Keypair instead of PDA to allow multiple mints per wallet
    #[account(
        init,
        payer = payer,
        mint::decimals = 0,
        mint::authority = mint,
        mint::freeze_authority = mint,
        signer
    )]
    pub mint: Account<'info, Mint>,

    #[account(
        init_if_needed,
        payer = payer,
        associated_token::mint = mint,
        associated_token::authority = payer,
    )]
    pub token_account: Account<'info, TokenAccount>,

    /// CHECK: Created by Metaplex
    #[account(mut)]
    pub metadata: UncheckedAccount<'info>,

    /// CHECK: Created by Metaplex
    #[account(mut)]
    pub master_edition: UncheckedAccount<'info>,

    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub token_metadata_program: Program<'info, Metadata>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
    
    /// CHECK: Sysvar instructions account
    #[account(address = anchor_lang::solana_program::sysvar::instructions::ID)]
    pub sysvar_instructions: UncheckedAccount<'info>,
}

// Commented out MintCNFT struct - requires bubblegum dependencies
// #[derive(Accounts)]
// pub struct MintCNFT<'info> {
//     #[account(mut)]
//     pub payer: Signer<'info>,
//
//     #[account(mut)]
//     pub tree_config: UncheckedAccount<'info>,
//     #[account(mut)]
//     pub merkle_tree: UncheckedAccount<'info>,
//
//     pub leaf_owner: UncheckedAccount<'info>,
//     pub leaf_delegate: UncheckedAccount<'info>,
//
//     #[account(mut)]
//     pub collection_mint: Account<'info, Mint>,
//     #[account(mut)]
//     pub collection_metadata: UncheckedAccount<'info>,
//     #[account(mut)]
//     pub collection_master_edition: UncheckedAccount<'info>,
//
//     #[account(
//         seeds = [b"collection_authority", collection_mint.key().as_ref()],
//         bump,
//     )]
//     pub collection_authority: UncheckedAccount<'info>,
//
//     pub tree_creator_or_delegate: Signer<'info>,
//
//     pub bubblegum_program: UncheckedAccount<'info>,
//     pub bubblegum_signer: UncheckedAccount<'info>,
//     pub compression_program: UncheckedAccount<'info>,
//     pub log_wrapper: UncheckedAccount<'info>,
//
//     pub token_metadata_program: Program<'info, Metadata>,
//     pub system_program: Program<'info, System>,
//     #[account(address = anchor_lang::solana_program::sysvar::instructions::ID)]
//     pub sysvar_instructions: UncheckedAccount<'info>,
//
//     pub collection_authority_record_pda: UncheckedAccount<'info>,
// }

#[program]
pub mod authority_mint {
    use super::*;

    pub fn mint_nft(
        ctx: Context<MintNFT>,
        name: String,
        symbol: String,
        uri: String,
        max_supply: Option<u64>,
    ) -> Result<()> {
        let is_sft = max_supply.is_some() && max_supply.unwrap() > 0;
        msg!("🎫 Minting {}: {}", if is_sft { "SFT" } else { "NFT" }, name);

        // Derive bump manually
        // Mint is now a signer (Keypair), not a PDA - no need to verify seeds
        
        // Mint 1 token (mint is a signer Keypair, no need for PDA seeds)
        mint_to(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                MintTo {
                    mint: ctx.accounts.mint.to_account_info(),
                    to: ctx.accounts.token_account.to_account_info(),
                    authority: ctx.accounts.mint.to_account_info(),
                },
            ),
            1,
        )?;

        // Create metadata
        let creator = vec![Creator {
            address: ctx.accounts.payer.key(),
            verified: false,
            share: 100,
        }];

        create_metadata_accounts_v3(
            CpiContext::new(
                ctx.accounts.token_metadata_program.to_account_info(),
                CreateMetadataAccountsV3 {
                    metadata: ctx.accounts.metadata.to_account_info(),
                    mint: ctx.accounts.mint.to_account_info(),
                    mint_authority: ctx.accounts.mint.to_account_info(),
                    update_authority: ctx.accounts.payer.to_account_info(),
                    payer: ctx.accounts.payer.to_account_info(),
                    system_program: ctx.accounts.system_program.to_account_info(),
                    rent: ctx.accounts.rent.to_account_info(),
                },
            ),
            DataV2 {
                name,
                symbol,
                uri,
                seller_fee_basis_points: 0,
                creators: Some(creator),
                collection: Some(mpl_token_metadata::types::Collection {
                    verified: false,
                    key: ctx.accounts.collection_mint.key(),
                }),
                uses: None,
            },
            true,
            true,
            None,
        )?;

        // Create master edition for NFTs only (skip for SFTs)
        if !is_sft {
            create_master_edition_v3(
                CpiContext::new(
                    ctx.accounts.token_metadata_program.to_account_info(),
                    CreateMasterEditionV3 {
                        edition: ctx.accounts.master_edition.to_account_info(),
                        mint: ctx.accounts.mint.to_account_info(),
                        update_authority: ctx.accounts.payer.to_account_info(),
                        mint_authority: ctx.accounts.mint.to_account_info(),
                        payer: ctx.accounts.payer.to_account_info(),
                        metadata: ctx.accounts.metadata.to_account_info(),
                        token_program: ctx.accounts.token_program.to_account_info(),
                        system_program: ctx.accounts.system_program.to_account_info(),
                        rent: ctx.accounts.rent.to_account_info(),
                    },
                ),
                max_supply,
            )?;
        }

        // Verify collection (using delegated authority)
        msg!("🔐 Verifying collection...");
        let collection_authority_bump = ctx.bumps.collection_authority;
        // Build signer seeds safely
        let collection_mint_key = ctx.accounts.collection_mint.key();
        let bump_arr = [collection_authority_bump];
        let signer_seeds: &[&[u8]] = &[
            b"collection_authority",
            collection_mint_key.as_ref(),
            &bump_arr,
        ];
        let signer_seeds_slice = &[signer_seeds];

        // Build CPI context and include the collection authority record PDA as a remaining account
        let cpi_ctx = CpiContext::new_with_signer(
            ctx.accounts.token_metadata_program.to_account_info(),
            VerifySizedCollectionItem {
                payer: ctx.accounts.payer.to_account_info(),
                collection_authority: ctx.accounts.collection_authority.to_account_info(),
                metadata: ctx.accounts.metadata.to_account_info(),
                collection_mint: ctx.accounts.collection_mint.to_account_info(),
                collection_metadata: ctx.accounts.collection_metadata.to_account_info(),
                collection_master_edition: ctx.accounts.collection_master_edition.to_account_info(),
            },
            signer_seeds_slice,
        )
        .with_remaining_accounts(vec![ctx.accounts.collection_authority_record_pda.to_account_info()]);

        verify_sized_collection_item(cpi_ctx, Some(ctx.accounts.collection_authority_record_pda.key()))?;

        msg!("✅ {} minted and verified successfully!", if is_sft { "SFT" } else { "NFT" });
        Ok(())
    }

    // Commented out mint_cnft function - requires bubblegum dependencies
    // pub fn mint_cnft(
    //     ctx: Context<MintCNFT>,
    //     name: String,
    //     symbol: String,
    //     uri: String,
    // ) -> Result<()> {
    //     let metadata = BubblegumMetadataArgs {
    //         name,
    //         symbol,
    //         uri,
    //         seller_fee_basis_points: 0,
    //         primary_sale_happened: false,
    //         is_mutable: true,
    //         edition_nonce: None,
    //         token_program_version: TokenProgramVersion::Original,
    //         token_standard: Some(TokenStandard::NonFungible),
    //         collection: Some(BubblegumCollection {
    //             verified: false,
    //             key: ctx.accounts.collection_mint.key(),
    //         }),
    //         uses: None,
    //         creators: Vec::<BubblegumCreator>::new(),
    //     };
    //
    //     let collection_authority_bump = ctx.bumps.collection_authority;
    //
    //     MintToCollectionV1CpiBuilder::new(&ctx.accounts.bubblegum_program.to_account_info())
    //         .tree_config(&ctx.accounts.tree_config.to_account_info())
    //         .leaf_owner(&ctx.accounts.leaf_owner.to_account_info())
    //         .leaf_delegate(&ctx.accounts.leaf_delegate.to_account_info())
    //         .merkle_tree(&ctx.accounts.merkle_tree.to_account_info())
    //         .payer(&ctx.accounts.payer.to_account_info())
    //         .tree_creator_or_delegate(&ctx.accounts.tree_creator_or_delegate.to_account_info())
    //         .collection_authority(&ctx.accounts.collection_authority.to_account_info())
    //         .collection_authority_record_pda(Some(
    //             &ctx.accounts.collection_authority_record_pda.to_account_info(),
    //         ))
    //         .collection_mint(&ctx.accounts.collection_mint.to_account_info())
    //         .collection_metadata(&ctx.accounts.collection_metadata.to_account_info())
    //         .collection_edition(&ctx.accounts.collection_master_edition.to_account_info())
    //         .bubblegum_signer(&ctx.accounts.bubblegum_signer.to_account_info())
    //         .log_wrapper(&ctx.accounts.log_wrapper.to_account_info())
    //         .compression_program(&ctx.accounts.compression_program.to_account_info())
    //         .token_metadata_program(&ctx.accounts.token_metadata_program.to_account_info())
    //         .system_program(&ctx.accounts.system_program.to_account_info())
    //         .sysvar_instructions(&ctx.accounts.sysvar_instructions.to_account_info())
    //         .metadata(metadata)
    //         .invoke_signed(&[&[
    //             b"collection_authority",
    //             ctx.accounts.collection_mint.key().as_ref(),
    //             &[collection_authority_bump],
    //         ]] )?;
    //
    //     Ok(())
    // }
}
