// PDA seeds
pub const CONFIG_SEED: &[u8] = b"config";
pub const RAFFLE_SEED: &[u8] = b"raffle";
pub const SLOTS_SEED: &[u8] = b"slots";
pub const USER_SEED: &[u8] = b"user";
pub const TREASURY_SEED: &[u8] = b"treasury";

// Limits
pub const MAX_RAFFLE_ID_LEN: usize = 64;
pub const MAX_URI_LEN: usize = 256;
pub const MAX_SLOTS_PER_USER: u32 = 1024;
