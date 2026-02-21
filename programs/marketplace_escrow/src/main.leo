// Escrow-based marketplace scaffold for ARC-721 private NFTs

import mogate_arc721_private.aleo;
use std::hash::BHP256;

program mogate_arc721_marketplace_escrow_private.aleo {
    @noupgrade
    async constructor() {}

    struct listing {
        seller: address,
        nft_commit: field,
        price: u64,
        custodian: address,
        active: bool,
    }

    mapping listings: u64 => listing;

    inline function commit_nft(
        nft_data: mogate_arc721_private.aleo/data,
        nft_edition: scalar
    ) -> field {
        let data_hash: field = BHP256::hash_to_field(nft_data);
        let commitment: field = BHP256::commit_to_field(data_hash, nft_edition);
        return commitment;
    }

    // Seller deposits NFT into custodian escrow and creates listing
    async transition create_escrow_listing(
        public listing_id: u64,
        private nft: mogate_arc721_private.aleo/PrivateNFT,
        public price: u64,
        public custodian: address
    ) -> Future {
        let seller: address = self.caller;
        let nft_commit: field = commit_nft(nft.data, nft.edition);

        let (_, transfer_future): (mogate_arc721_private.aleo/PrivateNFT, Future) =
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

        transfer_future.await();

        let state: listing = listing {
            seller,
            nft_commit,
            price,
            custodian,
            active: true,
        };
        listings.set(listing_id, state);
    }

    // Custodian releases escrowed NFT to buyer
    async transition release_escrow_to_buyer(
        public listing_id: u64,
        private nft: mogate_arc721_private.aleo/PrivateNFT,
        public buyer: address
    ) -> Future {
        let caller: address = self.caller;
        let nft_commit: field = commit_nft(nft.data, nft.edition);

        let (_, transfer_future): (mogate_arc721_private.aleo/PrivateNFT, Future) =
            mogate_arc721_private.aleo/transfer_private(nft, buyer);

        return finalize_release_escrow_to_buyer(
            caller,
            listing_id,
            nft_commit,
            transfer_future
        );
    }

    async function finalize_release_escrow_to_buyer(
        caller: address,
        listing_id: u64,
        nft_commit: field,
        transfer_future: Future
    ) {
        let state: listing = listings.get(listing_id);
        assert(state.active);
        assert_eq(caller, state.custodian);
        assert_eq(nft_commit, state.nft_commit);

        transfer_future.await();

        let new_state: listing = listing {
            seller: state.seller,
            nft_commit: state.nft_commit,
            price: state.price,
            custodian: state.custodian,
            active: false,
        };
        listings.set(listing_id, new_state);
    }

    // Custodian cancels escrow and returns NFT to seller
    async transition cancel_escrow_listing(
        public listing_id: u64,
        private nft: mogate_arc721_private.aleo/PrivateNFT,
        public seller: address
    ) -> Future {
        let caller: address = self.caller;
        let nft_commit: field = commit_nft(nft.data, nft.edition);

        let (_, transfer_future): (mogate_arc721_private.aleo/PrivateNFT, Future) =
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
        assert_eq(caller, state.custodian);
        assert_eq(nft_commit, state.nft_commit);
        assert_eq(seller, state.seller);

        transfer_future.await();

        let new_state: listing = listing {
            seller: state.seller,
            nft_commit: state.nft_commit,
            price: state.price,
            custodian: state.custodian,
            active: false,
        };
        listings.set(listing_id, new_state);
    }
}
