// ARC-721 multi-collection private (record-based) NFT collection for Aleo - Mogate
//
// Goals (Mogate):
// - Collection identity is public (collection_id + collection metadata).
// - NFT metadata URI is public (marketplaces/backends can read it).
// - Ownership, transfers, and holdings are private (record-based; no public to/from).
// - Optional per-collection "public token_id mode" for OpenSea-like indexing.

program mogate_arc721_multiprivate_v2.aleo {
    @noupgrade
    async constructor() {}

    // --- Data structures ---

    struct data {
        metadata: [field; 4],         // Metadata URI (encoded)
    }

    struct collection_meta {
        admin: address,
        name: [field; 4],
        symbol: [field; 4],
        metadata: [field; 4],         // Collection metadata URI (encoded)
        public_token_id: bool,        // If true: token_id is public and indexed on-chain.
        is_bridged: bool,
        origin_chain_id: u32,
        origin_collection: [field; 4],
    }

    struct nft_content {
        collection_id: field,
        data: data,
    }

    record PrivateNFT {
        owner: address,
        collection_id: field,
        data: data,
        token_id: scalar,
    }

    // Private receipt for offchain verification (encrypted to receipt owner)
    record BurnReceipt {
        owner: address,
        nft_owner: address,
        collection_id: field,
        nft_commit: field,
        metadata: [field; 4],
        token_id: scalar,
    }

    struct commit_input {
        collection_id: field,
        data: data,
    }

    struct minter_key_data {
        collection_id: field,
        minter: address,
    }

    struct collection_key_data {
        collection_id: field,
        index: u8,
    }

    struct token_key_data {
        collection_id: field,
        token_id: scalar,
    }

    // --- Public state mappings ---

    mapping program_admin: u8 => address;

    mapping collections: field => collection_meta;
    mapping collection_minters: field => bool;
    mapping supply_caps: field => u64;
    mapping minted_counts: field => u64;

    mapping nft_commits: field => bool;
    mapping nft_contents: field => nft_content;

    // Optional public token ID index (enabled per collection).
    // token_key(collection_id, token_id) -> nft_commit
    mapping token_to_commit: field => field;
    // nft_commit -> token_id
    mapping commit_to_token: field => scalar;

    // --- Internal helpers ---

    inline commit_nft(
        collection_id: field,
        nft_data: data,
        token_id: scalar
    ) -> field {
        let input: commit_input = commit_input { collection_id, data: nft_data };
        let data_hash: field = BHP256::hash_to_field(input);
        let commitment: field = BHP256::commit_to_field(data_hash, token_id);
        return commitment;
    }

    inline minter_key(collection_id: field, minter: address) -> field {
        let key_data: minter_key_data = minter_key_data { collection_id, minter };
        return BHP256::hash_to_field(key_data);
    }

    inline cap_key(collection_id: field, index: u8) -> field {
        let key_data: collection_key_data = collection_key_data { collection_id, index };
        return BHP256::hash_to_field(key_data);
    }

    inline count_key(collection_id: field, index: u8) -> field {
        let key_data: collection_key_data = collection_key_data { collection_id, index };
        return BHP256::hash_to_field(key_data);
    }

    inline token_key(collection_id: field, token_id: scalar) -> field {
        let key_data: token_key_data = token_key_data { collection_id, token_id };
        return BHP256::hash_to_field(key_data);
    }

    // Public helper to compute the NFT commitment offchain (no state changes).
    transition compute_nft_commit(
        public collection_id: field,
        public nft_data: data,
        public token_id: scalar
    ) -> field {
        return commit_nft(collection_id, nft_data, token_id);
    }

    // --- Initialization ---

    async transition initialize(
        public admin: address
    ) -> Future {
        return finalize_initialize(admin);
    }

    async function finalize_initialize(
        admin: address
    ) {
        let already_initialized: bool = program_admin.contains(0u8);
        assert(!already_initialized);
        program_admin.set(0u8, admin);
    }

    // --- Collection management ---

    async transition create_collection(
        public collection_id: field,
        public admin: address,
        public name: [field; 4],
        public symbol: [field; 4],
        public metadata: [field; 4],
        public public_token_id: bool,
        public is_bridged: bool,
        public origin_chain_id: u32,
        public origin_collection: [field; 4],
        public max_mintable: u64,
        public max_first_edition: u64
    ) -> Future {
        let caller: address = self.caller;
        return finalize_create_collection(
            caller,
            collection_id,
            admin,
            name,
            symbol,
            metadata,
            public_token_id,
            is_bridged,
            origin_chain_id,
            origin_collection,
            max_mintable,
            max_first_edition
        );
    }

    async function finalize_create_collection(
        caller: address,
        collection_id: field,
        admin: address,
        name: [field; 4],
        symbol: [field; 4],
        metadata: [field; 4],
        public_token_id: bool,
        is_bridged: bool,
        origin_chain_id: u32,
        origin_collection: [field; 4],
        max_mintable: u64,
        max_first_edition: u64
    ) {
        let super_admin: address = program_admin.get(0u8);
        assert_eq(caller, super_admin);

        let exists: bool = collections.contains(collection_id);
        assert(!exists);

        let meta: collection_meta = collection_meta {
            admin,
            name,
            symbol,
            metadata,
            public_token_id,
            is_bridged,
            origin_chain_id,
            origin_collection,
        };
        collections.set(collection_id, meta);

        supply_caps.set(cap_key(collection_id, 0u8), max_mintable);
        supply_caps.set(cap_key(collection_id, 1u8), max_first_edition);
    }

    async transition set_collection_admin(
        public collection_id: field,
        public new_admin: address
    ) -> Future {
        let caller: address = self.caller;
        return finalize_set_collection_admin(caller, collection_id, new_admin);
    }

    async function finalize_set_collection_admin(
        caller: address,
        collection_id: field,
        new_admin: address
    ) {
        let meta: collection_meta = collections.get(collection_id);
        assert_eq(caller, meta.admin);

        let updated: collection_meta = collection_meta {
            admin: new_admin,
            name: meta.name,
            symbol: meta.symbol,
            metadata: meta.metadata,
            public_token_id: meta.public_token_id,
            is_bridged: meta.is_bridged,
            origin_chain_id: meta.origin_chain_id,
            origin_collection: meta.origin_collection,
        };
        collections.set(collection_id, updated);
    }

    async transition set_minter(
        public collection_id: field,
        public minter: address,
        public allowed: bool
    ) -> Future {
        let caller: address = self.caller;
        return finalize_set_minter(caller, collection_id, minter, allowed);
    }

    async function finalize_set_minter(
        caller: address,
        collection_id: field,
        minter: address,
        allowed: bool
    ) {
        let meta: collection_meta = collections.get(collection_id);
        assert_eq(caller, meta.admin);

        let key: field = minter_key(collection_id, minter);
        collection_minters.set(key, allowed);
    }

    // --- Minting ---

    // Mint private NFT with private ownership record (token_id is private/hidden).
    async transition mint_private(
        public collection_id: field,
        private recipient: address,
        public nft_data: data,
        private token_id: scalar
    ) -> (PrivateNFT, Future) {
        let nft: PrivateNFT = PrivateNFT {
            owner: recipient,
            collection_id,
            data: nft_data,
            token_id,
        };

        let caller: address = self.caller;
        let nft_commit: field = commit_nft(collection_id, nft_data, token_id);
        let is_first_edition: bool = token_id == 1scalar;
        let future: Future = finalize_mint_private(
            caller,
            collection_id,
            nft_data,
            nft_commit,
            is_first_edition
        );
        return (nft, future);
    }

    async function finalize_mint_private(
        caller: address,
        collection_id: field,
        nft_data: data,
        nft_commit: field,
        is_first_edition: bool
    ) {
        let meta: collection_meta = collections.get(collection_id);
        // Enforce the correct collection mode.
        assert(!meta.public_token_id);
        let key: field = minter_key(collection_id, caller);
        let is_minter: bool = collection_minters.get_or_use(key, false);
        assert(caller == meta.admin || is_minter);

        // Enforce supply caps (0 means infinite)
        let max_mintable: u64 = supply_caps.get_or_use(
            cap_key(collection_id, 0u8),
            0u64
        );
        if max_mintable != 0u64 {
            let minted_total: u64 = minted_counts.get_or_use(
                count_key(collection_id, 0u8),
                0u64
            );
            assert(minted_total < max_mintable);
        }

        if is_first_edition {
            let max_first_edition: u64 = supply_caps.get_or_use(
                cap_key(collection_id, 1u8),
                0u64
            );
            if max_first_edition != 0u64 {
                let minted_first: u64 = minted_counts.get_or_use(
                    count_key(collection_id, 1u8),
                    0u64
                );
                assert(minted_first < max_first_edition);
            }
        }

        let exists: bool = nft_commits.get_or_use(nft_commit, false);
        assert(!exists);

        nft_commits.set(nft_commit, true);

        // Metadata is public by design (marketplaces/backends can read it).
        let content: nft_content = nft_content { collection_id, data: nft_data };
        nft_contents.set(nft_commit, content);

        // Update mint counters
        let minted_total: u64 = minted_counts.get_or_use(
            count_key(collection_id, 0u8),
            0u64
        );
        minted_counts.set(
            count_key(collection_id, 0u8),
            minted_total + 1u64
        );

        if is_first_edition {
            let minted_first: u64 = minted_counts.get_or_use(
                count_key(collection_id, 1u8),
                0u64
            );
            minted_counts.set(
                count_key(collection_id, 1u8),
                minted_first + 1u64
            );
        }
    }

    // Mint private NFT with a public token_id (indexed on-chain if the collection enables it).
    async transition mint_private_public_id(
        public collection_id: field,
        private recipient: address,
        public nft_data: data,
        public token_id: scalar
    ) -> (PrivateNFT, Future) {
        let nft: PrivateNFT = PrivateNFT {
            owner: recipient,
            collection_id,
            data: nft_data,
            token_id,
        };

        let caller: address = self.caller;
        let nft_commit: field = commit_nft(collection_id, nft_data, token_id);
        let is_first_edition: bool = token_id == 1scalar;
        let future: Future = finalize_mint_private_public_id(
            caller,
            collection_id,
            nft_data,
            nft_commit,
            token_id,
            is_first_edition
        );
        return (nft, future);
    }

    async function finalize_mint_private_public_id(
        caller: address,
        collection_id: field,
        nft_data: data,
        nft_commit: field,
        token_id: scalar,
        is_first_edition: bool
    ) {
        let meta: collection_meta = collections.get(collection_id);
        // Enforce the correct collection mode.
        assert(meta.public_token_id);
        let key: field = minter_key(collection_id, caller);
        let is_minter: bool = collection_minters.get_or_use(key, false);
        assert(caller == meta.admin || is_minter);

        // Enforce supply caps (0 means infinite)
        let max_mintable: u64 = supply_caps.get_or_use(
            cap_key(collection_id, 0u8),
            0u64
        );
        if max_mintable != 0u64 {
            let minted_total: u64 = minted_counts.get_or_use(
                count_key(collection_id, 0u8),
                0u64
            );
            assert(minted_total < max_mintable);
        }

        if is_first_edition {
            let max_first_edition: u64 = supply_caps.get_or_use(
                cap_key(collection_id, 1u8),
                0u64
            );
            if max_first_edition != 0u64 {
                let minted_first: u64 = minted_counts.get_or_use(
                    count_key(collection_id, 1u8),
                    0u64
                );
                assert(minted_first < max_first_edition);
            }
        }

        // Prevent duplicate commits.
        let exists: bool = nft_commits.get_or_use(nft_commit, false);
        assert(!exists);

        // Prevent duplicate public token IDs for this collection.
        let tkey: field = token_key(collection_id, token_id);
        let token_taken: bool = token_to_commit.contains(tkey);
        assert(!token_taken);

        nft_commits.set(nft_commit, true);

        // Public metadata.
        let content: nft_content = nft_content { collection_id, data: nft_data };
        nft_contents.set(nft_commit, content);

        // Public token-id index.
        token_to_commit.set(tkey, nft_commit);
        commit_to_token.set(nft_commit, token_id);

        // Update mint counters
        let minted_total: u64 = minted_counts.get_or_use(
            count_key(collection_id, 0u8),
            0u64
        );
        minted_counts.set(
            count_key(collection_id, 0u8),
            minted_total + 1u64
        );

        if is_first_edition {
            let minted_first: u64 = minted_counts.get_or_use(
                count_key(collection_id, 1u8),
                0u64
            );
            minted_counts.set(
                count_key(collection_id, 1u8),
                minted_first + 1u64
            );
        }
    }

    // --- Transfers ---

    // Pure record transfer: no public finalize step, so to/from remain private.
    transition transfer_private(
        private nft: PrivateNFT,
        private to: address
    ) -> PrivateNFT {
        let new_nft: PrivateNFT = PrivateNFT {
            owner: to,
            collection_id: nft.collection_id,
            data: nft.data,
            token_id: nft.token_id,
        };
        return new_nft;
    }

    // --- Burn ---

    async transition burn_private(
        private nft: PrivateNFT
    ) -> Future {
        let nft_commit: field = commit_nft(nft.collection_id, nft.data, nft.token_id);
        return finalize_burn_private(nft_commit);
    }

    async transition burn_private_with_receipt(
        private nft: PrivateNFT
    ) -> (BurnReceipt, Future) {
        let caller: address = self.caller;
        let receipt: BurnReceipt = BurnReceipt {
            owner: caller,
            nft_owner: nft.owner,
            collection_id: nft.collection_id,
            nft_commit: commit_nft(nft.collection_id, nft.data, nft.token_id),
            metadata: nft.data.metadata,
            token_id: nft.token_id,
        };
        let future: Future = finalize_burn_private(receipt.nft_commit);
        return (receipt, future);
    }

    async transition burn_private_with_receipt_to(
        private nft: PrivateNFT,
        public receipt_owner: address
    ) -> (BurnReceipt, Future) {
        let caller: address = self.caller;
        let receipt: BurnReceipt = BurnReceipt {
            owner: receipt_owner,
            nft_owner: nft.owner,
            collection_id: nft.collection_id,
            nft_commit: commit_nft(nft.collection_id, nft.data, nft.token_id),
            metadata: nft.data.metadata,
            token_id: nft.token_id,
        };
        let future: Future = finalize_burn_private(receipt.nft_commit);
        return (receipt, future);
    }

    async function finalize_burn_private(
        nft_commit: field
    ) {
        let exists: bool = nft_commits.get_or_use(nft_commit, false);
        assert(exists);

        // We always publish nft_contents on mint; use it to locate the collection_id.
        let has_content: bool = nft_contents.contains(nft_commit);
        assert(has_content);

        let content: nft_content = nft_contents.get(nft_commit);
        let collection_id: field = content.collection_id;

        // Remove public token-id index if present.
        if commit_to_token.contains(nft_commit) {
            let token_id: scalar = commit_to_token.get(nft_commit);
            let tkey: field = token_key(collection_id, token_id);
            token_to_commit.remove(tkey);
            commit_to_token.remove(nft_commit);
        }

        nft_contents.remove(nft_commit);
        nft_commits.remove(nft_commit);
    }

    // --- Metadata ---
    // Metadata is published at mint (nft_contents[nft_commit]).
}
