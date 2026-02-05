// PDA seeds
pub const CONFIG_SEED: &[u8] = b"config";
pub const RAFFLE_SEED: &[u8] = b"raffle";
pub const SLOTS_SEED: &[u8] = b"slots";
pub const SLOT_SEED: &[u8] = b"slot";
pub const USER_SEED: &[u8] = b"user";
pub const TREASURY_SEED: &[u8] = b"treasury";
pub const COMMITMENT_DOMAIN: &[u8] = b"raffle-slot-commitment-v1";
pub const DRAW_DOMAIN: &[u8] = b"raffle-draw-v1";

// Limits
pub const MAX_RAFFLE_ID_LEN: usize = 64;
pub const MAX_URI_LEN: usize = 256;
pub const MAX_SLOTS_PER_USER: u32 = 1024;
