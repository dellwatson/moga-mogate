use odra::casper_types::U256;
use odra::prelude::*;

/// External trait for CEP-95 NFT contracts
#[odra::external_contract]
pub trait Cep95 {
    fn mint(&mut self, to: Address, token_id: U256, metadata: Vec<(String, String)>);
}

/// Authority Mint contract - delegates minting to allowed NFT collections
#[odra::module]
pub struct AuthorityMint {
    allowed_collections: Var<Vec<Address>>,
    mints: Var<Vec<(Address, Address, u64)>>,
}

#[odra::module]
impl AuthorityMint {
    /// Initialize empty config.
    pub fn init(&mut self) {
        self.allowed_collections.set(Vec::new());
        self.mints.set(Vec::new());
    }

    /// Allow this contract to act as mint authority for a given collection.
    pub fn allow_collection(&mut self, collection: Address) {
        let mut list = self.allowed_collections.get_or_default();
        if !list.contains(&collection) {
            list.push(collection);
            self.allowed_collections.set(list);
        }
    }

    /// Revoke authority for a given collection.
    pub fn disallow_collection(&mut self, collection: Address) {
        let mut list = self.allowed_collections.get_or_default();
        list.retain(|c| c != &collection);
        self.allowed_collections.set(list);
    }

    /// Check if a collection is currently allowed.
    pub fn is_collection_allowed(&self, collection: Address) -> bool {
        let list = self.allowed_collections.get_or_default();
        list.contains(&collection)
    }

    /// Mint NFT on a collection (like Solana's mint_nft)
    /// This is the main function users call
    pub fn mint_nft(
        &mut self,
        collection: Address,
        recipient: Address,
        token_id: U256,
        name: String,
        symbol: String,
        token_uri: String,
    ) {
        // Check if collection is allowed
        if !self.is_collection_allowed(collection) {
            self.env().revert(Error::CollectionNotAllowed);
        }

        // Build metadata in CEP-95 format
        let metadata = vec![
            ("name".to_string(), name),
            ("symbol".to_string(), symbol),
            ("token_uri".to_string(), token_uri),
        ];

        // Cross-contract call to NFT contract's mint function
        let mut nft_contract = Cep95Ref::new(self.env(), collection);
        nft_contract.mint(recipient, token_id, metadata);

        // Record the mint
        let mut mints = self.mints.get_or_default();
        mints.push((collection, recipient, token_id.as_u64()));
        self.mints.set(mints);
    }

    /// Low-level mint with custom metadata (for advanced use)
    pub fn mint_for_collection(
        &mut self, 
        collection: Address, 
        to: Address, 
        token_id: U256,
        metadata: Vec<(String, String)>
    ) {
        if !self.is_collection_allowed(collection) {
            self.env().revert(Error::CollectionNotAllowed);
        }

        let mut nft_contract = Cep95Ref::new(self.env(), collection);
        nft_contract.mint(to, token_id, metadata);

        let mut mints = self.mints.get_or_default();
        mints.push((collection, to, token_id.as_u64()));
        self.mints.set(mints);
    }

    /// Return all recorded delegated mints (for testing).
    pub fn get_mints(&self) -> Vec<(Address, Address, u64)> {
        self.mints.get_or_default()
    }
}

#[odra::odra_error]
pub enum Error {
    CollectionNotAllowed = 1,
}
