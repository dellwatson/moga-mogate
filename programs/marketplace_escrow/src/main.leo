// Escrow-based marketplace for ARC-721 private NFTs.
// Custodian holds the NFT; buyer settles payment with credits.aleo.

import mogate_arc721_private.aleo;
import credits.aleo;

program mogate_mkt_escrow_private.aleo {
    @noupgrade
    async constructor() {}

    struct listing {
        seller: address,
        nft_commit: field,
        price: u64,
        custodian: address,
        buyer: address,
        paid: bool,
        active: bool,
    }

    mapping listings: u64 => listing;

    inline commit_nft(
        nft_data: data,
        nft_edition: scalar
    ) -> field {
        let data_hash: field = BHP256::hash_to_field(nft_data);
        let commitment: field = BHP256::commit_to_field(data_hash, nft_edition);
        return commitment;
    }

    async transition create_escrow_listing(
        public listing_id: u64,
        private nft: mogate_arc721_private.aleo/PrivateNFT,
        public price: u64,
        public custodian: address
    ) -> Future {
        let seller: address = self.caller;
        let nft_commit: field = commit_nft(nft.data, nft.edition);

        let (escrowed_nft, transfer_future): (mogate_arc721_private.aleo/PrivateNFT, Future) =
            mogate_arc721_private.aleo/transfer_private(nft, custodian);

        return finalize_create_escrow_listing(
            seller,
            listing_id,
            nft_commit,
            price,
            custodian,
            transfer_future
        );
    }

    async function finalize_create_escrow_listing(
        seller: address,
        listing_id: u64,
        nft_commit: field,
        price: u64,
        custodian: address,
        transfer_future: Future
    ) {
        assert(!listings.contains(listing_id));
        assert(price > 0u64);
        let seller_is_custodian: bool = seller == custodian;
        assert(!seller_is_custodian);

        transfer_future.await();

        let state: listing = listing {
            seller,
            nft_commit,
            price,
            custodian,
            buyer: seller,
            paid: false,
            active: true,
        };
        listings.set(listing_id, state);
    }

    async transition update_escrow_price(
        public listing_id: u64,
        public new_price: u64
    ) -> Future {
        let caller: address = self.caller;
        return finalize_update_escrow_price(caller, listing_id, new_price);
    }

    async function finalize_update_escrow_price(
        caller: address,
        listing_id: u64,
        new_price: u64
    ) {
        assert(new_price > 0u64);

        let state: listing = listings.get(listing_id);
        assert(state.active);
        assert(!state.paid);
        assert_eq(caller, state.seller);

        let new_state: listing = listing {
            seller: state.seller,
            nft_commit: state.nft_commit,
            price: new_price,
            custodian: state.custodian,
            buyer: state.buyer,
            paid: false,
            active: true,
        };
        listings.set(listing_id, new_state);
    }

    async transition pay_escrow_listing(
        public listing_id: u64,
        public seller: address,
        public payment_amount: u64,
        private payment: credits.aleo/credits
    ) -> (credits.aleo/credits, Future) {
        let buyer: address = self.caller;

        let (change, payment_future): (credits.aleo/credits, Future) =
            credits.aleo/transfer_private_to_public(
                payment,
                seller,
                payment_amount
            );

        let future: Future = finalize_pay_escrow_listing(
            buyer,
            listing_id,
            seller,
            payment_amount,
            payment_future
        );
        return (change, future);
    }

    async function finalize_pay_escrow_listing(
        buyer: address,
        listing_id: u64,
        seller: address,
        payment_amount: u64,
        payment_future: Future
    ) {
        let state: listing = listings.get(listing_id);
        assert(state.active);
        assert(!state.paid);
        assert_eq(seller, state.seller);
        assert_eq(payment_amount, state.price);
        let buyer_is_seller: bool = buyer == state.seller;
        assert(!buyer_is_seller);

        payment_future.await();

        let new_state: listing = listing {
            seller: state.seller,
            nft_commit: state.nft_commit,
            price: state.price,
            custodian: state.custodian,
            buyer,
            paid: true,
            active: true,
        };
        listings.set(listing_id, new_state);
    }

    async transition release_escrow_to_buyer(
        public listing_id: u64,
        private nft: mogate_arc721_private.aleo/PrivateNFT,
        public buyer: address
    ) -> Future {
        let caller: address = self.caller;
        let nft_commit: field = commit_nft(nft.data, nft.edition);

        let (released_nft, transfer_future): (mogate_arc721_private.aleo/PrivateNFT, Future) =
            mogate_arc721_private.aleo/transfer_private(nft, buyer);

        return finalize_release_to_buyer(
            caller,
            listing_id,
            nft_commit,
            buyer,
            transfer_future
        );
    }

    async function finalize_release_to_buyer(
        caller: address,
        listing_id: u64,
        nft_commit: field,
        buyer: address,
        transfer_future: Future
    ) {
        let state: listing = listings.get(listing_id);
        assert(state.active);
        assert(state.paid);
        assert_eq(caller, state.custodian);
        assert_eq(nft_commit, state.nft_commit);
        assert_eq(buyer, state.buyer);

        transfer_future.await();

        let new_state: listing = listing {
            seller: state.seller,
            nft_commit: state.nft_commit,
            price: state.price,
            custodian: state.custodian,
            buyer: state.buyer,
            paid: true,
            active: false,
        };
        listings.set(listing_id, new_state);
    }

    async transition cancel_escrow_listing(
        public listing_id: u64,
        private nft: mogate_arc721_private.aleo/PrivateNFT,
        public seller: address
    ) -> Future {
        let caller: address = self.caller;
        let nft_commit: field = commit_nft(nft.data, nft.edition);

        let (returned_nft, transfer_future): (mogate_arc721_private.aleo/PrivateNFT, Future) =
            mogate_arc721_private.aleo/transfer_private(nft, seller);

        return finalize_cancel_escrow_listing(
            caller,
            listing_id,
            nft_commit,
            seller,
            transfer_future
        );
    }

    async function finalize_cancel_escrow_listing(
        caller: address,
        listing_id: u64,
        nft_commit: field,
        seller: address,
        transfer_future: Future
    ) {
        let state: listing = listings.get(listing_id);
        assert(state.active);
        assert(!state.paid);
        assert_eq(caller, state.custodian);
        assert_eq(nft_commit, state.nft_commit);
        assert_eq(seller, state.seller);

        transfer_future.await();

        let new_state: listing = listing {
            seller: state.seller,
            nft_commit: state.nft_commit,
            price: state.price,
            custodian: state.custodian,
            buyer: state.buyer,
            paid: false,
            active: false,
        };
        listings.set(listing_id, new_state);
    }
}
