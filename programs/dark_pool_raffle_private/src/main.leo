// Darkpool raffle with fully private tickets (record-based)

import mogate_arc721_private.aleo;
import credits.aleo;

program mogate_darkpool_raffle_private.aleo {
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
        status: u8, // 0 = OPEN, 1 = FILLED, 2 = DRAWN, 3 = CANCELLED
    }

    record TicketBatch {
        owner: address,
        raffle_id: field,
        slots: [u64; 8],
        count: u8,
    }

    struct slot_key {
        raffle_id: field,
        slot_id: u64,
    }

    struct user_key {
        raffle_id: field,
        participant: address,
    }

    struct seed_commit_data {
        raffle_id: field,
        seed: u64,
    }

    // --- Public state mappings ---

    mapping raffles: field => raffle;
    mapping slot_taken: field => bool;          // slot_key => taken
    mapping user_slot_counts: field => u64;     // user_key => count
    mapping raffle_claimed: field => bool;      // raffle_id => claimed
    mapping raffle_admin: u8 => address;
    mapping backend_signer: u8 => address;
    mapping treasury_account: u8 => address;

    // --- Helpers ---

    inline slot_key_hash(raffle_id: field, slot_id: u64) -> field {
        let key: slot_key = slot_key { raffle_id, slot_id };
        return BHP256::hash_to_field(key);
    }

    inline user_key_hash(raffle_id: field, owner: address) -> field {
        let key: user_key = user_key { raffle_id, participant: owner };
        return BHP256::hash_to_field(key);
    }

    inline seed_commit_hash(raffle_id: field, seed: u64) -> field {
        let seed_data: seed_commit_data = seed_commit_data { raffle_id, seed };
        return BHP256::hash_to_field(seed_data);
    }

    inline prize_commit_hash(
        nft_data: data,
        nft_edition: scalar
    ) -> field {
        let data_hash: field = BHP256::hash_to_field(nft_data);
        return BHP256::commit_to_field(data_hash, nft_edition);
    }

    // --- Public hash helpers (no state changes) ---

    transition compute_seed_commit(
        public raffle_id: field,
        public seed: u64
    ) -> field {
        return seed_commit_hash(raffle_id, seed);
    }

    transition compute_slot_key_hash(
        public raffle_id: field,
        public slot_id: u64
    ) -> field {
        return slot_key_hash(raffle_id, slot_id);
    }

    transition compute_user_key_hash(
        public raffle_id: field,
        public owner: address
    ) -> field {
        return user_key_hash(raffle_id, owner);
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
            status: 0u8,
        };
        raffles.set(raffle_id, state);
    }

    // --- Join raffle (batch mint private ticket) ---

    // Safe join (backend-only)
    async transition join_raffle(
        public participant: address,
        public raffle_id: field,
        public slot_ids: [u64; 8],
        public count: u8,
        private payment: credits.aleo/credits,
        public amount: u64,
        public treasury: address
    ) -> (TicketBatch, credits.aleo/credits, Future) {
        let caller: address = self.caller;
        let ticket: TicketBatch = TicketBatch {
            owner: participant,
            raffle_id,
            slots: slot_ids,
            count,
        };

        let (change, payment_future): (credits.aleo/credits, Future) =
            credits.aleo/transfer_private_to_public(payment, treasury, amount);

        let future: Future = finalize_join_raffle(
            caller,
            participant,
            raffle_id,
            slot_ids,
            count,
            treasury,
            payment_future,
            true
        );
        return (ticket, change, future);
    }

    // Unsafe join (no backend auth) - default batch join
    async transition unsafe_join_raffle(
        public raffle_id: field,
        public slot_ids: [u64; 8],
        public count: u8,
        private payment: credits.aleo/credits,
        public amount: u64,
        public treasury: address
    ) -> (TicketBatch, credits.aleo/credits, Future) {
        let caller: address = self.caller;
        let ticket: TicketBatch = TicketBatch {
            owner: caller,
            raffle_id,
            slots: slot_ids,
            count,
        };

        let (change, payment_future): (credits.aleo/credits, Future) =
            credits.aleo/transfer_private_to_public(payment, treasury, amount);

        let future: Future = finalize_join_raffle(
            caller,
            caller,
            raffle_id,
            slot_ids,
            count,
            treasury,
            payment_future,
            false
        );
        return (ticket, change, future);
    }

    async function finalize_join_raffle(
        caller: address,
        participant: address,
        raffle_id: field,
        slot_ids: [u64; 8],
        count: u8,
        treasury: address,
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
        assert_eq(treasury, state.treasury);

        let count_u64: u64 = count as u64;
        let new_sold: u64 = state.sold_slots + count_u64;
        assert(new_sold <= state.total_slots);

        if count > 0u8 {
            let slot_0: u64 = slot_ids[0u32];
            assert(slot_0 > 0u64 && slot_0 <= state.total_slots);
            let key_0: field = slot_key_hash(raffle_id, slot_0);
            let taken_0: bool = slot_taken.get_or_use(key_0, false);
            assert(!taken_0);
            slot_taken.set(key_0, true);
        }
        if count > 1u8 {
            let slot_1: u64 = slot_ids[1u32];
            assert(slot_1 > 0u64 && slot_1 <= state.total_slots);
            let key_1: field = slot_key_hash(raffle_id, slot_1);
            let taken_1: bool = slot_taken.get_or_use(key_1, false);
            assert(!taken_1);
            slot_taken.set(key_1, true);
        }
        if count > 2u8 {
            let slot_2: u64 = slot_ids[2u32];
            assert(slot_2 > 0u64 && slot_2 <= state.total_slots);
            let key_2: field = slot_key_hash(raffle_id, slot_2);
            let taken_2: bool = slot_taken.get_or_use(key_2, false);
            assert(!taken_2);
            slot_taken.set(key_2, true);
        }
        if count > 3u8 {
            let slot_3: u64 = slot_ids[3u32];
            assert(slot_3 > 0u64 && slot_3 <= state.total_slots);
            let key_3: field = slot_key_hash(raffle_id, slot_3);
            let taken_3: bool = slot_taken.get_or_use(key_3, false);
            assert(!taken_3);
            slot_taken.set(key_3, true);
        }
        if count > 4u8 {
            let slot_4: u64 = slot_ids[4u32];
            assert(slot_4 > 0u64 && slot_4 <= state.total_slots);
            let key_4: field = slot_key_hash(raffle_id, slot_4);
            let taken_4: bool = slot_taken.get_or_use(key_4, false);
            assert(!taken_4);
            slot_taken.set(key_4, true);
        }
        if count > 5u8 {
            let slot_5: u64 = slot_ids[5u32];
            assert(slot_5 > 0u64 && slot_5 <= state.total_slots);
            let key_5: field = slot_key_hash(raffle_id, slot_5);
            let taken_5: bool = slot_taken.get_or_use(key_5, false);
            assert(!taken_5);
            slot_taken.set(key_5, true);
        }
        if count > 6u8 {
            let slot_6: u64 = slot_ids[6u32];
            assert(slot_6 > 0u64 && slot_6 <= state.total_slots);
            let key_6: field = slot_key_hash(raffle_id, slot_6);
            let taken_6: bool = slot_taken.get_or_use(key_6, false);
            assert(!taken_6);
            slot_taken.set(key_6, true);
        }
        if count > 7u8 {
            let slot_7: u64 = slot_ids[7u32];
            assert(slot_7 > 0u64 && slot_7 <= state.total_slots);
            let key_7: field = slot_key_hash(raffle_id, slot_7);
            let taken_7: bool = slot_taken.get_or_use(key_7, false);
            assert(!taken_7);
            slot_taken.set(key_7, true);
        }

        if state.max_slots_per_address != 0u64 {
            let ukey: field = user_key_hash(raffle_id, participant);
            let current_count: u64 = user_slot_counts.get_or_use(ukey, 0u64);
            let updated_count: u64 = current_count + count_u64;
            assert(updated_count <= state.max_slots_per_address);
            user_slot_counts.set(ukey, updated_count);
        }

        payment_future.await();

        let new_status: u8 = new_sold == state.total_slots ? 1u8 : state.status;

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
            status: 2u8,
        };
        raffles.set(raffle_id, new_state);
    }

    // --- Claim prize (private) ---

    async transition claim_prize(
        private ticket: TicketBatch,
        public slot_id: u64,
        private nft_data: data,
        private nft_edition: scalar
    ) -> (mogate_arc721_private.aleo/PrivateNFT, Future) {
        let caller: address = self.caller;
        let (minted_nft, mint_future): (mogate_arc721_private.aleo/PrivateNFT, Future) =
            mogate_arc721_private.aleo/mint_private(
                caller,
                nft_data,
                nft_edition
            );

        let future: Future = finalize_claim_prize(
            caller,
            ticket.owner,
            ticket.raffle_id,
            ticket.slots,
            ticket.count,
            slot_id,
            nft_data,
            nft_edition,
            mint_future
        );
        return (minted_nft, future);
    }

    async function finalize_claim_prize(
        caller: address,
        ticket_owner: address,
        raffle_id: field,
        ticket_slots: [u64; 8],
        ticket_count: u8,
        slot_id: u64,
        nft_data: data,
        nft_edition: scalar,
        mint_future: Future
    ) {
        assert_eq(caller, ticket_owner);

        let state: raffle = raffles.get(raffle_id);
        assert_eq(state.status, 2u8);
        assert_eq(state.winner_slot, slot_id);

        let claimed: bool = raffle_claimed.get_or_use(raffle_id, false);
        assert(!claimed);

        let has_slot: bool =
            (ticket_count > 0u8 && ticket_slots[0u32] == slot_id) ||
            (ticket_count > 1u8 && ticket_slots[1u32] == slot_id) ||
            (ticket_count > 2u8 && ticket_slots[2u32] == slot_id) ||
            (ticket_count > 3u8 && ticket_slots[3u32] == slot_id) ||
            (ticket_count > 4u8 && ticket_slots[4u32] == slot_id) ||
            (ticket_count > 5u8 && ticket_slots[5u32] == slot_id) ||
            (ticket_count > 6u8 && ticket_slots[6u32] == slot_id) ||
            (ticket_count > 7u8 && ticket_slots[7u32] == slot_id);
        assert(has_slot);

        // Ensure prize matches the committed metadata + edition
        let prize_commit: field = prize_commit_hash(nft_data, nft_edition);
        assert_eq(prize_commit, state.prize_commit);

        mint_future.await();

        raffle_claimed.set(raffle_id, true);
    }
}
