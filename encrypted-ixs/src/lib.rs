// Encrypted instructions crate (stub). Actual circuits will be added later.
// Keeping this minimal ensures the workspace builds before integrating Arcium macros.
use arcis_imports::*;

#[encrypted]
mod circuits {
    use arcis_imports::*;

    /// Returns a uniform random winner index in [1..=required_tickets].
    /// Uses 64 random bits from ArcisRNG and rejection via modulo.
    #[instruction]
    pub fn draw(required_tickets: u64) -> u64 {
        // Build a random 64-bit value from random bits
        let mut rnd: u64 = 0;
        for i in 0..64 {
            if ArcisRNG::bool() {
                rnd |= 1u64 << i;
            }
        }
        let winner = 1u64 + (rnd % required_tickets);
        winner.reveal()
    }
}
