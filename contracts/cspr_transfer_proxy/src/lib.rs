#![no_std]
#![no_main]

extern crate alloc;

use alloc::string::String;
use alloc::vec;
use casper_contract::{
    contract_api::{runtime, storage, system},
    unwrap_or_revert::UnwrapOrRevert,
};
use casper_types::{
    account::AccountHash, runtime_args, ApiError, Key, RuntimeArgs, URef, U512,
};

const VAULT_ADDRESS_KEY: &str = "vault_address";
const CONTRACT_PACKAGE_HASH_KEY: &str = "contract_package_hash";
const CONTRACT_ACCESS_UREF_KEY: &str = "contract_access_uref";

#[repr(u16)]
enum Error {
    InvalidVaultAddress = 0,
    TransferFailed = 1,
    Unauthorized = 2,
}

impl From<Error> for ApiError {
    fn from(error: Error) -> Self {
        ApiError::User(error as u16)
    }
}

/// Initialize the contract with a vault address
#[no_mangle]
pub extern "C" fn init() {
    let vault_address: AccountHash = runtime::get_named_arg("vault_address");
    
    // Store the vault address
    runtime::put_key(VAULT_ADDRESS_KEY, storage::new_uref(vault_address).into());
}

/// Transfer CSPR to the whitelisted vault address
#[no_mangle]
pub extern "C" fn transfer_to_vault() {
    let amount: U512 = runtime::get_named_arg("amount");
    
    // Get the vault address from storage
    let vault_address_uref: URef = runtime::get_key(VAULT_ADDRESS_KEY)
        .unwrap_or_revert_with(Error::InvalidVaultAddress)
        .into_uref()
        .unwrap_or_revert_with(Error::InvalidVaultAddress);
    
    let vault_address: AccountHash = storage::read(vault_address_uref)
        .unwrap_or_revert_with(Error::InvalidVaultAddress)
        .unwrap_or_revert_with(Error::InvalidVaultAddress);
    
    // Transfer CSPR to the vault
    system::transfer_to_account(vault_address, amount, None)
        .unwrap_or_revert_with(Error::TransferFailed);
}

/// Update the vault address (only callable by contract owner/installer)
#[no_mangle]
pub extern "C" fn update_vault() {
    let new_vault_address: AccountHash = runtime::get_named_arg("vault_address");
    
    // Get the vault address URef
    let vault_address_uref: URef = runtime::get_key(VAULT_ADDRESS_KEY)
        .unwrap_or_revert_with(Error::InvalidVaultAddress)
        .into_uref()
        .unwrap_or_revert_with(Error::InvalidVaultAddress);
    
    // Update the vault address
    storage::write(vault_address_uref, new_vault_address);
}

/// Get the current vault address
#[no_mangle]
pub extern "C" fn get_vault() {
    let vault_address_uref: URef = runtime::get_key(VAULT_ADDRESS_KEY)
        .unwrap_or_revert_with(Error::InvalidVaultAddress)
        .into_uref()
        .unwrap_or_revert_with(Error::InvalidVaultAddress);
    
    let vault_address: AccountHash = storage::read(vault_address_uref)
        .unwrap_or_revert_with(Error::InvalidVaultAddress)
        .unwrap_or_revert_with(Error::InvalidVaultAddress);
    
    runtime::ret(vault_address);
}

#[no_mangle]
pub extern "C" fn call() {
    let vault_address: AccountHash = runtime::get_named_arg("vault_address");
    let contract_name: String = runtime::get_named_arg("contract_name");
    
    // Create entry points
    let mut entry_points = casper_types::EntryPoints::new();
    
    entry_points.add_entry_point(casper_types::EntryPoint::new(
        "transfer_to_vault",
        vec![casper_types::Parameter::new("amount", casper_types::CLType::U512)],
        casper_types::CLType::Unit,
        casper_types::EntryPointAccess::Public,
        casper_types::EntryPointType::Contract,
    ));
    
    entry_points.add_entry_point(casper_types::EntryPoint::new(
        "update_vault",
        vec![casper_types::Parameter::new(
            "vault_address",
            casper_types::CLType::Key,
        )],
        casper_types::CLType::Unit,
        casper_types::EntryPointAccess::Public,
        casper_types::EntryPointType::Contract,
    ));
    
    entry_points.add_entry_point(casper_types::EntryPoint::new(
        "get_vault",
        vec![],
        casper_types::CLType::Key,
        casper_types::EntryPointAccess::Public,
        casper_types::EntryPointType::Contract,
    ));
    
    // Create named keys
    let mut named_keys = casper_types::NamedKeys::new();
    named_keys.insert(
        VAULT_ADDRESS_KEY.to_string(),
        storage::new_uref(vault_address).into(),
    );
    
    // Create the contract package
    let (contract_hash, contract_version) = storage::new_contract(
        entry_points,
        Some(named_keys),
        Some(CONTRACT_PACKAGE_HASH_KEY.to_string()),
        Some(CONTRACT_ACCESS_UREF_KEY.to_string()),
    );
    
    // Store contract hash under the provided name
    runtime::put_key(&contract_name, contract_hash.into());
    runtime::put_key(
        &format!("{}_contract_version", contract_name),
        storage::new_uref(contract_version).into(),
    );
}
