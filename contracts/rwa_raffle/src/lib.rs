#![no_std]
#![no_main]

extern crate alloc;

use alloc::string::ToString;
use casper_contract::contract_api::{runtime, storage};
use casper_types::{ApiError, CLType, EntryPoint, EntryPointAccess, EntryPointType, EntryPoints, Parameter, U256, U512};

const CONTRACT_NAME: &str = "rwa_raffle_cspr";

#[repr(u16)]
pub enum RwaRaffleError {
    InvalidAmount = 1,
    InvalidDeadline = 2,
    WrongStatus = 3,
}

impl From<RwaRaffleError> for ApiError {
    fn from(error: RwaRaffleError) -> ApiError {
        ApiError::User(error as u16)
    }
}

#[no_mangle]
pub extern "C" fn init() {
    // TODO: initialize raffle parameters (required_tickets, deadline, auto_draw, etc.)
}

#[no_mangle]
pub extern "C" fn join() {
    // TODO: join raffle by depositing tokens on Casper
}

#[no_mangle]
pub extern "C" fn refund() {
    // TODO: refund flow for participants
}

#[no_mangle]
pub extern "C" fn draw() {
    // TODO: trigger randomness / draw winner
}

#[no_mangle]
pub extern "C" fn call() {
    let entry_points = get_entry_points();
    let (contract_hash, _version) = storage::new_contract(
        entry_points,
        None,
        Some(CONTRACT_NAME.to_string()),
        None,
    );

    runtime::put_key(CONTRACT_NAME, contract_hash.into());
}

fn get_entry_points() -> EntryPoints {
    let mut entry_points = EntryPoints::new();

    // Initialize raffle (similar to initialize_raffle on Solana)
    entry_points.add_entry_point(EntryPoint::new(
        "init",
        vec![
            Parameter::new("required_tickets", U256::cl_type()),
            Parameter::new("deadline_unix_ts", U512::cl_type()),
            Parameter::new("auto_draw", CLType::Bool),
        ],
        CLType::Unit,
        EntryPointType::Contract,
        EntryPointAccess::Public,
    ));

    // Join raffle (similar to deposit / join_with_moga)
    entry_points.add_entry_point(EntryPoint::new(
        "join",
        vec![],
        CLType::Unit,
        EntryPointType::Contract,
        EntryPointAccess::Public,
    ));

    // Refund tickets
    entry_points.add_entry_point(EntryPoint::new(
        "refund",
        vec![],
        CLType::Unit,
        EntryPointType::Contract,
        EntryPointAccess::Public,
    ));

    // Draw winner
    entry_points.add_entry_point(EntryPoint::new(
        "draw",
        vec![],
        CLType::Unit,
        EntryPointType::Contract,
        EntryPointAccess::Public,
    ));

    entry_points
}
