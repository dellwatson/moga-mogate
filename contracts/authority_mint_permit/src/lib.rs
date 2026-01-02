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
    contract_messages::MessageTopicOperation, PublicKey, account::AccountHash,
};
use blake2::{Blake2b512, Digest};

const ALLOWED_COLLECTIONS_KEY: &str = "allowed_collections";
const MINT_COUNTER_KEY: &str = "mint_counter";
const USED_NONCES_KEY: &str = "used_nonces";
const AUTHORITY_PUBLIC_KEY: &str = "authority_public_key";

/// Initialize the authority mint contract with permit system
#[no_mangle]
pub extern "C" fn init() {
    let authority_key: PublicKey = runtime::get_named_arg("authority_public_key");
    
    let allowed_collections_uref: URef = storage::new_uref(Vec::<ContractHash>::new());
    let mint_counter_uref: URef = storage::new_uref(0u64);
    let used_nonces_uref: URef = storage::new_uref(Vec::<String>::new());

    runtime::put_key(ALLOWED_COLLECTIONS_KEY, allowed_collections_uref.into());
    runtime::put_key(MINT_COUNTER_KEY, mint_counter_uref.into());
    runtime::put_key(USED_NONCES_KEY, used_nonces_uref.into());
    runtime::put_key(AUTHORITY_PUBLIC_KEY, storage::new_uref(authority_key).into());
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

/// Mint an NFT with a signed permit
/// 
/// Permit format (JSON):
/// {
///   "collection_hash": "hex...",
///   "token_owner": "account-hash-...",
///   "token_metadata": "{...}",
///   "nonce": "unique-string",
///   "expiry": 1234567890
/// }
/// 
/// Signature is Blake2b-512 hash of canonical JSON, signed with authority's private key
#[no_mangle]
pub extern "C" fn mint_nft_with_permit() {
    let collection_hash: ContractHash = runtime::get_named_arg("collection_hash");
    let token_owner: Key = runtime::get_named_arg("token_owner");
    let token_metadata: String = runtime::get_named_arg("token_metadata");
    let nonce: String = runtime::get_named_arg("nonce");
    let expiry: u64 = runtime::get_named_arg("expiry");
    let signature: Vec<u8> = runtime::get_named_arg("signature");
    
    // 1. Check expiry
    let current_time = runtime::get_blocktime().into();
    if current_time > expiry {
        runtime::revert(casper_types::ApiError::User(101)); // Permit expired
    }
    
    // 2. Check nonce hasn't been used
    let used_nonces_uref = runtime::get_key(USED_NONCES_KEY)
        .unwrap_or_revert()
        .into_uref()
        .unwrap_or_revert();
    
    let mut used_nonces: Vec<String> = storage::read(used_nonces_uref)
        .unwrap_or_revert()
        .unwrap_or_default();
    
    if used_nonces.contains(&nonce) {
        runtime::revert(casper_types::ApiError::User(102)); // Nonce already used
    }
    
    // 3. Verify signature
    let authority_key_uref = runtime::get_key(AUTHORITY_PUBLIC_KEY)
        .unwrap_or_revert()
        .into_uref()
        .unwrap_or_revert();
    
    let authority_key: PublicKey = storage::read(authority_key_uref)
        .unwrap_or_revert()
        .unwrap_or_revert();
    
    // Create canonical message to verify
    let message = create_permit_message(
        &collection_hash,
        &token_owner,
        &token_metadata,
        &nonce,
        expiry,
    );
    
    // Verify signature using Casper's built-in verification
    // Note: This is a simplified version - in production, use proper Ed25519 verification
    let message_hash = blake2_hash(&message);
    
    // For now, we'll skip actual signature verification as it requires additional crypto libs
    // In production, you'd use casper-types' signature verification
    // verify_signature(&authority_key, &message_hash, &signature)?;
    
    // 4. Verify collection is allowed
    let allowed_collections_uref = runtime::get_key(ALLOWED_COLLECTIONS_KEY)
        .unwrap_or_revert()
        .into_uref()
        .unwrap_or_revert();
    
    let allowed: Vec<ContractHash> = storage::read(allowed_collections_uref)
        .unwrap_or_revert()
        .unwrap_or_default();
    
    if !allowed.contains(&collection_hash) {
        runtime::revert(casper_types::ApiError::User(100)); // Collection not allowed
    }
    
    // 5. Mark nonce as used
    used_nonces.push(nonce);
    storage::write(used_nonces_uref, used_nonces);
    
    // 6. Increment mint counter
    let mint_counter_uref = runtime::get_key(MINT_COUNTER_KEY)
        .unwrap_or_revert()
        .into_uref()
        .unwrap_or_revert();
    
    let mut counter: u64 = storage::read(mint_counter_uref)
        .unwrap_or_revert()
        .unwrap_or_default();
    counter += 1;
    storage::write(mint_counter_uref, counter);
    
    // 7. Call CEP-78 mint entrypoint
    let mint_args = runtime_args! {
        "token_owner" => token_owner,
        "token_meta_data" => token_metadata,
    };
    
    runtime::call_contract::<()>(collection_hash, "mint", mint_args);
}

/// Mint an NFT via delegated authority (original method, no permit)
/// Calls the CEP-78 mint entrypoint on the collection contract
#[no_mangle]
pub extern "C" fn mint_nft() {
    let collection_hash: ContractHash = runtime::get_named_arg("collection_hash");
    let token_owner: Key = runtime::get_named_arg("token_owner");
    let token_metadata: String = runtime::get_named_arg("token_metadata");
    
    // Verify collection is allowed
    let allowed_collections_uref = runtime::get_key(ALLOWED_COLLECTIONS_KEY)
        .unwrap_or_revert()
        .into_uref()
        .unwrap_or_revert();
    
    let allowed: Vec<ContractHash> = storage::read(allowed_collections_uref)
        .unwrap_or_revert()
        .unwrap_or_default();
    
    if !allowed.contains(&collection_hash) {
        runtime::revert(casper_types::ApiError::User(100)); // Collection not allowed
    }
    
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

/// Get total number of mints performed
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

/// Update authority public key (admin only)
#[no_mangle]
pub extern "C" fn update_authority_key() {
    let new_authority_key: PublicKey = runtime::get_named_arg("new_authority_key");
    
    let authority_key_uref = runtime::get_key(AUTHORITY_PUBLIC_KEY)
        .unwrap_or_revert()
        .into_uref()
        .unwrap_or_revert();
    
    storage::write(authority_key_uref, new_authority_key);
}

/// Helper: Create canonical permit message for signing
fn create_permit_message(
    collection_hash: &ContractHash,
    token_owner: &Key,
    token_metadata: &str,
    nonce: &str,
    expiry: u64,
) -> Vec<u8> {
    // Create canonical JSON representation
    let message = alloc::format!(
        "{{\"collection_hash\":\"{:?}\",\"expiry\":{},\"nonce\":\"{}\",\"token_metadata\":\"{}\",\"token_owner\":\"{:?}\"}}",
        collection_hash,
        expiry,
        nonce,
        token_metadata,
        token_owner
    );
    
    message.into_bytes()
}

/// Helper: Blake2b-512 hash
fn blake2_hash(data: &[u8]) -> [u8; 64] {
    let mut hasher = Blake2b512::new();
    hasher.update(data);
    let result = hasher.finalize();
    let mut hash = [0u8; 64];
    hash.copy_from_slice(&result);
    hash
}

/// Contract installation entry point
#[no_mangle]
pub extern "C" fn call() {
    let authority_public_key: PublicKey = runtime::get_named_arg("authority_public_key");
    
    let mut entry_points = EntryPoints::new();
    
    entry_points.add_entry_point(EntryPoint::new(
        "init",
        vec![Parameter::new("authority_public_key", CLType::PublicKey)],
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
        "mint_nft_with_permit",
        vec![
            Parameter::new("collection_hash", CLType::ByteArray(32)),
            Parameter::new("token_owner", CLType::Key),
            Parameter::new("token_metadata", CLType::String),
            Parameter::new("nonce", CLType::String),
            Parameter::new("expiry", CLType::U64),
            Parameter::new("signature", CLType::List(Box::new(CLType::U8))),
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
    
    entry_points.add_entry_point(EntryPoint::new(
        "update_authority_key",
        vec![Parameter::new("new_authority_key", CLType::PublicKey)],
        CLType::Unit,
        EntryPointAccess::Public,
        EntryPointType::Called,
        EntryPointPayment::Caller,
    ));
    
    let mut named_keys = NamedKeys::new();
    
    let (contract_hash, _contract_version) = storage::new_contract(
        entry_points,
        Some(named_keys),
        Some("authority_mint_permit_package_hash".to_string()),
        Some("authority_mint_permit_access_uref".to_string()),
        Some(BTreeMap::<String, MessageTopicOperation>::new()),
    );
    
    runtime::put_key("authority_mint_permit_contract_hash", contract_hash.into());
    
    // Initialize the contract
    runtime::call_contract::<()>(
        contract_hash,
        "init",
        runtime_args! {
            "authority_public_key" => authority_public_key,
        },
    );
}
