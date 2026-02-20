import mogate_arc721_private.aleo;
import credits.aleo;
program mogate_darkpool_raffle_private.aleo;

record TicketBatch:
    owner as address.private;
    raffle_id as field.private;
    slots as [u64; 8u32].private;
    count as u8.private;

struct raffle:
    organizer as address;
    total_slots as u64;
    max_slots_per_address as u64;
    metadata_hash as field;
    prize_commit as field;
    seed_commit as field;
    treasury as address;
    auto_draw as boolean;
    auto_claim as boolean;
    sold_slots as u64;
    winner_slot as u64;
    status as u8;

struct slot_key:
    raffle_id as field;
    slot_id as u64;

struct user_key:
    raffle_id as field;
    participant as address;

struct seed_commit_data:
    raffle_id as field;
    seed as u64;

struct attribute:
    trait_type as [field; 4u32];
    trait_value as [field; 4u32];

struct data:
    metadata as [field; 4u32];
    name as [field; 4u32];
    image as [field; 16u32];
    attributes as [attribute; 4u32];

mapping raffles:
    key as field.public;
    value as raffle.public;

mapping slot_taken:
    key as field.public;
    value as boolean.public;

mapping user_slot_counts:
    key as field.public;
    value as u64.public;

mapping raffle_claimed:
    key as field.public;
    value as boolean.public;

mapping raffle_admin:
    key as u8.public;
    value as address.public;

mapping backend_signer:
    key as u8.public;
    value as address.public;

mapping treasury_account:
    key as u8.public;
    value as address.public;

function compute_seed_commit:
    input r0 as field.public;
    input r1 as u64.public;
    cast r0 r1 into r2 as seed_commit_data;
    hash.bhp256 r2 into r3 as field;
    output r3 as field.private;

function compute_slot_key_hash:
    input r0 as field.public;
    input r1 as u64.public;
    cast r0 r1 into r2 as slot_key;
    hash.bhp256 r2 into r3 as field;
    output r3 as field.private;

function compute_user_key_hash:
    input r0 as field.public;
    input r1 as address.public;
    cast r0 r1 into r2 as user_key;
    hash.bhp256 r2 into r3 as field;
    output r3 as field.private;

function initialize:
    input r0 as address.public;
    input r1 as address.public;
    input r2 as address.public;
    async initialize r0 r1 r2 into r3;
    output r3 as mogate_darkpool_raffle_private.aleo/initialize.future;

finalize initialize:
    input r0 as address.public;
    input r1 as address.public;
    input r2 as address.public;
    contains raffle_admin[0u8] into r3;
    not r3 into r4;
    assert.eq r4 true;
    set r0 into raffle_admin[0u8];
    set r1 into backend_signer[0u8];
    set r2 into treasury_account[0u8];

function set_backend_signer:
    input r0 as address.public;
    async set_backend_signer self.caller r0 into r1;
    output r1 as mogate_darkpool_raffle_private.aleo/set_backend_signer.future;

finalize set_backend_signer:
    input r0 as address.public;
    input r1 as address.public;
    get raffle_admin[0u8] into r2;
    assert.eq r0 r2;
    set r1 into backend_signer[0u8];

function set_treasury:
    input r0 as address.public;
    async set_treasury self.caller r0 into r1;
    output r1 as mogate_darkpool_raffle_private.aleo/set_treasury.future;

finalize set_treasury:
    input r0 as address.public;
    input r1 as address.public;
    get raffle_admin[0u8] into r2;
    assert.eq r0 r2;
    set r1 into treasury_account[0u8];

function host_raffle:
    input r0 as address.public;
    input r1 as field.public;
    input r2 as u64.public;
    input r3 as u64.public;
    input r4 as field.public;
    input r5 as field.public;
    input r6 as field.public;
    input r7 as boolean.public;
    input r8 as boolean.public;
    async host_raffle self.caller r0 r1 r2 r3 r4 r5 r6 r7 r8 true into r9;
    output r9 as mogate_darkpool_raffle_private.aleo/host_raffle.future;

finalize host_raffle:
    input r0 as address.public;
    input r1 as address.public;
    input r2 as field.public;
    input r3 as u64.public;
    input r4 as u64.public;
    input r5 as field.public;
    input r6 as field.public;
    input r7 as field.public;
    input r8 as boolean.public;
    input r9 as boolean.public;
    input r10 as boolean.public;
    get raffle_admin[0u8] into r11;
    get.or_use backend_signer[0u8] r11 into r12;
    branch.eq r10 false to end_then_0_0;
    is.eq r0 r12 into r13;
    is.eq r0 r11 into r14;
    or r13 r14 into r15;
    assert.eq r15 true;
    branch.eq true true to end_otherwise_0_1;
    position end_then_0_0;
    position end_otherwise_0_1;
    contains raffles[r2] into r16;
    not r16 into r17;
    assert.eq r17 true;
    gt r3 0u64 into r18;
    assert.eq r18 true;
    get.or_use treasury_account[0u8] r1 into r19;
    cast r1 r3 r4 r5 r6 r7 r19 r8 r9 0u64 0u64 0u8 into r20 as raffle;
    set r20 into raffles[r2];

function unsafe_host_raffle:
    input r0 as field.public;
    input r1 as u64.public;
    input r2 as u64.public;
    input r3 as field.public;
    input r4 as field.public;
    input r5 as field.public;
    input r6 as boolean.public;
    input r7 as boolean.public;
    async unsafe_host_raffle self.caller self.caller r0 r1 r2 r3 r4 r5 r6 r7 false into r8;
    output r8 as mogate_darkpool_raffle_private.aleo/unsafe_host_raffle.future;

finalize unsafe_host_raffle:
    input r0 as address.public;
    input r1 as address.public;
    input r2 as field.public;
    input r3 as u64.public;
    input r4 as u64.public;
    input r5 as field.public;
    input r6 as field.public;
    input r7 as field.public;
    input r8 as boolean.public;
    input r9 as boolean.public;
    input r10 as boolean.public;
    get raffle_admin[0u8] into r11;
    get.or_use backend_signer[0u8] r11 into r12;
    branch.eq r10 false to end_then_0_2;
    is.eq r0 r12 into r13;
    is.eq r0 r11 into r14;
    or r13 r14 into r15;
    assert.eq r15 true;
    branch.eq true true to end_otherwise_0_3;
    position end_then_0_2;
    position end_otherwise_0_3;
    contains raffles[r2] into r16;
    not r16 into r17;
    assert.eq r17 true;
    gt r3 0u64 into r18;
    assert.eq r18 true;
    get.or_use treasury_account[0u8] r1 into r19;
    cast r1 r3 r4 r5 r6 r7 r19 r8 r9 0u64 0u64 0u8 into r20 as raffle;
    set r20 into raffles[r2];

function join_raffle:
    input r0 as address.public;
    input r1 as field.public;
    input r2 as [u64; 8u32].public;
    input r3 as u8.public;
    input r4 as credits.aleo/credits.record;
    input r5 as u64.public;
    input r6 as address.public;
    cast r0 r1 r2 r3 into r7 as TicketBatch.record;
    call credits.aleo/transfer_private_to_public r4 r6 r5 into r8 r9;
    async join_raffle self.caller r0 r1 r2 r3 r6 r9 true into r10;
    output r7 as TicketBatch.record;
    output r8 as credits.aleo/credits.record;
    output r10 as mogate_darkpool_raffle_private.aleo/join_raffle.future;

finalize join_raffle:
    input r0 as address.public;
    input r1 as address.public;
    input r2 as field.public;
    input r3 as [u64; 8u32].public;
    input r4 as u8.public;
    input r5 as address.public;
    input r6 as credits.aleo/transfer_private_to_public.future;
    input r7 as boolean.public;
    get raffle_admin[0u8] into r8;
    get.or_use backend_signer[0u8] r8 into r9;
    branch.eq r7 false to end_then_0_4;
    is.eq r0 r9 into r10;
    is.eq r0 r8 into r11;
    or r10 r11 into r12;
    assert.eq r12 true;
    branch.eq true true to end_otherwise_0_5;
    position end_then_0_4;
    position end_otherwise_0_5;
    gt r4 0u8 into r13;
    lte r4 8u8 into r14;
    and r13 r14 into r15;
    assert.eq r15 true;
    get raffles[r2] into r16;
    assert.eq r16.status 0u8;
    assert.eq r5 r16.treasury;
    cast r4 into r17 as u64;
    add r16.sold_slots r17 into r18;
    lte r18 r16.total_slots into r19;
    assert.eq r19 true;
    branch.eq r13 false to end_then_0_6;
    gt r3[0u32] 0u64 into r20;
    lte r3[0u32] r16.total_slots into r21;
    and r20 r21 into r22;
    assert.eq r22 true;
    cast r2 r3[0u32] into r23 as slot_key;
    hash.bhp256 r23 into r24 as field;
    get.or_use slot_taken[r24] false into r25;
    not r25 into r26;
    assert.eq r26 true;
    set true into slot_taken[r24];
    branch.eq true true to end_otherwise_0_7;
    position end_then_0_6;
    position end_otherwise_0_7;
    gt r4 1u8 into r27;
    branch.eq r27 false to end_then_0_8;
    gt r3[1u32] 0u64 into r28;
    lte r3[1u32] r16.total_slots into r29;
    and r28 r29 into r30;
    assert.eq r30 true;
    cast r2 r3[1u32] into r31 as slot_key;
    hash.bhp256 r31 into r32 as field;
    get.or_use slot_taken[r32] false into r33;
    not r33 into r34;
    assert.eq r34 true;
    set true into slot_taken[r32];
    branch.eq true true to end_otherwise_0_9;
    position end_then_0_8;
    position end_otherwise_0_9;
    gt r4 2u8 into r35;
    branch.eq r35 false to end_then_0_10;
    gt r3[2u32] 0u64 into r36;
    lte r3[2u32] r16.total_slots into r37;
    and r36 r37 into r38;
    assert.eq r38 true;
    cast r2 r3[2u32] into r39 as slot_key;
    hash.bhp256 r39 into r40 as field;
    get.or_use slot_taken[r40] false into r41;
    not r41 into r42;
    assert.eq r42 true;
    set true into slot_taken[r40];
    branch.eq true true to end_otherwise_0_11;
    position end_then_0_10;
    position end_otherwise_0_11;
    gt r4 3u8 into r43;
    branch.eq r43 false to end_then_0_12;
    gt r3[3u32] 0u64 into r44;
    lte r3[3u32] r16.total_slots into r45;
    and r44 r45 into r46;
    assert.eq r46 true;
    cast r2 r3[3u32] into r47 as slot_key;
    hash.bhp256 r47 into r48 as field;
    get.or_use slot_taken[r48] false into r49;
    not r49 into r50;
    assert.eq r50 true;
    set true into slot_taken[r48];
    branch.eq true true to end_otherwise_0_13;
    position end_then_0_12;
    position end_otherwise_0_13;
    gt r4 4u8 into r51;
    branch.eq r51 false to end_then_0_14;
    gt r3[4u32] 0u64 into r52;
    lte r3[4u32] r16.total_slots into r53;
    and r52 r53 into r54;
    assert.eq r54 true;
    cast r2 r3[4u32] into r55 as slot_key;
    hash.bhp256 r55 into r56 as field;
    get.or_use slot_taken[r56] false into r57;
    not r57 into r58;
    assert.eq r58 true;
    set true into slot_taken[r56];
    branch.eq true true to end_otherwise_0_15;
    position end_then_0_14;
    position end_otherwise_0_15;
    gt r4 5u8 into r59;
    branch.eq r59 false to end_then_0_16;
    gt r3[5u32] 0u64 into r60;
    lte r3[5u32] r16.total_slots into r61;
    and r60 r61 into r62;
    assert.eq r62 true;
    cast r2 r3[5u32] into r63 as slot_key;
    hash.bhp256 r63 into r64 as field;
    get.or_use slot_taken[r64] false into r65;
    not r65 into r66;
    assert.eq r66 true;
    set true into slot_taken[r64];
    branch.eq true true to end_otherwise_0_17;
    position end_then_0_16;
    position end_otherwise_0_17;
    gt r4 6u8 into r67;
    branch.eq r67 false to end_then_0_18;
    gt r3[6u32] 0u64 into r68;
    lte r3[6u32] r16.total_slots into r69;
    and r68 r69 into r70;
    assert.eq r70 true;
    cast r2 r3[6u32] into r71 as slot_key;
    hash.bhp256 r71 into r72 as field;
    get.or_use slot_taken[r72] false into r73;
    not r73 into r74;
    assert.eq r74 true;
    set true into slot_taken[r72];
    branch.eq true true to end_otherwise_0_19;
    position end_then_0_18;
    position end_otherwise_0_19;
    gt r4 7u8 into r75;
    branch.eq r75 false to end_then_0_20;
    gt r3[7u32] 0u64 into r76;
    lte r3[7u32] r16.total_slots into r77;
    and r76 r77 into r78;
    assert.eq r78 true;
    cast r2 r3[7u32] into r79 as slot_key;
    hash.bhp256 r79 into r80 as field;
    get.or_use slot_taken[r80] false into r81;
    not r81 into r82;
    assert.eq r82 true;
    set true into slot_taken[r80];
    branch.eq true true to end_otherwise_0_21;
    position end_then_0_20;
    position end_otherwise_0_21;
    is.neq r16.max_slots_per_address 0u64 into r83;
    branch.eq r83 false to end_then_0_22;
    cast r2 r1 into r84 as user_key;
    hash.bhp256 r84 into r85 as field;
    get.or_use user_slot_counts[r85] 0u64 into r86;
    add r86 r17 into r87;
    lte r87 r16.max_slots_per_address into r88;
    assert.eq r88 true;
    set r87 into user_slot_counts[r85];
    branch.eq true true to end_otherwise_0_23;
    position end_then_0_22;
    position end_otherwise_0_23;
    await r6;
    is.eq r18 r16.total_slots into r89;
    ternary r89 1u8 r16.status into r90;
    cast r16.organizer r16.total_slots r16.max_slots_per_address r16.metadata_hash r16.prize_commit r16.seed_commit r16.treasury r16.auto_draw r16.auto_claim r18 r16.winner_slot r90 into r91 as raffle;
    set r91 into raffles[r2];

function unsafe_join_raffle:
    input r0 as field.public;
    input r1 as [u64; 8u32].public;
    input r2 as u8.public;
    input r3 as credits.aleo/credits.record;
    input r4 as u64.public;
    input r5 as address.public;
    cast self.caller r0 r1 r2 into r6 as TicketBatch.record;
    call credits.aleo/transfer_private_to_public r3 r5 r4 into r7 r8;
    async unsafe_join_raffle self.caller self.caller r0 r1 r2 r5 r8 false into r9;
    output r6 as TicketBatch.record;
    output r7 as credits.aleo/credits.record;
    output r9 as mogate_darkpool_raffle_private.aleo/unsafe_join_raffle.future;

finalize unsafe_join_raffle:
    input r0 as address.public;
    input r1 as address.public;
    input r2 as field.public;
    input r3 as [u64; 8u32].public;
    input r4 as u8.public;
    input r5 as address.public;
    input r6 as credits.aleo/transfer_private_to_public.future;
    input r7 as boolean.public;
    get raffle_admin[0u8] into r8;
    get.or_use backend_signer[0u8] r8 into r9;
    branch.eq r7 false to end_then_0_24;
    is.eq r0 r9 into r10;
    is.eq r0 r8 into r11;
    or r10 r11 into r12;
    assert.eq r12 true;
    branch.eq true true to end_otherwise_0_25;
    position end_then_0_24;
    position end_otherwise_0_25;
    gt r4 0u8 into r13;
    lte r4 8u8 into r14;
    and r13 r14 into r15;
    assert.eq r15 true;
    get raffles[r2] into r16;
    assert.eq r16.status 0u8;
    assert.eq r5 r16.treasury;
    cast r4 into r17 as u64;
    add r16.sold_slots r17 into r18;
    lte r18 r16.total_slots into r19;
    assert.eq r19 true;
    branch.eq r13 false to end_then_0_26;
    gt r3[0u32] 0u64 into r20;
    lte r3[0u32] r16.total_slots into r21;
    and r20 r21 into r22;
    assert.eq r22 true;
    cast r2 r3[0u32] into r23 as slot_key;
    hash.bhp256 r23 into r24 as field;
    get.or_use slot_taken[r24] false into r25;
    not r25 into r26;
    assert.eq r26 true;
    set true into slot_taken[r24];
    branch.eq true true to end_otherwise_0_27;
    position end_then_0_26;
    position end_otherwise_0_27;
    gt r4 1u8 into r27;
    branch.eq r27 false to end_then_0_28;
    gt r3[1u32] 0u64 into r28;
    lte r3[1u32] r16.total_slots into r29;
    and r28 r29 into r30;
    assert.eq r30 true;
    cast r2 r3[1u32] into r31 as slot_key;
    hash.bhp256 r31 into r32 as field;
    get.or_use slot_taken[r32] false into r33;
    not r33 into r34;
    assert.eq r34 true;
    set true into slot_taken[r32];
    branch.eq true true to end_otherwise_0_29;
    position end_then_0_28;
    position end_otherwise_0_29;
    gt r4 2u8 into r35;
    branch.eq r35 false to end_then_0_30;
    gt r3[2u32] 0u64 into r36;
    lte r3[2u32] r16.total_slots into r37;
    and r36 r37 into r38;
    assert.eq r38 true;
    cast r2 r3[2u32] into r39 as slot_key;
    hash.bhp256 r39 into r40 as field;
    get.or_use slot_taken[r40] false into r41;
    not r41 into r42;
    assert.eq r42 true;
    set true into slot_taken[r40];
    branch.eq true true to end_otherwise_0_31;
    position end_then_0_30;
    position end_otherwise_0_31;
    gt r4 3u8 into r43;
    branch.eq r43 false to end_then_0_32;
    gt r3[3u32] 0u64 into r44;
    lte r3[3u32] r16.total_slots into r45;
    and r44 r45 into r46;
    assert.eq r46 true;
    cast r2 r3[3u32] into r47 as slot_key;
    hash.bhp256 r47 into r48 as field;
    get.or_use slot_taken[r48] false into r49;
    not r49 into r50;
    assert.eq r50 true;
    set true into slot_taken[r48];
    branch.eq true true to end_otherwise_0_33;
    position end_then_0_32;
    position end_otherwise_0_33;
    gt r4 4u8 into r51;
    branch.eq r51 false to end_then_0_34;
    gt r3[4u32] 0u64 into r52;
    lte r3[4u32] r16.total_slots into r53;
    and r52 r53 into r54;
    assert.eq r54 true;
    cast r2 r3[4u32] into r55 as slot_key;
    hash.bhp256 r55 into r56 as field;
    get.or_use slot_taken[r56] false into r57;
    not r57 into r58;
    assert.eq r58 true;
    set true into slot_taken[r56];
    branch.eq true true to end_otherwise_0_35;
    position end_then_0_34;
    position end_otherwise_0_35;
    gt r4 5u8 into r59;
    branch.eq r59 false to end_then_0_36;
    gt r3[5u32] 0u64 into r60;
    lte r3[5u32] r16.total_slots into r61;
    and r60 r61 into r62;
    assert.eq r62 true;
    cast r2 r3[5u32] into r63 as slot_key;
    hash.bhp256 r63 into r64 as field;
    get.or_use slot_taken[r64] false into r65;
    not r65 into r66;
    assert.eq r66 true;
    set true into slot_taken[r64];
    branch.eq true true to end_otherwise_0_37;
    position end_then_0_36;
    position end_otherwise_0_37;
    gt r4 6u8 into r67;
    branch.eq r67 false to end_then_0_38;
    gt r3[6u32] 0u64 into r68;
    lte r3[6u32] r16.total_slots into r69;
    and r68 r69 into r70;
    assert.eq r70 true;
    cast r2 r3[6u32] into r71 as slot_key;
    hash.bhp256 r71 into r72 as field;
    get.or_use slot_taken[r72] false into r73;
    not r73 into r74;
    assert.eq r74 true;
    set true into slot_taken[r72];
    branch.eq true true to end_otherwise_0_39;
    position end_then_0_38;
    position end_otherwise_0_39;
    gt r4 7u8 into r75;
    branch.eq r75 false to end_then_0_40;
    gt r3[7u32] 0u64 into r76;
    lte r3[7u32] r16.total_slots into r77;
    and r76 r77 into r78;
    assert.eq r78 true;
    cast r2 r3[7u32] into r79 as slot_key;
    hash.bhp256 r79 into r80 as field;
    get.or_use slot_taken[r80] false into r81;
    not r81 into r82;
    assert.eq r82 true;
    set true into slot_taken[r80];
    branch.eq true true to end_otherwise_0_41;
    position end_then_0_40;
    position end_otherwise_0_41;
    is.neq r16.max_slots_per_address 0u64 into r83;
    branch.eq r83 false to end_then_0_42;
    cast r2 r1 into r84 as user_key;
    hash.bhp256 r84 into r85 as field;
    get.or_use user_slot_counts[r85] 0u64 into r86;
    add r86 r17 into r87;
    lte r87 r16.max_slots_per_address into r88;
    assert.eq r88 true;
    set r87 into user_slot_counts[r85];
    branch.eq true true to end_otherwise_0_43;
    position end_then_0_42;
    position end_otherwise_0_43;
    await r6;
    is.eq r18 r16.total_slots into r89;
    ternary r89 1u8 r16.status into r90;
    cast r16.organizer r16.total_slots r16.max_slots_per_address r16.metadata_hash r16.prize_commit r16.seed_commit r16.treasury r16.auto_draw r16.auto_claim r18 r16.winner_slot r90 into r91 as raffle;
    set r91 into raffles[r2];

function draw_raffle:
    input r0 as field.public;
    input r1 as u64.public;
    async draw_raffle self.caller r0 r1 into r2;
    output r2 as mogate_darkpool_raffle_private.aleo/draw_raffle.future;

finalize draw_raffle:
    input r0 as address.public;
    input r1 as field.public;
    input r2 as u64.public;
    get raffles[r1] into r3;
    is.eq r3.status 1u8 into r4;
    is.eq r3.status 0u8 into r5;
    or r4 r5 into r6;
    assert.eq r6 true;
    is.eq r3.sold_slots r3.total_slots into r7;
    assert.eq r7 true;
    get raffle_admin[0u8] into r8;
    get.or_use backend_signer[0u8] r8 into r9;
    is.eq r0 r3.organizer into r10;
    is.eq r0 r9 into r11;
    or r10 r11 into r12;
    is.eq r0 r8 into r13;
    or r12 r13 into r14;
    assert.eq r14 true;
    cast r1 r2 into r15 as seed_commit_data;
    hash.bhp256 r15 into r16 as field;
    assert.eq r16 r3.seed_commit;
    rem r2 r3.total_slots into r17;
    add r17 1u64 into r18;
    cast r3.organizer r3.total_slots r3.max_slots_per_address r3.metadata_hash r3.prize_commit r3.seed_commit r3.treasury r3.auto_draw r3.auto_claim r3.sold_slots r18 2u8 into r19 as raffle;
    set r19 into raffles[r1];

function claim_prize:
    input r0 as TicketBatch.record;
    input r1 as u64.public;
    input r2 as data.private;
    input r3 as scalar.private;
    call mogate_arc721_private.aleo/mint_private self.caller r2 r3 into r4 r5;
    async claim_prize self.caller r0.owner r0.raffle_id r0.slots r0.count r1 r2 r3 r5 into r6;
    output r4 as mogate_arc721_private.aleo/PrivateNFT.record;
    output r6 as mogate_darkpool_raffle_private.aleo/claim_prize.future;

finalize claim_prize:
    input r0 as address.public;
    input r1 as address.public;
    input r2 as field.public;
    input r3 as [u64; 8u32].public;
    input r4 as u8.public;
    input r5 as u64.public;
    input r6 as data.public;
    input r7 as scalar.public;
    input r8 as mogate_arc721_private.aleo/mint_private.future;
    assert.eq r0 r1;
    get raffles[r2] into r9;
    assert.eq r9.status 2u8;
    assert.eq r9.winner_slot r5;
    get.or_use raffle_claimed[r2] false into r10;
    not r10 into r11;
    assert.eq r11 true;
    gt r4 0u8 into r12;
    is.eq r3[0u32] r5 into r13;
    and r12 r13 into r14;
    gt r4 1u8 into r15;
    is.eq r3[1u32] r5 into r16;
    and r15 r16 into r17;
    or r14 r17 into r18;
    gt r4 2u8 into r19;
    is.eq r3[2u32] r5 into r20;
    and r19 r20 into r21;
    or r18 r21 into r22;
    gt r4 3u8 into r23;
    is.eq r3[3u32] r5 into r24;
    and r23 r24 into r25;
    or r22 r25 into r26;
    gt r4 4u8 into r27;
    is.eq r3[4u32] r5 into r28;
    and r27 r28 into r29;
    or r26 r29 into r30;
    gt r4 5u8 into r31;
    is.eq r3[5u32] r5 into r32;
    and r31 r32 into r33;
    or r30 r33 into r34;
    gt r4 6u8 into r35;
    is.eq r3[6u32] r5 into r36;
    and r35 r36 into r37;
    or r34 r37 into r38;
    gt r4 7u8 into r39;
    is.eq r3[7u32] r5 into r40;
    and r39 r40 into r41;
    or r38 r41 into r42;
    assert.eq r42 true;
    hash.bhp256 r6 into r43 as field;
    commit.bhp256 r43 r7 into r44 as field;
    assert.eq r44 r9.prize_commit;
    await r8;
    set true into raffle_claimed[r2];

constructor:
    assert.eq edition 0u16;
