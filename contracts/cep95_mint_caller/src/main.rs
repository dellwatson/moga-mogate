#![no_std]
#![no_main]

extern crate alloc;

use alloc::{string::String, vec, vec::Vec};
use casper_contract::{
    contract_api::runtime,
    unwrap_or_revert::UnwrapOrRevert,
};
use casper_types::{runtime_args, ContractHash, Key, RuntimeArgs, U256};

const ARG_CONTRACT_HASH: &str = "contract_hash";
const ARG_TOKEN_ID: &str = "token_id";

#[no_mangle]
pub extern "C" fn call() {
    // Get contract hash directly as Key
    let contract_key: Key = runtime::get_named_arg(ARG_CONTRACT_HASH);
    let contract_hash = contract_key.into_hash()
        .map(ContractHash::new)
        .unwrap_or_else(|| runtime::revert(casper_types::ApiError::InvalidArgument));
    
    // Use caller as recipient
    let recipient = runtime::get_caller();
    let token_id: U256 = runtime::get_named_arg(ARG_TOKEN_ID);

    // Create metadata as Vec<(String, String)>
    let metadata: Vec<(String, String)> = vec![
        ("name".into(), "Tixia Flight Credit".into()),
        ("symbol".into(), "TIX95".into()),
        (
            "token_uri".into(),
            "https://raw.githubusercontent.com/dellwatson/moga-mogate/refs/heads/master/metadata/v2-test/nfts/casper/tixia/1o1/200/metadata.json".into(),
        ),
    ];

    let args = runtime_args! {
        "to" => recipient,
        "token_id" => token_id,
        "metadata" => metadata,
    };

    runtime::call_contract::<()>(contract_hash, "mint", args);
}
