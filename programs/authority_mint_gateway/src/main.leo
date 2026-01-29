// Authority Mint Gateway Program for Aleo
// Migrated from AuthorityMintGateway.sol

import collection.aleo;

program authority_mint_gateway.aleo {
    @noupgrade
    async constructor() {}

    // Public state mappings
    mapping allowed_collections: address => bool;
    mapping gateway_owner: u8 => address;

    // Initialize the gateway
    async transition initialize(public owner: address) -> Future {
        return finalize_initialize(owner);
    }

    async function finalize_initialize(owner: address) {
        gateway_owner.set(0u8, owner);
    }

    // Set collection allowed status (owner only)
    async transition set_collection_allowed(
        public collection: address,
        public allowed: bool
    ) -> Future {
        return finalize_set_collection_allowed(self.caller, collection, allowed);
    }

    async function finalize_set_collection_allowed(
        caller: address,
        collection: address,
        allowed: bool
    ) {
        let owner: address = gateway_owner.get(0u8);
        assert_eq(caller, owner);
        allowed_collections.set(collection, allowed);
    }

    // Authority mint (owner only, checks allowed collections)
    async transition mint(
        public collection: address,
        public to: address,
        public uri_hash: field,
        public token_id: u64
    ) -> Future {
        return finalize_mint(self.caller, collection);
    }

    async function finalize_mint(
        caller: address,
        collection: address
    ) {
        // Check owner
        let owner: address = gateway_owner.get(0u8);
        assert_eq(caller, owner);

        // Check collection is allowed
        let is_allowed: bool = allowed_collections.get_or_use(collection, false);
        assert(is_allowed);
    }

    // Faucet-style mint (no collection check, open access)
    // WARNING: This is for testing/faucet purposes only
    transition mint_nft(
        public collection: address,
        public to: address,
        public uri_hash: field,
        public token_id: u64
    ) -> bool {
        // No permission checks - open access
        return true;
    }

    // Check if collection is allowed
    async transition is_collection_allowed(public collection: address) -> Future {
        return finalize_is_collection_allowed(collection);
    }

    async function finalize_is_collection_allowed(collection: address) {
        let is_allowed: bool = allowed_collections.get_or_use(collection, false);
    }

    // Get gateway owner
    async transition get_owner() -> Future {
        return finalize_get_owner();
    }

    async function finalize_get_owner() {
        let owner: address = gateway_owner.get(0u8);
    }
}

