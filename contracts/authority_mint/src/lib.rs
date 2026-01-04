#![no_std]
#![no_main]

extern crate alloc;

use alloc::{string::{String, ToString}, vec, vec::Vec, collections::BTreeMap};
use casper_contract::{
    contract_api::{runtime, storage},
    unwrap_or_revert::UnwrapOrRevert,
};
use casper_types::{
    contracts::{NamedKeys, ContractHash}, runtime_args, CLType, CLValue, EntryPointAccess, EntryPoints, Key, URef,
    Parameter, EntityEntryPoint as EntryPoint, EntryPointType, EntryPointPayment,
    contract_messages::MessageTopicOperation,
};

const ALLOWED_COLLECTIONS_KEY: &str = "allowed_collections";
const MINT_COUNTER_KEY: &str = "mint_counter";

/// Initialize the authority mint contract
#[no_mangle]
pub extern "C" fn init() {
    let allowed_collections_uref: URef = storage::new_uref(Vec::<ContractHash>::new());
    let mint_counter_uref: URef = storage::new_uref(0u64);

    runtime::put_key(ALLOWED_COLLECTIONS_KEY, allowed_collections_uref.into());
    runtime::put_key(MINT_COUNTER_KEY, mint_counter_uref.into());
}

/// Allow a collection contract to be minted by this authority
#[no_mangle]
pub extern "C" fn allow_collection() {
    let collection_hash: ContractHash = runtime::get_named_arg("collection_hash");
    
    let allowed_collections_uref = runtime::get_key(ALLOWED_COLLECTIONS_KEY)
        .unwrap_or_revert()
        .into_uref()
        .unwrap_or_revert();
    
    let mut allowed: Vec<ContractHash> = storage::read(allowed_collections_uref)
        .unwrap_or_revert()
        .unwrap_or_default();
    
    if !allowed.contains(&collection_hash) {
        allowed.push(collection_hash);
        storage::write(allowed_collections_uref, allowed);
    }
}

/// Disallow a collection contract
#[no_mangle]
pub extern "C" fn disallow_collection() {
    let collection_hash: ContractHash = runtime::get_named_arg("collection_hash");
    
    let allowed_collections_uref = runtime::get_key(ALLOWED_COLLECTIONS_KEY)
        .unwrap_or_revert()
        .into_uref()
        .unwrap_or_revert();
    
    let mut allowed: Vec<ContractHash> = storage::read(allowed_collections_uref)
        .unwrap_or_revert()
        .unwrap_or_default();
    
    allowed.retain(|&h| h != collection_hash);
    storage::write(allowed_collections_uref, allowed);
}

/// Check if a collection is allowed
#[no_mangle]
pub extern "C" fn is_collection_allowed() {
    let collection_hash: ContractHash = runtime::get_named_arg("collection_hash");
    
    let allowed_collections_uref = runtime::get_key(ALLOWED_COLLECTIONS_KEY)
        .unwrap_or_revert()
        .into_uref()
        .unwrap_or_revert();
    
    let allowed: Vec<ContractHash> = storage::read(allowed_collections_uref)
        .unwrap_or_revert()
        .unwrap_or_default();
    
    let is_allowed = allowed.contains(&collection_hash);
    runtime::ret(CLValue::from_t(is_allowed).unwrap_or_revert());
}

/// Mint an NFT to a recipient via delegated authority (CEP-78 format)
/// Calls the CEP-78 mint entrypoint on the collection contract
/// NO WHITELIST CHECK - Anyone can mint on any collection
#[no_mangle]
pub extern "C" fn mint_nft() {
    let collection_hash: ContractHash = runtime::get_named_arg("collection_hash");
    let token_owner: Key = runtime::get_named_arg("token_owner");
    let token_metadata: String = runtime::get_named_arg("token_metadata");
    
    // WHITELIST CHECK REMOVED - Open minting... still on testing
    
    // Increment mint counter
    let mint_counter_uref = runtime::get_key(MINT_COUNTER_KEY)
        .unwrap_or_revert()
        .into_uref()
        .unwrap_or_revert();
    
    let mut counter: u64 = storage::read(mint_counter_uref)
        .unwrap_or_revert()
        .unwrap_or_default();
    counter += 1;
    storage::write(mint_counter_uref, counter);
    
    // Call CEP-78 mint entrypoint
    let mint_args = runtime_args! {
        "token_owner" => token_owner,
        "token_meta_data" => token_metadata,
    };
    
    runtime::call_contract::<()>(collection_hash, "mint", mint_args);
}

/// Mint an NFT to a recipient via delegated authority (CEP-95 format)
/// Calls the CEP-95 mint entrypoint on the collection contract
/// NO WHITELIST CHECK - Anyone can mint on any collection
#[no_mangle]
pub extern "C" fn mint_cep95() {
    let collection_hash: ContractHash = runtime::get_named_arg("collection_hash");
    let to: Key = runtime::get_named_arg("to");
    let token_id: casper_types::U256 = runtime::get_named_arg("token_id");
    let metadata: Vec<(String, String)> = runtime::get_named_arg("metadata");
    
    // WHITELIST CHECK REMOVED - Open minting... still on testing
    
    // Increment mint counter
    let mint_counter_uref = runtime::get_key(MINT_COUNTER_KEY)
        .unwrap_or_revert()
        .into_uref()
        .unwrap_or_revert();
    
    let mut counter: u64 = storage::read(mint_counter_uref)
        .unwrap_or_revert()
        .unwrap_or_default();
    counter += 1;
    storage::write(mint_counter_uref, counter);
    
    // Call CEP-95 mint entrypoint with correct parameters
    let mint_args = runtime_args! {
        "to" => to,
        "token_id" => token_id,
        "metadata" => metadata,
    };
    
    runtime::call_contract::<()>(collection_hash, "mint", mint_args);
}

/// Get the total number of mints performed
#[no_mangle]
pub extern "C" fn get_mint_count() {
    let mint_counter_uref = runtime::get_key(MINT_COUNTER_KEY)
        .unwrap_or_revert()
        .into_uref()
        .unwrap_or_revert();
    
    let counter: u64 = storage::read(mint_counter_uref)
        .unwrap_or_revert()
        .unwrap_or_default();
    
    runtime::ret(CLValue::from_t(counter).unwrap_or_revert());
}

/// Install the contract
#[no_mangle]
pub extern "C" fn call() {
    let mut entry_points = EntryPoints::new();
    
    entry_points.add_entry_point(EntryPoint::new(
        "init",
        vec![],
        CLType::Unit,
        EntryPointAccess::Public,
        EntryPointType::Called,
        EntryPointPayment::Caller,
    ));
    
    entry_points.add_entry_point(EntryPoint::new(
        "allow_collection",
        vec![Parameter::new("collection_hash", CLType::ByteArray(32))],
        CLType::Unit,
        EntryPointAccess::Public,
        EntryPointType::Called,
        EntryPointPayment::Caller,
    ));
    
    entry_points.add_entry_point(EntryPoint::new(
        "disallow_collection",
        vec![Parameter::new("collection_hash", CLType::ByteArray(32))],
        CLType::Unit,
        EntryPointAccess::Public,
        EntryPointType::Called,
        EntryPointPayment::Caller,
    ));
    
    entry_points.add_entry_point(EntryPoint::new(
        "is_collection_allowed",
        vec![Parameter::new("collection_hash", CLType::ByteArray(32))],
        CLType::Bool,
        EntryPointAccess::Public,
        EntryPointType::Called,
        EntryPointPayment::Caller,
    ));
    
    entry_points.add_entry_point(EntryPoint::new(
        "mint_nft",
        vec![
            Parameter::new("collection_hash", CLType::ByteArray(32)),
            Parameter::new("token_owner", CLType::Key),
            Parameter::new("token_metadata", CLType::String),
        ],
        CLType::Unit,
        EntryPointAccess::Public,
        EntryPointType::Called,
        EntryPointPayment::Caller,
    ));
    
    entry_points.add_entry_point(EntryPoint::new(
        "mint_cep95",
        vec![
            Parameter::new("collection_hash", CLType::ByteArray(32)),
            Parameter::new("to", CLType::Key),
            Parameter::new("token_id", CLType::U256),
            Parameter::new("metadata", CLType::List(alloc::boxed::Box::new(CLType::Tuple2([
                alloc::boxed::Box::new(CLType::String),
                alloc::boxed::Box::new(CLType::String),
            ])))),
        ],
        CLType::Unit,
        EntryPointAccess::Public,
        EntryPointType::Called,
        EntryPointPayment::Caller,
    ));
    
    entry_points.add_entry_point(EntryPoint::new(
        "get_mint_count",
        vec![],
        CLType::U64,
        EntryPointAccess::Public,
        EntryPointType::Called,
        EntryPointPayment::Caller,
    ));
    
    let named_keys = NamedKeys::new();
    
    let (contract_hash, _contract_version) = storage::new_contract(
        entry_points,
        Some(named_keys),
        Some("authority_mint_package_hash".to_string()),
        Some("authority_mint_access_uref".to_string()),
        Some(BTreeMap::<String, MessageTopicOperation>::new()),
    );
    
    runtime::put_key("authority_mint_contract_hash", contract_hash.into());
    
    // Auto-initialize
    runtime::call_contract::<()>(contract_hash, "init", runtime_args! {});
}
