use anchor_lang::prelude::*;

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
