#![no_std]
#![no_main]

extern crate alloc;

use alloc::{string::String, vec};
use casper_contract::{
    contract_api::{runtime, storage},
    unwrap_or_revert::UnwrapOrRevert,
};
use casper_types::{
    CLType, CLValue, EntryPoint, EntryPointAccess, EntryPointType, EntryPoints, Parameter,
};

const VALUE_KEY: &str = "value";
const CONTRACT_VERSION_KEY: &str = "version";

/// Initialize the contract with an initial value
#[no_mangle]
pub extern "C" fn init() {
    let value: u64 = runtime::get_named_arg("value");
    storage::new_dictionary(VALUE_KEY).unwrap_or_revert();
    runtime::put_key(VALUE_KEY, storage::new_uref(value).into());
}

/// Set the stored value
#[no_mangle]
pub extern "C" fn set_value() {
    let value: u64 = runtime::get_named_arg("value");
    let value_uref = runtime::get_key(VALUE_KEY)
        .unwrap_or_revert()
        .into_uref()
        .unwrap_or_revert();
    storage::write(value_uref, value);
}

/// Get the stored value
#[no_mangle]
pub extern "C" fn get_value() {
    let value_uref = runtime::get_key(VALUE_KEY)
        .unwrap_or_revert()
        .into_uref()
        .unwrap_or_revert();
    let value: u64 = storage::read(value_uref)
        .unwrap_or_revert()
        .unwrap_or_revert();
    runtime::ret(CLValue::from_t(value).unwrap_or_revert());
}

/// Install the contract
#[no_mangle]
pub extern "C" fn call() {
    let value: u64 = runtime::get_named_arg("value");

    // Create entry points
    let mut entry_points = EntryPoints::new();

    entry_points.add_entry_point(EntryPoint::new(
        "set_value",
        vec![Parameter::new("value", CLType::U64)],
        CLType::Unit,
        EntryPointAccess::Public,
        EntryPointType::Contract,
    ));

    entry_points.add_entry_point(EntryPoint::new(
        "get_value",
        vec![],
        CLType::U64,
        EntryPointAccess::Public,
        EntryPointType::Contract,
    ));

    // Store the contract
    let (contract_hash, contract_version) = storage::new_contract(
        entry_points,
        None,
        Some(String::from("ant_mint_test_package")),
        Some(String::from("ant_mint_test_access_uref")),
        None, // message topics
    );

    // Store initial value
    runtime::put_key(VALUE_KEY, storage::new_uref(value).into());

    // Store contract hash and version
    runtime::put_key("ant_mint_test_contract_hash", contract_hash.into());
    runtime::put_key(CONTRACT_VERSION_KEY, storage::new_uref(contract_version).into());
}
