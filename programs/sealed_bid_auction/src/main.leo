// Sealed-bid auction for ARC-721 NFTs (mogate_arc721_collection.aleo)

import mogate_arc721_collection.aleo;
use std::hash::BHP256;

program mogate_sealed_bid_auction.aleo {
    @noupgrade
    async constructor() {}

    struct auction_state {
        seller: address,
        nft_commit: field,
        min_bid: u64,
        highest_bid: u64,
        highest_bidder: address,
        active: bool,
    }

    struct bid_key {
        auction_id: u64,
        bidder: address,
    }

    struct bid_plain {
        amount: u64,
        salt: field,
    }

    mapping auctions: u64 => auction_state;
    mapping bid_commits: field => field; // key(hash(auction_id,bidder)) => commit(amount,salt)

    inline function bid_key_hash(auction_id: u64, bidder: address) -> field {
        let key_struct: bid_key = bid_key { auction_id, bidder };
        let key: field = BHP256::hash_to_field(key_struct);
        return key;
    }

    inline function commit_bid_value(amount: u64, salt: field) -> field {
        let plain: bid_plain = bid_plain { amount, salt };
        let commit: field = BHP256::hash_to_field(plain);
        return commit;
    }

    inline function commit_nft(
        nft_data: mogate_arc721_collection.aleo/data,
        nft_edition: scalar
    ) -> field {
        let data_hash: field = BHP256::hash_to_field(nft_data);
        let commitment: field = BHP256::commit_to_field(data_hash, nft_edition);
        return commitment;
    }

    // Create a new auction for an NFT.
    // Seller must approve this program as spender in mogate_arc721_collection.aleo
    // using set_for_all_approval or approve_public before auction finalization.
    async transition create_auction(
        public auction_id: u64,
        public nft_commit: field,
        public min_bid: u64
    ) -> Future {
        let seller: address = self.caller;
        return finalize_create_auction(
            seller,
            auction_id,
            nft_commit,
            min_bid
        );
    }

    async function finalize_create_auction(
        seller: address,
        auction_id: u64,
        nft_commit: field,
        min_bid: u64
    ) {
        assert(!auctions.contains(auction_id));

        let state: auction_state = auction_state {
            seller,
            nft_commit,
            min_bid,
            highest_bid: 0u64,
            highest_bidder: seller,
            active: true,
        };

        auctions.set(auction_id, state);
    }

    // Commit to a bid: commit = hash( amount || salt )
    async transition commit_bid(
        public auction_id: u64,
        private bid_commit: field
    ) -> Future {
        let bidder: address = self.caller;
        return finalize_commit_bid(
            auction_id,
            bidder,
            bid_commit
        );
    }

    async function finalize_commit_bid(
        auction_id: u64,
        bidder: address,
        bid_commit: field
    ) {
        assert(auctions.contains(auction_id));
        let state: auction_state = auctions.get(auction_id);
        assert(state.active);

        let key: field = bid_key_hash(auction_id, bidder);
        bid_commits.set(key, bid_commit);
    }

    // Reveal a bid: provides amount + salt, must match previous commit.
    async transition reveal_bid(
        public auction_id: u64,
        private amount: u64,
        private salt: field
    ) -> Future {
        let bidder: address = self.caller;
        return finalize_reveal_bid(
            auction_id,
            bidder,
            amount,
            salt
        );
    }

    async function finalize_reveal_bid(
        auction_id: u64,
        bidder: address,
        amount: u64,
        salt: field
    ) {
        assert(auctions.contains(auction_id));
        let state: auction_state = auctions.get(auction_id);
        assert(state.active);

        let key: field = bid_key_hash(auction_id, bidder);
        let stored_commit: field = bid_commits.get(key);

        let expected_commit: field = commit_bid_value(amount, salt);
        assert_eq(stored_commit, expected_commit);

        // Enforce minimum bid
        assert(amount >= state.min_bid);

        // Update highest bid if necessary
        if amount > state.highest_bid {
            let new_state: auction_state = auction_state {
                seller: state.seller,
                nft_commit: state.nft_commit,
                min_bid: state.min_bid,
                highest_bid: amount,
                highest_bidder: bidder,
                active: true,
            };
            auctions.set(auction_id, new_state);
        }
    }

    // Finalize auction and transfer NFT to highest bidder.
    // Requires that seller has approved this program in mogate_arc721_collection.aleo
    // and that there is at least one valid revealed bid.
    async transition finalize_auction(
        public auction_id: u64,
        private nft_data: mogate_arc721_collection.aleo/data,
        private nft_edition: scalar
    ) -> Future {
        let caller: address = self.caller;
        return finalize_finalize_auction(
            caller,
            auction_id,
            nft_data,
            nft_edition
        );
    }

    async function finalize_finalize_auction(
        caller: address,
        auction_id: u64,
        nft_data: mogate_arc721_collection.aleo/data,
        nft_edition: scalar
    ) {
        assert(auctions.contains(auction_id));
        let state: auction_state = auctions.get(auction_id);
        assert(state.active);
        assert_eq(caller, state.seller);
        assert(state.highest_bid > 0u64);

        let nft_commit: field = commit_nft(nft_data, nft_edition);
        assert_eq(nft_commit, state.nft_commit);

        // Transfer NFT from seller to highest bidder via ARC-721 transfer_from_public
        let (_, transfer_future): (mogate_arc721_collection.aleo/NFTView, Future) =
            mogate_arc721_collection.aleo/transfer_from_public(
                state.seller,
                state.highest_bidder,
                nft_data,
                nft_edition
            );

        transfer_future.await();

        let new_state: auction_state = auction_state {
            seller: state.seller,
            nft_commit: state.nft_commit,
            min_bid: state.min_bid,
            highest_bid: state.highest_bid,
            highest_bidder: state.highest_bidder,
            active: false,
        };
        auctions.set(auction_id, new_state);
    }

    // Cancel auction (only if no valid revealed bid)
    async transition cancel_auction(
        public auction_id: u64
    ) -> Future {
        let caller: address = self.caller;
        return finalize_cancel_auction(caller, auction_id);
    }

    async function finalize_cancel_auction(
        caller: address,
        auction_id: u64
    ) {
        assert(auctions.contains(auction_id));
        let state: auction_state = auctions.get(auction_id);
        assert(state.active);
        assert_eq(caller, state.seller);
        assert_eq(state.highest_bid, 0u64);

        let new_state: auction_state = auction_state {
            seller: state.seller,
            nft_commit: state.nft_commit,
            min_bid: state.min_bid,
            highest_bid: state.highest_bid,
            highest_bidder: state.highest_bidder,
            active: false,
        };
        auctions.set(auction_id, new_state);
    }
}
