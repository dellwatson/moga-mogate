// ARC-721 private (record-based) NFT collection for Aleo - Mogate

program mogate_arc721_private.aleo {
    @noupgrade
    async constructor() {}

    // --- Data structures ---

    struct attribute {
        trait_type: [field; 4],
        trait_value: [field; 4],
    }

    struct data {
        metadata: [field; 4],         // URI of off-chain metadata JSON (encoded)
        name: [field; 4],             // Optional name
        image: [field; 16],           // Optional image
        attributes: [attribute; 4],   // Optional attributes
    }

    struct nft_content {
        data: data,
        edition: scalar,
    }

    record PrivateNFT {
        owner: address,
        data: data,
        edition: scalar,
    }

    // Private receipt for offchain verification (encrypted to receipt owner)
    record BurnReceipt {
        owner: address,
        nft_owner: address,
        nft_commit: field,
    }

    // --- Public state mappings ---

    mapping nft_commits: field => bool;
    mapping nft_contents: field => nft_content;

    // Collection settings (ARC-721 recommended layout)
    mapping general_settings: u8 => field;
    // 0u8 - max mintable NFTs (all editions)
    // 1u8 - max number of first-edition NFTs
    // 2u8 - symbol
    // 3u8..6u8 - base URI parts
    // 7u8 - admin address hash

    // Collection admin
    mapping collection_admin: u8 => address;

    // Allowed minters (admin-controlled)
    mapping minters: address => bool;

    // Supply caps and counters (u64; 0 means infinite)
    mapping supply_caps: u8 => u64;
    // 0u8 - max mintable NFTs (all editions)
    // 1u8 - max number of first-edition NFTs
    mapping minted_counts: u8 => u64;
    // 0u8 - total minted count
    // 1u8 - first-edition minted count

    // --- Internal helpers ---

    inline commit_nft(nft_data: data, nft_edition: scalar) -> field {
        let data_hash: field = BHP256::hash_to_field(nft_data);
        let commitment: field = BHP256::commit_to_field(data_hash, nft_edition);
        return commitment;
    }

    // Public helper to compute the NFT commitment offchain (no state changes).
    transition compute_nft_commit(
        public nft_data: data,
        public nft_edition: scalar
    ) -> field {
        return commit_nft(nft_data, nft_edition);
    }

    // --- Initialization ---

    async transition initialize(
        public admin: address,
        public max_mintable: u64,
        public max_first_edition: u64,
        public symbol: field
    ) -> Future {
        return finalize_initialize(admin, max_mintable, max_first_edition, symbol);
    }

    async function finalize_initialize(
        admin: address,
        max_mintable: u64,
        max_first_edition: u64,
        symbol: field
    ) {
        // One-time initialization guard
        let already_initialized: bool = collection_admin.contains(0u8);
        assert(!already_initialized);

        collection_admin.set(0u8, admin);

        // Configure basic settings
        let max_mintable_field: field = max_mintable as field;
        let max_first_edition_field: field = max_first_edition as field;
        general_settings.set(0u8, max_mintable_field);
        general_settings.set(1u8, max_first_edition_field);
        general_settings.set(2u8, symbol);

        let admin_hash: field = BHP256::hash_to_field(admin);
        general_settings.set(7u8, admin_hash);

        // Store caps for enforcement (0 means infinite)
        supply_caps.set(0u8, max_mintable);
        supply_caps.set(1u8, max_first_edition);
    }

    // --- Admin controls ---

    async transition set_minter(
        public minter: address,
        public allowed: bool
    ) -> Future {
        let caller: address = self.caller;
        return finalize_set_minter(caller, minter, allowed);
    }

    async function finalize_set_minter(
        caller: address,
        minter: address,
        allowed: bool
    ) {
        let admin: address = collection_admin.get(0u8);
        assert_eq(caller, admin);
        minters.set(minter, allowed);
    }

    // --- Minting ---

    // Mint private NFT with private ownership record
    async transition mint_private(
        public recipient: address,
        private nft_data: data,
        private nft_edition: scalar
    ) -> (PrivateNFT, Future) {
        let nft: PrivateNFT = PrivateNFT {
            owner: recipient,
            data: nft_data,
            edition: nft_edition,
        };

        let caller: address = self.caller;
        let future: Future = finalize_mint_private(
            caller,
            recipient,
            nft_data,
            nft_edition
        );
        return (nft, future);
    }

    async function finalize_mint_private(
        caller: address,
        recipient: address,
        nft_data: data,
        nft_edition: scalar
    ) {
        // Admin or approved minter can mint
        let admin: address = collection_admin.get(0u8);
        let is_minter: bool = minters.get_or_use(caller, false);
        assert(caller == admin || is_minter);

        // Enforce supply caps (0 means infinite)
        let max_mintable: u64 = supply_caps.get_or_use(0u8, 0u64);
        if max_mintable != 0u64 {
            let minted_total: u64 = minted_counts.get_or_use(0u8, 0u64);
            assert(minted_total < max_mintable);
        }

        let is_first_edition: bool = nft_edition == 1scalar;
        if is_first_edition {
            let max_first_edition: u64 = supply_caps.get_or_use(1u8, 0u64);
            if max_first_edition != 0u64 {
                let minted_first: u64 = minted_counts.get_or_use(1u8, 0u64);
                assert(minted_first < max_first_edition);
            }
        }

        let nft_commit: field = commit_nft(nft_data, nft_edition);
        let exists: bool = nft_commits.get_or_use(nft_commit, false);
        assert(!exists);

        nft_commits.set(nft_commit, true);

        // Update mint counters
        let minted_total: u64 = minted_counts.get_or_use(0u8, 0u64);
        minted_counts.set(0u8, minted_total + 1u64);
        if is_first_edition {
            let minted_first: u64 = minted_counts.get_or_use(1u8, 0u64);
            minted_counts.set(1u8, minted_first + 1u64);
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
            data: nft.data,
            edition: nft.edition,
        };

        let future: Future = finalize_transfer_private(
            caller,
            nft.owner,
            nft.data,
            nft.edition
        );
        return (new_nft, future);
    }

    async function finalize_transfer_private(
        caller: address,
        owner: address,
        nft_data: data,
        nft_edition: scalar
    ) {
        assert_eq(caller, owner);

        let nft_commit: field = commit_nft(nft_data, nft_edition);
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
            nft.data,
            nft.edition
        );
    }

    // Burn with a receipt encrypted to the NFT owner (caller).
    async transition burn_private_with_receipt(
        private nft: PrivateNFT
    ) -> (BurnReceipt, Future) {
        let receipt: BurnReceipt = BurnReceipt {
            owner: nft.owner,
            nft_owner: nft.owner,
            nft_commit: commit_nft(nft.data, nft.edition),
        };

        let caller: address = self.caller;
        let future: Future = finalize_burn_private(
            caller,
            nft.owner,
            nft.data,
            nft.edition
        );
        return (receipt, future);
    }

    // Burn with a receipt encrypted to a specified recipient (e.g., backend).
    async transition burn_private_with_receipt_to(
        private nft: PrivateNFT,
        public receipt_recipient: address
    ) -> (BurnReceipt, Future) {
        let receipt: BurnReceipt = BurnReceipt {
            owner: receipt_recipient,
            nft_owner: nft.owner,
            nft_commit: commit_nft(nft.data, nft.edition),
        };

        let caller: address = self.caller;
        let future: Future = finalize_burn_private(
            caller,
            nft.owner,
            nft.data,
            nft.edition
        );
        return (receipt, future);
    }

    async function finalize_burn_private(
        caller: address,
        owner: address,
        nft_data: data,
        nft_edition: scalar
    ) {
        assert_eq(caller, owner);

        let nft_commit: field = commit_nft(nft_data, nft_edition);
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
            nft.data,
            nft.edition
        );
    }

    async function finalize_publish_content_owner(
        caller: address,
        owner: address,
        nft_data: data,
        nft_edition: scalar
    ) {
        assert_eq(caller, owner);

        let nft_commit: field = commit_nft(nft_data, nft_edition);
        let exists: bool = nft_commits.get_or_use(nft_commit, false);
        assert(exists);

        let content: nft_content = nft_content {
            data: nft_data,
            edition: nft_edition,
        };
        nft_contents.set(nft_commit, content);
    }

    // Admin publishes content with public data (optional policy)
    async transition publish_nft_content_admin(
        public nft_data: data,
        public nft_edition: scalar
    ) -> Future {
        let caller: address = self.caller;
        return finalize_publish_content_admin(caller, nft_data, nft_edition);
    }

    async function finalize_publish_content_admin(
        caller: address,
        nft_data: data,
        nft_edition: scalar
    ) {
        let admin: address = collection_admin.get(0u8);
        assert_eq(caller, admin);

        let nft_commit: field = commit_nft(nft_data, nft_edition);
        let exists: bool = nft_commits.get_or_use(nft_commit, false);
        assert(exists);

        let content: nft_content = nft_content {
            data: nft_data,
            edition: nft_edition,
        };
        nft_contents.set(nft_commit, content);
    }

    // --- Simple views (public queries) ---

    async transition get_nft_content(
        public nft_commit: field
    ) -> Future {
        return finalize_get_nft_content(nft_commit);
    }

    async function finalize_get_nft_content(
        nft_commit: field
    ) {
        let content: nft_content = nft_contents.get(nft_commit);
        // Prevent "unused variable" optimizations from dropping the read.
        assert(content.edition >= 0scalar);
    }
}
