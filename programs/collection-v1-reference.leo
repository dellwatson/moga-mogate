// Collection NFT Program for Aleo - V1 (DEPLOYED)
// Migrated from Collection.sol
// Program Name: mogate_nft_collection_rwa.aleo
// Status: DEPLOYED on testnet
// TX: at1as952eycv6h7ypdph0rj8tfzr0c89arg7gtsyztsr8x08n9hkc9sf62wjd
 
program mogate_nft_collection_rwa.aleo {
    @noupgrade
    async constructor() {}

    // NFT record structure - private by default in Aleo
    record NFT {
        owner: address,
        token_id: u64,
        uri: field, // URI hash stored as field
        collection: address,
    }

    // Public state mappings
    mapping operators: address => bool;
    mapping minters: address => bool;
    mapping token_owners: u64 => address;
    mapping token_uris: u64 => field;
    mapping next_token_id: u8 => u64; // Single counter
    mapping collection_owner: u8 => address;

    // Initialize the collection
    async transition initialize(public owner: address) -> Future {
        return finalize_initialize(owner);
    }

    async function finalize_initialize(owner: address) {
        // Set the collection owner (key 0u8 for single owner)
        collection_owner.set(0u8, owner);
        // Initialize token counter
        next_token_id.set(0u8, 0u64);
    }

    // Set operator status (owner only)
    async transition set_operator(
        public operator: address,
        public allowed: bool
    ) -> Future {
        return finalize_set_operator(self.caller, operator, allowed);
    }

    async function finalize_set_operator(
        caller: address,
        operator: address,
        allowed: bool
    ) {
        let owner: address = collection_owner.get(0u8);
        assert_eq(caller, owner);
        operators.set(operator, allowed);
    }

    // Set minter status (owner or operator)
    async transition set_minter(
        public minter: address,
        public allowed: bool
    ) -> Future {
        return finalize_set_minter(self.caller, minter, allowed);
    }

    async function finalize_set_minter(
        caller: address,
        minter: address,
        allowed: bool
    ) {
        let owner: address = collection_owner.get(0u8);
        let is_operator: bool = operators.get_or_use(caller, false);
        assert(caller == owner || is_operator);
        minters.set(minter, allowed);
    }

    // Mint NFT with auto-incrementing token ID
    async transition mint_to(
        public to: address,
        public uri_hash: field
    ) -> (NFT, Future) {
        let nft: NFT = NFT {
            owner: to,
            token_id: 0u64, // Will be set in finalize
            uri: uri_hash,
            collection: self.address,
        };

        let future: Future = finalize_mint_to(self.caller, to, uri_hash);
        return (nft, future);
    }

    async function finalize_mint_to(
        caller: address,
        to: address,
        uri_hash: field
    ) {
        // Check minter permission
        let is_minter: bool = minters.get_or_use(caller, false);
        assert(is_minter);

        // Get and increment token ID
        let current_id: u64 = next_token_id.get_or_use(0u8, 0u64);
        let new_id: u64 = current_id + 1u64;
        next_token_id.set(0u8, new_id);

        // Store token data
        token_owners.set(new_id, to);
        token_uris.set(new_id, uri_hash);
    }

    // Mint NFT with specific token ID
    async transition mint_with_token_id(
        public to: address,
        public token_id: u64,
        public uri_hash: field
    ) -> (NFT, Future) {
        let nft: NFT = NFT {
            owner: to,
            token_id: token_id,
            uri: uri_hash,
            collection: self.address,
        };

        let future: Future = finalize_mint_with_token_id(
            self.caller,
            to,
            token_id,
            uri_hash
        );
        return (nft, future);
    }

    async function finalize_mint_with_token_id(
        caller: address,
        to: address,
        token_id: u64,
        uri_hash: field
    ) {
        // Check minter permission
        let is_minter: bool = minters.get_or_use(caller, false);
        assert(is_minter);

        // Ensure token doesn't exist
        let exists: bool = token_owners.contains(token_id);
        assert(!exists);

        // Store token data
        token_owners.set(token_id, to);
        token_uris.set(token_id, uri_hash);
    }

    // Transfer NFT
    async transition transfer(
        nft: NFT,
        public to: address
    ) -> (NFT, Future) {
        let updated_nft: NFT = NFT {
            owner: to,
            token_id: nft.token_id,
            uri: nft.uri,
            collection: nft.collection,
        };

        let future: Future = finalize_transfer(nft.token_id, to);
        return (updated_nft, future);
    }

    async function finalize_transfer(
        token_id: u64,
        to: address
    ) {
        token_owners.set(token_id, to);
    }

    // Burn NFT
    async transition burn(nft: NFT) -> Future {
        return finalize_burn(nft.token_id);
    }

    async function finalize_burn(token_id: u64) {
        // Remove token from mappings
        token_owners.remove(token_id);
        token_uris.remove(token_id);
    }

    // View functions (public queries)
    async transition get_token_owner(public token_id: u64) -> Future {
        return finalize_get_token_owner(token_id);
    }

    async function finalize_get_token_owner(token_id: u64) {
        let owner: address = token_owners.get(token_id);
    }

    async transition get_token_uri(public token_id: u64) -> Future {
        return finalize_get_token_uri(token_id);
    }

    async function finalize_get_token_uri(token_id: u64) {
        let uri: field = token_uris.get(token_id);
    }
}

