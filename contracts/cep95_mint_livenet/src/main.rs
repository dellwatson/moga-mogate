//! Mints an NFT on the deployed OwnedCep95 contract
use odra::casper_types::U256;
use odra::host::{HostEnv, HostRefLoader};
use odra::prelude::*;
use std::str::FromStr;

// Import the CEP95 module and interface
use odra_modules::cep95::{Cep95, Cep95HostRef, CEP95Interface};

fn main() {
    let env = odra_casper_livenet_env::env();

    // Load the deployed CEP-95 contract
    let contract_address = "hash-d3cd76c35943ab698ab24aa1991a5ad3082da8128849005b5bbd7eab65fb8ffe";
    let address = Address::from_str(contract_address).unwrap();
    
    let mut nft_contract = Cep95::load(&env, address);

    println!("CEP-95 Contract loaded: {}", address.to_string());
    println!("Name: {}", nft_contract.name());
    println!("Symbol: {}", nft_contract.symbol());

    // Prepare mint parameters
    let recipient = env.caller(); // Mint to ourselves
    let token_id = U256::from(1);
    
    // Metadata as Vec<(String, String)>
    let metadata = vec![
        ("name".to_string(), "Tixia Flight Credit".to_string()),
        ("symbol".to_string(), "TIX95".to_string()),
        ("token_uri".to_string(), "https://raw.githubusercontent.com/dellwatson/moga-mogate/refs/heads/casper-network/metadata/v2-test/nfts/casper/tixia/1o1/200/metadata.json".to_string()),
    ];

    println!("Minting token ID {} to {:?}", token_id, recipient);
    
    env.set_gas(5_000_000_000u64);
    nft_contract.mint(recipient, token_id, metadata);

    println!("✅ Mint successful!");
    println!("Owner of token {}: {:?}", token_id, nft_contract.owner_of(token_id));
    println!("Balance of {:?}: {}", recipient, nft_contract.balance_of(recipient));
}
