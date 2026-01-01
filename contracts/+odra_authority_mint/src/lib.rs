use odra::prelude::*;

/// Skeleton for an Odra-based authority mint contract.
/// We'll later mirror the old Solana `authority_mint` behavior here.
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

    /// Record a delegated mint for an allowed collection.
    /// Later we can replace this with a real cross-contract call into the
    /// collection NFT contract on Casper.
    pub fn mint_for_collection(&mut self, collection: Address, to: Address, token_id: u64) {
        if !self.is_collection_allowed(collection) {
            return;
        }

        let mut mints = self.mints.get_or_default();
        mints.push((collection, to, token_id));
        self.mints.set(mints);
    }

    /// Return all recorded delegated mints (for testing).
    pub fn get_mints(&self) -> Vec<(Address, Address, u64)> {
        self.mints.get_or_default()
    }
}
