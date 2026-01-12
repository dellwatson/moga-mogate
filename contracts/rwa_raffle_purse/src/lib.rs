#![no_std]
#![no_main]

extern crate alloc;

use alloc::{boxed::Box, string::{String, ToString}, vec, vec::Vec};
use casper_contract::{
    contract_api::{runtime, storage, system},
    unwrap_or_revert::UnwrapOrRevert,
};
use casper_types::{
    bytesrepr::{FromBytes, ToBytes},
    runtime_args, AccessRights, ApiError, CLType, CLValue, EntryPointAccess, EntryPointType,
    EntryPoints, Key, Parameter, U256, U512, URef, CLTyped,
};
use casper_types::contracts::{ContractHash, EntryPoint};

const CONTRACT_NAME: &str = "rwa_raffle_cspr";

const RAFFLE_PURSE_KEY: &str = "raffle_purse";
const ADMIN_KEY: &str = "raffle_admin";

const DICT_TOTAL_SLOTS: &str = "raffle_total_slots";
const DICT_MAX_SLOTS_PER_ADDR: &str = "raffle_max_slots_per_addr";
const DICT_PRICE_PER_SLOT: &str = "raffle_price_per_slot";
const DICT_METADATA_URI: &str = "raffle_metadata_uri";
const DICT_COLLECTION_HASH: &str = "raffle_collection_hash";
const DICT_PREMINT_CONTRACT: &str = "raffle_premint_contract";
const DICT_PREMINT: &str = "raffle_premint";
const DICT_AUTO_CLAIM: &str = "raffle_auto_claim";
const DICT_CREATED_AT: &str = "raffle_created_at";
const DICT_EXPIRES_AT: &str = "raffle_expires_at";
const DICT_STATUS: &str = "raffle_status";
const DICT_SOLD_SLOTS: &str = "raffle_sold_slots";
const DICT_WINNER_SLOT: &str = "raffle_winner_slot";
const DICT_WINNER: &str = "raffle_winner";
const DICT_CLAIMED: &str = "raffle_claimed";

const DICT_SLOT_OWNER: &str = "raffle_slot_owner";
const DICT_USER_SLOT_COUNT: &str = "raffle_user_slot_count";
const DICT_USER_SLOTS: &str = "raffle_user_slots";
const DICT_USER_RAFFLES: &str = "raffle_user_raffles";

const STATUS_OPEN: u8 = 0;
const STATUS_FILLED: u8 = 1;
const STATUS_DRAWN: u8 = 2;
const STATUS_CANCELLED: u8 = 3;

const FREE_SLOTS_FOR_HOST: usize = 3;

#[repr(u16)]
pub enum RwaRaffleError {
    InvalidAmount = 1,
    InvalidDeadline = 2,
    WrongStatus = 3,
    RaffleAlreadyExists = 4,
    RaffleNotFound = 5,
    RaffleClosed = 6,
    RaffleExpired = 7,
    SlotOutOfRange = 8,
    SlotAlreadyTaken = 9,
    NotEnoughSlotsLeft = 10,
    MaxSlotsPerAddressExceeded = 11,
    NoSlotsProvided = 12,
    DuplicateSlot = 13,
    NotWinner = 14,
    AlreadyClaimed = 15,
    NotFilled = 16,
    PaymentFailed = 17,
    NotAdmin = 18,
}

impl From<RwaRaffleError> for ApiError {
    fn from(error: RwaRaffleError) -> ApiError {
        ApiError::User(error as u16)
    }
}

fn get_dict_uref(name: &str) -> URef {
    runtime::get_key(name)
        .unwrap_or_revert()
        .into_uref()
        .unwrap_or_revert()
}

fn dict_read<T: CLTyped + FromBytes>(name: &str, key: &str) -> Option<T> {
    let uref = get_dict_uref(name);
    storage::dictionary_get::<T>(uref, key).unwrap_or_revert()
}

fn dict_write<T: CLTyped + ToBytes>(name: &str, key: &str, value: T) {
    let uref = get_dict_uref(name);
    storage::dictionary_put(uref, key, value);
}

fn key_to_string(key: &Key) -> String {
    key.to_formatted_string()
}

fn raffle_slot_key(raffle_id: &str, slot: u64) -> String {
    let mut s = String::from(raffle_id);
    s.push('|');
    let n = itoa_u64(slot);
    s.push_str(&n);
    s
}

fn user_raffle_key(raffle_id: &str, owner: &Key) -> String {
    let mut s = String::from(raffle_id);
    s.push('|');
    s.push_str(&key_to_string(owner));
    s
}

fn itoa_u64(mut value: u64) -> String {
    if value == 0 {
        return String::from("0");
    }
    let mut buf = [0u8; 20];
    let mut i = 20;
    while value > 0 {
        i -= 1;
        buf[i] = b'0' + (value % 10) as u8;
        value /= 10;
    }
    String::from(core::str::from_utf8(&buf[i..]).unwrap_or("0"))
}

#[no_mangle]
pub extern "C" fn init() {
    let dicts = [
        DICT_TOTAL_SLOTS,
        DICT_MAX_SLOTS_PER_ADDR,
        DICT_PRICE_PER_SLOT,
        DICT_METADATA_URI,
        DICT_COLLECTION_HASH,
        DICT_PREMINT_CONTRACT,
        DICT_PREMINT,
        DICT_AUTO_CLAIM,
        DICT_CREATED_AT,
        DICT_EXPIRES_AT,
        DICT_STATUS,
        DICT_SOLD_SLOTS,
        DICT_WINNER_SLOT,
        DICT_WINNER,
        DICT_CLAIMED,
        DICT_SLOT_OWNER,
        DICT_USER_SLOT_COUNT,
        DICT_USER_SLOTS,
        DICT_USER_RAFFLES,
    ];

    for name in dicts.iter() {
        storage::new_dictionary(name).unwrap_or_revert();
    }

    let purse = system::create_purse();
    runtime::put_key(RAFFLE_PURSE_KEY, purse.into());

    let admin: Key = runtime::get_caller().into();
    let admin_uref = storage::new_uref(admin);
    runtime::put_key(ADMIN_KEY, admin_uref.into());
}

fn get_admin() -> Key {
    let uref = runtime::get_key(ADMIN_KEY)
        .unwrap_or_revert()
        .into_uref()
        .unwrap_or_revert();
    storage::read(uref).unwrap_or_revert().unwrap_or_revert()
}

fn get_raffle_purse() -> URef {
    runtime::get_key(RAFFLE_PURSE_KEY)
        .unwrap_or_revert()
        .into_uref()
        .unwrap_or_revert()
}

fn ensure_raffle_not_exists(raffle_id: &str) {
    if dict_read::<u64>(DICT_TOTAL_SLOTS, raffle_id).is_some() {
        runtime::revert(RwaRaffleError::RaffleAlreadyExists);
    }
}

fn ensure_raffle_open(raffle_id: &str) {
    let status: u8 = match dict_read(DICT_STATUS, raffle_id) {
        Some(v) => v,
        None => runtime::revert(RwaRaffleError::RaffleNotFound),
    };
    if status != STATUS_OPEN {
        runtime::revert(RwaRaffleError::RaffleClosed);
    }

    if let Some(expires_at) = dict_read::<U512>(DICT_EXPIRES_AT, raffle_id) {
        if !expires_at.is_zero() {
            let now: u64 = runtime::get_blocktime().into();
            let now_u512 = U512::from(now);
            if now_u512 > expires_at {
                runtime::revert(RwaRaffleError::RaffleExpired);
            }
        }
    }
}

fn host_raffle_internal(
    raffle_id: String,
    total_slots: u64,
    max_slots_per_address: u64,
    price_per_slot: U512,
    metadata_uri: String,
    collection_hash: ContractHash,
    premint_contract: bool,
    premint: bool,
    auto_claim: bool,
    expires_at: U512,
) {
    if total_slots == 0 || max_slots_per_address == 0 {
        runtime::revert(RwaRaffleError::InvalidAmount);
    }

    ensure_raffle_not_exists(&raffle_id);

    let created_at_u64: u64 = runtime::get_blocktime().into();
    let created_at = U512::from(created_at_u64);

    dict_write(DICT_TOTAL_SLOTS, &raffle_id, total_slots);
    dict_write(DICT_MAX_SLOTS_PER_ADDR, &raffle_id, max_slots_per_address);
    dict_write(DICT_PRICE_PER_SLOT, &raffle_id, price_per_slot);
    dict_write(DICT_METADATA_URI, &raffle_id, metadata_uri);
    dict_write(DICT_COLLECTION_HASH, &raffle_id, collection_hash);
    dict_write(DICT_PREMINT_CONTRACT, &raffle_id, premint_contract);
    dict_write(DICT_PREMINT, &raffle_id, premint);
    dict_write(DICT_AUTO_CLAIM, &raffle_id, auto_claim);
    dict_write(DICT_CREATED_AT, &raffle_id, created_at);
    dict_write(DICT_EXPIRES_AT, &raffle_id, expires_at);
    dict_write(DICT_STATUS, &raffle_id, STATUS_OPEN);
    dict_write(DICT_SOLD_SLOTS, &raffle_id, 0u64);
    dict_write(DICT_CLAIMED, &raffle_id, false);
}

fn join_internal(
    raffle_id: String,
    mut slot_ids: Vec<u64>,
    source_purse: URef,
    bonus_free_slots: usize,
) {
    if slot_ids.is_empty() {
        runtime::revert(RwaRaffleError::NoSlotsProvided);
    }

    ensure_raffle_open(&raffle_id);

    let total_slots: u64 = match dict_read(DICT_TOTAL_SLOTS, &raffle_id) {
        Some(v) => v,
        None => runtime::revert(RwaRaffleError::RaffleNotFound),
    };

    let max_slots_per_address: u64 = dict_read(DICT_MAX_SLOTS_PER_ADDR, &raffle_id)
        .unwrap_or_revert();
    let mut sold_slots: u64 = dict_read(DICT_SOLD_SLOTS, &raffle_id).unwrap_or(0u64);

    let caller: Key = runtime::get_caller().into();
    let user_key = key_to_string(&caller);
    let user_raffle_key = user_raffle_key(&raffle_id, &caller);

    // Deduplicate slot_ids and validate
    slot_ids.sort_unstable();
    slot_ids.dedup();

    let requested = slot_ids.len() as u64;
    if requested == 0 {
        runtime::revert(RwaRaffleError::NoSlotsProvided);
    }

    let user_current: u64 = dict_read(DICT_USER_SLOT_COUNT, &user_raffle_key).unwrap_or(0u64);
    let new_user_total = user_current + requested;
    if new_user_total > max_slots_per_address {
        runtime::revert(RwaRaffleError::MaxSlotsPerAddressExceeded);
    }

    // Check availability and range
    for slot in slot_ids.iter() {
        if *slot == 0 || *slot > total_slots {
            runtime::revert(RwaRaffleError::SlotOutOfRange);
        }
        let key = raffle_slot_key(&raffle_id, *slot);
        if dict_read::<Key>(DICT_SLOT_OWNER, &key).is_some() {
            runtime::revert(RwaRaffleError::SlotAlreadyTaken);
        }
    }

    let remaining = total_slots - sold_slots;
    if requested > remaining {
        runtime::revert(RwaRaffleError::NotEnoughSlotsLeft);
    }

    let price_per_slot: U512 = dict_read(DICT_PRICE_PER_SLOT, &raffle_id).unwrap_or_revert();
    let free_slots = core::cmp::min(bonus_free_slots as u64, requested);
    let paid_slots = requested - free_slots;

    let paid_slots_u512 = U512::from(paid_slots);
    let amount = price_per_slot * paid_slots_u512;

    if !amount.is_zero() {
        let raffle_purse = get_raffle_purse();
        // Expose the real Mint error instead of masking it with PaymentFailed
        // This allows us to see InvalidURef, InsufficientFunds, etc. in deploy error_message
        system::transfer_from_purse_to_purse(source_purse, raffle_purse, amount, None)
            .unwrap_or_revert();
    }

    // Persist bookings
    let mut user_slots: Vec<u64> = dict_read(DICT_USER_SLOTS, &user_raffle_key).unwrap_or(Vec::new());
    for slot in slot_ids.iter() {
        let key = raffle_slot_key(&raffle_id, *slot);
        dict_write(DICT_SLOT_OWNER, &key, caller);
        user_slots.push(*slot);
    }
    dict_write(DICT_USER_SLOTS, &user_raffle_key, user_slots);
    dict_write(DICT_USER_SLOT_COUNT, &user_raffle_key, new_user_total);

    sold_slots += requested;
    dict_write(DICT_SOLD_SLOTS, &raffle_id, sold_slots);

    // Track list of raffles per user
    let mut raffles: Vec<String> = dict_read(DICT_USER_RAFFLES, &user_key).unwrap_or(Vec::new());
    if !raffles.iter().any(|r| r == &raffle_id) {
        raffles.push(raffle_id.clone());
        dict_write(DICT_USER_RAFFLES, &user_key, raffles);
    }

    if sold_slots == total_slots {
        dict_write(DICT_STATUS, &raffle_id, STATUS_FILLED);
        end_raffle_internal(raffle_id, caller);
    }
}

fn end_raffle_internal(raffle_id: String, _last_buyer: Key) {
    let total_slots: u64 = dict_read(DICT_TOTAL_SLOTS, &raffle_id)
        .unwrap_or_revert();

    let mut status: u8 = dict_read(DICT_STATUS, &raffle_id).unwrap_or(STATUS_OPEN);
    if status != STATUS_FILLED && status != STATUS_OPEN {
        runtime::revert(RwaRaffleError::WrongStatus);
    }

    let now: u64 = runtime::get_blocktime().into();
    let winner_index = (now % total_slots) + 1;

    let slot_key = raffle_slot_key(&raffle_id, winner_index);
    let winner: Key = match dict_read(DICT_SLOT_OWNER, &slot_key) {
        Some(w) => w,
        None => runtime::revert(RwaRaffleError::RaffleNotFound),
    };

    dict_write(DICT_WINNER_SLOT, &raffle_id, winner_index);
    dict_write(DICT_WINNER, &raffle_id, winner.clone());

    status = STATUS_DRAWN;
    dict_write(DICT_STATUS, &raffle_id, status);

    let auto_claim: bool = dict_read(DICT_AUTO_CLAIM, &raffle_id).unwrap_or(false);
    if auto_claim {
        mint_prize_internal(&raffle_id, winner);
        dict_write(DICT_CLAIMED, &raffle_id, true);
    } else {
        dict_write(DICT_CLAIMED, &raffle_id, false);
    }
}

fn mint_prize_internal(raffle_id: &str, to: Key) {
    let collection_hash: ContractHash = dict_read(DICT_COLLECTION_HASH, raffle_id)
        .unwrap_or_revert();
    let metadata_uri: String = dict_read(DICT_METADATA_URI, raffle_id).unwrap_or_revert();

    let now: u64 = runtime::get_blocktime().into();
    let token_id = U256::from(now);

    let metadata: Vec<(String, String)> = vec![
        (String::from("token_uri"), metadata_uri),
    ];

    let args = runtime_args! {
        "to" => to,
        "token_id" => token_id,
        "metadata" => metadata,
    };

    runtime::call_contract::<()>(collection_hash, "mint", args);
}

#[no_mangle]
pub extern "C" fn unsafe_host_raffle() {
    let raffle_id: String = runtime::get_named_arg("raffle_id");
    let total_slots: u64 = runtime::get_named_arg("total_slots");
    let max_slots_per_address: u64 = runtime::get_named_arg("max_slots_per_address");
    let price_per_slot: U512 = runtime::get_named_arg("price_per_slot");
    let metadata_uri: String = runtime::get_named_arg("metadata_uri");
    let collection_hash: ContractHash = runtime::get_named_arg("collection_hash");
    let premint_contract: bool = runtime::get_named_arg("premint_contract");
    let premint: bool = runtime::get_named_arg("premint");
    let auto_claim: bool = runtime::get_named_arg("auto_claim");
    let expires_at: U512 = runtime::get_named_arg("expires_at");

    host_raffle_internal(
        raffle_id,
        total_slots,
        max_slots_per_address,
        price_per_slot,
        metadata_uri,
        collection_hash,
        premint_contract,
        premint,
        auto_claim,
        expires_at,
    );
}

#[no_mangle]
pub extern "C" fn host_raffle() {
    let raffle_id: String = runtime::get_named_arg("raffle_id");
    let total_slots: u64 = runtime::get_named_arg("total_slots");
    let max_slots_per_address: u64 = runtime::get_named_arg("max_slots_per_address");
    let price_per_slot: U512 = runtime::get_named_arg("price_per_slot");
    let metadata_uri: String = runtime::get_named_arg("metadata_uri");
    let collection_hash: ContractHash = runtime::get_named_arg("collection_hash");
    let premint_contract: bool = runtime::get_named_arg("premint_contract");
    let premint: bool = runtime::get_named_arg("premint");
    let auto_claim: bool = runtime::get_named_arg("auto_claim");
    let expires_at: U512 = runtime::get_named_arg("expires_at");
    let _permit: Vec<u8> = runtime::get_named_arg("permit");

    host_raffle_internal(
        raffle_id,
        total_slots,
        max_slots_per_address,
        price_per_slot,
        metadata_uri,
        collection_hash,
        premint_contract,
        premint,
        auto_claim,
        expires_at,
    );
}

#[no_mangle]
pub extern "C" fn join_raffle() {
    let raffle_id: String = runtime::get_named_arg("raffle_id");
    let slot_ids: Vec<u64> = runtime::get_named_arg("slot_ids");
    let source_purse: URef = runtime::get_named_arg("source_purse");

    join_internal(raffle_id, slot_ids, source_purse, 0);
}

#[no_mangle]
pub extern "C" fn free_join_raffle() {
    let raffle_id: String = runtime::get_named_arg("raffle_id");
    let slot_ids: Vec<u64> = runtime::get_named_arg("slot_ids");
    
    // Create a dummy URef (will not be used since payment is 0)
    let dummy_purse = URef::new([0u8; 32], AccessRights::READ_ADD_WRITE);
    
    // Join with 0 bonus slots, but since price is 0 or we skip payment, slots are free
    // We'll use bonus_free_slots = slot_ids.len() to make all slots free
    join_internal(raffle_id, slot_ids.clone(), dummy_purse, slot_ids.len());
}

#[no_mangle]
pub extern "C" fn free_create_and_join() {
    let raffle_id: String = runtime::get_named_arg("raffle_id");
    let total_slots: u64 = runtime::get_named_arg("total_slots");
    let max_slots_per_address: u64 = runtime::get_named_arg("max_slots_per_address");
    let metadata_uri: String = runtime::get_named_arg("metadata_uri");
    let collection_hash: ContractHash = runtime::get_named_arg("collection_hash");
    let premint_contract: bool = runtime::get_named_arg("premint_contract");
    let premint: bool = runtime::get_named_arg("premint");
    let auto_claim: bool = runtime::get_named_arg("auto_claim");
    let expires_at: U512 = runtime::get_named_arg("expires_at");
    let slot_ids: Vec<u64> = runtime::get_named_arg("slot_ids");

    // Host raffle with price_per_slot = 0 (free)
    host_raffle_internal(
        raffle_id.clone(),
        total_slots,
        max_slots_per_address,
        U512::zero(), // price_per_slot = 0
        metadata_uri,
        collection_hash,
        premint_contract,
        premint,
        auto_claim,
        expires_at,
    );

    // Join immediately with dummy purse (no payment needed)
    let dummy_purse = URef::new([0u8; 32], AccessRights::READ_ADD_WRITE);
    join_internal(raffle_id, slot_ids.clone(), dummy_purse, slot_ids.len());
}

#[no_mangle]
pub extern "C" fn unsafe_join_host_raffle() {
    let raffle_id: String = runtime::get_named_arg("raffle_id");
    let total_slots: u64 = runtime::get_named_arg("total_slots");
    let max_slots_per_address: u64 = runtime::get_named_arg("max_slots_per_address");
    let price_per_slot: U512 = runtime::get_named_arg("price_per_slot");
    let metadata_uri: String = runtime::get_named_arg("metadata_uri");
    let collection_hash: ContractHash = runtime::get_named_arg("collection_hash");
    let premint_contract: bool = runtime::get_named_arg("premint_contract");
    let premint: bool = runtime::get_named_arg("premint");
    let auto_claim: bool = runtime::get_named_arg("auto_claim");
    let expires_at: U512 = runtime::get_named_arg("expires_at");
    let slot_ids: Vec<u64> = runtime::get_named_arg("slot_ids");
    let source_purse: URef = runtime::get_named_arg("source_purse");

    host_raffle_internal(
        raffle_id.clone(),
        total_slots,
        max_slots_per_address,
        price_per_slot,
        metadata_uri,
        collection_hash,
        premint_contract,
        premint,
        auto_claim,
        expires_at,
    );

    join_internal(raffle_id, slot_ids, source_purse, FREE_SLOTS_FOR_HOST);
}

#[no_mangle]
pub extern "C" fn claim() {
    let raffle_id: String = runtime::get_named_arg("raffle_id");
    let caller: Key = runtime::get_caller().into();

    let status: u8 = dict_read(DICT_STATUS, &raffle_id).unwrap_or(STATUS_OPEN);
    if status != STATUS_DRAWN {
        runtime::revert(RwaRaffleError::WrongStatus);
    }

    let claimed: bool = dict_read(DICT_CLAIMED, &raffle_id).unwrap_or(false);
    if claimed {
        runtime::revert(RwaRaffleError::AlreadyClaimed);
    }

    let winner: Key = dict_read(DICT_WINNER, &raffle_id).unwrap_or_revert();
    if winner != caller {
        runtime::revert(RwaRaffleError::NotWinner);
    }

    mint_prize_internal(&raffle_id, caller);
    dict_write(DICT_CLAIMED, &raffle_id, true);
}

#[no_mangle]
pub extern "C" fn withdraw_proceeds() {
    let caller: Key = runtime::get_caller().into();
    let admin = get_admin();
    if caller != admin {
        runtime::revert(RwaRaffleError::NotAdmin);
    }

    let to_purse: URef = runtime::get_named_arg("to_purse");
    let amount: U512 = runtime::get_named_arg("amount");

    let raffle_purse = get_raffle_purse();
    system::transfer_from_purse_to_purse(raffle_purse, to_purse, amount, None)
        .unwrap_or_revert_with(RwaRaffleError::PaymentFailed);
}

#[no_mangle]
pub extern "C" fn get_raffle_load() {
    let raffle_id: String = runtime::get_named_arg("raffle_id");
    let total_slots: u64 = match dict_read(DICT_TOTAL_SLOTS, &raffle_id) {
        Some(v) => v,
        None => runtime::revert(RwaRaffleError::RaffleNotFound),
    };
    let sold_slots: u64 = dict_read(DICT_SOLD_SLOTS, &raffle_id).unwrap_or(0u64);
    let status: u8 = dict_read(DICT_STATUS, &raffle_id).unwrap_or(STATUS_OPEN);

    let result = (total_slots, sold_slots, status);
    runtime::ret(CLValue::from_t(result).unwrap_or_revert());
}

#[no_mangle]
pub extern "C" fn get_user_raffles() {
    let owner: Key = runtime::get_named_arg("owner");
    let key = key_to_string(&owner);
    let raffles: Vec<String> = dict_read(DICT_USER_RAFFLES, &key).unwrap_or(Vec::new());
    runtime::ret(CLValue::from_t(raffles).unwrap_or_revert());
}

#[no_mangle]
pub extern "C" fn get_user_raffle_slots() {
    let raffle_id: String = runtime::get_named_arg("raffle_id");
    let owner: Key = runtime::get_named_arg("owner");
    let key = user_raffle_key(&raffle_id, &owner);
    let slots: Vec<u64> = dict_read(DICT_USER_SLOTS, &key).unwrap_or(Vec::new());
    runtime::ret(CLValue::from_t(slots).unwrap_or_revert());
}

#[no_mangle]
pub extern "C" fn check_slots_availability() {
    let raffle_id: String = runtime::get_named_arg("raffle_id");
    let slot_ids: Vec<u64> = runtime::get_named_arg("slot_ids");

    let total_slots: u64 = match dict_read(DICT_TOTAL_SLOTS, &raffle_id) {
        Some(v) => v,
        None => runtime::revert(RwaRaffleError::RaffleNotFound),
    };

    let mut unavailable: Vec<u64> = Vec::new();

    for slot in slot_ids.iter() {
        if *slot == 0 || *slot > total_slots {
            unavailable.push(*slot);
            continue;
        }
        let key = raffle_slot_key(&raffle_id, *slot);
        if dict_read::<Key>(DICT_SLOT_OWNER, &key).is_some() {
            unavailable.push(*slot);
        }
    }

    let all_available = unavailable.is_empty();
    let result = (all_available, unavailable);
    runtime::ret(CLValue::from_t(result).unwrap_or_revert());
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

fn get_entry_points() -> EntryPoints {
    let mut entry_points = EntryPoints::new();

    entry_points.add_entry_point(
        EntryPoint::new(
            "init",
            vec![],
            CLType::Unit,
            EntryPointAccess::Public,
            EntryPointType::Called,
        )
        .into(),
    );

    entry_points.add_entry_point(
        EntryPoint::new(
            "unsafe_host_raffle",
            vec![
                Parameter::new("raffle_id", CLType::String),
                Parameter::new("total_slots", CLType::U64),
                Parameter::new("max_slots_per_address", CLType::U64),
                Parameter::new("price_per_slot", CLType::U512),
                Parameter::new("metadata_uri", CLType::String),
                Parameter::new("collection_hash", CLType::ByteArray(32)),
                Parameter::new("premint_contract", CLType::Bool),
                Parameter::new("premint", CLType::Bool),
                Parameter::new("auto_claim", CLType::Bool),
                Parameter::new("expires_at", CLType::U512),
            ],
            CLType::Unit,
            EntryPointAccess::Public,
            EntryPointType::Called,
        )
        .into(),
    );

    entry_points.add_entry_point(
        EntryPoint::new(
            "host_raffle",
            vec![
                Parameter::new("raffle_id", CLType::String),
                Parameter::new("total_slots", CLType::U64),
                Parameter::new("max_slots_per_address", CLType::U64),
                Parameter::new("price_per_slot", CLType::U512),
                Parameter::new("metadata_uri", CLType::String),
                Parameter::new("collection_hash", CLType::ByteArray(32)),
                Parameter::new("premint_contract", CLType::Bool),
                Parameter::new("premint", CLType::Bool),
                Parameter::new("auto_claim", CLType::Bool),
                Parameter::new("expires_at", CLType::U512),
                Parameter::new("permit", CLType::List(Box::new(CLType::U8))),
            ],
            CLType::Unit,
            EntryPointAccess::Public,
            EntryPointType::Called,
        )
        .into(),
    );

    entry_points.add_entry_point(
        EntryPoint::new(
            "join_raffle",
            vec![
                Parameter::new("raffle_id", CLType::String),
                Parameter::new("slot_ids", CLType::List(Box::new(CLType::U64))),
                Parameter::new("source_purse", CLType::URef),
            ],
            CLType::Unit,
            EntryPointAccess::Public,
            EntryPointType::Called,
        )
        .into(),
    );

    entry_points.add_entry_point(
        EntryPoint::new(
            "free_join_raffle",
            vec![
                Parameter::new("raffle_id", CLType::String),
                Parameter::new("slot_ids", CLType::List(Box::new(CLType::U64))),
            ],
            CLType::Unit,
            EntryPointAccess::Public,
            EntryPointType::Called,
        )
        .into(),
    );

    entry_points.add_entry_point(
        EntryPoint::new(
            "free_create_and_join",
            vec![
                Parameter::new("raffle_id", CLType::String),
                Parameter::new("total_slots", CLType::U64),
                Parameter::new("max_slots_per_address", CLType::U64),
                Parameter::new("metadata_uri", CLType::String),
                Parameter::new("collection_hash", CLType::ByteArray(32)),
                Parameter::new("premint_contract", CLType::Bool),
                Parameter::new("premint", CLType::Bool),
                Parameter::new("auto_claim", CLType::Bool),
                Parameter::new("expires_at", CLType::U512),
                Parameter::new("slot_ids", CLType::List(Box::new(CLType::U64))),
            ],
            CLType::Unit,
            EntryPointAccess::Public,
            EntryPointType::Called,
        )
        .into(),
    );

    entry_points.add_entry_point(
        EntryPoint::new(
            "unsafe_join_host_raffle",
            vec![
                Parameter::new("raffle_id", CLType::String),
                Parameter::new("total_slots", CLType::U64),
                Parameter::new("max_slots_per_address", CLType::U64),
                Parameter::new("price_per_slot", CLType::U512),
                Parameter::new("metadata_uri", CLType::String),
                Parameter::new("collection_hash", CLType::ByteArray(32)),
                Parameter::new("premint_contract", CLType::Bool),
                Parameter::new("premint", CLType::Bool),
                Parameter::new("auto_claim", CLType::Bool),
                Parameter::new("expires_at", CLType::U512),
                Parameter::new("slot_ids", CLType::List(Box::new(CLType::U64))),
                Parameter::new("source_purse", CLType::URef),
            ],
            CLType::Unit,
            EntryPointAccess::Public,
            EntryPointType::Called,
        )
        .into(),
    );

    entry_points.add_entry_point(
        EntryPoint::new(
            "claim",
            vec![Parameter::new("raffle_id", CLType::String)],
            CLType::Unit,
            EntryPointAccess::Public,
            EntryPointType::Called,
        )
        .into(),
    );

    entry_points.add_entry_point(
        EntryPoint::new(
            "withdraw_proceeds",
            vec![
                Parameter::new("to_purse", CLType::URef),
                Parameter::new("amount", CLType::U512),
            ],
            CLType::Unit,
            EntryPointAccess::Public,
            EntryPointType::Called,
        )
        .into(),
    );

    entry_points.add_entry_point(
        EntryPoint::new(
            "get_raffle_load",
            vec![Parameter::new("raffle_id", CLType::String)],
            CLType::Tuple3([
                Box::new(CLType::U64),
                Box::new(CLType::U64),
                Box::new(CLType::U8),
            ]),
            EntryPointAccess::Public,
            EntryPointType::Called,
        )
        .into(),
    );

    entry_points.add_entry_point(
        EntryPoint::new(
            "get_user_raffles",
            vec![Parameter::new("owner", CLType::Key)],
            CLType::List(Box::new(CLType::String)),
            EntryPointAccess::Public,
            EntryPointType::Called,
        )
        .into(),
    );

    entry_points.add_entry_point(
        EntryPoint::new(
            "get_user_raffle_slots",
            vec![
                Parameter::new("raffle_id", CLType::String),
                Parameter::new("owner", CLType::Key),
            ],
            CLType::List(Box::new(CLType::U64)),
            EntryPointAccess::Public,
            EntryPointType::Called,
        )
        .into(),
    );

    entry_points.add_entry_point(
        EntryPoint::new(
            "check_slots_availability",
            vec![
                Parameter::new("raffle_id", CLType::String),
                Parameter::new("slot_ids", CLType::List(Box::new(CLType::U64))),
            ],
            CLType::Tuple2([
                Box::new(CLType::Bool),
                Box::new(CLType::List(Box::new(CLType::U64))),
            ]),
            EntryPointAccess::Public,
            EntryPointType::Called,
        )
        .into(),
    );

    entry_points
}
