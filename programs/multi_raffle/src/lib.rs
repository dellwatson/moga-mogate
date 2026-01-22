use anchor_lang::prelude::*;
use anchor_lang::system_program::{self, Transfer};

// NOTE: placeholder program id; replace with your generated keypair and update Anchor.toml
declare_id!("MultiRaffl1111111111111111111111111111111111");

const CONFIG_SEED: &[u8] = b"config";
const RAFFLE_SEED: &[u8] = b"raffle";
const SLOTS_SEED: &[u8] = b"slots";
const USER_SEED: &[u8] = b"user";
const TREASURY_SEED: &[u8] = b"treasury";

const MAX_RAFFLE_ID_LEN: usize = 64;
const MAX_URI_LEN: usize = 256;
const MAX_SLOTS_PER_USER: u32 = 1024;

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq)]
pub enum MultiRaffleStatus {
    Open = 0,
    Filled = 1,
    Drawn = 2,
    Cancelled = 3,
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
    pub auto_claim: bool,
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
        1 + 1 + 1 +             // premint_contract, premint, auto_claim
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

    pub fn unsafe_host_and_join_raffle(
        ctx: Context<UnsafeHostAndJoinRaffle>,
        raffle_id: String,
        total_slots: u32,
        max_slots_per_address: u32,
        metadata_uri: String,
        collection: Pubkey,
        premint_contract: bool,
        premint: bool,
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
        raffle.auto_claim = auto_claim;
        raffle.created_at = clock.unix_timestamp;
        raffle.expires_at = expires_at;
        raffle.status = MultiRaffleStatus::Open as u8;
        raffle.sold_slots = 0;
        raffle.winner_slot = 0;
        raffle.winner = Pubkey::default();
        raffle.claimed = false;
        raffle.bump = ctx.bumps.raffle;

        let slots_acc = &mut ctx.accounts.slots;
        slots_acc.raffle = raffle.key();
        slots_acc.total_slots = total_slots;
        slots_acc.slot_owners = vec![Pubkey::default(); total_slots as usize];

        let user = &mut ctx.accounts.user_raffle;
        user.raffle = raffle.key();
        user.user = ctx.accounts.payer.key();
        user.paid = 0;
        user.slots = Vec::new();

        if amount > 0 {
            let cpi_accounts = Transfer {
                from: ctx.accounts.payer.to_account_info(),
                to: ctx.accounts.treasury.to_account_info(),
            };
            let cpi_ctx = CpiContext::new(ctx.accounts.system_program.to_account_info(), cpi_accounts);
            system_program::transfer(cpi_ctx, amount)?;
            user.paid = user.paid.saturating_add(amount);
        }

        if raffle.expires_at != 0 {
            require!(clock.unix_timestamp <= raffle.expires_at, RaffleError::RaffleExpired);
        }

        let requested = slot_ids.len() as u32;
        let remaining = raffle.total_slots.saturating_sub(raffle.sold_slots);
        require!(requested <= remaining, RaffleError::OverCapacity);

        for (i, slot) in slot_ids.iter().enumerate() {
            require!(*slot >= 1 && *slot <= raffle.total_slots, RaffleError::SlotOutOfRange);
            for j in 0..i {
                require!(slot_ids[j] != *slot, RaffleError::DuplicateSlot);
            }
            let idx = (*slot - 1) as usize;
            require!(slots_acc.slot_owners[idx] == Pubkey::default(), RaffleError::SlotTaken);
        }

        let current = user.slots.len() as u32;
        require!(current + requested <= raffle.max_slots_per_address, RaffleError::MaxSlotsPerAddress);

        for slot in slot_ids.iter() {
            let idx = (*slot - 1) as usize;
            slots_acc.slot_owners[idx] = ctx.accounts.payer.key();
            user.slots.push(*slot);
        }

        raffle.sold_slots = raffle.sold_slots.saturating_add(requested);

        if raffle.sold_slots == raffle.total_slots {
            raffle.status = MultiRaffleStatus::Filled as u8;
            _end_raffle_internal(raffle, slots_acc)?;
        }

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
        raffle.auto_claim = auto_claim;
        raffle.created_at = clock.unix_timestamp;
        raffle.expires_at = expires_at;
        raffle.status = MultiRaffleStatus::Open as u8;
        raffle.sold_slots = 0;
        raffle.winner_slot = 0;
        raffle.winner = Pubkey::default();
        raffle.claimed = false;
        raffle.bump = ctx.bumps.raffle;

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

        // Transfer SOL into raffle treasury PDA and track paid amount
        if amount > 0 {
            let cpi_accounts = Transfer {
                from: ctx.accounts.payer.to_account_info(),
                to: ctx.accounts.treasury.to_account_info(),
            };
            let cpi_ctx = CpiContext::new(ctx.accounts.system_program.to_account_info(), cpi_accounts);
            system_program::transfer(cpi_ctx, amount)?;
            user.paid = user.paid.saturating_add(amount);
        }

        // First-time join: set keys
        if user.raffle == Pubkey::default() {
            user.raffle = raffle.key();
            user.user = ctx.accounts.payer.key();
        }

        // Assign slots
        for slot in slot_ids.iter() {
            let idx = (*slot - 1) as usize;
            slots_acc.slot_owners[idx] = ctx.accounts.payer.key();
            user.slots.push(*slot);
        }

        raffle.sold_slots = raffle.sold_slots.saturating_add(requested);

        if raffle.sold_slots == raffle.total_slots {
            raffle.status = MultiRaffleStatus::Filled as u8;
            _end_raffle_internal(raffle, slots_acc)?;
        }

        Ok(())
    }

    pub fn claim(ctx: Context<Claim>) -> Result<()> {
        let raffle = &mut ctx.accounts.raffle;
        let caller = ctx.accounts.caller.key();

        require!(raffle.status == MultiRaffleStatus::Drawn as u8, RaffleError::NotDrawn);
        require!(!raffle.claimed, RaffleError::AlreadyClaimed);
        require!(raffle.winner == caller, RaffleError::NotWinner);

        // Prize minting is chain-specific; integrate with your NFT mint program here.
        // For now this is a no-op placeholder.
        raffle.claimed = true;
        Ok(())
    }

    pub fn withdraw_proceeds(ctx: Context<WithdrawProceeds>, amount: u64) -> Result<()> {
        let cfg = &ctx.accounts.config;
        require!(cfg.admin == ctx.accounts.admin.key(), RaffleError::NotAdmin);

        let treasury_info = ctx.accounts.treasury.to_account_info();
        require!(**treasury_info.lamports.borrow() >= amount, RaffleError::NothingPaid);

        let bump = ctx.bumps.treasury;
        let raffle_key = ctx.accounts.raffle.key();

        let seeds: &[&[u8]] = &[TREASURY_SEED, raffle_key.as_ref(), &[bump]];
        let cpi_accounts = Transfer {
            from: ctx.accounts.treasury.to_account_info(),
            to: ctx.accounts.to.to_account_info(),
        };
        let cpi_ctx = CpiContext::new_with_signer(
            ctx.accounts.system_program.to_account_info(),
            cpi_accounts,
            &[seeds],
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

        let bump = ctx.bumps.treasury;
        let raffle_key = raffle.key();
        let seeds: &[&[u8]] = &[TREASURY_SEED, raffle_key.as_ref(), &[bump]];

        let cpi_accounts = Transfer {
            from: ctx.accounts.treasury.to_account_info(),
            to: ctx.accounts.caller.to_account_info(),
        };
        let cpi_ctx = CpiContext::new_with_signer(
            ctx.accounts.system_program.to_account_info(),
            cpi_accounts,
            &[seeds],
        );
        system_program::transfer(cpi_ctx, refund_amount)?;

        Ok(())
    }
}

fn _end_raffle_internal(raffle: &mut Account<Raffle>, slots: &Account<RaffleSlots>) -> Result<()> {
    require!(
        raffle.status == MultiRaffleStatus::Filled as u8 || raffle.status == MultiRaffleStatus::Open as u8,
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
#[instruction(raffle_id: String, total_slots: u32, max_slots_per_address: u32)]
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
    #[account(
        init,
        payer = payer,
        seeds = [TREASURY_SEED, raffle.key().as_ref()],
        bump,
        space = 8,
    )]
    pub treasury: SystemAccount<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(raffle_id: String, total_slots: u32, max_slots_per_address: u32)]
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
    #[account(
        init,
        payer = payer,
        space = 8 + UserRaffle::space(),
        seeds = [USER_SEED, raffle.key().as_ref(), payer.key().as_ref()],
        bump,
    )]
    pub user_raffle: Account<'info, UserRaffle>,
    #[account(
        init,
        payer = payer,
        seeds = [TREASURY_SEED, raffle.key().as_ref()],
        bump,
        space = 8, // system-owned lamports-only account
    )]
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
        init_if_needed,
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
pub struct Claim<'info> {
    #[account(mut)]
    pub caller: Signer<'info>,
    #[account(mut, seeds = [RAFFLE_SEED, raffle.raffle_id.as_bytes()], bump = raffle.bump)]
    pub raffle: Account<'info, Raffle>,
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

// =========================
// NOTE: Safe (ed25519) routes
// =========================

// Future work: add host/join variants that verify an ed25519 signature
// via the instructions sysvar (similar to `initialize_raffle_with_permit`
// in the existing `rwa_raffle` program). For now we intentionally expose
// only the unsafe routes above so the backend can iterate quickly.
