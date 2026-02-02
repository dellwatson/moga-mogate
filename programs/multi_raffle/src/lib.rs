use anchor_lang::prelude::*;
use anchor_lang::system_program::{self, Transfer};
use anchor_spl::associated_token::AssociatedToken;
use anchor_spl::metadata::{
    mpl_token_metadata::types::{Creator, DataV2},
    CreateMetadataAccountsV3, CreateMasterEditionV3, Metadata, VerifyCollection, VerifySizedCollectionItem,
    create_master_edition_v3, create_metadata_accounts_v3, verify_collection, verify_sized_collection_item,
};
use anchor_spl::token::{Mint, MintTo, Token, TokenAccount, mint_to};

declare_id!("5Nb1Mtm2VfjxqfkA9rKZVt294QSx1vUVCYT7Hi1DrZeM");

const CONFIG_SEED: &[u8] = b"config";
const RAFFLE_SEED: &[u8] = b"raffle";
const SLOTS_SEED: &[u8] = b"slots";
const USER_SEED: &[u8] = b"user";
const TREASURY_SEED: &[u8] = b"treasury";

const MAX_RAFFLE_ID_LEN: usize = 64;
const MAX_URI_LEN: usize = 256;
const MAX_SLOTS_PER_USER: u32 = 1024;
const PRIZE_MINT_SEED: &[u8] = b"prize_mint";
const COLLECTION_AUTHORITY_SEED: &[u8] = b"collection_authority";

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq)]
pub enum MultiRaffleStatus {
    Open = 0,
    Filled = 1,
    Drawn = 2,
    Cancelled = 3,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq)]
pub enum PrizeTokenType {
    None = 0,
    Spl = 1,           // Standard SPL token (NFT with Metaplex metadata)
    Cnft = 2,          // Compressed NFT (Metaplex Bubblegum)
    Pnft = 3,          // Programmable NFT (Metaplex Token Standard with rule sets)
    ZkCompressed = 4,  // ZK-compressed token (Light Protocol)
}

fn status_to_string(status: u8) -> String {
    if status == MultiRaffleStatus::Open as u8 {
        "OPEN".to_string()
    } else if status == MultiRaffleStatus::Filled as u8 {
        "FILLED".to_string()
    } else if status == MultiRaffleStatus::Drawn as u8 {
        "DRAWN".to_string()
    } else {
        "CANCELLED".to_string()
    }
}

fn prize_type_to_string(prize_type: u8) -> String {
    if prize_type == PrizeTokenType::Spl as u8 {
        "SPL".to_string()
    } else if prize_type == PrizeTokenType::Cnft as u8 {
        "cNFT".to_string()
    } else if prize_type == PrizeTokenType::Pnft as u8 {
        "pNFT".to_string()
    } else if prize_type == PrizeTokenType::ZkCompressed as u8 {
        "ZK_COMPRESSED".to_string()
    } else {
        "NONE".to_string()
    }
}

#[account]
pub struct Config {
    pub admin: Pubkey,
    pub refund_fee_bps: u16, // e.g. 500 = 5%
}

impl Config {
    pub const LEN: usize = 32 + 2;
}

#[account]
pub struct Raffle {
    pub raffle_id: String,
    pub total_slots: u32,
    pub max_slots_per_address: u32,
    pub metadata_uri: String,
    pub collection: Pubkey,
    pub premint_contract: bool,
    pub premint: bool,
    pub auto_draw: bool,
    pub auto_claim: bool,
    pub prize_type: u8,
    pub prize_amount: u64,
    pub created_at: i64,
    pub expires_at: i64,
    pub status: u8,
    pub sold_slots: u32,
    pub winner_slot: u32,
    pub winner: Pubkey,
    pub claimed: bool,
    pub bump: u8,
}

impl Raffle {
    pub const LEN: usize =
        4 + MAX_RAFFLE_ID_LEN + // raffle_id
        4 + MAX_URI_LEN +       // metadata_uri
        4 +                     // total_slots
        4 +                     // max_slots_per_address
        32 +                    // collection
        1 + 1 + 1 + 1 +         // premint_contract, premint, auto_draw, auto_claim
        1 +                     // prize_type
        8 +                     // prize_amount
        8 + 8 +                 // created_at, expires_at
        1 +                     // status
        4 + 4 +                 // sold_slots, winner_slot
        32 +                    // winner
        1 + 1;                  // claimed, bump
}

#[account]
pub struct RaffleSlots {
    pub raffle: Pubkey,
    pub total_slots: u32,
    pub slot_owners: Vec<Pubkey>, // length == total_slots, 1-based externally
}

impl RaffleSlots {
    pub fn space(total_slots: u32) -> usize {
        32 + // raffle
        4 +  // total_slots
        4 + (total_slots as usize) * 32 // vec len + owners
    }
}

#[account]
pub struct UserRaffle {
    pub raffle: Pubkey,
    pub user: Pubkey,
    pub slots: Vec<u32>,
    pub paid: u64, // total lamports paid into this raffle
}

impl UserRaffle {
    pub fn space() -> usize {
        32 + // raffle
        32 + // user
        4 + (MAX_SLOTS_PER_USER as usize) * 4 + // slots vec (u32)
        8 // paid
    }
}

// View return types
#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct RaffleDetailView {
    pub total_slots: u32,
    pub sold_slots: u32,
    pub max_slots_per_address: u32,
    pub metadata_uri: String,
    pub collection: Pubkey,
    pub premint_contract: bool,
    pub premint: bool,
    pub auto_draw: bool,
    pub auto_claim: bool,
    pub created_at: i64,
    pub expires_at: i64,
    pub status: u8,
    pub status_string: String,
    pub winner_slot: u32,
    pub winner: Pubkey,
    pub prize_amount: u64,
    pub prize_type: u8,
    pub prize_type_string: String,
    pub claimed: bool,
}

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct RefundStatusView {
    pub paid: u64,
    pub refundable_amount: u64,
    pub expired: bool,
    pub can_claim: bool,
    pub status: u8,
}

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct RaffleResultView {
    pub winner_slot: u32,
    pub winner: Pubkey,
    pub status: u8,
    pub status_string: String,
    pub claimed: bool,
    pub collection: Pubkey,
    pub prize_amount: u64,
    pub prize_type: u8,
    pub prize_type_string: String,
}

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct RafflesLoadView {
    pub total_slots: Vec<u32>,
    pub sold_slots: Vec<u32>,
    pub status: Vec<u8>,
}

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct RafflesLoadDetailView {
    pub total_slots: Vec<u32>,
    pub sold_slots: Vec<u32>,
    pub max_slots_per_address: Vec<u32>,
    pub metadata_uri: Vec<String>,
    pub collection: Vec<Pubkey>,
    pub premint_contract: Vec<bool>,
    pub premint: Vec<bool>,
    pub auto_draw: Vec<bool>,
    pub auto_claim: Vec<bool>,
    pub created_at: Vec<i64>,
    pub expires_at: Vec<i64>,
    pub status: Vec<u8>,
    pub winner_slot: Vec<u32>,
    pub winner: Vec<Pubkey>,
    pub prize_amount: Vec<u64>,
    pub prize_type: Vec<u8>,
    pub claimed: Vec<bool>,
}

#[error_code]
pub enum RaffleError {
    #[msg("TotalSlotsZero")] 
    TotalSlotsZero,
    #[msg("MaxSlotsZero")] 
    MaxSlotsZero,
    #[msg("RaffleExists")] 
    RaffleExists,
    #[msg("RaffleNotFound")] 
    RaffleNotFound,
    #[msg("NotOpen")] 
    NotOpen,
    #[msg("RaffleExpired")] 
    RaffleExpired,
    #[msg("NoSlots")] 
    NoSlots,
    #[msg("OverCapacity")] 
    OverCapacity,
    #[msg("MaxSlotsPerAddress")] 
    MaxSlotsPerAddress,
    #[msg("SlotOutOfRange")] 
    SlotOutOfRange,
    #[msg("DuplicateSlot")] 
    DuplicateSlot,
    #[msg("SlotTaken")] 
    SlotTaken,
    #[msg("NothingPaid")] 
    NothingPaid,
    #[msg("NotAdmin")] 
    NotAdmin,
    #[msg("NotWinner")] 
    NotWinner,
    #[msg("NotDrawn")] 
    NotDrawn,
    #[msg("AlreadyClaimed")] 
    AlreadyClaimed,
    #[msg("BadStatus")] 
    BadStatus,
    #[msg("NotImplemented")] 
    NotImplemented,
}

#[program]
pub mod multi_raffle {
    use super::*;

    pub fn initialize_config(ctx: Context<InitializeConfig>, refund_fee_bps: u16) -> Result<()> {
        let cfg = &mut ctx.accounts.config;
        cfg.admin = ctx.accounts.admin.key();
        cfg.refund_fee_bps = refund_fee_bps;
        Ok(())
    }

    // =============================================================
    // Safe host/join (permit-based, not implemented yet)
    // =============================================================

    /// Safe host with off-chain pricing/signature (matches Solidity hostRaffle stub).
    pub fn host_raffle(
        _ctx: Context<HostRaffle>,
        _raffle_id: String,
        _total_slots: u32,
        _max_slots_per_address: u32,
        _metadata_uri: String,
        _collection: Pubkey,
        _premint_contract: bool,
        _premint: bool,
        _auto_claim: bool,
        _expires_at: i64,
        _signature: Vec<u8>,
    ) -> Result<()> {
        err!(RaffleError::NotImplemented)
    }

    /// Safe join with signature (matches Solidity joinRaffle stub).
    pub fn join_raffle(
        _ctx: Context<JoinRaffle>,
        _raffle_id: String,
        _slot_ids: Vec<u32>,
        _amount: u64,
        _token: Pubkey,
        _signature: Vec<u8>,
    ) -> Result<()> {
        err!(RaffleError::NotImplemented)
    }

    /// Safe host+join with signature (matches Solidity hostAndJoinRaffle stub).
    pub fn host_and_join_raffle(
        _ctx: Context<HostAndJoinRaffle>,
        _raffle_id: String,
        _total_slots: u32,
        _max_slots_per_address: u32,
        _metadata_uri: String,
        _collection: Pubkey,
        _premint_contract: bool,
        _premint: bool,
        _auto_claim: bool,
        _expires_at: i64,
        _slot_ids: Vec<u32>,
        _amount: u64,
        _token: Pubkey,
        _bonus_free_slots: u32,
        _signature: Vec<u8>,
    ) -> Result<()> {
        err!(RaffleError::NotImplemented)
    }

    pub fn unsafe_host_and_join_raffle(
        ctx: Context<UnsafeHostAndJoinRaffle>,
        raffle_id: String,
        total_slots: u32,
        max_slots_per_address: u32,
        metadata_uri: String,
        collection: Pubkey,
        premint_contract: bool,
        premint: bool,
        prize_type: u8,
        prize_amount: u64,
        auto_draw: bool,
        auto_claim: bool,
        expires_at: i64,
        slot_ids: Vec<u32>,
        amount: u64,
        _bonus_free_slots: u32,
    ) -> Result<()> {
        require!(total_slots > 0, RaffleError::TotalSlotsZero);
        require!(max_slots_per_address > 0, RaffleError::MaxSlotsZero);
        require!(max_slots_per_address <= MAX_SLOTS_PER_USER, RaffleError::MaxSlotsPerAddress);
        require!(raffle_id.len() <= MAX_RAFFLE_ID_LEN, RaffleError::RaffleExists);
        require!(metadata_uri.len() <= MAX_URI_LEN, RaffleError::RaffleExists);
        require!(!slot_ids.is_empty(), RaffleError::NoSlots);

        let clock = Clock::get()?;

        let raffle = &mut ctx.accounts.raffle;
        require!(raffle.raffle_id.is_empty(), RaffleError::RaffleExists);

        raffle.raffle_id = raffle_id;
        raffle.total_slots = total_slots;
        raffle.max_slots_per_address = max_slots_per_address;
        raffle.metadata_uri = metadata_uri;
        raffle.collection = collection;
        raffle.premint_contract = premint_contract;
        raffle.premint = premint;
        raffle.auto_draw = auto_draw;
        raffle.auto_claim = auto_claim;
        raffle.prize_type = prize_type;
        raffle.prize_amount = prize_amount;
        raffle.created_at = clock.unix_timestamp;
        raffle.expires_at = expires_at;
        raffle.status = MultiRaffleStatus::Open as u8;
        raffle.sold_slots = 0;
        raffle.winner_slot = 0;
        raffle.winner = Pubkey::default();
        raffle.claimed = false;
        
        // Manually derive bump since context doesn't implement Bumps trait
        let (_, raffle_bump) = Pubkey::find_program_address(
            &[RAFFLE_SEED, raffle.raffle_id.as_bytes()],
            ctx.program_id,
        );
        raffle.bump = raffle_bump;

        let slots_acc = &mut ctx.accounts.slots;
        slots_acc.raffle = raffle.key();
        slots_acc.total_slots = total_slots;
        slots_acc.slot_owners = vec![Pubkey::default(); total_slots as usize];

        let user = &mut ctx.accounts.user_raffle;
        user.raffle = raffle.key();
        user.user = ctx.accounts.payer.key();
        user.paid = 0;
        user.slots = Vec::new();

        handle_native_payment(
            &ctx.accounts.payer,
            &ctx.accounts.treasury,
            &ctx.accounts.system_program,
            user,
            amount,
        )?;

        if raffle.expires_at != 0 {
            require!(clock.unix_timestamp <= raffle.expires_at, RaffleError::RaffleExpired);
        }

        let requested = slot_ids.len() as u32;
        let remaining = raffle.total_slots.saturating_sub(raffle.sold_slots);
        require!(requested <= remaining, RaffleError::OverCapacity);

        _join_raffle_internal(
            raffle,
            slots_acc,
            user,
            &ctx.accounts.payer.key(),
            &slot_ids,
        )?;

        Ok(())
    }

    /// Unsafe host: create raffle without any off-chain signature.
    pub fn unsafe_host_raffle(
        ctx: Context<UnsafeHostRaffle>,
        raffle_id: String,
        total_slots: u32,
        max_slots_per_address: u32,
        metadata_uri: String,
        collection: Pubkey,
        premint_contract: bool,
        premint: bool,
        prize_type: u8,
        prize_amount: u64,
        auto_draw: bool,
        auto_claim: bool,
        expires_at: i64,
    ) -> Result<()> {
        require!(total_slots > 0, RaffleError::TotalSlotsZero);
        require!(max_slots_per_address > 0, RaffleError::MaxSlotsZero);
        require!(max_slots_per_address <= MAX_SLOTS_PER_USER, RaffleError::MaxSlotsPerAddress);
        require!(raffle_id.len() <= MAX_RAFFLE_ID_LEN, RaffleError::RaffleExists); // reuse error
        require!(metadata_uri.len() <= MAX_URI_LEN, RaffleError::RaffleExists);

        let clock = Clock::get()?;

        let raffle = &mut ctx.accounts.raffle;
        require!(raffle.raffle_id.is_empty(), RaffleError::RaffleExists);

        raffle.raffle_id = raffle_id;
        raffle.total_slots = total_slots;
        raffle.max_slots_per_address = max_slots_per_address;
        raffle.metadata_uri = metadata_uri;
        raffle.collection = collection;
        raffle.premint_contract = premint_contract;
        raffle.premint = premint;
        raffle.auto_draw = auto_draw;
        raffle.auto_claim = auto_claim;
        raffle.prize_type = prize_type;
        raffle.prize_amount = prize_amount;
        raffle.created_at = clock.unix_timestamp;
        raffle.expires_at = expires_at;
        raffle.status = MultiRaffleStatus::Open as u8;
        raffle.sold_slots = 0;
        raffle.winner_slot = 0;
        raffle.winner = Pubkey::default();
        raffle.claimed = false;
        
        // Manually derive bump since context doesn't implement Bumps trait
        let (_, raffle_bump) = Pubkey::find_program_address(
            &[RAFFLE_SEED, raffle.raffle_id.as_bytes()],
            ctx.program_id,
        );
        raffle.bump = raffle_bump;

        // Initialize slots owners as empty
        let slots = &mut ctx.accounts.slots;
        slots.raffle = raffle.key();
        slots.total_slots = total_slots;
        slots.slot_owners = vec![Pubkey::default(); total_slots as usize];

        Ok(())
    }

    /// Unsafe join: pay SOL and take explicit slots.
    pub fn unsafe_join_raffle(
        ctx: Context<UnsafeJoinRaffle>,
        slot_ids: Vec<u32>,
        amount: u64,
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

        // Transfer SOL into raffle treasury PDA and track paid amount
        handle_native_payment(
            &ctx.accounts.payer,
            &ctx.accounts.treasury,
            &ctx.accounts.system_program,
            user,
            amount,
        )?;

        // Initialize user_raffle account (always new since we use init)
        user.raffle = raffle.key();
        user.user = ctx.accounts.payer.key();

        _join_raffle_internal(
            raffle,
            slots_acc,
            user,
            &ctx.accounts.payer.key(),
            &slot_ids,
        )?;

        Ok(())
    }

    /// Manual draw for filled raffles (when auto_draw is false).
    /// Note: autoClaim is a config flag; if true, backend should auto-call claim after draw.
    pub fn draw_raffle(ctx: Context<DrawRaffle>) -> Result<()> {
        let raffle = &mut ctx.accounts.raffle;
        let slots = &ctx.accounts.slots;
        
        require!(raffle.status == MultiRaffleStatus::Filled as u8, RaffleError::BadStatus);
        _end_raffle_internal(raffle, slots)?;
        Ok(())
    }

    /// Claim the prize for a raffle where the caller is the recorded winner (matches Solidity claim).
    pub fn claim(ctx: Context<Claim>, is_sized_collection: bool) -> Result<()> {
        let raffle = &mut ctx.accounts.raffle;
        let caller = ctx.accounts.caller.key();

        require!(raffle.status == MultiRaffleStatus::Drawn as u8, RaffleError::NotDrawn);
        require!(!raffle.claimed, RaffleError::AlreadyClaimed);
        require!(raffle.winner == caller, RaffleError::NotWinner);

        // Manually derive bumps since Claim doesn't implement Bumps trait
        let raffle_key = raffle.key();
        let (_, prize_mint_bump) = Pubkey::find_program_address(
            &[PRIZE_MINT_SEED, raffle_key.as_ref()],
            ctx.program_id,
        );
        let (_, collection_authority_bump) = Pubkey::find_program_address(
            &[COLLECTION_AUTHORITY_SEED, raffle.collection.as_ref()],
            ctx.program_id,
        );

        // Call internal mint function with individual accounts
        _mint_prize_internal(
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

    pub fn withdraw_proceeds(ctx: Context<WithdrawProceeds>, amount: u64) -> Result<()> {
        let cfg = &ctx.accounts.config;
        require!(cfg.admin == ctx.accounts.admin.key(), RaffleError::NotAdmin);

        let treasury_info = ctx.accounts.treasury.to_account_info();
        require!(**treasury_info.lamports.borrow() >= amount, RaffleError::NothingPaid);

        let raffle_key = ctx.accounts.raffle.key();
        let (_, bump) = Pubkey::find_program_address(
            &[TREASURY_SEED, raffle_key.as_ref()],
            ctx.program_id,
        );

        let seeds: &[&[u8]] = &[TREASURY_SEED, raffle_key.as_ref(), &[bump]];
        let signer_seeds: &[&[&[u8]]] = &[seeds];
        let cpi_accounts = Transfer {
            from: ctx.accounts.treasury.to_account_info(),
            to: ctx.accounts.to.to_account_info(),
        };
        let cpi_ctx = CpiContext::new_with_signer(
            ctx.accounts.system_program.to_account_info(),
            cpi_accounts,
            signer_seeds,
        );
        system_program::transfer(cpi_ctx, amount)?;

        Ok(())
    }

    pub fn claim_refund(ctx: Context<ClaimRefund>) -> Result<()> {
        let clock = Clock::get()?;
        let cfg = &ctx.accounts.config;
        let raffle = &mut ctx.accounts.raffle;
        let user = &mut ctx.accounts.user_raffle;

        require!(raffle.expires_at != 0 && clock.unix_timestamp > raffle.expires_at, RaffleError::RaffleExpired);
        require!(raffle.sold_slots < raffle.total_slots, RaffleError::OverCapacity); // "RaffleFilled" equivalent
        require!(
            raffle.status == MultiRaffleStatus::Open as u8 ||
            raffle.status == MultiRaffleStatus::Cancelled as u8,
            RaffleError::BadStatus
        );

        let paid = user.paid;
        require!(paid > 0, RaffleError::NothingPaid);

        if raffle.status == MultiRaffleStatus::Open as u8 {
            raffle.status = MultiRaffleStatus::Cancelled as u8;
        }

        user.paid = 0;

        let refund_bps = 10_000u64.saturating_sub(cfg.refund_fee_bps as u64);
        let refund_amount = paid
            .saturating_mul(refund_bps)
            .checked_div(10_000)
            .ok_or(RaffleError::NothingPaid)?;

        let raffle_key = raffle.key();
        let (_, bump) = Pubkey::find_program_address(
            &[TREASURY_SEED, raffle_key.as_ref()],
            ctx.program_id,
        );
        let seeds: &[&[u8]] = &[TREASURY_SEED, raffle_key.as_ref(), &[bump]];
        let signer_seeds: &[&[&[u8]]] = &[seeds];

        let cpi_accounts = Transfer {
            from: ctx.accounts.treasury.to_account_info(),
            to: ctx.accounts.caller.to_account_info(),
        };
        let cpi_ctx = CpiContext::new_with_signer(
            ctx.accounts.system_program.to_account_info(),
            cpi_accounts,
            signer_seeds,
        );
        system_program::transfer(cpi_ctx, refund_amount)?;

        Ok(())
    }

    // =========================
    // TESTING - View helpers: removed on mainnet (mainnet use -direct account)
    // =========================

    /// Basic raffle load (legacy, kept for compatibility)
    pub fn get_raffle_load(
        ctx: Context<GetRaffleLoad>,
    ) -> Result<(u32, u32, u8)> {
        let raffle = &ctx.accounts.raffle;
        Ok((raffle.total_slots, raffle.sold_slots, raffle.status))
    }

    /// Comprehensive raffle information (matches Solidity getRaffleLoadDetail)
    pub fn get_raffle_load_detail(
        ctx: Context<GetRaffleLoad>,
    ) -> Result<RaffleDetailView> {
        let raffle = &ctx.accounts.raffle;
        let status_string = status_to_string(raffle.status);
        let prize_type_string = prize_type_to_string(raffle.prize_type);
        Ok(RaffleDetailView {
            total_slots: raffle.total_slots,
            sold_slots: raffle.sold_slots,
            max_slots_per_address: raffle.max_slots_per_address,
            metadata_uri: raffle.metadata_uri.clone(),
            collection: raffle.collection,
            premint_contract: raffle.premint_contract,
            premint: raffle.premint,
            auto_draw: raffle.auto_draw,
            auto_claim: raffle.auto_claim,
            created_at: raffle.created_at,
            expires_at: raffle.expires_at,
            status: raffle.status,
            status_string,
            winner_slot: raffle.winner_slot,
            winner: raffle.winner,
            prize_amount: raffle.prize_amount,
            prize_type: raffle.prize_type,
            prize_type_string,
            claimed: raffle.claimed,
        })
    }

    /// Get refund status for a user (matches Solidity getRefundStatus)
    pub fn get_refund_status(
        ctx: Context<GetRefundStatus>,
    ) -> Result<RefundStatusView> {
        let raffle = &ctx.accounts.raffle;
        let user_raffle = &ctx.accounts.user_raffle;
        let config = &ctx.accounts.config;
        let clock = Clock::get()?;

        let paid = user_raffle.paid;
        let expired = raffle.expires_at != 0 && clock.unix_timestamp > raffle.expires_at;
        let not_filled = raffle.sold_slots < raffle.total_slots;
        
        let refundable_amount = if paid > 0 {
            let refund_bps = 10_000u64.saturating_sub(config.refund_fee_bps as u64);
            paid.saturating_mul(refund_bps).checked_div(10_000).unwrap_or(0)
        } else {
            0
        };

        let can_claim = expired
            && not_filled
            && (raffle.status == MultiRaffleStatus::Open as u8 || raffle.status == MultiRaffleStatus::Cancelled as u8)
            && paid > 0;

        Ok(RefundStatusView {
            paid,
            refundable_amount,
            expired,
            can_claim,
            status: raffle.status,
        })
    }

    /// Winner and prize information (matches Solidity getRaffleResult)
    pub fn get_raffle_result(
        ctx: Context<GetRaffleLoad>,
    ) -> Result<RaffleResultView> {
        let raffle = &ctx.accounts.raffle;
        let status_string = status_to_string(raffle.status);
        let prize_type_string = prize_type_to_string(raffle.prize_type);
        Ok(RaffleResultView {
            winner_slot: raffle.winner_slot,
            winner: raffle.winner,
            status: raffle.status,
            status_string,
            claimed: raffle.claimed,
            collection: raffle.collection,
            prize_amount: raffle.prize_amount,
            prize_type: raffle.prize_type,
            prize_type_string,
        })
    }

    /// Admin function to update refund fee (matches Solidity setRefundFeeBps)
    pub fn set_refund_fee_bps(
        ctx: Context<SetRefundFeeBps>,
        new_fee_bps: u16,
    ) -> Result<()> {
        require!(new_fee_bps <= 10_000, RaffleError::BadStatus);
        let config = &mut ctx.accounts.config;
        config.refund_fee_bps = new_fee_bps;
        Ok(())
    }

    /// Batch basic load (matches Solidity getRafflesLoad)
    pub fn get_raffles_load<'info>(
        ctx: Context<'_, '_, 'info, 'info, GetRafflesLoadBatch>,
        raffle_ids: Vec<String>,
    ) -> Result<RafflesLoadView> {
        let mut total_slots = Vec::with_capacity(raffle_ids.len());
        let mut sold_slots = Vec::with_capacity(raffle_ids.len());
        let mut status = Vec::with_capacity(raffle_ids.len());

        let mut acc_iter = ctx.remaining_accounts.iter();
        for expected_id in raffle_ids.iter() {
            let acc_info = acc_iter.next().ok_or(RaffleError::RaffleNotFound)?;
            let raffle: Account<Raffle> = Account::try_from(acc_info)?;
            require!(raffle.raffle_id == *expected_id, RaffleError::RaffleNotFound);
            total_slots.push(raffle.total_slots);
            sold_slots.push(raffle.sold_slots);
            status.push(raffle.status);
        }

        Ok(RafflesLoadView {
            total_slots,
            sold_slots,
            status,
        })
    }

    /// Batch detailed load (matches Solidity getRafflesLoadDetail)
    pub fn get_raffles_load_detail<'info>(
        ctx: Context<'_, '_, 'info, 'info, GetRafflesLoadBatch>,
        raffle_ids: Vec<String>,
    ) -> Result<RafflesLoadDetailView> {
        let len = raffle_ids.len();
        let mut total_slots = Vec::with_capacity(len);
        let mut sold_slots = Vec::with_capacity(len);
        let mut max_slots_per_address = Vec::with_capacity(len);
        let mut metadata_uri = Vec::with_capacity(len);
        let mut collection = Vec::with_capacity(len);
        let mut premint_contract = Vec::with_capacity(len);
        let mut premint = Vec::with_capacity(len);
        let mut auto_draw = Vec::with_capacity(len);
        let mut auto_claim = Vec::with_capacity(len);
        let mut created_at = Vec::with_capacity(len);
        let mut expires_at = Vec::with_capacity(len);
        let mut status = Vec::with_capacity(len);
        let mut winner_slot = Vec::with_capacity(len);
        let mut winner = Vec::with_capacity(len);
        let mut prize_amount = Vec::with_capacity(len);
        let mut prize_type = Vec::with_capacity(len);
        let mut claimed = Vec::with_capacity(len);

        let mut acc_iter = ctx.remaining_accounts.iter();
        for expected_id in raffle_ids.iter() {
            let acc_info = acc_iter.next().ok_or(RaffleError::RaffleNotFound)?;
            let raffle: Account<Raffle> = Account::try_from(acc_info)?;
            require!(raffle.raffle_id == *expected_id, RaffleError::RaffleNotFound);

            total_slots.push(raffle.total_slots);
            sold_slots.push(raffle.sold_slots);
            max_slots_per_address.push(raffle.max_slots_per_address);
            metadata_uri.push(raffle.metadata_uri.clone());
            collection.push(raffle.collection);
            premint_contract.push(raffle.premint_contract);
            premint.push(raffle.premint);
            auto_draw.push(raffle.auto_draw);
            auto_claim.push(raffle.auto_claim);
            created_at.push(raffle.created_at);
            expires_at.push(raffle.expires_at);
            status.push(raffle.status);
            winner_slot.push(raffle.winner_slot);
            winner.push(raffle.winner);
            prize_amount.push(raffle.prize_amount);
            prize_type.push(raffle.prize_type);
            claimed.push(raffle.claimed);
        }

        Ok(RafflesLoadDetailView {
            total_slots,
            sold_slots,
            max_slots_per_address,
            metadata_uri,
            collection,
            premint_contract,
            premint,
            auto_draw,
            auto_claim,
            created_at,
            expires_at,
            status,
            winner_slot,
            winner,
            prize_amount,
            prize_type,
            claimed,
        })
    }

    pub fn get_user_raffle_slots(
        ctx: Context<GetUserRaffleSlots>,
    ) -> Result<Vec<u32>> {
        let user_raffle = &ctx.accounts.user_raffle;
        Ok(user_raffle.slots.clone())
    }

    pub fn check_slots_availability(
        ctx: Context<CheckSlotsAvailability>,
        slot_ids: Vec<u32>,
    ) -> Result<Vec<u32>> {
        let raffle = &ctx.accounts.raffle;
        let slots = &ctx.accounts.slots;
        let mut unavailable = Vec::new();

        for slot in slot_ids {
            if slot < 1 || slot > raffle.total_slots {
                unavailable.push(slot);
            } else {
                let idx = (slot - 1) as usize;
                if slots.slot_owners[idx] != Pubkey::default() {
                    unavailable.push(slot);
                }
            }
        }

        Ok(unavailable)
    }

    pub fn get_taken_slots_in_range(
        ctx: Context<GetSlotsInRange>,
        start_slot: u32,
        end_slot: u32,
    ) -> Result<Vec<u32>> {
        let raffle = &ctx.accounts.raffle;
        let slots = &ctx.accounts.slots;
        
        require!(start_slot >= 1 && end_slot >= start_slot && end_slot <= raffle.total_slots, RaffleError::SlotOutOfRange);

        let mut taken = Vec::new();
        for slot in start_slot..=end_slot {
            let idx = (slot - 1) as usize;
            if slots.slot_owners[idx] != Pubkey::default() {
                taken.push(slot);
            }
        }

        Ok(taken)
    }

    pub fn get_available_slots_in_range(
        ctx: Context<GetSlotsInRange>,
        start_slot: u32,
        end_slot: u32,
    ) -> Result<Vec<u32>> {
        let raffle = &ctx.accounts.raffle;
        let slots = &ctx.accounts.slots;
        
        require!(start_slot >= 1 && end_slot >= start_slot && end_slot <= raffle.total_slots, RaffleError::SlotOutOfRange);

        let mut available = Vec::new();
        for slot in start_slot..=end_slot {
            let idx = (slot - 1) as usize;
            if slots.slot_owners[idx] == Pubkey::default() {
                available.push(slot);
            }
        }

        Ok(available)
    }
}

/// Internal draw logic (matches Solidity _endRaffleInternal).
/// Called by draw_raffle or by join when autoDraw is true.
/// Note: autoClaim is stored as a config flag. On Solana, the backend should auto-call claim after draw if autoClaim is true.
/// (We can't mint during draw because DrawRaffle context doesn't have all the minting accounts.)
fn _end_raffle_internal(
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

    // autoClaim flag is set; backend should auto-call claim if true
    Ok(())
}

/// Internal mint prize logic (matches Solidity _mintPrize).
/// Called by claim instruction.
fn _mint_prize_internal<'info>(
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
fn handle_native_payment<'info>(
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

fn _join_raffle_internal(
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
            _end_raffle_internal(raffle, slots_acc)?;
        }
    }

    Ok(())
}

// =========================
// Account contexts
// =========================

#[derive(Accounts)]
pub struct InitializeConfig<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,
    #[account(
        init,
        payer = admin,
        space = 8 + Config::LEN,
        seeds = [CONFIG_SEED],
        bump,
    )]
    pub config: Account<'info, Config>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(raffle_id: String, total_slots: u32)]
pub struct UnsafeHostAndJoinRaffle<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    pub config: Account<'info, Config>,
    #[account(
        init,
        payer = payer,
        space = 8 + Raffle::LEN,
        seeds = [RAFFLE_SEED, raffle_id.as_bytes()],
        bump,
    )]
    pub raffle: Account<'info, Raffle>,
    #[account(
        init,
        payer = payer,
        space = 8 + RaffleSlots::space(total_slots),
        seeds = [SLOTS_SEED, raffle.key().as_ref()],
        bump,
    )]
    pub slots: Account<'info, RaffleSlots>,
    #[account(
        init,
        payer = payer,
        space = 8 + UserRaffle::space(),
        seeds = [USER_SEED, raffle.key().as_ref(), payer.key().as_ref()],
        bump,
    )]
    pub user_raffle: Account<'info, UserRaffle>,
    #[account(mut, seeds = [TREASURY_SEED, raffle.key().as_ref()], bump)]
    pub treasury: SystemAccount<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(raffle_id: String, total_slots: u32)]
pub struct UnsafeHostRaffle<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    pub config: Account<'info, Config>,
    #[account(
        init,
        payer = payer,
        space = 8 + Raffle::LEN,
        seeds = [RAFFLE_SEED, raffle_id.as_bytes()],
        bump,
    )]
    pub raffle: Account<'info, Raffle>,
    #[account(
        init,
        payer = payer,
        space = 8 + RaffleSlots::space(total_slots),
        seeds = [SLOTS_SEED, raffle.key().as_ref()],
        bump,
    )]
    pub slots: Account<'info, RaffleSlots>,
    #[account(mut, seeds = [TREASURY_SEED, raffle.key().as_ref()], bump)]
    pub treasury: SystemAccount<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
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
        space = 8 + UserRaffle::space(),
        seeds = [USER_SEED, raffle.key().as_ref(), payer.key().as_ref()],
        bump,
    )]
    pub user_raffle: Account<'info, UserRaffle>,
    #[account(mut, seeds = [TREASURY_SEED, raffle.key().as_ref()], bump)]
    pub treasury: SystemAccount<'info>,
    pub system_program: Program<'info, System>,
}

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

#[derive(Accounts)]
pub struct WithdrawProceeds<'info> {
    pub admin: Signer<'info>,
    pub config: Account<'info, Config>,
    pub raffle: Account<'info, Raffle>,
    #[account(mut, seeds = [TREASURY_SEED, raffle.key().as_ref()], bump)]
    pub treasury: SystemAccount<'info>,
    /// CHECK: arbitrary recipient
    #[account(mut)]
    pub to: UncheckedAccount<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct ClaimRefund<'info> {
    #[account(mut)]
    pub caller: Signer<'info>,
    pub config: Account<'info, Config>,
    #[account(mut, seeds = [RAFFLE_SEED, raffle.raffle_id.as_bytes()], bump = raffle.bump)]
    pub raffle: Account<'info, Raffle>,
    #[account(mut, seeds = [SLOTS_SEED, raffle.key().as_ref()], bump)]
    pub slots: Account<'info, RaffleSlots>,
    #[account(
        mut,
        seeds = [USER_SEED, raffle.key().as_ref(), caller.key().as_ref()],
        bump,
    )]
    pub user_raffle: Account<'info, UserRaffle>,
    #[account(mut, seeds = [TREASURY_SEED, raffle.key().as_ref()], bump)]
    pub treasury: SystemAccount<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct GetRaffleLoad<'info> {
    #[account(seeds = [RAFFLE_SEED, raffle.raffle_id.as_bytes()], bump = raffle.bump)]
    pub raffle: Account<'info, Raffle>,
}

#[derive(Accounts)]
pub struct GetUserRaffleSlots<'info> {
    #[account(seeds = [RAFFLE_SEED, raffle.raffle_id.as_bytes()], bump = raffle.bump)]
    pub raffle: Account<'info, Raffle>,
    #[account(seeds = [USER_SEED, raffle.key().as_ref(), user.key().as_ref()], bump)]
    pub user_raffle: Account<'info, UserRaffle>,
    /// CHECK: User pubkey for PDA derivation
    pub user: UncheckedAccount<'info>,
}

#[derive(Accounts)]
pub struct CheckSlotsAvailability<'info> {
    #[account(seeds = [RAFFLE_SEED, raffle.raffle_id.as_bytes()], bump = raffle.bump)]
    pub raffle: Account<'info, Raffle>,
    #[account(seeds = [SLOTS_SEED, raffle.key().as_ref()], bump)]
    pub slots: Account<'info, RaffleSlots>,
}

#[derive(Accounts)]
pub struct GetSlotsInRange<'info> {
    #[account(seeds = [RAFFLE_SEED, raffle.raffle_id.as_bytes()], bump = raffle.bump)]
    pub raffle: Account<'info, Raffle>,
    #[account(seeds = [SLOTS_SEED, raffle.key().as_ref()], bump)]
    pub slots: Account<'info, RaffleSlots>,
}

/// Batch views use only remaining_accounts for raffles; no fixed accounts here.
#[derive(Accounts)]
pub struct GetRafflesLoadBatch {}

// Safe (permit-based) variants currently stubbed out to match Solidity API.
#[derive(Accounts)]
pub struct HostRaffle {}

#[derive(Accounts)]
pub struct JoinRaffle {}

#[derive(Accounts)]
pub struct HostAndJoinRaffle {}

#[derive(Accounts)]
pub struct DrawRaffle<'info> {
    #[account(mut, seeds = [RAFFLE_SEED, raffle.raffle_id.as_bytes()], bump = raffle.bump)]
    pub raffle: Account<'info, Raffle>,
    #[account(seeds = [SLOTS_SEED, raffle.key().as_ref()], bump)]
    pub slots: Account<'info, RaffleSlots>,
}

#[derive(Accounts)]
pub struct GetRefundStatus<'info> {
    pub config: Account<'info, Config>,
    #[account(seeds = [RAFFLE_SEED, raffle.raffle_id.as_bytes()], bump = raffle.bump)]
    pub raffle: Account<'info, Raffle>,
    #[account(seeds = [USER_SEED, raffle.key().as_ref(), user.key().as_ref()], bump)]
    pub user_raffle: Account<'info, UserRaffle>,
    /// CHECK: User pubkey for PDA derivation
    pub user: UncheckedAccount<'info>,
}

#[derive(Accounts)]
pub struct SetRefundFeeBps<'info> {
    pub admin: Signer<'info>,
    #[account(mut, seeds = [CONFIG_SEED], bump, has_one = admin)]
    pub config: Account<'info, Config>,
}

// =========================
// NOTE: Safe (ed25519) routes
// =========================

// Future work: add host/join variants that verify an ed25519 signature
// via the instructions sysvar (similar to `initialize_raffle_with_permit`
// in the existing `rwa_raffle` program). For now we intentionally expose
// only the unsafe routes above so the backend can iterate quickly.
