// ARC-721 multi-collection private (record-based) NFT collection for Aleo - Mogate

program mogate_arc721_multiprivate.aleo {
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
        is_bridged: bool,
        origin_chain_id: u32,
        origin_collection: [field; 4],
    }

    struct nft_content {
        collection_id: field,
        data: data,
        edition: scalar,
    }

    record PrivateNFT {
        owner: address,
        collection_id: field,
        data: data,
        edition: scalar,
    }

    // Private receipt for offchain verification (encrypted to receipt owner)
    record BurnReceipt {
        owner: address,
        nft_owner: address,
        collection_id: field,
        nft_commit: field,
        metadata: [field; 4],
        edition: scalar,
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

    // --- Public state mappings ---

    mapping program_admin: u8 => address;

    mapping collections: field => collection_meta;
    mapping collection_minters: field => bool;
    mapping supply_caps: field => u64;
    mapping minted_counts: field => u64;

    mapping nft_commits: field => bool;
    mapping nft_contents: field => nft_content;

    // --- Internal helpers ---

    inline commit_nft(
        collection_id: field,
        nft_data: data,
        nft_edition: scalar
    ) -> field {
        let input: commit_input = commit_input { collection_id, data: nft_data };
        let data_hash: field = BHP256::hash_to_field(input);
        let commitment: field = BHP256::commit_to_field(data_hash, nft_edition);
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

    // Public helper to compute the NFT commitment offchain (no state changes).
    transition compute_nft_commit(
        public collection_id: field,
        public nft_data: data,
        public nft_edition: scalar
    ) -> field {
        return commit_nft(collection_id, nft_data, nft_edition);
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

    // Mint private NFT with private ownership record
    async transition mint_private(
        public collection_id: field,
        public recipient: address,
        private nft_data: data,
        private nft_edition: scalar
    ) -> (PrivateNFT, Future) {
        let nft: PrivateNFT = PrivateNFT {
            owner: recipient,
            collection_id,
            data: nft_data,
            edition: nft_edition,
        };

        let caller: address = self.caller;
        let future: Future = finalize_mint_private(
            caller,
            collection_id,
            recipient,
            nft_data,
            nft_edition
        );
        return (nft, future);
    }

    async function finalize_mint_private(
        caller: address,
        collection_id: field,
        recipient: address,
        nft_data: data,
        nft_edition: scalar
    ) {
        let meta: collection_meta = collections.get(collection_id);
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

        let is_first_edition: bool = nft_edition == 1scalar;
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

        let nft_commit: field = commit_nft(collection_id, nft_data, nft_edition);
        let exists: bool = nft_commits.get_or_use(nft_commit, false);
        assert(!exists);

        nft_commits.set(nft_commit, true);

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

    async transition transfer_private(
        private nft: PrivateNFT,
        public to: address
    ) -> (PrivateNFT, Future) {
        let caller: address = self.caller;
        let new_nft: PrivateNFT = PrivateNFT {
            owner: to,
            collection_id: nft.collection_id,
            data: nft.data,
            edition: nft.edition,
        };

        let future: Future = finalize_transfer_private(
            caller,
            nft.owner,
            nft.collection_id,
            nft.data,
            nft.edition
        );
        return (new_nft, future);
    }

    async function finalize_transfer_private(
        caller: address,
        owner: address,
        collection_id: field,
        nft_data: data,
        nft_edition: scalar
    ) {
        assert_eq(caller, owner);

        let nft_commit: field = commit_nft(collection_id, nft_data, nft_edition);
        let exists: bool = nft_commits.get_or_use(nft_commit, false);
        assert(exists);
    }

    // --- Burn ---

    async transition burn_private(
        private nft: PrivateNFT
    ) -> Future {
        let caller: address = self.caller;
        return finalize_burn_private(
            caller,
            nft.owner,
            nft.collection_id,
            nft.data,
            nft.edition
        );
    }

    async transition burn_private_with_receipt(
        private nft: PrivateNFT
    ) -> (BurnReceipt, Future) {
        let caller: address = self.caller;
        let receipt: BurnReceipt = BurnReceipt {
            owner: caller,
            nft_owner: nft.owner,
            collection_id: nft.collection_id,
            nft_commit: commit_nft(nft.collection_id, nft.data, nft.edition),
            metadata: nft.data.metadata,
            edition: nft.edition,
        };
        let future: Future = finalize_burn_private(
            caller,
            nft.owner,
            nft.collection_id,
            nft.data,
            nft.edition
        );
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
            nft_commit: commit_nft(nft.collection_id, nft.data, nft.edition),
            metadata: nft.data.metadata,
            edition: nft.edition,
        };
        let future: Future = finalize_burn_private(
            caller,
            nft.owner,
            nft.collection_id,
            nft.data,
            nft.edition
        );
        return (receipt, future);
    }

    async function finalize_burn_private(
        caller: address,
        owner: address,
        collection_id: field,
        nft_data: data,
        nft_edition: scalar
    ) {
        assert_eq(caller, owner);

        let nft_commit: field = commit_nft(collection_id, nft_data, nft_edition);
        let exists: bool = nft_commits.get_or_use(nft_commit, false);
        assert(exists);

        nft_commits.remove(nft_commit);
        if nft_contents.contains(nft_commit) {
            nft_contents.remove(nft_commit);
        }
    }

    // --- Metadata publishing ---

    // Owner publishes content using their private NFT record
    async transition publish_nft_content_owner(
        private nft: PrivateNFT
    ) -> Future {
        let caller: address = self.caller;
        return finalize_publish_content_owner(
            caller,
            nft.owner,
            nft.collection_id,
            nft.data,
            nft.edition
        );
    }

    async function finalize_publish_content_owner(
        caller: address,
        owner: address,
        collection_id: field,
        nft_data: data,
        nft_edition: scalar
    ) {
        assert_eq(caller, owner);

        let nft_commit: field = commit_nft(collection_id, nft_data, nft_edition);
        let exists: bool = nft_commits.get_or_use(nft_commit, false);
        assert(exists);

        let content: nft_content = nft_content {
            collection_id,
            data: nft_data,
            edition: nft_edition,
        };
        nft_contents.set(nft_commit, content);
    }

    // Admin publishes content with public data (optional policy)
    async transition publish_nft_content_admin(
        public collection_id: field,
        public nft_data: data,
        public nft_edition: scalar
    ) -> Future {
        let caller: address = self.caller;
        return finalize_publish_content_admin(caller, collection_id, nft_data, nft_edition);
    }

    async function finalize_publish_content_admin(
        caller: address,
        collection_id: field,
        nft_data: data,
        nft_edition: scalar
    ) {
        let meta: collection_meta = collections.get(collection_id);
        assert_eq(caller, meta.admin);

        let nft_commit: field = commit_nft(collection_id, nft_data, nft_edition);
        let exists: bool = nft_commits.get_or_use(nft_commit, false);
        assert(exists);

        let content: nft_content = nft_content {
            collection_id,
            data: nft_data,
            edition: nft_edition,
        };
        nft_contents.set(nft_commit, content);
    }
}
