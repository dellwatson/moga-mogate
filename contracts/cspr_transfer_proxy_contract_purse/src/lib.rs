#![no_std]
#![no_main]

extern crate alloc;

use casper_contract::{
    contract_api::{runtime, storage, system},
    unwrap_or_revert::UnwrapOrRevert,
};
use casper_types::{
    runtime_args, ApiError, CLType, CLValue, EntryPointAccess, EntryPointType, EntryPoints,
    Parameter, URef, U512,
};
use casper_types::contracts::EntryPoint;

const CONTRACT_NAME: &str = "cspr_transfer_contract_purse";
const CONTRACT_PURSE_KEY: &str = "contract_purse";

#[repr(u16)]
enum Error {
    ContractPurseMissing = 1,
    TransferFailed = 2,
    BalanceReadFailed = 3,
}

impl From<Error> for ApiError {
    fn from(error: Error) -> Self {
        ApiError::User(error as u16)
    }
}

fn get_contract_purse() -> URef {
    runtime::get_key(CONTRACT_PURSE_KEY)
        .unwrap_or_revert()
        .into_uref()
        .unwrap_or_revert()
}

#[no_mangle]
pub extern "C" fn init() {
    let purse = system::create_purse();
    runtime::put_key(CONTRACT_PURSE_KEY, purse.into());
}

/// Deposit CSPR from a caller-controlled purse into the contract's purse.
///
/// NOTE: For testing you can pass your main purse URef here, but that
/// exposes full control to this contract. Use only with keys you trust.
#[no_mangle]
pub extern "C" fn deposit_from_purse() {
    let amount: U512 = runtime::get_named_arg("amount");
    let source_purse: URef = runtime::get_named_arg("source_purse");

    let contract_purse = get_contract_purse();

    system::transfer_from_purse_to_purse(source_purse, contract_purse, amount, None)
        .unwrap_or_revert_with(Error::TransferFailed);
}

/// Return the current balance of the contract's purse.
#[no_mangle]
pub extern "C" fn get_purse_balance() {
    let purse = get_contract_purse();
    let maybe_balance = system::get_balance(purse).unwrap_or_revert_with(Error::BalanceReadFailed);
    let balance = maybe_balance.unwrap_or_default();

    let cl_value = CLValue::from_t(balance).unwrap_or_revert();
    runtime::ret(cl_value);
}

fn get_entry_points() -> EntryPoints {
    let mut entry_points = EntryPoints::new();

    entry_points.add_entry_point(
        EntryPoint::new(
            "init",
            vec![],
            CLType::Unit,
            EntryPointAccess::Public,
            EntryPointType::Contract,
        )
        .into(),
    );

    entry_points.add_entry_point(
        EntryPoint::new(
            "deposit_from_purse",
            vec![
                Parameter::new("amount", CLType::U512),
                Parameter::new("source_purse", CLType::URef),
            ],
            CLType::Unit,
            EntryPointAccess::Public,
            EntryPointType::Contract,
        )
        .into(),
    );

    entry_points.add_entry_point(
        EntryPoint::new(
            "get_purse_balance",
            vec![],
            CLType::U512,
            EntryPointAccess::Public,
            EntryPointType::Contract,
        )
        .into(),
    );

    entry_points
}

#[no_mangle]
pub extern "C" fn call() {
    let entry_points = get_entry_points();
    let (contract_hash, _version) = storage::new_contract(
        entry_points,
        None,
        Some(CONTRACT_NAME.to_string()),
        None,
        None,
    );

    runtime::put_key(CONTRACT_NAME, contract_hash.into());
    runtime::call_contract::<()>(contract_hash, "init", runtime_args! {});
}
