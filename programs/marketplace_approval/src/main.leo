// Approval-based marketplace scaffold for ARC-721 public NFTs

import mogate_arc721_collection.aleo;
use std::hash::BHP256;

program mogate_arc721_marketplace_approval.aleo {
    @noupgrade
    async constructor() {}

    struct listing {
        seller: address,
        nft_commit: field,
        price: u64,
        active: bool,
    }

    mapping listings: u64 => listing;

    inline function commit_nft(
        nft_data: mogate_arc721_collection.aleo/data,
        nft_edition: scalar
    ) -> field {
        let data_hash: field = BHP256::hash_to_field(nft_data);
        let commitment: field = BHP256::commit_to_field(data_hash, nft_edition);
        return commitment;
    }

    // Create listing (seller must approve this program in ARC-721)
    async transition create_listing(
        public listing_id: u64,
        public nft_commit: field,
        public price: u64
    ) -> Future {
        let seller: address = self.caller;
        return finalize_create_listing(seller, listing_id, nft_commit, price);
    }

    async function finalize_create_listing(
        seller: address,
        listing_id: u64,
        nft_commit: field,
        price: u64
    ) {
        assert(!listings.contains(listing_id));
        let state: listing = listing {
            seller,
            nft_commit,
            price,
            active: true,
        };
        listings.set(listing_id, state);
    }

    // Cancel listing (seller only)
    async transition cancel_listing(
        public listing_id: u64
    ) -> Future {
        let caller: address = self.caller;
        return finalize_cancel_listing(caller, listing_id);
    }

    async function finalize_cancel_listing(
        caller: address,
        listing_id: u64
    ) {
        let state: listing = listings.get(listing_id);
        assert(state.active);
        assert_eq(caller, state.seller);

        let new_state: listing = listing {
            seller: state.seller,
            nft_commit: state.nft_commit,
            price: state.price,
            active: false,
        };
        listings.set(listing_id, new_state);
    }

    // Buy (payment logic omitted; seller must have approved this program)
    async transition buy(
        public listing_id: u64,
        private nft_data: mogate_arc721_collection.aleo/data,
        private nft_edition: scalar
    ) -> Future {
        let buyer: address = self.caller;
        return finalize_buy(buyer, listing_id, nft_data, nft_edition);
    }

    async function finalize_buy(
        buyer: address,
        listing_id: u64,
        nft_data: mogate_arc721_collection.aleo/data,
        nft_edition: scalar
    ) {
        let state: listing = listings.get(listing_id);
        assert(state.active);

        let computed_commit: field = commit_nft(nft_data, nft_edition);
        assert_eq(computed_commit, state.nft_commit);

        // Transfer NFT from seller to buyer via ARC-721 transfer_from_public
        let (_, transfer_future): (mogate_arc721_collection.aleo/NFTView, Future) =
            mogate_arc721_collection.aleo/transfer_from_public(
                state.seller,
                buyer,
                nft_data,
                nft_edition
            );

        transfer_future.await();

        let new_state: listing = listing {
            seller: state.seller,
            nft_commit: state.nft_commit,
            price: state.price,
            active: false,
        };
        listings.set(listing_id, new_state);
    }
}
