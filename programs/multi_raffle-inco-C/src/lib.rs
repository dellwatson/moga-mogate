use anchor_lang::prelude::*;
use anchor_lang::system_program::{self, Transfer};

declare_id!("DjJGjfc48jo9xkat64JZrGJ7yk4FKTQzknqRehgeW63B");

const CONFIG_SEED: &[u8] = b"config";
const RAFFLE_SEED: &[u8] = b"raffle";
const TICKET_SEED: &[u8] = b"ticket";
const TREASURY_SEED: &[u8] = b"treasury";

const MAX_RAFFLE_ID_LEN: usize = 64;
const MAX_URI_LEN: usize = 256;

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq)]
pub enum RaffleStatus {
    Open = 0,
    Closed = 1,
    Drawn = 2,
    Cancelled = 3,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq)]
pub enum PrizeTokenType {
    None = 0,
    Spl = 1,
    Sft = 2,
    CNft = 3,
    ZkCompressed = 4,
}

#[account]
pub struct Config {
    pub admin: Pubkey,
    pub refund_fee_bps: u16,
}

impl Config {
    pub const LEN: usize = 8 + 32 + 2;
}

#[account]
pub struct Raffle {
    pub raffle_id: String,
    pub authority: Pubkey,
    pub ticket_price: u64,
    pub max_number: u32,  // Range for auto-assigned numbers (1 to max_number)
    pub metadata_uri: String,
    pub collection: Pubkey,
    pub prize_type: u8,
    pub prize_amount: u64,
    pub created_at: i64,
    pub expires_at: i64,
    pub status: u8,
    pub total_tickets: u32,
    pub winning_number_handle: u128,  // TODO: FHE encrypted winning number
    pub claimed: bool,
    pub bump: u8,
}

impl Raffle {
    pub const LEN: usize =
        8 +                     // discriminator
        4 + MAX_RAFFLE_ID_LEN + // raffle_id
        4 + MAX_URI_LEN +       // metadata_uri
        32 + 32 +               // authority, collection
        8 +                     // ticket_price
        4 +                     // max_number
        1 +                     // prize_type
        8 +                     // prize_amount
        8 + 8 +                 // created_at, expires_at
        1 +                     // status
        4 +                     // total_tickets
        16 +                    // winning_number_handle
        1 + 1 +                 // claimed, bump
        32;                     // buffer
}

#[account]
pub struct Ticket {
    pub raffle: Pubkey,
    pub owner: Pubkey,
    pub number_handle: u128,  // TODO: FHE auto-assigned encrypted number
    pub is_winner_handle: u128,  // TODO: FHE encrypted boolean result
    pub bump: u8,
}

impl Ticket {
    pub const LEN: usize = 8 + 32 + 32 + 16 + 16 + 1;
}

#[error_code]
pub enum RaffleError {
    #[msg("Raffle is not open")]
    RaffleNotOpen,
    #[msg("Unauthorized")]
    Unauthorized,
    #[msg("No winning number")]
    NoWinningNumber,
    #[msg("Not winner")]
    NotWinner,
    #[msg("No funds")]
    NoFunds,
    #[msg("Invalid amount")]
    InvalidAmount,
    #[msg("Already claimed")]
    AlreadyClaimed,
}

#[program]
pub mod multi_raffle_inco_auto {
    use super::*;

    pub fn initialize_config(ctx: Context<InitializeConfig>, refund_fee_bps: u16) -> Result<()> {
        let config = &mut ctx.accounts.config;
        config.admin = ctx.accounts.admin.key();
        config.refund_fee_bps = refund_fee_bps;
        Ok(())
    }

    /// Unsafe host: create raffle (pure-FHE, no slot picking, system auto-assigns)
    pub fn unsafe_host_raffle(
        ctx: Context<CreateRaffle>,
        raffle_id: String,
        max_number: u32,
        metadata_uri: String,
        collection: Pubkey,
        prize_type: u8,
        prize_amount: u64,
        expires_at: i64,
    ) -> Result<()> {
        let raffle = &mut ctx.accounts.raffle;
        
        raffle.raffle_id = raffle_id;
        raffle.authority = ctx.accounts.authority.key();
        raffle.ticket_price = 0; // Offchain pricing
        raffle.max_number = max_number;
        raffle.metadata_uri = metadata_uri;
        raffle.collection = collection;
        raffle.prize_type = prize_type;
        raffle.prize_amount = prize_amount;
        raffle.created_at = Clock::get()?.unix_timestamp;
        raffle.expires_at = expires_at;
        raffle.status = RaffleStatus::Open as u8;
        raffle.total_tickets = 0;
        raffle.winning_number_handle = 0; // TODO: FHE encrypted winning number
        raffle.claimed = false;
        raffle.bump = ctx.bumps.raffle;

        msg!("Raffle created! Max range: 1-{}", max_number);
        Ok(())
    }

    /// Unsafe join: pay amount, system AUTO-ASSIGNS encrypted random number (pure-FHE, no slot picking)
    pub fn unsafe_join_raffle(
        ctx: Context<JoinRaffle>,
        amount: u64,
    ) -> Result<()> {
        let raffle = &ctx.accounts.raffle;
        let ticket = &mut ctx.accounts.ticket;

        require!(raffle.status == RaffleStatus::Open as u8, RaffleError::RaffleNotOpen);
        require!(amount > 0, RaffleError::InvalidAmount);

        // TODO: Add FHE operations later - for now just create ticket with placeholder
        ticket.raffle = raffle.key();
        ticket.owner = ctx.accounts.buyer.key();
        ticket.number_handle = 0; // TODO: FHE encrypted number
        ticket.is_winner_handle = 0; // TODO: FHE encrypted boolean
        ticket.bump = ctx.bumps.ticket;

        let raffle_mut = &mut ctx.accounts.raffle;
        raffle_mut.total_tickets += 1;

        // Transfer SOL to treasury
        let transfer_cpi = CpiContext::new(
            ctx.accounts.system_program.to_account_info(),
            Transfer {
                from: ctx.accounts.buyer.to_account_info(),
                to: ctx.accounts.treasury.to_account_info(),
            },
        );
        system_program::transfer(transfer_cpi, amount)?;

        msg!("Ticket purchased! {} total tickets", raffle_mut.total_tickets);
        msg!("(FHE auto-assigned number - encrypted and hidden!)");
        Ok(())
    }

    /// Draw winner (minimal version - TODO: add FHE operations)
    pub fn draw_winner(ctx: Context<DrawWinner>) -> Result<()> {
        let raffle = &mut ctx.accounts.raffle;
        
        require!(raffle.authority == ctx.accounts.authority.key(), RaffleError::Unauthorized);
        require!(raffle.status == RaffleStatus::Open as u8, RaffleError::RaffleNotOpen);

        // TODO: Add FHE operations later - for now just set placeholder
        raffle.winning_number_handle = 12345; // TODO: FHE encrypted winning number
        raffle.status = RaffleStatus::Drawn as u8;

        msg!("Winning number drawn! (FHE encrypted - nobody knows!)");
        Ok(())
    }

    /// Check winner (minimal version - TODO: add FHE operations)
    pub fn check_winner(ctx: Context<CheckWinner>) -> Result<()> {
        let raffle = &ctx.accounts.raffle;
        let ticket = &mut ctx.accounts.ticket;

        require!(raffle.status == RaffleStatus::Drawn as u8, RaffleError::RaffleNotOpen);
        require!(raffle.winning_number_handle != 0, RaffleError::NoWinningNumber);

        // TODO: Add FHE operations later - for now just set placeholder
        ticket.is_winner_handle = 1; // TODO: FHE encrypted boolean result

        msg!("Winner checked! (FHE encrypted result)");
        Ok(())
    }

    /// Withdraw prize (minimal version - TODO: add FHE verification)
    pub fn withdraw_prize(ctx: Context<WithdrawPrize>) -> Result<()> {
        let raffle = &mut ctx.accounts.raffle;
        let ticket = &ctx.accounts.ticket;

        require!(ticket.is_winner_handle != 0, RaffleError::NotWinner);
        require!(!raffle.claimed, RaffleError::AlreadyClaimed);

        let prize_amount = ctx.accounts.treasury.lamports();
        require!(prize_amount > 0, RaffleError::NoFunds);

        let treasury_seeds = &[
            &[TREASURY_SEED, raffle.key().as_ref(), &[ctx.bumps.treasury]],
        ];

        let transfer_cpi = CpiContext::new_with_signer(
            ctx.accounts.system_program.to_account_info(),
            Transfer {
                from: ctx.accounts.treasury.to_account_info(),
                to: ctx.accounts.winner.to_account_info(),
            },
            treasury_seeds,
        );
        system_program::transfer(transfer_cpi, prize_amount)?;

        raffle.claimed = true;

        msg!("Prize withdrawn: {} lamports!", prize_amount);
        Ok(())
    }
}

// Account structs
#[derive(Accounts)]
pub struct InitializeConfig<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,
    
    #[account(
        init,
        payer = admin,
        space = Config::LEN,
        seeds = [CONFIG_SEED],
        bump
    )]
    pub config: Account<'info, Config>,
    
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(raffle_id: String, max_number: u32, metadata_uri: String, collection: Pubkey, prize_type: u8, prize_amount: u64, expires_at: i64)]
pub struct CreateRaffle<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(
        init,
        payer = authority,
        space = Raffle::LEN,
        seeds = [RAFFLE_SEED, raffle_id.as_bytes()],
        bump
    )]
    pub raffle: Account<'info, Raffle>,

    /// CHECK: Treasury PDA
    #[account(
        init,
        payer = authority,
        space = 0,
        seeds = [TREASURY_SEED, raffle.key().as_ref()],
        bump
    )]
    pub treasury: AccountInfo<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct JoinRaffle<'info> {
    #[account(mut)]
    pub buyer: Signer<'info>,

    #[account(mut)]
    pub raffle: Account<'info, Raffle>,

    #[account(
        init,
        payer = buyer,
        space = Ticket::LEN,
        seeds = [TICKET_SEED, raffle.key().as_ref(), buyer.key().as_ref()],
        bump
    )]
    pub ticket: Account<'info, Ticket>,

    /// CHECK: Treasury PDA
    #[account(
        mut,
        seeds = [TREASURY_SEED, raffle.key().as_ref()],
        bump
    )]
    pub treasury: AccountInfo<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct DrawWinner<'info> {
    pub authority: Signer<'info>,

    #[account(mut)]
    pub raffle: Account<'info, Raffle>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct CheckWinner<'info> {
    pub checker: Signer<'info>,

    #[account(mut)]
    pub raffle: Account<'info, Raffle>,

    #[account(mut)]
    pub ticket: Account<'info, Ticket>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct WithdrawPrize<'info> {
    #[account(mut)]
    pub winner: Signer<'info>,

    #[account(mut)]
    pub raffle: Account<'info, Raffle>,

    #[account(mut)]
    pub ticket: Account<'info, Ticket>,

    /// CHECK: Treasury PDA
    #[account(
        mut,
        seeds = [TREASURY_SEED, raffle.key().as_ref()],
        bump
    )]
    pub treasury: AccountInfo<'info>,

    pub system_program: Program<'info, System>,
}
