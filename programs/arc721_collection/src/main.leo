// ARC-721-style NFT collection for Aleo - Mogate

program mogate_arc721_collection.aleo {
    use std::hash::BHP256;
    @noupgrade
    async constructor() {}

    // --- Data structures ---

    struct attribute {
        trait_type: [field; 4],
        _value: [field; 4],
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

    record NFT {
        owner: address,
        data: data,
        edition: scalar,
    }

    record NFTView {
        owner: address,
        data: data,
        edition: scalar,
        is_view: bool,
    }

    struct approval {
        approver: address,
        spender: address,
    }

    // --- Public state mappings ---

    // ARC-721 base mappings
    mapping nft_commits: field => bool;
    mapping nft_owners: field => address;
    mapping nft_contents: field => nft_content;

    // Approvals
    mapping for_all_approvals: field => bool;   // approval hash => is approved
    mapping nft_approvals: field => field;      // nft_commit => approval hash

    // Collection settings (ARC-721 recommended layout)
    mapping general_settings: u8 => field;
    // 0u8 - max mintable NFTs (all editions)
    // 1u8 - max number of first-edition NFTs
    // 2u8 - symbol
    // 3u8..6u8 - base URI parts
    // 7u8 - admin address hash (optional, we also store admin mapping)

    // Collection admin (explicit address for convenience)
    mapping collection_admin: u8 => address;

    // --- Internal helpers ---

    inline function commit_nft(nft_data: data, nft_edition: scalar) -> field {
        let data_hash: field = BHP256::hash_to_field(nft_data);
        let commitment: field = BHP256::commit_to_field(data_hash, nft_edition);
        return commitment;
    }

    inline function approval_key(approver: address, spender: address) -> field {
        let app: approval = approval { approver, spender };
        let key: field = BHP256::hash_to_field(app);
        return key;
    }

    // --- Initialization ---

    async transition initialize(
        public admin: address,
        public max_mintable: field,
        public symbol: field
    ) -> Future {
        return finalize_initialize(admin, max_mintable, symbol);
    }

    async function finalize_initialize(
        admin: address,
        max_mintable: field,
        symbol: field
    ) {
        // Set admin
        collection_admin.set(0u8, admin);

        // Configure basic settings
        general_settings.set(0u8, max_mintable);
        general_settings.set(2u8, symbol);

        // Store admin hash as recommended in index 7u8
        let admin_hash: field = BHP256::hash_to_field(admin);
        general_settings.set(7u8, admin_hash);
    }

    // --- Minting ---

    // Mint public NFT with public owner, private data
    async transition mint_public(
        public recipient: address,
        private nft_data: data,
        private nft_edition: scalar
    ) -> (NFTView, Future) {
        let nft_view: NFTView = NFTView {
            owner: recipient,
            data: nft_data,
            edition: nft_edition,
            is_view: true,
        };

        let caller: address = self.caller;
        let future: Future = finalize_mint_public(
            caller,
            recipient,
            nft_data,
            nft_edition
        );
        return (nft_view, future);
    }

    async function finalize_mint_public(
        caller: address,
        recipient: address,
        nft_data: data,
        nft_edition: scalar
    ) {
        // Optional: only admin can mint; change if fully public minting is desired
        let admin: address = collection_admin.get(0u8);
        assert_eq(caller, admin);

        let nft_commit: field = commit_nft(nft_data, nft_edition);
        let exists: bool = nft_commits.get_or_use(nft_commit, false);
        assert(!exists);

        // Track existence and public ownership
        nft_commits.set(nft_commit, true);
        nft_owners.set(nft_commit, recipient);
    }

    // Publish NFT content (data becomes public)
    async transition publish_nft_content(
        public nft_data: data,
        public nft_edition: scalar
    ) -> Future {
        return finalize_publish_nft_content(nft_data, nft_edition);
    }

    async function finalize_publish_nft_content(
        nft_data: data,
        nft_edition: scalar
    ) {
        let nft_commit: field = commit_nft(nft_data, nft_edition);
        let exists: bool = nft_commits.get_or_use(nft_commit, false);
        assert(exists);

        let content: nft_content = nft_content {
            data: nft_data,
            edition: nft_edition,
        };
        nft_contents.set(nft_commit, content);
    }

    // --- Transfers ---

    // Direct public transfer from caller to `to`
    async transition transfer_public(
        private nft_data: data,
        private nft_edition: scalar,
        public to: address
    ) -> (NFTView, Future) {
        let caller: address = self.caller;
        let nft_commit: field = commit_nft(nft_data, nft_edition);

        let nft_view: NFTView = NFTView {
            owner: to,
            data: nft_data,
            edition: nft_edition,
            is_view: true,
        };

        let future: Future = finalize_transfer_public(
            caller,
            to,
            nft_commit
        );
        return (nft_view, future);
    }

    async function finalize_transfer_public(
        caller: address,
        to: address,
        nft_commit: field
    ) {
        let current_owner: address = nft_owners.get(nft_commit);
        assert_eq(caller, current_owner);

        nft_owners.set(nft_commit, to);

        // Clear any per-NFT approval
        if nft_approvals.contains(nft_commit) {
            nft_approvals.remove(nft_commit);
        }
    }

    // Transfer by approved spender (used by auction contracts, marketplaces, etc.)
    async transition transfer_from_public(
        public from: address,
        public to: address,
        private nft_data: data,
        private nft_edition: scalar
    ) -> (NFTView, Future) {
        let caller: address = self.caller;
        let nft_commit: field = commit_nft(nft_data, nft_edition);

        let nft_view: NFTView = NFTView {
            owner: to,
            data: nft_data,
            edition: nft_edition,
            is_view: true,
        };

        let future: Future = finalize_transfer_from_public(
            caller,
            from,
            to,
            nft_commit
        );
        return (nft_view, future);
    }

    async function finalize_transfer_from_public(
        caller: address,
        from: address,
        to: address,
        nft_commit: field
    ) {
        let current_owner: address = nft_owners.get(nft_commit);
        assert_eq(current_owner, from);

        // Allow direct owner call without approval
        if caller != from {
            let app: approval = approval {
                approver: from,
                spender: caller,
            };
            let key: field = BHP256::hash_to_field(app);

            // Check collection-wide approval
            let is_global: bool = for_all_approvals.get_or_use(key, false);
            if !is_global {
                // Fallback to per-NFT approval
                let has_nft_approval: bool = nft_approvals.contains(nft_commit);
                assert(has_nft_approval);
                let stored_key: field = nft_approvals.get(nft_commit);
                assert_eq(stored_key, key);
            }
        }

        nft_owners.set(nft_commit, to);

        // Clear per-NFT approval on transfer
        if nft_approvals.contains(nft_commit) {
            nft_approvals.remove(nft_commit);
        }
    }

    // --- Approvals ---

    // Collection-wide approval for `spender`
    async transition set_for_all_approval(
        private spender: address,
        public new_value: bool
    ) -> Future {
        let approver: address = self.caller;
        return finalize_set_for_all_approval(approver, spender, new_value);
    }

    async function finalize_set_for_all_approval(
        approver: address,
        spender: address,
        new_value: bool
    ) {
        let key: field = approval_key(approver, spender);
        for_all_approvals.set(key, new_value);
    }

    // Approve `spender` for a specific NFT
    async transition approve_public(
        private spender: address,
        private nft_data: data,
        private nft_edition: scalar
    ) -> Future {
        let owner: address = self.caller;
        return finalize_approve_public(
            owner,
            spender,
            nft_data,
            nft_edition
        );
    }

    async function finalize_approve_public(
        owner: address,
        spender: address,
        nft_data: data,
        nft_edition: scalar
    ) {
        let nft_commit: field = commit_nft(nft_data, nft_edition);
        let current_owner: address = nft_owners.get(nft_commit);
        assert_eq(owner, current_owner);

        let key: field = approval_key(owner, spender);
        nft_approvals.set(nft_commit, key);
    }

    // Revoke per-NFT approval
    async transition unapprove_public(
        private nft_data: data,
        private nft_edition: scalar
    ) -> Future {
        let owner: address = self.caller;
        return finalize_unapprove_public(owner, nft_data, nft_edition);
    }

    async function finalize_unapprove_public(
        owner: address,
        nft_data: data,
        nft_edition: scalar
    ) {
        let nft_commit: field = commit_nft(nft_data, nft_edition);
        let current_owner: address = nft_owners.get(nft_commit);
        assert_eq(owner, current_owner);

        if nft_approvals.contains(nft_commit) {
            nft_approvals.remove(nft_commit);
        }
    }

    // --- Simple views (public queries) ---

    async transition get_nft_owner(
        public nft_commit: field
    ) -> Future {
        return finalize_get_nft_owner(nft_commit);
    }

    async function finalize_get_nft_owner(
        nft_commit: field
    ) {
        let _owner: address = nft_owners.get(nft_commit);
    }
}
