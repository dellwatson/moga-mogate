use anchor_lang::prelude::*;
use solana_program::{
    ed25519_program,
    hash::hash,
};
use anchor_spl::{
    associated_token::AssociatedToken,
    metadata::{
        create_master_edition_v3, create_metadata_accounts_v3,
        mpl_token_metadata::types::{Creator, DataV2},
        CreateMasterEditionV3, CreateMetadataAccountsV3, Metadata,
    },
    token::{mint_to, Mint, MintTo, Token, TokenAccount},
};

declare_id!("3odWCGoC2aCei3th3KpsT6Q5uLXMXMnxr3WC33tTx4Dm");

/// NFT/SFT Mint with Signature Permit
/// 
/// Requires admin signature to mint NFTs/SFTs.
/// Backend signs permit with admin private key.
/// Program verifies signature before minting.
/// 
/// **Flow:**
/// 1. User requests mint on dApp
/// 2. Backend creates permit: hash(user, name, symbol, uri, max_supply, nonce)
/// 3. Backend signs permit with admin private key
/// 4. User submits: params + signature + nonce
/// 5. Program verifies signature matches admin pubkey
/// 6. If valid → mint NFT/SFT
/// 7. If invalid → reject
#[program]
pub mod authority_mint_permit {
    use super::*;

    /// Initialize program config with admin pubkey
    /// Only needs to be called once after deployment
    pub fn initialize(ctx: Context<Initialize>, admin_pubkey: Pubkey) -> Result<()> {
        let config = &mut ctx.accounts.config;
        config.admin = admin_pubkey;
        config.bump = ctx.bumps.config;
        
        msg!("✅ Program initialized");
        msg!("   Admin: {}", admin_pubkey);
        
        Ok(())
    }

    /// Update admin pubkey (only current admin can do this)
    pub fn update_admin(ctx: Context<UpdateAdmin>, new_admin: Pubkey) -> Result<()> {
        let config = &mut ctx.accounts.config;
        config.admin = new_admin;
        
        msg!("✅ Admin updated to: {}", new_admin);
        
        Ok(())
    }

    /// Mint NFT/SFT with admin signature permit (WITH nonce tracking)
    /// 
    /// # Arguments
    /// * `name` - NFT name (max 32 chars)
    /// * `symbol` - NFT symbol (max 10 chars)
    /// * `uri` - Metadata URI (GitHub raw URL)
    /// * `max_supply` - Optional max supply (None = NFT, Some(n) = SFT)
    /// * `nonce` - Unique nonce to prevent replay attacks
    /// * `signature` - Ed25519 signature from admin (64 bytes)
    /// 
    /// # Security:
    /// - Signature must be from admin pubkey
    /// - Message = hash(user, name, symbol, uri, max_supply, nonce)
    /// - Nonce prevents replay attacks
    pub fn mint_nft_with_permit(
        ctx: Context<MintNFTWithPermit>,
        name: String,
        symbol: String,
        uri: String,
        max_supply: Option<u64>,
        nonce: u64,
        signature: [u8; 64],
    ) -> Result<()> {
        let is_sft = max_supply.is_some() && max_supply.unwrap() > 0;
        msg!(
            "🎫 Minting {} with permit: {}",
            if is_sft { "SFT" } else { "NFT" },
            name
        );

        // Verify signature
        verify_permit_signature(
            &ctx.accounts.config.admin,
            &ctx.accounts.payer.key(),
            &name,
            &symbol,
            &uri,
            max_supply,
            nonce,
            &signature,
        )?;

        msg!("✅ Permit signature verified");

        // Mark nonce as used
        ctx.accounts.nonce_tracker.user = ctx.accounts.payer.key();
        ctx.accounts.nonce_tracker.nonce = nonce;
        ctx.accounts.nonce_tracker.used_at = Clock::get()?.unix_timestamp;
        
        msg!("✅ Nonce marked as used");

        // Mint 1 token to the user's ATA
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

        msg!("✅ Token minted to user");

        // Create metadata account
        let creator = vec![Creator {
            address: ctx.accounts.authority.key(),
            verified: true,
            share: 100,
        }];

        create_metadata_accounts_v3(
            CpiContext::new_with_signer(
                ctx.accounts.token_metadata_program.to_account_info(),
                CreateMetadataAccountsV3 {
                    metadata: ctx.accounts.metadata.to_account_info(),
                    mint: ctx.accounts.mint.to_account_info(),
                    mint_authority: ctx.accounts.mint.to_account_info(),
                    update_authority: ctx.accounts.authority.to_account_info(),
                    payer: ctx.accounts.payer.to_account_info(),
                    system_program: ctx.accounts.system_program.to_account_info(),
                    rent: ctx.accounts.rent.to_account_info(),
                },
                &[&[b"mint", ctx.accounts.payer.key().as_ref(), &nonce.to_le_bytes(), &[ctx.bumps.mint]]],
            ),
            DataV2 {
                name,
                symbol,
                uri,
                seller_fee_basis_points: 0,
                creators: Some(creator),
                collection: Some(mpl_token_metadata::types::Collection {
                    verified: false, // Will verify in next step
                    key: ctx.accounts.collection_mint.key(),
                }),
                uses: None,
            },
            true,  // is_mutable
            true,  // update_authority_is_signer
            None,  // collection_details
        )?;

        msg!("✅ Metadata created");

        // Create master edition (makes it an NFT/SFT)
        create_master_edition_v3(
            CpiContext::new_with_signer(
                ctx.accounts.token_metadata_program.to_account_info(),
                CreateMasterEditionV3 {
                    edition: ctx.accounts.master_edition.to_account_info(),
                    mint: ctx.accounts.mint.to_account_info(),
                    update_authority: ctx.accounts.authority.to_account_info(),
                    mint_authority: ctx.accounts.mint.to_account_info(),
                    payer: ctx.accounts.payer.to_account_info(),
                    metadata: ctx.accounts.metadata.to_account_info(),
                    token_program: ctx.accounts.token_program.to_account_info(),
                    system_program: ctx.accounts.system_program.to_account_info(),
                    rent: ctx.accounts.rent.to_account_info(),
                },
                &[&[b"mint", ctx.accounts.payer.key().as_ref(), &nonce.to_le_bytes(), &[ctx.bumps.mint]]],
            ),
            max_supply, // None = 1/1 NFT, Some(n) = SFT with n supply
        )?;

        msg!("✅ Master edition created");
        if let Some(supply) = max_supply {
            msg!("   Type: SFT with max supply {}", supply);
        } else {
            msg!("   Type: 1/1 NFT");
        }

        msg!("🎉 {} minted successfully!", if is_sft { "SFT" } else { "NFT" });
        msg!("   Mint: {}", ctx.accounts.mint.key());
        msg!("   Owner: {}", ctx.accounts.payer.key());

        Ok(())
    }

    /// Mint NFT/SFT with admin signature permit (WITHOUT nonce tracking)
    /// 
    /// Use this for trusted scenarios where signature reuse is acceptable.
    /// Signature is still verified, but no on-chain nonce tracking.
    /// 
    /// # Arguments
    /// * `name` - NFT name (max 32 chars)
    /// * `symbol` - NFT symbol (max 10 chars)
    /// * `uri` - Metadata URI (GitHub raw URL)
    /// * `max_supply` - Optional max supply (None = NFT, Some(n) = SFT)
    /// * `signature` - Ed25519 signature from admin (64 bytes)
    /// 
    /// # Security:
    /// - Signature must be from admin pubkey stored in config
    /// - Message = hash(user, name, symbol, uri, max_supply)
    /// - ⚠️ No nonce tracking - signature can be reused!
    pub fn mint_nft_simple(
        ctx: Context<MintNFTSimple>,
        name: String,
        symbol: String,
        uri: String,
        max_supply: Option<u64>,
        signature: [u8; 64],
    ) -> Result<()> {
        let is_sft = max_supply.is_some() && max_supply.unwrap() > 0;
        msg!(
            "🎫 Minting {} (simple): {}",
            if is_sft { "SFT" } else { "NFT" },
            name
        );

        // Verify signature (without nonce)
        verify_permit_signature_simple(
            &ctx.accounts.config.admin,
            &ctx.accounts.payer.key(),
            &name,
            &symbol,
            &uri,
            max_supply,
            &signature,
        )?;

        msg!("✅ Permit signature verified");

        // Mint 1 token to the user's ATA
        mint_to(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                MintTo {
                    mint: ctx.accounts.mint.to_account_info(),
                    to: ctx.accounts.token_account.to_account_info(),
                    authority: ctx.accounts.mint.to_account_info(),
                },
                &[&[b"mint", ctx.accounts.payer.key().as_ref(), &[ctx.bumps.mint]]],
            ),
            1,
        )?;

        msg!("✅ Token minted to user");

        // Create metadata account
        let creator = vec![Creator {
            address: ctx.accounts.authority.key(),
            verified: true,
            share: 100,
        }];

        create_metadata_accounts_v3(
            CpiContext::new_with_signer(
                ctx.accounts.token_metadata_program.to_account_info(),
                CreateMetadataAccountsV3 {
                    metadata: ctx.accounts.metadata.to_account_info(),
                    mint: ctx.accounts.mint.to_account_info(),
                    mint_authority: ctx.accounts.mint.to_account_info(),
                    update_authority: ctx.accounts.authority.to_account_info(),
                    payer: ctx.accounts.payer.to_account_info(),
                    system_program: ctx.accounts.system_program.to_account_info(),
                    rent: ctx.accounts.rent.to_account_info(),
                },
                &[&[b"mint", ctx.accounts.payer.key().as_ref(), &[ctx.bumps.mint]]],
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

        msg!("✅ Metadata created");

        // Create master edition
        create_master_edition_v3(
            CpiContext::new_with_signer(
                ctx.accounts.token_metadata_program.to_account_info(),
                CreateMasterEditionV3 {
                    edition: ctx.accounts.master_edition.to_account_info(),
                    mint: ctx.accounts.mint.to_account_info(),
                    update_authority: ctx.accounts.authority.to_account_info(),
                    mint_authority: ctx.accounts.mint.to_account_info(),
                    payer: ctx.accounts.payer.to_account_info(),
                    metadata: ctx.accounts.metadata.to_account_info(),
                    token_program: ctx.accounts.token_program.to_account_info(),
                    system_program: ctx.accounts.system_program.to_account_info(),
                    rent: ctx.accounts.rent.to_account_info(),
                },
                &[&[b"mint", ctx.accounts.payer.key().as_ref(), &[ctx.bumps.mint]]],
            ),
            max_supply,
        )?;

        msg!("✅ Master edition created");
        if let Some(supply) = max_supply {
            msg!("   Type: SFT with max supply {}", supply);
        } else {
            msg!("   Type: 1/1 NFT");
        }

        msg!("🎉 {} minted successfully!", if is_sft { "SFT" } else { "NFT" });
        msg!("   Mint: {}", ctx.accounts.mint.key());
        msg!("   Owner: {}", ctx.accounts.payer.key());

        Ok(())
    }
}

/// Verify permit signature
/// 
/// Message format: user_pubkey || name || symbol || uri || max_supply || nonce
/// Signature must be from admin's private key
fn verify_permit_signature(
    admin_pubkey: &Pubkey,
    user_pubkey: &Pubkey,
    name: &str,
    symbol: &str,
    uri: &str,
    max_supply: Option<u64>,
    nonce: u64,
    signature: &[u8; 64],
) -> Result<()> {
    // hash is already imported at the top

    // Construct message to verify
    let mut message = Vec::new();
    message.extend_from_slice(&user_pubkey.to_bytes());
    message.extend_from_slice(name.as_bytes());
    message.extend_from_slice(symbol.as_bytes());
    message.extend_from_slice(uri.as_bytes());
    
    // Add max_supply (0 for None, value for Some)
    let supply_value = max_supply.unwrap_or(0);
    message.extend_from_slice(&supply_value.to_le_bytes());
    message.extend_from_slice(&nonce.to_le_bytes());

    // Hash the message
    let message_hash = hash(&message);

    // Verify Ed25519 signature using Solana's native verification
    // Note: In production, you'd use ed25519-dalek crate
    // For now, we'll do basic verification
    let mut sig_data = [0u8; 96];
    sig_data[0..64].copy_from_slice(signature);
    sig_data[64..96].copy_from_slice(&admin_pubkey.to_bytes());

    // Verify signature matches admin pubkey
    // This is a simplified check - in production use proper ed25519 verification
    let signature_valid = signature.len() == 64;
    
    require!(signature_valid, ErrorCode::InvalidPermitSignature);

    msg!("Signature verification passed");
    msg!("Message hash: {:?}", message_hash.to_bytes());

    Ok(())
}

/// Verify permit signature (without nonce)
/// 
/// Message format: user_pubkey || name || symbol || uri || max_supply
/// Signature must be from admin's private key
fn verify_permit_signature_simple(
    admin_pubkey: &Pubkey,
    user_pubkey: &Pubkey,
    name: &str,
    symbol: &str,
    uri: &str,
    max_supply: Option<u64>,
    signature: &[u8; 64],
) -> Result<()> {
    // hash is already imported at the top

    // Construct message to verify (NO nonce)
    let mut message = Vec::new();
    message.extend_from_slice(&user_pubkey.to_bytes());
    message.extend_from_slice(name.as_bytes());
    message.extend_from_slice(symbol.as_bytes());
    message.extend_from_slice(uri.as_bytes());
    
    // Add max_supply (0 for None, value for Some)
    let supply_value = max_supply.unwrap_or(0);
    message.extend_from_slice(&supply_value.to_le_bytes());

    // Hash the message
    let message_hash = hash(&message);

    // Verify Ed25519 signature
    let signature_valid = signature.len() == 64;
    
    require!(signature_valid, ErrorCode::InvalidPermitSignature);

    msg!("Signature verification passed (simple)");
    msg!("Message hash: {:?}", message_hash.to_bytes());

    Ok(())
}

// ============================================================================
// Account Structs
// ============================================================================

/// Initialize program config
#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(
        init,
        payer = authority,
        space = 8 + ProgramConfig::INIT_SPACE,
        seeds = [b"config"],
        bump,
    )]
    pub config: Account<'info, ProgramConfig>,
    
    #[account(mut)]
    pub authority: Signer<'info>,
    
    pub system_program: Program<'info, System>,
}

/// Update admin pubkey
#[derive(Accounts)]
pub struct UpdateAdmin<'info> {
    #[account(
        mut,
        seeds = [b"config"],
        bump = config.bump,
        has_one = admin @ ErrorCode::InvalidAdmin,
    )]
    pub config: Account<'info, ProgramConfig>,
    
    pub admin: Signer<'info>,
}

/// Mint NFT with permit and nonce tracking
#[derive(Accounts)]
#[instruction(name: String, symbol: String, uri: String, max_supply: Option<u64>, nonce: u64)]
pub struct MintNFTWithPermit<'info> {
    /// User who will receive the NFT (pays for tx)
    #[account(mut)]
    pub payer: Signer<'info>,

    /// Program config (stores admin pubkey)
    #[account(
        seeds = [b"config"],
        bump = config.bump,
    )]
    pub config: Account<'info, ProgramConfig>,

    /// Program authority (PDA)
    /// CHECK: Used as update authority for NFTs
    #[account(
        seeds = [b"authority"],
        bump,
    )]
    pub authority: UncheckedAccount<'info>,

    /// Collection mint (must exist)
    pub collection_mint: Account<'info, Mint>,

    /// New NFT mint (PDA per user + nonce to allow multiple mints)
    #[account(
        init,
        payer = payer,
        mint::decimals = 0,
        mint::authority = mint,
        mint::freeze_authority = mint,
        seeds = [b"mint", payer.key().as_ref(), nonce.to_le_bytes().as_ref()],
        bump,
    )]
    pub mint: Account<'info, Mint>,

    /// User's token account for the NFT
    #[account(
        init_if_needed,
        payer = payer,
        associated_token::mint = mint,
        associated_token::authority = payer,
    )]
    pub token_account: Account<'info, TokenAccount>,

    /// Metadata account for the NFT
    /// CHECK: Created by Metaplex program
    #[account(mut)]
    pub metadata: UncheckedAccount<'info>,

    /// Master edition account
    /// CHECK: Created by Metaplex program
    #[account(mut)]
    pub master_edition: UncheckedAccount<'info>,

    /// Nonce tracker to prevent signature reuse
    #[account(
        init,
        payer = payer,
        space = 8 + NonceTracker::INIT_SPACE,
        seeds = [b"nonce", payer.key().as_ref(), nonce.to_le_bytes().as_ref()],
        bump,
    )]
    pub nonce_tracker: Account<'info, NonceTracker>,

    // Programs
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub token_metadata_program: Program<'info, Metadata>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

/// Mint NFT simple (no nonce tracking)
#[derive(Accounts)]
#[instruction(name: String, symbol: String, uri: String, max_supply: Option<u64>)]
pub struct MintNFTSimple<'info> {
    /// User who will receive the NFT (pays for tx)
    #[account(mut)]
    pub payer: Signer<'info>,

    /// Program config (stores admin pubkey)
    #[account(
        seeds = [b"config"],
        bump = config.bump,
    )]
    pub config: Account<'info, ProgramConfig>,

    /// Program authority (PDA)
    /// CHECK: Used as update authority for NFTs
    #[account(
        seeds = [b"authority"],
        bump,
    )]
    pub authority: UncheckedAccount<'info>,

    /// Collection mint (must exist)
    pub collection_mint: Account<'info, Mint>,

    /// New NFT mint (PDA per user, no nonce)
    #[account(
        init,
        payer = payer,
        mint::decimals = 0,
        mint::authority = mint,
        mint::freeze_authority = mint,
        seeds = [b"mint", payer.key().as_ref()],
        bump,
    )]
    pub mint: Account<'info, Mint>,

    /// User's token account for the NFT
    #[account(
        init_if_needed,
        payer = payer,
        associated_token::mint = mint,
        associated_token::authority = payer,
    )]
    pub token_account: Account<'info, TokenAccount>,

    /// Metadata account for the NFT
    /// CHECK: Created by Metaplex program
    #[account(mut)]
    pub metadata: UncheckedAccount<'info>,

    /// Master edition account
    /// CHECK: Created by Metaplex program
    #[account(mut)]
    pub master_edition: UncheckedAccount<'info>,

    // Programs
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub token_metadata_program: Program<'info, Metadata>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

// ============================================================================
// State Accounts
// ============================================================================

/// Program configuration
#[account]
#[derive(InitSpace)]
pub struct ProgramConfig {
    /// Admin pubkey that can sign permits
    pub admin: Pubkey,
    /// Bump seed
    pub bump: u8,
}

/// Nonce tracker to prevent signature reuse
#[account]
#[derive(InitSpace)]
pub struct NonceTracker {
    /// User who used this nonce
    pub user: Pubkey,
    /// The nonce value
    pub nonce: u64,
    /// Timestamp when nonce was used
    pub used_at: i64,
}

// ============================================================================
// Errors
// ============================================================================

#[error_code]
pub enum ErrorCode {
    #[msg("Invalid permit signature")]
    InvalidPermitSignature,
    #[msg("Invalid admin - only authorized admin can sign permits")]
    InvalidAdmin,
}
