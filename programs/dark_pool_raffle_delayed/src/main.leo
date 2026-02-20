// Darkpool raffle with delayed transparency (commit-reveal slots)

import mogate_arc721_collection.aleo;
import credits.aleo;
use std::hash::BHP256;

program mogate_darkpool_raffle_delayed.aleo {
    @noupgrade
    async constructor() {}

    // --- Data structures ---

    struct raffle {
        organizer: address,
        total_slots: u64,
        max_slots_per_address: u64,
        metadata_hash: field,
        prize_commit: field,
        seed_commit: field,
        treasury: address,
        auto_draw: bool,
        auto_claim: bool,
        sold_slots: u64,
        winner_slot: u64,
        winner: address,
        winner_set: bool,
        status: u8, // 0 = OPEN, 1 = FILLED, 2 = DRAWN, 3 = CANCELLED
    }

    struct slot_key {
        raffle_id: field,
        slot_id: u64,
    }

    struct user_key {
        raffle_id: field,
        owner: address,
    }

    struct slot_commit_data {
        owner: address,
        salt: field,
    }

    struct seed_commit_data {
        raffle_id: field,
        seed: u64,
    }

    // --- Public state mappings ---

    mapping raffles: field => raffle;
    mapping slot_commits: field => field;       // slot_key => commitment(owner,salt)
    mapping slot_owners: field => address;      // slot_key => owner (revealed)
    mapping user_slot_counts: field => u64;     // user_key => count
    mapping raffle_claimed: field => bool;      // raffle_id => claimed
    mapping raffle_admin: u8 => address;
    mapping backend_signer: u8 => address;
    mapping treasury_account: u8 => address;

    // --- Helpers ---

    inline function slot_key_hash(raffle_id: field, slot_id: u64) -> field {
        let key: slot_key = slot_key { raffle_id, slot_id };
        return BHP256::hash_to_field(key);
    }

    inline function user_key_hash(raffle_id: field, owner: address) -> field {
        let key: user_key = user_key { raffle_id, owner };
        return BHP256::hash_to_field(key);
    }

    inline function slot_commit(owner: address, salt: field) -> field {
        let data: slot_commit_data = slot_commit_data { owner, salt };
        return BHP256::hash_to_field(data);
    }

    inline function seed_commit_hash(raffle_id: field, seed: u64) -> field {
        let data: seed_commit_data = seed_commit_data { raffle_id, seed };
        return BHP256::hash_to_field(data);
    }

    inline function prize_commit_hash(
        nft_data: mogate_arc721_collection.aleo/data,
        nft_edition: scalar
    ) -> field {
        let data_hash: field = BHP256::hash_to_field(nft_data);
        return BHP256::commit_to_field(data_hash, nft_edition);
    }

    inline function process_slot_commit(
        participant: address,
        raffle_id: field,
        slot_id: u64,
        salt: field,
        max_slots_per_address: u64,
        total_slots: u64
    ) {
        assert(slot_id > 0u64 && slot_id <= total_slots);

        let key: field = slot_key_hash(raffle_id, slot_id);
        assert(!slot_commits.contains(key));

        // Enforce max slots per address (0 = unlimited)
        if max_slots_per_address != 0u64 {
            let ukey: field = user_key_hash(raffle_id, participant);
            let count: u64 = user_slot_counts.get_or_use(ukey, 0u64);
            assert(count < max_slots_per_address);
            user_slot_counts.set(ukey, count + 1u64);
        }

        let commit: field = slot_commit(participant, salt);
        slot_commits.set(key, commit);
    }

    // --- Initialization ---

    async transition initialize(
        public admin: address,
        public backend: address,
        public treasury: address
    ) -> Future {
        return finalize_initialize(admin, backend, treasury);
    }

    async function finalize_initialize(
        admin: address,
        backend: address,
        treasury: address
    ) {
        let already_initialized: bool = raffle_admin.contains(0u8);
        assert(!already_initialized);
        raffle_admin.set(0u8, admin);
        backend_signer.set(0u8, backend);
        treasury_account.set(0u8, treasury);
    }

    async transition set_backend_signer(
        public new_backend: address
    ) -> Future {
        let caller: address = self.caller;
        return finalize_set_backend_signer(caller, new_backend);
    }

    async function finalize_set_backend_signer(
        caller: address,
        new_backend: address
    ) {
        let admin: address = raffle_admin.get(0u8);
        assert_eq(caller, admin);
        backend_signer.set(0u8, new_backend);
    }

    async transition set_treasury(
        public new_treasury: address
    ) -> Future {
        let caller: address = self.caller;
        return finalize_set_treasury(caller, new_treasury);
    }

    async function finalize_set_treasury(
        caller: address,
        new_treasury: address
    ) {
        let admin: address = raffle_admin.get(0u8);
        assert_eq(caller, admin);
        treasury_account.set(0u8, new_treasury);
    }

    // --- Host raffle ---

    // Safe host (backend-only)
    async transition host_raffle(
        public organizer: address,
        public raffle_id: field,
        public total_slots: u64,
        public max_slots_per_address: u64,
        public metadata_hash: field,
        public prize_commit: field,
        public seed_commit: field,
        public auto_draw: bool,
        public auto_claim: bool
    ) -> Future {
        let caller: address = self.caller;
        return finalize_host_raffle(
            caller,
            organizer,
            raffle_id,
            total_slots,
            max_slots_per_address,
            metadata_hash,
            prize_commit,
            seed_commit,
            auto_draw,
            auto_claim,
            true
        );
    }

    // Unsafe host (no backend auth)
    async transition unsafe_host_raffle(
        public raffle_id: field,
        public total_slots: u64,
        public max_slots_per_address: u64,
        public metadata_hash: field,
        public prize_commit: field,
        public seed_commit: field,
        public auto_draw: bool,
        public auto_claim: bool
    ) -> Future {
        let caller: address = self.caller;
        return finalize_host_raffle(
            caller,
            caller,
            raffle_id,
            total_slots,
            max_slots_per_address,
            metadata_hash,
            prize_commit,
            seed_commit,
            auto_draw,
            auto_claim,
            false
        );
    }

    async function finalize_host_raffle(
        caller: address,
        organizer: address,
        raffle_id: field,
        total_slots: u64,
        max_slots_per_address: u64,
        metadata_hash: field,
        prize_commit: field,
        seed_commit: field,
        auto_draw: bool,
        auto_claim: bool,
        enforce_backend: bool
    ) {
        let admin: address = raffle_admin.get(0u8);
        let backend: address = backend_signer.get_or_use(0u8, admin);
        if enforce_backend {
            assert(caller == backend || caller == admin);
        }

        assert(!raffles.contains(raffle_id));
        assert(total_slots > 0u64);

        let treasury: address = treasury_account.get_or_use(0u8, organizer);

        let state: raffle = raffle {
            organizer,
            total_slots,
            max_slots_per_address,
            metadata_hash,
            prize_commit,
            seed_commit,
            treasury,
            auto_draw,
            auto_claim,
            sold_slots: 0u64,
            winner_slot: 0u64,
            winner: organizer,
            winner_set: false,
            status: 0u8,
        };
        raffles.set(raffle_id, state);
    }

    // --- Join raffle (batch commit slots) ---

    // Safe join (backend-only)
    async transition join_raffle(
        public participant: address,
        public raffle_id: field,
        public slot_ids: [u64; 8],
        private salts: [field; 8],
        public count: u8,
        private payment: credits.aleo/credits,
        public amount: u64
    ) -> (credits.aleo/credits, Future) {
        let caller: address = self.caller;
        let state: raffle = raffles.get(raffle_id);
        let treasury: address = state.treasury;

        let (change, payment_future): (credits.aleo/credits, Future) =
            credits.aleo/transfer_private(payment, treasury, amount);

        let future: Future = finalize_join_raffle(
            caller,
            participant,
            raffle_id,
            slot_ids,
            salts,
            count,
            payment_future,
            true
        );
        return (change, future);
    }

    // Unsafe join (no backend auth) - default batch join
    async transition unsafe_join_raffle(
        public raffle_id: field,
        public slot_ids: [u64; 8],
        private salts: [field; 8],
        public count: u8,
        private payment: credits.aleo/credits,
        public amount: u64
    ) -> (credits.aleo/credits, Future) {
        let caller: address = self.caller;
        let state: raffle = raffles.get(raffle_id);
        let treasury: address = state.treasury;

        let (change, payment_future): (credits.aleo/credits, Future) =
            credits.aleo/transfer_private(payment, treasury, amount);

        let future: Future = finalize_join_raffle(
            caller,
            caller,
            raffle_id,
            slot_ids,
            salts,
            count,
            payment_future,
            false
        );
        return (change, future);
    }

    async function finalize_join_raffle(
        caller: address,
        participant: address,
        raffle_id: field,
        slot_ids: [u64; 8],
        salts: [field; 8],
        count: u8,
        payment_future: Future,
        enforce_backend: bool
    ) {
        let admin: address = raffle_admin.get(0u8);
        let backend: address = backend_signer.get_or_use(0u8, admin);
        if enforce_backend {
            assert(caller == backend || caller == admin);
        }

        assert(count > 0u8 && count <= 8u8);

        let state: raffle = raffles.get(raffle_id);
        assert_eq(state.status, 0u8);

        let count_u64: u64 = count as u64;
        let new_sold: u64 = state.sold_slots + count_u64;
        assert(new_sold <= state.total_slots);

        if count > 0u8 {
            process_slot_commit(
                participant,
                raffle_id,
                slot_ids[0u32],
                salts[0u32],
                state.max_slots_per_address,
                state.total_slots
            );
        }
        if count > 1u8 {
            process_slot_commit(
                participant,
                raffle_id,
                slot_ids[1u32],
                salts[1u32],
                state.max_slots_per_address,
                state.total_slots
            );
        }
        if count > 2u8 {
            process_slot_commit(
                participant,
                raffle_id,
                slot_ids[2u32],
                salts[2u32],
                state.max_slots_per_address,
                state.total_slots
            );
        }
        if count > 3u8 {
            process_slot_commit(
                participant,
                raffle_id,
                slot_ids[3u32],
                salts[3u32],
                state.max_slots_per_address,
                state.total_slots
            );
        }
        if count > 4u8 {
            process_slot_commit(
                participant,
                raffle_id,
                slot_ids[4u32],
                salts[4u32],
                state.max_slots_per_address,
                state.total_slots
            );
        }
        if count > 5u8 {
            process_slot_commit(
                participant,
                raffle_id,
                slot_ids[5u32],
                salts[5u32],
                state.max_slots_per_address,
                state.total_slots
            );
        }
        if count > 6u8 {
            process_slot_commit(
                participant,
                raffle_id,
                slot_ids[6u32],
                salts[6u32],
                state.max_slots_per_address,
                state.total_slots
            );
        }
        if count > 7u8 {
            process_slot_commit(
                participant,
                raffle_id,
                slot_ids[7u32],
                salts[7u32],
                state.max_slots_per_address,
                state.total_slots
            );
        }

        payment_future.await();

        let new_status: u8 = state.status;
        if new_sold == state.total_slots {
            new_status = 1u8;
        }

        let new_state: raffle = raffle {
            organizer: state.organizer,
            total_slots: state.total_slots,
            max_slots_per_address: state.max_slots_per_address,
            metadata_hash: state.metadata_hash,
            prize_commit: state.prize_commit,
            seed_commit: state.seed_commit,
            treasury: state.treasury,
            auto_draw: state.auto_draw,
            auto_claim: state.auto_claim,
            sold_slots: new_sold,
            winner_slot: state.winner_slot,
            winner: state.winner,
            winner_set: state.winner_set,
            status: new_status,
        };
        raffles.set(raffle_id, new_state);
    }

    // --- Draw winner ---

    async transition draw_raffle(
        public raffle_id: field,
        public seed: u64
    ) -> Future {
        let caller: address = self.caller;
        return finalize_draw_raffle(caller, raffle_id, seed);
    }

    async function finalize_draw_raffle(
        caller: address,
        raffle_id: field,
        seed: u64
    ) {
        let state: raffle = raffles.get(raffle_id);
        assert(state.status == 1u8 || state.status == 0u8);
        assert(state.sold_slots == state.total_slots);

        // Only organizer or backend can draw
        let admin: address = raffle_admin.get(0u8);
        let backend: address = backend_signer.get_or_use(0u8, admin);
        assert(caller == state.organizer || caller == backend || caller == admin);

        let expected_commit: field = seed_commit_hash(raffle_id, seed);
        assert_eq(expected_commit, state.seed_commit);

        let winner_slot: u64 = (seed % state.total_slots) + 1u64;

        let new_state: raffle = raffle {
            organizer: state.organizer,
            total_slots: state.total_slots,
            max_slots_per_address: state.max_slots_per_address,
            metadata_hash: state.metadata_hash,
            prize_commit: state.prize_commit,
            seed_commit: state.seed_commit,
            treasury: state.treasury,
            auto_draw: state.auto_draw,
            auto_claim: state.auto_claim,
            sold_slots: state.sold_slots,
            winner_slot,
            winner: state.winner,
            winner_set: false,
            status: 2u8,
        };
        raffles.set(raffle_id, new_state);
    }

    // --- Reveal slot (optional transparency) ---

    async transition reveal_slot(
        public raffle_id: field,
        public slot_id: u64,
        private salt: field
    ) -> Future {
        let caller: address = self.caller;
        return finalize_reveal_slot(caller, raffle_id, slot_id, salt);
    }

    async function finalize_reveal_slot(
        caller: address,
        raffle_id: field,
        slot_id: u64,
        salt: field
    ) {
        let key: field = slot_key_hash(raffle_id, slot_id);
        let commit: field = slot_commits.get(key);
        let expected: field = slot_commit(caller, salt);
        assert_eq(commit, expected);

        slot_owners.set(key, caller);
    }

    // --- Claim prize ---

    async transition claim_prize(
        public raffle_id: field,
        public slot_id: u64,
        private salt: field,
        private nft_data: mogate_arc721_collection.aleo/data,
        private nft_edition: scalar
    ) -> Future {
        let caller: address = self.caller;
        return finalize_claim_prize(
            caller,
            raffle_id,
            slot_id,
            salt,
            nft_data,
            nft_edition
        );
    }

    async function finalize_claim_prize(
        caller: address,
        raffle_id: field,
        slot_id: u64,
        salt: field,
        nft_data: mogate_arc721_collection.aleo/data,
        nft_edition: scalar
    ) {
        let state: raffle = raffles.get(raffle_id);
        assert_eq(state.status, 2u8);
        assert_eq(state.winner_slot, slot_id);

        let claimed: bool = raffle_claimed.get_or_use(raffle_id, false);
        assert(!claimed);

        let key: field = slot_key_hash(raffle_id, slot_id);
        let commit: field = slot_commits.get(key);
        let expected: field = slot_commit(caller, salt);
        assert_eq(commit, expected);

        // Ensure prize matches the committed metadata + edition
        let prize_commit: field = prize_commit_hash(nft_data, nft_edition);
        assert_eq(prize_commit, state.prize_commit);

        // Mint NFT to winner (this program must be collection admin/minter)
        let (_, mint_future): (mogate_arc721_collection.aleo/NFTView, Future) =
            mogate_arc721_collection.aleo/mint_public(
                caller,
                nft_data,
                nft_edition
            );
        mint_future.await();

        raffle_claimed.set(raffle_id, true);

        let new_state: raffle = raffle {
            organizer: state.organizer,
            total_slots: state.total_slots,
            max_slots_per_address: state.max_slots_per_address,
            metadata_hash: state.metadata_hash,
            prize_commit: state.prize_commit,
            seed_commit: state.seed_commit,
            treasury: state.treasury,
            auto_draw: state.auto_draw,
            auto_claim: state.auto_claim,
            sold_slots: state.sold_slots,
            winner_slot: state.winner_slot,
            winner: caller,
            winner_set: true,
            status: state.status,
        };
        raffles.set(raffle_id, new_state);
    }
}
