#![no_std]
#![no_main]

//! # Signature Verification Contract
//! 
//! A generic contract demonstrating Ed25519 signature verification on Casper.
//! 
//! ## Flow:
//! 1. Store a trusted signer's public key (Ed25519)
//! 2. Offchain: Sign data with the private key
//! 3. Onchain: Verify signature matches the stored public key
//! 4. Execute action if signature is valid
//! 
//! ## Example Use Case:
//! - Set a value only if signed by the authorized signer
//! - Prevents unauthorized modifications

extern crate alloc;

use alloc::{string::String, vec::Vec};
use casper_contract::{
    contract_api::{runtime, storage},
    unwrap_or_revert::UnwrapOrRevert,
};
use casper_types::{
    contracts::NamedKeys, runtime_args, CLType, CLValue, EntryPointAccess, 
    EntryPoints, URef, Parameter, EntityEntryPoint as EntryPoint, 
    EntryPointType, EntryPointPayment, PublicKey, bytesrepr::Bytes,
};
use blake2::{Blake2b512, Digest};

// Storage keys
const SIGNER_PUBLIC_KEY: &str = "signer_public_key";
const STORED_VALUE: &str = "stored_value";
const USED_NONCES: &str = "used_nonces";

/// Initialize contract with the authorized signer's public key
#[no_mangle]
pub extern "C" fn init() {
    let signer_key: PublicKey = runtime::get_named_arg("signer_public_key");
    
    // Store the authorized signer's public key
    let signer_uref: URef = storage::new_uref(signer_key);
    runtime::put_key(SIGNER_PUBLIC_KEY, signer_uref.into());
    
    // Initialize storage
    let value_uref: URef = storage::new_uref(String::new());
    runtime::put_key(STORED_VALUE, value_uref.into());
    
    let nonces_uref: URef = storage::new_uref(Vec::<String>::new());
    runtime::put_key(USED_NONCES, nonces_uref.into());
}

/// Set a value with signature verification
/// 
/// Parameters:
/// - value: The value to store
/// - nonce: Unique nonce to prevent replay attacks
/// - signature: Ed25519 signature (64 bytes)
/// 
/// The signature must be created by signing:
/// Blake2b-512(value || nonce)
#[no_mangle]
pub extern "C" fn set_value_with_signature() {
    let value: String = runtime::get_named_arg("value");
    let nonce: String = runtime::get_named_arg("nonce");
    let signature: Bytes = runtime::get_named_arg("signature");
    
    // 1. Check nonce hasn't been used (prevent replay attacks)
    let nonces_uref = runtime::get_key(USED_NONCES)
        .unwrap_or_revert()
        .into_uref()
        .unwrap_or_revert();
    
    let mut used_nonces: Vec<String> = storage::read(nonces_uref)
        .unwrap_or_revert()
        .unwrap_or_default();
    
    if used_nonces.contains(&nonce) {
        runtime::revert(casper_types::ApiError::User(101)); // Nonce already used
    }
    
    // 2. Get stored signer public key
    let signer_uref = runtime::get_key(SIGNER_PUBLIC_KEY)
        .unwrap_or_revert()
        .into_uref()
        .unwrap_or_revert();
    
    let signer_public_key: PublicKey = storage::read(signer_uref)
        .unwrap_or_revert()
        .unwrap_or_revert();
    
    // 3. Create message to verify (same as offchain signing)
    let message = create_message(&value, &nonce);
    let message_hash = blake2_hash(&message);
    
    // 4. Verify signature
    // Convert signature bytes to array
    if signature.len() != 64 {
        runtime::revert(casper_types::ApiError::User(102)); // Invalid signature length
    }
    
    let mut sig_array = [0u8; 64];
    sig_array.copy_from_slice(&signature);
    
    // Verify using Casper's built-in Ed25519 verification
    let is_valid = verify_ed25519_signature(
        &signer_public_key,
        &message_hash,
        &sig_array,
    );
    
    if !is_valid {
        runtime::revert(casper_types::ApiError::User(103)); // Invalid signature
    }
    
    // 5. Mark nonce as used
    used_nonces.push(nonce);
    storage::write(nonces_uref, used_nonces);
    
    // 6. Store the value (signature verified!)
    let value_uref = runtime::get_key(STORED_VALUE)
        .unwrap_or_revert()
        .into_uref()
        .unwrap_or_revert();
    
    storage::write(value_uref, value);
}

/// Get the stored value
#[no_mangle]
pub extern "C" fn get_value() {
    let value_uref = runtime::get_key(STORED_VALUE)
        .unwrap_or_revert()
        .into_uref()
        .unwrap_or_revert();
    
    let value: String = storage::read(value_uref)
        .unwrap_or_revert()
        .unwrap_or_default();
    
    runtime::ret(CLValue::from_t(value).unwrap_or_revert());
}

/// Get the authorized signer's public key
#[no_mangle]
pub extern "C" fn get_signer_public_key() {
    let signer_uref = runtime::get_key(SIGNER_PUBLIC_KEY)
        .unwrap_or_revert()
        .into_uref()
        .unwrap_or_revert();
    
    let signer_key: PublicKey = storage::read(signer_uref)
        .unwrap_or_revert()
        .unwrap_or_revert();
    
    runtime::ret(CLValue::from_t(signer_key).unwrap_or_revert());
}

/// Update the authorized signer (admin only - should add access control in production)
#[no_mangle]
pub extern "C" fn update_signer() {
    let new_signer: PublicKey = runtime::get_named_arg("new_signer_public_key");
    
    let signer_uref = runtime::get_key(SIGNER_PUBLIC_KEY)
        .unwrap_or_revert()
        .into_uref()
        .unwrap_or_revert();
    
    storage::write(signer_uref, new_signer);
}

// ============================================================================
// Helper Functions
// ============================================================================

/// Create canonical message for signing: value || nonce
fn create_message(value: &str, nonce: &str) -> Vec<u8> {
    let mut message = Vec::new();
    message.extend_from_slice(value.as_bytes());
    message.extend_from_slice(nonce.as_bytes());
    message
}

/// Blake2b-512 hash
fn blake2_hash(data: &[u8]) -> [u8; 64] {
    let mut hasher = Blake2b512::new();
    hasher.update(data);
    let result = hasher.finalize();
    let mut hash = [0u8; 64];
    hash.copy_from_slice(&result);
    hash
}

/// Verify Ed25519 signature
/// 
/// Note: Casper uses Ed25519 for account keys.
/// This function extracts the raw Ed25519 public key and verifies the signature.
fn verify_ed25519_signature(
    public_key: &PublicKey,
    message_hash: &[u8; 64],
    signature: &[u8; 64],
) -> bool {
    // Casper's PublicKey type wraps Ed25519 keys
    // We need to extract the raw bytes for verification
    
    match public_key {
        PublicKey::Ed25519(ed25519_key) => {
            // Use Casper's built-in verification
            // The verify method expects the original message, not the hash
            // So we pass the hash as the message since we already hashed it
            ed25519_key.verify(message_hash, signature).is_ok()
        }
        _ => {
            // Only Ed25519 keys are supported
            false
        }
    }
}

// ============================================================================
// Contract Installation
// ============================================================================

#[no_mangle]
pub extern "C" fn call() {
    let signer_public_key: PublicKey = runtime::get_named_arg("signer_public_key");
    
    let mut entry_points = EntryPoints::new();
    
    // Init entry point
    entry_points.add_entry_point(EntryPoint::new(
        "init",
        vec![Parameter::new("signer_public_key", CLType::PublicKey)],
        CLType::Unit,
        EntryPointAccess::Public,
        EntryPointType::Called,
        EntryPointPayment::Caller,
    ));
    
    // Set value with signature
    entry_points.add_entry_point(EntryPoint::new(
        "set_value_with_signature",
        vec![
            Parameter::new("value", CLType::String),
            Parameter::new("nonce", CLType::String),
            Parameter::new("signature", CLType::ByteArray(64)),
        ],
        CLType::Unit,
        EntryPointAccess::Public,
        EntryPointType::Called,
        EntryPointPayment::Caller,
    ));
    
    // Get value
    entry_points.add_entry_point(EntryPoint::new(
        "get_value",
        vec![],
        CLType::String,
        EntryPointAccess::Public,
        EntryPointType::Called,
        EntryPointPayment::Caller,
    ));
    
    // Get signer public key
    entry_points.add_entry_point(EntryPoint::new(
        "get_signer_public_key",
        vec![],
        CLType::PublicKey,
        EntryPointAccess::Public,
        EntryPointType::Called,
        EntryPointPayment::Caller,
    ));
    
    // Update signer
    entry_points.add_entry_point(EntryPoint::new(
        "update_signer",
        vec![Parameter::new("new_signer_public_key", CLType::PublicKey)],
        CLType::Unit,
        EntryPointAccess::Public,
        EntryPointType::Called,
        EntryPointPayment::Caller,
    ));
    
    let named_keys = NamedKeys::new();
    
    let (contract_hash, _contract_version) = storage::new_contract(
        entry_points,
        Some(named_keys),
        Some("signature_verify_package_hash".to_string()),
        Some("signature_verify_access_uref".to_string()),
    );
    
    runtime::put_key("signature_verify_contract_hash", contract_hash.into());
    
    // Initialize the contract
    runtime::call_contract::<()>(
        contract_hash,
        "init",
        runtime_args! {
            "signer_public_key" => signer_public_key,
        },
    );
}
