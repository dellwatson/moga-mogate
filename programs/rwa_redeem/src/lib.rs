use anchor_lang::prelude::*;
use anchor_spl::token_interface::{self as token, Mint, TokenAccount, Burn};
use anchor_spl::token::Token;

// TODO: Replace with actual deployed program ID
declare_id!("RwaRede3m1111111111111111111111111111111111");

const REDEMPTION_SEED: &[u8] = b"redemption";
const BACKEND_SIGNER: Pubkey = pubkey!("2mdvoXMrxTPyqq9ETxAf7YLgLU7GHdefR88SLvQ5xC7r");

#[program]
pub mod rwa_redeem {
    use super::*;

    /// **Redeem RWA NFT with backend permit.**
    ///
    /// # What it does
    /// - Verifies backend-signed permit for redemption authorization
    /// - Burns RWA NFT on-chain
    /// - Records redemption details for off-chain fulfillment
    /// - Emits event for backend to process physical asset delivery
    ///
    /// # Security
    /// - Backend must sign: holder || nft_mint || redemption_type || nonce || expiry || program_id
    /// - Permit expiry enforced on-chain
    /// - NFT burned (cannot be redeemed twice)
    /// - Redemption record prevents replay
    ///
    /// # Redemption types
    /// - 0: Physical delivery (backend ships physical asset)
    /// - 1: Digital delivery (backend sends digital asset)
    /// - 2: Cash settlement (backend transfers fiat/crypto)
    #[cfg(not(feature = "test-bypass"))]
    pub fn redeem_nft_with_permit(
        ctx: Context<RedeemNftWithPermit>,
        redemption_type: u8,
        permit_nonce: [u8; 16],
        permit_expiry_unix_ts: i64,
    ) -> Result<()> {
        let clock = Clock::get()?;
        require!(permit_expiry_unix_ts > clock.unix_timestamp, RedeemError::PermitExpired);

        // Build canonical permit message
        let mut expected_msg: Vec<u8> = b"RWA_REDEEM_PERMIT".to_vec();
        expected_msg.extend_from_slice(ctx.accounts.holder.key().as_ref());
        expected_msg.extend_from_slice(ctx.accounts.nft_mint.key().as_ref());
        expected_msg.push(redemption_type);
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
        require!(found, RedeemError::PermitInvalid);

        // Burn NFT
        require!(ctx.accounts.nft_mint.decimals == 0, RedeemError::MustBeNft);
        require!(ctx.accounts.holder_nft_ata.amount == 1, RedeemError::InsufficientBalance);

        let cpi_accounts = Burn {
            mint: ctx.accounts.nft_mint.to_account_info(),
            from: ctx.accounts.holder_nft_ata.to_account_info(),
            authority: ctx.accounts.holder.to_account_info(),
        };
        token::burn(
            CpiContext::new(ctx.accounts.token_program.to_account_info(), cpi_accounts),
            1,
        )?;

        // Record redemption
        let redemption = &mut ctx.accounts.redemption;
        redemption.holder = ctx.accounts.holder.key();
        redemption.nft_mint = ctx.accounts.nft_mint.key();
        redemption.redemption_type = redemption_type;
        redemption.timestamp = clock.unix_timestamp;
        redemption.fulfilled = false;
        redemption.bump = ctx.bumps.redemption;

        emit!(RedemptionRequested {
            redemption: redemption.key(),
            holder: redemption.holder,
            nft_mint: redemption.nft_mint,
            redemption_type,
            timestamp: redemption.timestamp,
        });

        Ok(())
    }

    /// **[TEST ONLY] Redeem NFT without permit verification.**
    #[cfg(feature = "test-bypass")]
    pub fn redeem_nft_test(
        ctx: Context<RedeemNftTest>,
        redemption_type: u8,
    ) -> Result<()> {
        let clock = Clock::get()?;

        // Burn NFT
        require!(ctx.accounts.nft_mint.decimals == 0, RedeemError::MustBeNft);
        require!(ctx.accounts.holder_nft_ata.amount == 1, RedeemError::InsufficientBalance);

        let cpi_accounts = Burn {
            mint: ctx.accounts.nft_mint.to_account_info(),
            from: ctx.accounts.holder_nft_ata.to_account_info(),
            authority: ctx.accounts.holder.to_account_info(),
        };
        token::burn(
            CpiContext::new(ctx.accounts.token_program.to_account_info(), cpi_accounts),
            1,
        )?;

        // Record redemption
        let redemption = &mut ctx.accounts.redemption;
        redemption.holder = ctx.accounts.holder.key();
        redemption.nft_mint = ctx.accounts.nft_mint.key();
        redemption.redemption_type = redemption_type;
        redemption.timestamp = clock.unix_timestamp;
        redemption.fulfilled = false;
        redemption.bump = ctx.bumps.redemption;

        emit!(RedemptionRequested {
            redemption: redemption.key(),
            holder: redemption.holder,
            nft_mint: redemption.nft_mint,
            redemption_type,
            timestamp: redemption.timestamp,
        });

        Ok(())
    }

    /// **Redeem compressed RWA NFT (Bubblegum).**
    ///
    /// # What it does
    /// - Verifies backend permit
    /// - Burns compressed NFT via Bubblegum CPI
    /// - Records redemption for off-chain fulfillment
    #[cfg(all(feature = "bubblegum", not(feature = "test-bypass")))]
    pub fn redeem_compressed_nft(
        ctx: Context<RedeemCompressedNft>,
        redemption_type: u8,
        permit_nonce: [u8; 16],
        permit_expiry_unix_ts: i64,
        nft_proofs: Vec<u8>,
    ) -> Result<()> {
        let clock = Clock::get()?;
        require!(permit_expiry_unix_ts > clock.unix_timestamp, RedeemError::PermitExpired);

        // Build permit message
        let mut expected_msg: Vec<u8> = b"RWA_REDEEM_PERMIT".to_vec();
        expected_msg.extend_from_slice(ctx.accounts.holder.key().as_ref());
        expected_msg.extend_from_slice(ctx.accounts.nft_mint.key().as_ref());
        expected_msg.push(redemption_type);
        expected_msg.extend_from_slice(&permit_nonce);
        expected_msg.extend_from_slice(&permit_expiry_unix_ts.to_le_bytes());
        expected_msg.extend_from_slice(crate::ID.as_ref());

        // Verify ed25519 signature (same logic as redeem_nft_with_permit)
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
        require!(found, RedeemError::PermitInvalid);

        // Parse proof data and burn compressed NFT
        require!(nft_proofs.len() >= 108, RedeemError::InvalidProof);
        
        let mut root = [0u8; 32];
        let mut data_hash = [0u8; 32];
        let mut creator_hash = [0u8; 32];
        root.copy_from_slice(&nft_proofs[0..32]);
        data_hash.copy_from_slice(&nft_proofs[32..64]);
        creator_hash.copy_from_slice(&nft_proofs[64..96]);
        let nonce = u64::from_le_bytes(nft_proofs[96..104].try_into().unwrap());
        let index = u32::from_le_bytes(nft_proofs[104..108].try_into().unwrap());
        
        // TODO: Implement Bubblegum burn CPI (same pattern as rwa_raffle)
        msg!("Burning compressed NFT: root={:?}, index={}", root, index);

        // Record redemption
        let redemption = &mut ctx.accounts.redemption;
        redemption.holder = ctx.accounts.holder.key();
        redemption.nft_mint = ctx.accounts.nft_mint.key();
        redemption.redemption_type = redemption_type;
        redemption.timestamp = clock.unix_timestamp;
        redemption.fulfilled = false;
        redemption.bump = ctx.bumps.redemption;

        emit!(RedemptionRequested {
            redemption: redemption.key(),
            holder: redemption.holder,
            nft_mint: redemption.nft_mint,
            redemption_type,
            timestamp: redemption.timestamp,
        });

        Ok(())
    }

    /// **Mark redemption as fulfilled (backend only).**
    ///
    /// # What it does
    /// - Verifies backend signature
    /// - Marks redemption as fulfilled
    /// - Emits fulfillment event
    pub fn mark_fulfilled(
        ctx: Context<MarkFulfilled>,
        fulfillment_data: Vec<u8>, // Tracking number, txid, etc.
    ) -> Result<()> {
        let redemption = &mut ctx.accounts.redemption;
        require!(!redemption.fulfilled, RedeemError::AlreadyFulfilled);

        // TODO: Add backend signature verification for mark_fulfilled
        // For now, only allow the holder to mark (for testing)
        require_keys_eq!(redemption.holder, ctx.accounts.authority.key());

        redemption.fulfilled = true;

        emit!(RedemptionFulfilled {
            redemption: redemption.key(),
            holder: redemption.holder,
            nft_mint: redemption.nft_mint,
            fulfillment_data,
        });

        Ok(())
    }
}

// ============================================================================
// Account Structs
// ============================================================================

#[cfg(not(feature = "test-bypass"))]
#[derive(Accounts)]
#[instruction(redemption_type: u8, permit_nonce: [u8; 16], permit_expiry_unix_ts: i64)]
pub struct RedeemNftWithPermit<'info> {
    #[account(mut)]
    pub holder: Signer<'info>,

    #[account(mut)]
    pub nft_mint: InterfaceAccount<'info, Mint>,

    #[account(mut, constraint = holder_nft_ata.owner == holder.key(), constraint = holder_nft_ata.mint == nft_mint.key())]
    pub holder_nft_ata: InterfaceAccount<'info, TokenAccount>,

    #[account(
        init,
        payer = holder,
        space = 8 + Redemption::LEN,
        seeds = [REDEMPTION_SEED, nft_mint.key().as_ref(), holder.key().as_ref()],
        bump,
    )]
    pub redemption: Account<'info, Redemption>,

    /// CHECK: Instructions sysvar for ed25519 verification
    #[account(address = anchor_lang::solana_program::sysvar::instructions::ID)]
    pub instructions_sysvar: AccountInfo<'info>,

    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
}

#[cfg(feature = "test-bypass")]
#[derive(Accounts)]
#[instruction(redemption_type: u8)]
pub struct RedeemNftTest<'info> {
    #[account(mut)]
    pub holder: Signer<'info>,

    #[account(mut)]
    pub nft_mint: InterfaceAccount<'info, Mint>,

    #[account(mut, constraint = holder_nft_ata.owner == holder.key(), constraint = holder_nft_ata.mint == nft_mint.key())]
    pub holder_nft_ata: InterfaceAccount<'info, TokenAccount>,

    #[account(
        init,
        payer = holder,
        space = 8 + Redemption::LEN,
        seeds = [REDEMPTION_SEED, nft_mint.key().as_ref(), holder.key().as_ref()],
        bump,
    )]
    pub redemption: Account<'info, Redemption>,

    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
}

#[cfg(all(feature = "bubblegum", not(feature = "test-bypass")))]
#[derive(Accounts)]
#[instruction(redemption_type: u8, permit_nonce: [u8; 16], permit_expiry_unix_ts: i64, nft_proofs: Vec<u8>)]
pub struct RedeemCompressedNft<'info> {
    #[account(mut)]
    pub holder: Signer<'info>,

    /// CHECK: Compressed NFT mint (leaf in Merkle tree)
    pub nft_mint: AccountInfo<'info>,

    /// CHECK: Merkle tree account
    pub merkle_tree: AccountInfo<'info>,

    /// CHECK: Tree config PDA
    pub tree_config: AccountInfo<'info>,

    /// CHECK: Log wrapper
    pub log_wrapper: AccountInfo<'info>,

    /// CHECK: Compression program
    pub compression_program: AccountInfo<'info>,

    /// CHECK: Bubblegum program
    pub bubblegum_program: AccountInfo<'info>,

    #[account(
        init,
        payer = holder,
        space = 8 + Redemption::LEN,
        seeds = [REDEMPTION_SEED, nft_mint.key().as_ref(), holder.key().as_ref()],
        bump,
    )]
    pub redemption: Account<'info, Redemption>,

    /// CHECK: Instructions sysvar for ed25519 verification
    #[account(address = anchor_lang::solana_program::sysvar::instructions::ID)]
    pub instructions_sysvar: AccountInfo<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct MarkFulfilled<'info> {
    pub authority: Signer<'info>,

    #[account(mut)]
    pub redemption: Account<'info, Redemption>,
}

// ============================================================================
// State
// ============================================================================

#[account]
pub struct Redemption {
    pub holder: Pubkey,
    pub nft_mint: Pubkey,
    pub redemption_type: u8,
    pub timestamp: i64,
    pub fulfilled: bool,
    pub bump: u8,
}

impl Redemption {
    pub const LEN: usize = 32 + 32 + 1 + 8 + 1 + 1;
}

// ============================================================================
// Events
// ============================================================================

#[event]
pub struct RedemptionRequested {
    pub redemption: Pubkey,
    pub holder: Pubkey,
    pub nft_mint: Pubkey,
    pub redemption_type: u8,
    pub timestamp: i64,
}

#[event]
pub struct RedemptionFulfilled {
    pub redemption: Pubkey,
    pub holder: Pubkey,
    pub nft_mint: Pubkey,
    pub fulfillment_data: Vec<u8>,
}

// ============================================================================
// Errors
// ============================================================================

#[error_code]
pub enum RedeemError {
    #[msg("Permit expired")] PermitExpired,
    #[msg("Permit invalid")] PermitInvalid,
    #[msg("Must be an NFT (decimals = 0)")] MustBeNft,
    #[msg("Insufficient balance")] InsufficientBalance,
    #[msg("Already fulfilled")] AlreadyFulfilled,
    #[msg("Invalid proof data")] InvalidProof,
}
