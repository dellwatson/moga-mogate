// Approval-based marketplace for ARC-721 public NFTs.
// Requires seller approval in mogate_arc721_collection.aleo.

import mogate_arc721_collection.aleo;
import credits.aleo;

program mogate_mkt_approval.aleo {
    @noupgrade
    async constructor() {}

    struct listing {
        seller: address,
        nft_commit: field,
        price: u64,
        active: bool,
    }

    mapping listings: u64 => listing;

    inline commit_nft(
        nft_data: mogate_arc721_collection.aleo/data,
        nft_edition: scalar
    ) -> field {
        let data_hash: field = BHP256::hash_to_field(nft_data);
        let commitment: field = BHP256::commit_to_field(data_hash, nft_edition);
        return commitment;
    }

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
        assert(price > 0u64);

        let state: listing = listing {
            seller,
            nft_commit,
            price,
            active: true,
        };
        listings.set(listing_id, state);
    }

    async transition update_listing_price(
        public listing_id: u64,
        public new_price: u64
    ) -> Future {
        let caller: address = self.caller;
        return finalize_update_listing_price(caller, listing_id, new_price);
    }

    async function finalize_update_listing_price(
        caller: address,
        listing_id: u64,
        new_price: u64
    ) {
        assert(new_price > 0u64);

        let state: listing = listings.get(listing_id);
        assert(state.active);
        assert_eq(caller, state.seller);

        let new_state: listing = listing {
            seller: state.seller,
            nft_commit: state.nft_commit,
            price: new_price,
            active: true,
        };
        listings.set(listing_id, new_state);
    }

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

    async transition buy(
        public listing_id: u64,
        public seller: address,
        public payment_amount: u64,
        private nft_data: mogate_arc721_collection.aleo/data,
        private nft_edition: scalar,
        private payment: credits.aleo/credits
    ) -> (mogate_arc721_collection.aleo/NFTView, credits.aleo/credits, Future) {
        let buyer: address = self.caller;

        let (nft_view, transfer_future): (mogate_arc721_collection.aleo/NFTView, Future) =
            mogate_arc721_collection.aleo/transfer_from_public(
                seller,
                buyer,
                nft_data,
                nft_edition
            );

        let (change, payment_future): (credits.aleo/credits, Future) =
            credits.aleo/transfer_private_to_public(
                payment,
                seller,
                payment_amount
            );

        let future: Future = finalize_buy(
            buyer,
            listing_id,
            seller,
            payment_amount,
            nft_data,
            nft_edition,
            transfer_future,
            payment_future
        );
        return (nft_view, change, future);
    }

    async function finalize_buy(
        buyer: address,
        listing_id: u64,
        seller: address,
        payment_amount: u64,
        nft_data: mogate_arc721_collection.aleo/data,
        nft_edition: scalar,
        transfer_future: Future,
        payment_future: Future
    ) {
        let state: listing = listings.get(listing_id);
        assert(state.active);
        let buyer_is_seller: bool = buyer == state.seller;
        assert(!buyer_is_seller);
        assert_eq(seller, state.seller);
        assert_eq(payment_amount, state.price);

        let computed_commit: field = commit_nft(nft_data, nft_edition);
        assert_eq(computed_commit, state.nft_commit);

        transfer_future.await();
        payment_future.await();

        let new_state: listing = listing {
            seller: state.seller,
            nft_commit: state.nft_commit,
            price: state.price,
            active: false,
        };
        listings.set(listing_id, new_state);
    }
}
