#![cfg_attr(not(test), no_std)]
#![cfg_attr(not(test), no_main)]

extern crate alloc;

use odra::prelude::*;

/// Minimal Odra test contract mirroring `ant_mint_test` behavior:
/// stores a single `u64` value that can be set and read.
#[odra::module]
pub struct AntMintTest {
    value: Var<u64>,
}

#[odra::module]
impl AntMintTest {
    /// Optional initializer.
    pub fn init(&mut self, value: u64) {
        self.value.set(value);
    }

    /// Set the stored value.
    pub fn set_value(&mut self, value: u64) {
        self.value.set(value);
    }

    /// Read the stored value.
    pub fn get_value(&self) -> u64 {
        self.value.get_or_default()
    }
}
