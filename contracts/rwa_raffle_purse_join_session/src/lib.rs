#![no_std]
#![no_main]

extern crate alloc;

use alloc::{string::String, vec::Vec};
use casper_contract::{
    contract_api::{account, runtime, system},
    unwrap_or_revert::UnwrapOrRevert,
};
use casper_types::{runtime_args, ContractHash, U512};

/// Session code for paid join using a throw-away purse (Scenario 1 from docs)
///
/// Named args:
/// - amount: U512 (total CSPR to pay for slots)
/// - raffle_contract: ContractHash (rwa_raffle_purse contract hash)
/// - raffle_id: String
/// - slot_ids: List<u64>
#[no_mangle]
pub extern "C" fn call() {
    let amount: U512 = runtime::get_named_arg("amount");
    let raffle_contract: ContractHash = runtime::get_named_arg("raffle_contract");
    let raffle_id: String = runtime::get_named_arg("raffle_id");
    let slot_ids: Vec<u64> = runtime::get_named_arg("slot_ids");

    // 1) Create a one-time purse
    let new_purse = system::create_purse();

    // 2) Move funds from caller's main purse into the new purse
    let main_purse = account::get_main_purse();
    system::transfer_from_purse_to_purse(main_purse, new_purse, amount, None)
        .unwrap_or_revert();

    // 3) Call the raffle contract's join_raffle, passing the new purse as source_purse
    runtime::call_contract::<()>(
        raffle_contract,
        "join_raffle",
        runtime_args! {
            "raffle_id" => raffle_id,
            "slot_ids" => slot_ids,
            "source_purse" => new_purse,
        },
    );
}
