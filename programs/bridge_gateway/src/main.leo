// Bridge gateway for minting bridged NFTs into the multi-collection private ARC-721.

import mogate_arc721_multiprivate.aleo;

program mogate_bridge_gateway.aleo {
    @noupgrade
    async constructor() {}

    struct bridge_claim {
        collection_id: field,
        recipient: address,
        origin_chain_id: u32,
        origin_collection: [field; 4],
        origin_token_id: u64,
        metadata: [field; 4],
        nonce: u64,
    }

    mapping bridge_admin: u8 => address;
    mapping relayer_signer: u8 => address;
    mapping claim_used: field => bool;

    inline claim_key(claim: bridge_claim) -> field {
        return BHP256::hash_to_field(claim);
    }

    transition compute_claim_key(
        public claim: bridge_claim
    ) -> field {
        return claim_key(claim);
    }

    async transition initialize(
        public admin: address,
        public relayer: address
    ) -> Future {
        return finalize_initialize(admin, relayer);
    }

    async function finalize_initialize(
        admin: address,
        relayer: address
    ) {
        let already_initialized: bool = bridge_admin.contains(0u8);
        assert(!already_initialized);
        bridge_admin.set(0u8, admin);
        relayer_signer.set(0u8, relayer);
    }

    async transition set_relayer(
        public new_relayer: address
    ) -> Future {
        let caller: address = self.caller;
        return finalize_set_relayer(caller, new_relayer);
    }

    async function finalize_set_relayer(
        caller: address,
        new_relayer: address
    ) {
        let admin: address = bridge_admin.get(0u8);
        assert_eq(caller, admin);
        relayer_signer.set(0u8, new_relayer);
    }

    async transition mint_bridged(
        public claim: bridge_claim,
        public signer: address,
        public signature: signature
    ) -> (mogate_arc721_multiprivate.aleo/PrivateNFT, Future) {
        let caller: address = self.caller;
        let key: field = claim_key(claim);

        assert(signature.verify(signer, claim));

        let admin: address = bridge_admin.get(0u8);
        let expected_signer: address = relayer_signer.get_or_use(0u8, admin);
        assert_eq(signer, expected_signer);

        let used: bool = claim_used.get_or_use(key, false);
        assert(!used);
        claim_used.set(key, true);

        let nft_data: mogate_arc721_multiprivate.aleo/data =
            mogate_arc721_multiprivate.aleo/data { metadata: claim.metadata };
        let edition: scalar = claim.origin_token_id as scalar;

        let (nft, mint_future): (mogate_arc721_multiprivate.aleo/PrivateNFT, Future) =
            mogate_arc721_multiprivate.aleo/mint_private(
                claim.collection_id,
                claim.recipient,
                nft_data,
                edition
            );

        let future: Future = finalize_mint_bridged(caller, mint_future);
        return (nft, future);
    }

    async function finalize_mint_bridged(
        caller: address,
        mint_future: Future
    ) {
        // Caller can be anyone; authorization is via relayer signature.
        mint_future.await();
    }
}
