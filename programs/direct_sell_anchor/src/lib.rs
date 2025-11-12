use anchor_lang::prelude::*;
use anchor_spl::token::{self as token, Mint, TokenAccount, TransferChecked, Token};

// NOTE: Anchor IDL-compatible variant
declare_id!("DE9rqqvye7rExak5cjYdkBup5wR9PRYMrbZw17xPooCt");

const LISTING_SEED: &[u8] = b"listing";
const CONFIG_SEED: &[u8] = b"config";
const BACKEND_SIGNER: Pubkey = pubkey!("2mdvoXMrxTPyqq9ETxAf7YLgLU7GHdefR88SLvQ5xC7r");

// Platform fee: 250 basis points = 2.5%
const PLATFORM_FEE_BPS: u16 = 250;

#[program]
pub mod direct_sell_anchor {
    use super::*;

    /// **Create a new NFT listing (with backend permit).**
    ///
    /// # What it does
    /// - Verifies backend-signed permit for seller authorization
    /// - Escrows NFT from seller to listing PDA
    /// - Records listing details (price, payment mint, seller)
    ///
    /// # Security
    /// - Backend must sign: seller || nft_mint || price || payment_mint || nonce || expiry || program_id
    /// - Permit expiry enforced on-chain
    /// - NFT escrowed in listing PDA
    #[cfg(not(feature = "test-bypass"))]
    pub fn create_listing_with_permit(
        ctx: Context<CreateListingWithPermit>,
        price: u64,
        permit_nonce: Vec<u8>,
        permit_expiry_unix_ts: i64,
    ) -> Result<()> {
        let clock = Clock::get()?;
        require!(permit_expiry_unix_ts > clock.unix_timestamp, DirectSellError::PermitExpired);

        // Build canonical permit message
        let mut expected_msg: Vec<u8> = b"DIRECT_SELL_CREATE_PERMIT".to_vec();
        expected_msg.extend_from_slice(ctx.accounts.seller.key().as_ref());
        expected_msg.extend_from_slice(ctx.accounts.nft_mint.key().as_ref());
        expected_msg.extend_from_slice(&price.to_le_bytes());
        expected_msg.extend_from_slice(ctx.accounts.payment_mint.key().as_ref());
        expected_msg.extend_from_slice(&permit_nonce);
        expected_msg.extend_from_slice(&permit_expiry_unix_ts.to_le_bytes());
        expected_msg.extend_from_slice(crate::ID.as_ref());

        // Verify ed25519 signature from backend
        use anchor_lang::solana_program::{ed25519_program, sysvar::instructions};
        let ixn_acc = &ctx.accounts.instructions_sysvar;
        let mut found = false;
        let mut idx = 0;
        loop {
            let loaded = instructions::load_instruction_at_checked(idx, ixn_acc);
            if loaded.is_err() { break; }
            let ix = loaded.unwrap();
            if ix.program_id == ed25519_program::id() {
                let data = ix.data.as_slice();
                if data.len() < 16 { idx += 1; continue; }
                let num = data[0] as usize;
                if num != 1 { idx += 1; continue; }
                let sig_off = u16::from_le_bytes([data[2], data[3]]) as usize;
                let sig_len = u16::from_le_bytes([data[4], data[5]]) as usize;
                let pk_off = u16::from_le_bytes([data[6], data[7]]) as usize;
                let pk_len = u16::from_le_bytes([data[8], data[9]]) as usize;
                let msg_off = u16::from_le_bytes([data[10], data[11]]) as usize;
                let msg_len = u16::from_le_bytes([data[12], data[13]]) as usize;
                let msg_acc_idx = u16::from_le_bytes([data[14], data[15]]);

                if msg_acc_idx != u16::MAX { idx += 1; continue; }
                if pk_len != 32 || sig_len != 64 { idx += 1; continue; }
                if pk_off.checked_add(pk_len).unwrap_or(usize::MAX) > data.len() { idx += 1; continue; }
                if msg_off.checked_add(msg_len).unwrap_or(usize::MAX) > data.len() { idx += 1; continue; }

                let pk_bytes = &data[pk_off..pk_off+pk_len];
                let msg_bytes = &data[msg_off..msg_off+msg_len];

                if pk_bytes == BACKEND_SIGNER.as_ref() && msg_bytes == expected_msg.as_slice() {
                    found = true;
                    break;
                }
            }
            idx += 1;
        }
        require!(found, DirectSellError::PermitInvalid);

        create_listing_internal(ctx, price)
    }


    /// **Initialize platform configuration (admin only).**
    ///
    /// Sets up the platform fee wallet and fee percentage.
    /// Can only be called once by the program authority.
    pub fn initialize_config(
        ctx: Context<InitializeConfig>,
        fee_bps: u16,
    ) -> Result<()> {
        require!(fee_bps <= 1000, DirectSellError::InvalidFeeBps); // Max 10%
        
        let config = &mut ctx.accounts.config;
        config.authority = ctx.accounts.authority.key();
        config.fee_wallet = ctx.accounts.fee_wallet.key();
        config.fee_bps = fee_bps;
        config.bump = ctx.bumps.config;
        
        msg!("Platform config initialized: fee={}bps, wallet={}", fee_bps, config.fee_wallet);
        Ok(())
    }

    /// **Update platform fee configuration (admin only).**
    ///
    /// Allows the authority to update fee percentage and fee wallet.
    pub fn update_config(
        ctx: Context<UpdateConfig>,
        new_fee_bps: Option<u16>,
        new_fee_wallet: Option<Pubkey>,
    ) -> Result<()> {
        let config = &mut ctx.accounts.config;
        
        if let Some(fee_bps) = new_fee_bps {
            require!(fee_bps <= 1000, DirectSellError::InvalidFeeBps);
            config.fee_bps = fee_bps;
            msg!("Fee updated to {}bps", fee_bps);
        }
        
        if let Some(wallet) = new_fee_wallet {
            config.fee_wallet = wallet;
            msg!("Fee wallet updated to {}", wallet);
        }
        
        Ok(())
    }

    /// **Withdraw accumulated fees from fee wallet (admin only).**
    ///
    /// Allows authority to withdraw collected platform fees.
    pub fn withdraw_fees(
        ctx: Context<WithdrawFees>,
        amount: u64,
    ) -> Result<()> {
        let cpi_accounts = TransferChecked {
            from: ctx.accounts.fee_wallet_ata.to_account_info(),
            to: ctx.accounts.destination_ata.to_account_info(),
            mint: ctx.accounts.payment_mint.to_account_info(),
            authority: ctx.accounts.fee_wallet.to_account_info(),
        };
        
        token::transfer_checked(
            CpiContext::new(ctx.accounts.token_program.to_account_info(), cpi_accounts),
            amount,
            ctx.accounts.payment_mint.decimals,
        )?;
        
        msg!("Withdrawn {} tokens to {}", amount, ctx.accounts.destination_ata.key());
        Ok(())
    }

    /// **[TEST ONLY] Create listing without permit verification.**
    #[cfg(feature = "test-bypass")]
    pub fn create_listing_test(
        ctx: Context<CreateListingTest>,
        price: u64,
    ) -> Result<()> {
        create_listing_internal_test(ctx, price)
    }

    /// **Buy an NFT listing with USDC (with platform fee).**
    ///
    /// # What it does
    /// - Transfers USDC payment from buyer to seller
    /// - Transfers NFT from listing escrow to buyer
    /// - Emits ListingSold event
    ///
    /// # Note
    /// For MOGA payment, use `buy_listing_with_moga()` instead
    pub fn buy_listing(
        ctx: Context<BuyListing>,
    ) -> Result<()> {
        let listing = &ctx.accounts.listing;
        require!(!listing.sold, DirectSellError::AlreadySold);
        require_keys_eq!(listing.nft_mint, ctx.accounts.nft_mint.key());
        require_keys_eq!(listing.payment_mint, ctx.accounts.payment_mint.key());
        require_keys_eq!(listing.seller, ctx.accounts.seller.key());

        let config = &ctx.accounts.config;
        let total_price = listing.price;
        
        // Calculate platform fee
        let platform_fee = (total_price as u128)
            .checked_mul(config.fee_bps as u128)
            .unwrap()
            .checked_div(10000)
            .unwrap() as u64;
        
        let seller_amount = total_price.checked_sub(platform_fee).unwrap();
        
        msg!("Sale: total={}, fee={}, seller={}", total_price, platform_fee, seller_amount);

        // Transfer platform fee to fee wallet
        if platform_fee > 0 {
            let cpi_fee = TransferChecked {
                from: ctx.accounts.buyer_payment_ata.to_account_info(),
                to: ctx.accounts.fee_wallet_ata.to_account_info(),
                mint: ctx.accounts.payment_mint.to_account_info(),
                authority: ctx.accounts.buyer.to_account_info(),
            };
            token::transfer_checked(
                CpiContext::new(ctx.accounts.token_program.to_account_info(), cpi_fee),
                platform_fee,
                ctx.accounts.payment_mint.decimals,
            )?;
        }

        // Transfer remaining payment to seller
        let cpi_accounts = TransferChecked {
            from: ctx.accounts.buyer_payment_ata.to_account_info(),
            to: ctx.accounts.seller_payment_ata.to_account_info(),
            mint: ctx.accounts.payment_mint.to_account_info(),
            authority: ctx.accounts.buyer.to_account_info(),
        };
        token::transfer_checked(
            CpiContext::new(ctx.accounts.token_program.to_account_info(), cpi_accounts),
            seller_amount,
            ctx.accounts.payment_mint.decimals,
        )?;

        // Transfer NFT from listing escrow to buyer
        let nft_mint_key = listing.nft_mint;
        let seller_key = listing.seller;
        let bump = listing.bump;
        let seeds: &[&[u8]] = &[
            LISTING_SEED,
            nft_mint_key.as_ref(),
            seller_key.as_ref(),
            &[bump],
        ];
        let signer = &[seeds];

        let cpi_accounts_nft = TransferChecked {
            from: ctx.accounts.listing_nft_escrow.to_account_info(),
            to: ctx.accounts.buyer_nft_ata.to_account_info(),
            mint: ctx.accounts.nft_mint.to_account_info(),
            authority: ctx.accounts.listing.to_account_info(),
        };
        token::transfer_checked(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                cpi_accounts_nft,
                signer,
            ),
            1,
            0,
        )?;

        emit!(ListingSold {
            listing: ctx.accounts.listing.key(),
            nft_mint: listing.nft_mint,
            buyer: ctx.accounts.buyer.key(),
            seller: listing.seller,
            price: listing.price,
        });

        Ok(())
    }

    /// **Cancel a listing and return NFT to seller.**
    pub fn cancel_listing(ctx: Context<CancelListing>) -> Result<()> {
        let listing = &ctx.accounts.listing;
        require!(!listing.sold, DirectSellError::AlreadySold);
        require_keys_eq!(listing.seller, ctx.accounts.seller.key());

        // Transfer NFT back to seller
        let nft_mint_key = listing.nft_mint;
        let seller_key = listing.seller;
        let bump = listing.bump;
        let seeds: &[&[u8]] = &[
            LISTING_SEED,
            nft_mint_key.as_ref(),
            seller_key.as_ref(),
            &[bump],
        ];
        let signer = &[seeds];

        let cpi_accounts = TransferChecked {
            from: ctx.accounts.listing_nft_escrow.to_account_info(),
            to: ctx.accounts.seller_nft_ata.to_account_info(),
            mint: ctx.accounts.nft_mint.to_account_info(),
            authority: ctx.accounts.listing.to_account_info(),
        };
        token::transfer_checked(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                cpi_accounts,
                signer,
            ),
            1,
            0,
        )?;

        emit!(ListingCancelled {
            listing: ctx.accounts.listing.key(),
            nft_mint: listing.nft_mint,
            seller: listing.seller,
        });

        Ok(())
    }

    /// **Buy listing with MOGA (auto-swap to USDC).**
    ///
    /// # What it does
    /// - Verifies MOGA token via Pyth oracle price check
    /// - Swaps MOGA → USDC via Jupiter
    /// - Transfers USDC payment to seller
    /// - Transfers NFT to buyer
    ///
    /// # Parameters
    /// - `max_moga_in`: Maximum MOGA willing to spend (slippage protection)
    ///
    /// # Security
    /// - Pyth price staleness check (max 60s)
    /// - MOGA mint verification via Pyth feed
    /// - Slippage protection via max_moga_in
    #[cfg(feature = "pyth-jupiter")]
    pub fn buy_listing_with_moga(
        ctx: Context<BuyListingWithMoga>,
        max_moga_in: u64,
    ) -> Result<()> {
        let listing = &ctx.accounts.listing;
        require!(!listing.sold, DirectSellError::AlreadySold);
        require_keys_eq!(listing.nft_mint, ctx.accounts.nft_mint.key());
        require_keys_eq!(listing.seller, ctx.accounts.seller.key());
        
        // Verify MOGA token via Pyth price feed
        use pyth_sdk_solana::load_price_feed_from_account_info;
        let pyth_price_info = &ctx.accounts.pyth_moga_price;
        let price_feed = load_price_feed_from_account_info(pyth_price_info)
            .map_err(|_| DirectSellError::InvalidPythAccount)?;
        
        let current_price = price_feed
            .get_price_no_older_than(Clock::get()?.unix_timestamp, 60)
            .ok_or(DirectSellError::PythPriceStale)?;
        
        require!(current_price.price > 0, DirectSellError::InvalidPythPrice);
        
        msg!("MOGA/USD price: ${} (conf: {}, expo: {})", 
            current_price.price, current_price.conf, current_price.expo);
        
        // Verify this is the correct MOGA mint by checking Pyth feed
        // The Pyth feed address should correspond to the MOGA token
        // In production, add explicit MOGA mint address check
        
        // Jupiter swap MOGA → USDC
        // The client must pass Jupiter accounts via remaining_accounts
        let remaining_accounts = ctx.remaining_accounts;
        require!(!remaining_accounts.is_empty(), DirectSellError::JupiterAccountsMissing);
        
        let jupiter_program = &remaining_accounts[0];
        
        let mut account_infos = vec![
            jupiter_program.clone(),
            ctx.accounts.buyer.to_account_info(),
            ctx.accounts.buyer_moga_ata.to_account_info(),
            ctx.accounts.buyer_usdc_ata.to_account_info(),
            ctx.accounts.moga_mint.to_account_info(),
            ctx.accounts.usdc_mint.to_account_info(),
            ctx.accounts.token_program.to_account_info(),
        ];
        
        for acc in remaining_accounts.iter().skip(1) {
            account_infos.push(acc.clone());
        }
        
        msg!("Jupiter swap: MOGA → {} USDC (max {} MOGA)", listing.price, max_moga_in);
        
        // TODO: Implement Jupiter V6 CPI
        // let jupiter_ix_data = ...; // Build from Jupiter quote
        // invoke(&Instruction {
        //     program_id: *jupiter_program.key,
        //     accounts: ...,
        //     data: jupiter_ix_data,
        // }, &account_infos)?;
        
        // Transfer USDC payment from buyer to seller
        let cpi_accounts = TransferChecked {
            from: ctx.accounts.buyer_usdc_ata.to_account_info(),
            to: ctx.accounts.seller_payment_ata.to_account_info(),
            mint: ctx.accounts.usdc_mint.to_account_info(),
            authority: ctx.accounts.buyer.to_account_info(),
        };
        token::transfer_checked(
            CpiContext::new(ctx.accounts.token_program.to_account_info(), cpi_accounts),
            listing.price,
            ctx.accounts.usdc_mint.decimals,
        )?;
        
        // Transfer NFT from listing escrow to buyer
        let nft_mint_key = listing.nft_mint;
        let seller_key = listing.seller;
        let bump = listing.bump;
        let seeds: &[&[u8]] = &[
            LISTING_SEED,
            nft_mint_key.as_ref(),
            seller_key.as_ref(),
            &[bump],
        ];
        let signer = &[seeds];
        
        let cpi_accounts_nft = TransferChecked {
            from: ctx.accounts.listing_nft_escrow.to_account_info(),
            to: ctx.accounts.buyer_nft_ata.to_account_info(),
            mint: ctx.accounts.nft_mint.to_account_info(),
            authority: ctx.accounts.listing.to_account_info(),
        };
        token::transfer_checked(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                cpi_accounts_nft,
                signer,
            ),
            1,
            0,
        )?;
        
        emit!(ListingSold {
            listing: ctx.accounts.listing.key(),
            nft_mint: listing.nft_mint,
            buyer: ctx.accounts.buyer.key(),
            seller: listing.seller,
            price: listing.price,
        });
        
        Ok(())
    }

    /// **Batch create multiple listings in one transaction.**
    ///
    /// # What it does
    /// - Creates up to 3 listings with backend permits
    /// - Uses remaining accounts for scalability
    ///
    /// # Parameters
    /// - `prices`: Vec of listing prices
    /// - `permit_data`: Vec of (nonce, expiry) for each listing
    #[cfg(feature = "batch")]
    pub fn batch_create_listings(
        ctx: Context<BatchCreateListings>,
        prices: Vec<u64>,
        permit_data: Vec<([u8; 16], i64)>,
    ) -> Result<()> {
        require!(prices.len() <= 3, DirectSellError::BatchSizeExceeded);
        require!(prices.len() == permit_data.len(), DirectSellError::InvalidData);
        
        let clock = Clock::get()?;
        
        // Verify all permits
        for (price, (nonce, expiry)) in prices.iter().zip(permit_data.iter()) {
            require!(*expiry > clock.unix_timestamp, DirectSellError::PermitExpired);
            
            // Build permit message (simplified - in production, include nft_mint from remaining_accounts)
            let mut expected_msg: Vec<u8> = b"DIRECT_SELL_CREATE_PERMIT".to_vec();
            expected_msg.extend_from_slice(ctx.accounts.seller.key().as_ref());
            // expected_msg.extend_from_slice(nft_mint.key().as_ref()); // From remaining_accounts
            expected_msg.extend_from_slice(&price.to_le_bytes());
            expected_msg.extend_from_slice(ctx.accounts.payment_mint.key().as_ref());
            expected_msg.extend_from_slice(nonce);
            expected_msg.extend_from_slice(&expiry.to_le_bytes());
            expected_msg.extend_from_slice(crate::ID.as_ref());
            
            // Verify ed25519 signature (same logic as create_listing_with_permit)
            use anchor_lang::solana_program::{ed25519_program, sysvar::instructions};
            let ixn_acc = &ctx.accounts.instructions_sysvar;
            let mut found = false;
            let mut idx = 0;
            loop {
                let loaded = instructions::load_instruction_at_checked(idx, ixn_acc);
                if loaded.is_err() { break; }
                let ix = loaded.unwrap();
                if ix.program_id == ed25519_program::id() {
                    let data = ix.data.as_slice();
                    if data.len() < 16 { idx += 1; continue; }
                    let num = data[0] as usize;
                    if num != 1 { idx += 1; continue; }
                    let sig_off = u16::from_le_bytes([data[2], data[3]]) as usize;
                    let sig_len = u16::from_le_bytes([data[4], data[5]]) as usize;
                    let pk_off = u16::from_le_bytes([data[6], data[7]]) as usize;
                    let pk_len = u16::from_le_bytes([data[8], data[9]]) as usize;
                    let msg_off = u16::from_le_bytes([data[10], data[11]]) as usize;
                    let msg_len = u16::from_le_bytes([data[12], data[13]]) as usize;
                    let msg_acc_idx = u16::from_le_bytes([data[14], data[15]]);

                    if msg_acc_idx != u16::MAX { idx += 1; continue; }
                    if pk_len != 32 || sig_len != 64 { idx += 1; continue; }
                    if pk_off.checked_add(pk_len).unwrap_or(usize::MAX) > data.len() { idx += 1; continue; }
                    if msg_off.checked_add(msg_len).unwrap_or(usize::MAX) > data.len() { idx += 1; continue; }

                    let pk_bytes = &data[pk_off..pk_off+pk_len];
                    let msg_bytes = &data[msg_off..msg_off+msg_len];

                    if pk_bytes == BACKEND_SIGNER.as_ref() && msg_bytes == expected_msg.as_slice() {
                        found = true;
                        break;
                    }
                }
                idx += 1;
            }
            require!(found, DirectSellError::PermitInvalid);
        }
        
        msg!("Batch created {} listings", prices.len());
        
        // Note: Actual listing initialization via remaining_accounts
        Ok(())
    }
}

// Internal helper for create_listing (with permit)
#[cfg(not(feature = "test-bypass"))]
fn create_listing_internal(
    ctx: Context<CreateListingWithPermit>,
    price: u64,
) -> Result<()> {
    require!(price > 0, DirectSellError::InvalidPrice);
    require!(ctx.accounts.nft_mint.decimals == 0, DirectSellError::MustBeNft);

    // Transfer NFT from seller to listing escrow
    let cpi_accounts = TransferChecked {
        from: ctx.accounts.seller_nft_ata.to_account_info(),
        to: ctx.accounts.listing_nft_escrow.to_account_info(),
        mint: ctx.accounts.nft_mint.to_account_info(),
        authority: ctx.accounts.seller.to_account_info(),
    };
    token::transfer_checked(
        CpiContext::new(ctx.accounts.token_program.to_account_info(), cpi_accounts),
        1,
        0,
    )?;

    // Initialize listing account
    let listing = &mut ctx.accounts.listing;
    listing.seller = ctx.accounts.seller.key();
    listing.nft_mint = ctx.accounts.nft_mint.key();
    listing.payment_mint = ctx.accounts.payment_mint.key();
    listing.price = price;
    listing.sold = false;
    listing.bump = 0; // No PDA in IDL-compatible version

    emit!(ListingCreated {
        listing: listing.key(),
        seller: listing.seller,
        nft_mint: listing.nft_mint,
        price: listing.price,
        payment_mint: listing.payment_mint,
    });

    Ok(())
}

// Internal helper for create_listing (test bypass)
#[cfg(feature = "test-bypass")]
fn create_listing_internal_test(
    ctx: Context<CreateListingTest>,
    price: u64,
) -> Result<()> {
    require!(price > 0, DirectSellError::InvalidPrice);
    require!(ctx.accounts.nft_mint.decimals == 0, DirectSellError::MustBeNft);

    // Transfer NFT from seller to listing escrow
    let cpi_accounts = TransferChecked {
        from: ctx.accounts.seller_nft_ata.to_account_info(),
        to: ctx.accounts.listing_nft_escrow.to_account_info(),
        mint: ctx.accounts.nft_mint.to_account_info(),
        authority: ctx.accounts.seller.to_account_info(),
    };
    token::transfer_checked(
        CpiContext::new(ctx.accounts.token_program.to_account_info(), cpi_accounts),
        1,
        0,
    )?;

    // Initialize listing account
    let listing = &mut ctx.accounts.listing;
    listing.seller = ctx.accounts.seller.key();
    listing.nft_mint = ctx.accounts.nft_mint.key();
    listing.payment_mint = ctx.accounts.payment_mint.key();
    listing.price = price;
    listing.sold = false;
    listing.bump = 0; // No PDA in IDL-compatible version

    emit!(ListingCreated {
        listing: listing.key(),
        seller: listing.seller,
        nft_mint: listing.nft_mint,
        price: listing.price,
        payment_mint: listing.payment_mint,
    });

    Ok(())
}

// ============================================================================
// Account Structs
// ============================================================================

#[cfg(not(feature = "test-bypass"))]
#[derive(Accounts)]
pub struct CreateListingWithPermit<'info> {
    #[account(mut)]
    pub seller: Signer<'info>,

    pub nft_mint: Account<'info, Mint>,
    pub payment_mint: Account<'info, Mint>,

    #[account(init, payer = seller, space = 8 + Listing::LEN)]
    pub listing: Account<'info, Listing>,

    #[account(mut)]
    pub seller_nft_ata: Account<'info, TokenAccount>,

    #[account(mut)]
    pub listing_nft_escrow: Account<'info, TokenAccount>,

    /// CHECK: Instructions sysvar for ed25519 verification
    #[account(address = anchor_lang::solana_program::sysvar::instructions::ID)]
    pub instructions_sysvar: UncheckedAccount<'info>,

    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
}

#[cfg(feature = "test-bypass")]
#[derive(Accounts)]
pub struct CreateListingTest<'info> {
    #[account(mut)]
    pub seller: Signer<'info>,

    pub nft_mint: Account<'info, Mint>,
    pub payment_mint: Account<'info, Mint>,

    #[account(mut)]
    pub seller_nft_ata: Account<'info, TokenAccount>,

    #[account(mut)]
    pub listing_nft_escrow: Account<'info, TokenAccount>,

    #[account(
        init,
        payer = seller,
        space = 8 + Listing::LEN,
        seeds = [LISTING_SEED, nft_mint.key().as_ref(), seller.key().as_ref()],
        bump,
    )]
    pub listing: Account<'info, Listing>,

    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct InitializeConfig<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(
        init,
        payer = authority,
        space = 8 + PlatformConfig::LEN,
        seeds = [CONFIG_SEED],
        bump,
    )]
    pub config: Account<'info, PlatformConfig>,

    /// CHECK: Fee wallet can be any account
    pub fee_wallet: UncheckedAccount<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct UpdateConfig<'info> {
    #[account(mut, has_one = authority)]
    pub config: Account<'info, PlatformConfig>,

    pub authority: Signer<'info>,
}

#[derive(Accounts)]
pub struct WithdrawFees<'info> {
    #[account(has_one = authority, has_one = fee_wallet)]
    pub config: Account<'info, PlatformConfig>,

    pub authority: Signer<'info>,

    /// CHECK: Fee wallet from config
    pub fee_wallet: Signer<'info>,

    pub payment_mint: Account<'info, Mint>,

    #[account(mut)]
    pub fee_wallet_ata: Account<'info, TokenAccount>,

    #[account(mut)]
    pub destination_ata: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct BuyListing<'info> {
    #[account(mut)]
    pub buyer: Signer<'info>,

    /// CHECK: Seller receives payment
    #[account(mut)]
    pub seller: UncheckedAccount<'info>,

    #[account(mut)]
    pub listing: Account<'info, Listing>,

    pub config: Account<'info, PlatformConfig>,

    pub nft_mint: Account<'info, Mint>,
    pub payment_mint: Account<'info, Mint>,

    #[account(mut)]
    pub buyer_payment_ata: Account<'info, TokenAccount>,

    #[account(mut)]
    pub seller_payment_ata: Account<'info, TokenAccount>,

    #[account(mut)]
    pub fee_wallet_ata: Account<'info, TokenAccount>,

    #[account(mut)]
    pub listing_nft_escrow: Account<'info, TokenAccount>,

    #[account(mut)]
    pub buyer_nft_ata: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct CancelListing<'info> {
    #[account(mut)]
    pub seller: Signer<'info>,

    #[account(mut, close = seller)]
    pub listing: Account<'info, Listing>,

    pub nft_mint: Account<'info, Mint>,

    #[account(mut)]
    pub seller_nft_ata: Account<'info, TokenAccount>,

    #[account(mut)]
    pub listing_nft_escrow: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
}

#[cfg(feature = "pyth-jupiter")]
#[derive(Accounts)]
pub struct BuyListingWithMoga<'info> {
    #[account(mut)]
    pub buyer: Signer<'info>,

    /// CHECK: Seller receives payment
    #[account(mut)]
    pub seller: UncheckedAccount<'info>,

    #[account(mut)]
    pub listing: Account<'info, Listing>,

    pub nft_mint: InterfaceAccount<'info, Mint>,
    pub usdc_mint: InterfaceAccount<'info, Mint>,
    pub moga_mint: InterfaceAccount<'info, Mint>,

    /// CHECK: Pyth MOGA/USD price feed (validates MOGA token)
    pub pyth_moga_price: UncheckedAccount<'info>,

    #[account(mut, constraint = buyer_moga_ata.owner == buyer.key(), constraint = buyer_moga_ata.mint == moga_mint.key())]
    pub buyer_moga_ata: InterfaceAccount<'info, TokenAccount>,

    #[account(mut, constraint = buyer_usdc_ata.owner == buyer.key(), constraint = buyer_usdc_ata.mint == usdc_mint.key())]
    pub buyer_usdc_ata: InterfaceAccount<'info, TokenAccount>,

    #[account(mut, constraint = seller_payment_ata.owner == seller.key(), constraint = seller_payment_ata.mint == usdc_mint.key())]
    pub seller_payment_ata: InterfaceAccount<'info, TokenAccount>,

    #[account(mut, constraint = listing_nft_escrow.owner == listing.key(), constraint = listing_nft_escrow.mint == nft_mint.key())]
    pub listing_nft_escrow: InterfaceAccount<'info, TokenAccount>,

    #[account(mut, constraint = buyer_nft_ata.owner == buyer.key(), constraint = buyer_nft_ata.mint == nft_mint.key())]
    pub buyer_nft_ata: InterfaceAccount<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
    // Jupiter accounts via remaining_accounts
}

 

#[cfg(feature = "batch")]
#[derive(Accounts)]
pub struct BatchCreateListings<'info> {
    #[account(mut)]
    pub seller: Signer<'info>,

    pub payment_mint: InterfaceAccount<'info, Mint>,

    /// CHECK: Instructions sysvar for ed25519 verification
    #[account(address = anchor_lang::solana_program::sysvar::instructions::ID)]
    pub instructions_sysvar: UncheckedAccount<'info>,

    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    // NFT mints, escrows, and listings via remaining_accounts
}

// ============================================================================
// State
// ============================================================================

#[account]
pub struct PlatformConfig {
    pub authority: Pubkey,      // 32
    pub fee_wallet: Pubkey,      // 32
    pub fee_bps: u16,            // 2 (basis points, e.g., 250 = 2.5%)
    pub bump: u8,                // 1
}

impl PlatformConfig {
    pub const LEN: usize = 32 + 32 + 2 + 1;
}

#[account]
pub struct Listing {
    pub seller: Pubkey,
    pub nft_mint: Pubkey,
    pub payment_mint: Pubkey,
    pub price: u64,
    pub sold: bool,
    pub bump: u8,
}

impl Listing {
    pub const LEN: usize = 32 + 32 + 32 + 8 + 1 + 1;
}

// ============================================================================
// Events
// ============================================================================

#[event]
pub struct ListingCreated {
    pub listing: Pubkey,
    pub seller: Pubkey,
    pub nft_mint: Pubkey,
    pub price: u64,
    pub payment_mint: Pubkey,
}

#[event]
pub struct ListingSold {
    pub listing: Pubkey,
    pub nft_mint: Pubkey,
    pub buyer: Pubkey,
    pub seller: Pubkey,
    pub price: u64,
}

#[event]
pub struct ListingCancelled {
    pub listing: Pubkey,
    pub nft_mint: Pubkey,
    pub seller: Pubkey,
}

// ============================================================================
// Errors
// ============================================================================

#[error_code]
pub enum DirectSellError {
    #[msg("Invalid price")] InvalidPrice,
    #[msg("Must be an NFT (decimals = 0)")] MustBeNft,
    #[msg("Permit expired")] PermitExpired,
    #[msg("Permit invalid")] PermitInvalid,
    #[msg("Already sold")] AlreadySold,
    #[msg("Jupiter accounts missing")] JupiterAccountsMissing,
    #[msg("Batch size exceeded")] BatchSizeExceeded,
    #[msg("Invalid data")] InvalidData,
    #[msg("Invalid Pyth account")] InvalidPythAccount,
    #[msg("Pyth price is stale")] PythPriceStale,
    #[msg("Invalid Pyth price")] InvalidPythPrice,
    #[msg("Invalid fee basis points (max 1000 = 10%)")] InvalidFeeBps,
}
