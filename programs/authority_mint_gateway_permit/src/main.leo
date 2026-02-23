// Authority mint gateway with signed permit data verification.
// Permit message is a typed Leo struct (data-sign pattern).

import mogate_arc721_private.aleo;

program mogate_auth_mint_permit.aleo {
    @noupgrade
    async constructor() {}

    struct mint_permit_data {
        recipient: address,
        nft_commit: field,
        nonce: u64,
    }

    mapping gateway_admin: u8 => address;
    mapping permit_signer: u8 => address;
    mapping permit_used: field => bool;

    inline commit_nft(
        nft_data: data,
        nft_edition: scalar
    ) -> field {
        let data_hash: field = BHP256::hash_to_field(nft_data);
        return BHP256::commit_to_field(data_hash, nft_edition);
    }

    inline permit_key(permit_data: mint_permit_data) -> field {
        return BHP256::hash_to_field(permit_data);
    }

    transition compute_nft_commit(
        public nft_data: data,
        public nft_edition: scalar
    ) -> field {
        return commit_nft(nft_data, nft_edition);
    }

    transition compute_permit_key(
        public recipient: address,
        public nft_commit: field,
        public nonce: u64
    ) -> field {
        let permit_data: mint_permit_data = mint_permit_data {
            recipient,
            nft_commit,
            nonce,
        };
        return permit_key(permit_data);
    }

    async transition initialize(
        public admin: address,
        public signer: address
    ) -> Future {
        return finalize_initialize(admin, signer);
    }

    async function finalize_initialize(
        admin: address,
        signer: address
    ) {
        let already_initialized: bool = gateway_admin.contains(0u8);
        assert(!already_initialized);
        gateway_admin.set(0u8, admin);
        permit_signer.set(0u8, signer);
    }

    async transition set_permit_signer(
        public new_signer: address
    ) -> Future {
        let caller: address = self.caller;
        return finalize_set_permit_signer(caller, new_signer);
    }

    async function finalize_set_permit_signer(
        caller: address,
        new_signer: address
    ) {
        let admin: address = gateway_admin.get(0u8);
        assert_eq(caller, admin);
        permit_signer.set(0u8, new_signer);
    }

    async transition mint_private_admin(
        public recipient: address,
        private nft_data: data,
        private nft_edition: scalar
    ) -> (mogate_arc721_private.aleo/PrivateNFT, Future) {
        let caller: address = self.caller;

        let (nft, mint_future): (mogate_arc721_private.aleo/PrivateNFT, Future) =
            mogate_arc721_private.aleo/mint_private(recipient, nft_data, nft_edition);

        let future: Future = finalize_mint_private_admin(caller, mint_future);
        return (nft, future);
    }

    async function finalize_mint_private_admin(
        caller: address,
        mint_future: Future
    ) {
        let admin: address = gateway_admin.get(0u8);
        assert_eq(caller, admin);
        mint_future.await();
    }

    async transition mint_private_with_permit(
        public recipient: address,
        private nft_data: data,
        private nft_edition: scalar,
        public nonce: u64,
        public signer: address,
        public permit_signature: signature
    ) -> (mogate_arc721_private.aleo/PrivateNFT, Future) {
        let caller: address = self.caller;
        let nft_commit: field = commit_nft(nft_data, nft_edition);

        let permit_data: mint_permit_data = mint_permit_data {
            recipient,
            nft_commit,
            nonce,
        };

        assert(permit_signature.verify(signer, permit_data));

        let key: field = permit_key(permit_data);

        let (nft, mint_future): (mogate_arc721_private.aleo/PrivateNFT, Future) =
            mogate_arc721_private.aleo/mint_private(recipient, nft_data, nft_edition);

        let future: Future = finalize_mint_with_permit(
            caller,
            recipient,
            key,
            signer,
            mint_future
        );
        return (nft, future);
    }

    async function finalize_mint_with_permit(
        caller: address,
        recipient: address,
        key: field,
        signer: address,
        mint_future: Future
    ) {
        assert_eq(caller, recipient);

        let admin: address = gateway_admin.get(0u8);
        let expected_signer: address = permit_signer.get_or_use(0u8, admin);
        assert_eq(signer, expected_signer);

        let used: bool = permit_used.get_or_use(key, false);
        assert(!used);

        permit_used.set(key, true);
        mint_future.await();
    }
}
