program mogate_arc721_multiprivate_v2.aleo;

struct data:
    metadata as [field; 4u32];

record PrivateNFT:
    owner as address.private;
    collection_id as field.private;
    data as data.private;
    token_id as scalar.private;

record BurnReceipt:
    owner as address.private;
    nft_owner as address.private;
    collection_id as field.private;
    nft_commit as field.private;
    metadata as [field; 4u32].private;
    token_id as scalar.private;

struct collection_meta:
    admin as address;
    name as [field; 4u32];
    symbol as [field; 4u32];
    metadata as [field; 4u32];
    public_token_id as boolean;
    is_bridged as boolean;
    origin_chain_id as u32;
    origin_collection as [field; 4u32];

struct nft_content:
    collection_id as field;
    data as data;

struct commit_input:
    collection_id as field;
    data as data;

struct minter_key_data:
    collection_id as field;
    minter as address;

struct collection_key_data:
    collection_id as field;
    index as u8;

struct token_key_data:
    collection_id as field;
    token_id as scalar;

mapping program_admin:
    key as u8.public;
    value as address.public;

mapping collections:
    key as field.public;
    value as collection_meta.public;

mapping collection_minters:
    key as field.public;
    value as boolean.public;

mapping supply_caps:
    key as field.public;
    value as u64.public;

mapping minted_counts:
    key as field.public;
    value as u64.public;

mapping nft_commits:
    key as field.public;
    value as boolean.public;

mapping nft_contents:
    key as field.public;
    value as nft_content.public;

mapping token_to_commit:
    key as field.public;
    value as field.public;

mapping commit_to_token:
    key as field.public;
    value as scalar.public;

function compute_nft_commit:
    input r0 as field.public;
    input r1 as data.public;
    input r2 as scalar.public;
    cast r0 r1 into r3 as commit_input;
    hash.bhp256 r3 into r4 as field;
    commit.bhp256 r4 r2 into r5 as field;
    output r5 as field.private;

function initialize:
    input r0 as address.public;
    async initialize r0 into r1;
    output r1 as mogate_arc721_multiprivate_v2.aleo/initialize.future;

finalize initialize:
    input r0 as address.public;
    contains program_admin[0u8] into r1;
    not r1 into r2;
    assert.eq r2 true;
    set r0 into program_admin[0u8];

function create_collection:
    input r0 as field.public;
    input r1 as address.public;
    input r2 as [field; 4u32].public;
    input r3 as [field; 4u32].public;
    input r4 as [field; 4u32].public;
    input r5 as boolean.public;
    input r6 as boolean.public;
    input r7 as u32.public;
    input r8 as [field; 4u32].public;
    input r9 as u64.public;
    input r10 as u64.public;
    async create_collection self.caller r0 r1 r2 r3 r4 r5 r6 r7 r8 r9 r10 into r11;
    output r11 as mogate_arc721_multiprivate_v2.aleo/create_collection.future;

finalize create_collection:
    input r0 as address.public;
    input r1 as field.public;
    input r2 as address.public;
    input r3 as [field; 4u32].public;
    input r4 as [field; 4u32].public;
    input r5 as [field; 4u32].public;
    input r6 as boolean.public;
    input r7 as boolean.public;
    input r8 as u32.public;
    input r9 as [field; 4u32].public;
    input r10 as u64.public;
    input r11 as u64.public;
    get program_admin[0u8] into r12;
    assert.eq r0 r12;
    contains collections[r1] into r13;
    not r13 into r14;
    assert.eq r14 true;
    cast r2 r3 r4 r5 r6 r7 r8 r9 into r15 as collection_meta;
    set r15 into collections[r1];
    cast r1 0u8 into r16 as collection_key_data;
    hash.bhp256 r16 into r17 as field;
    set r10 into supply_caps[r17];
    cast r1 1u8 into r18 as collection_key_data;
    hash.bhp256 r18 into r19 as field;
    set r11 into supply_caps[r19];

function set_collection_admin:
    input r0 as field.public;
    input r1 as address.public;
    async set_collection_admin self.caller r0 r1 into r2;
    output r2 as mogate_arc721_multiprivate_v2.aleo/set_collection_admin.future;

finalize set_collection_admin:
    input r0 as address.public;
    input r1 as field.public;
    input r2 as address.public;
    get collections[r1] into r3;
    assert.eq r0 r3.admin;
    cast r2 r3.name r3.symbol r3.metadata r3.public_token_id r3.is_bridged r3.origin_chain_id r3.origin_collection into r4 as collection_meta;
    set r4 into collections[r1];

function set_minter:
    input r0 as field.public;
    input r1 as address.public;
    input r2 as boolean.public;
    async set_minter self.caller r0 r1 r2 into r3;
    output r3 as mogate_arc721_multiprivate_v2.aleo/set_minter.future;

finalize set_minter:
    input r0 as address.public;
    input r1 as field.public;
    input r2 as address.public;
    input r3 as boolean.public;
    get collections[r1] into r4;
    assert.eq r0 r4.admin;
    cast r1 r2 into r5 as minter_key_data;
    hash.bhp256 r5 into r6 as field;
    set r3 into collection_minters[r6];

function mint_private:
    input r0 as field.public;
    input r1 as address.private;
    input r2 as data.public;
    input r3 as scalar.private;
    cast r1 r0 r2 r3 into r4 as PrivateNFT.record;
    cast r0 r2 into r5 as commit_input;
    hash.bhp256 r5 into r6 as field;
    commit.bhp256 r6 r3 into r7 as field;
    is.eq r3 1scalar into r8;
    async mint_private self.caller r0 r2 r7 r8 into r9;
    output r4 as PrivateNFT.record;
    output r9 as mogate_arc721_multiprivate_v2.aleo/mint_private.future;

finalize mint_private:
    input r0 as address.public;
    input r1 as field.public;
    input r2 as data.public;
    input r3 as field.public;
    input r4 as boolean.public;
    get collections[r1] into r5;
    not r5.public_token_id into r6;
    assert.eq r6 true;
    cast r1 r0 into r7 as minter_key_data;
    hash.bhp256 r7 into r8 as field;
    get.or_use collection_minters[r8] false into r9;
    is.eq r0 r5.admin into r10;
    or r10 r9 into r11;
    assert.eq r11 true;
    cast r1 0u8 into r12 as collection_key_data;
    hash.bhp256 r12 into r13 as field;
    get.or_use supply_caps[r13] 0u64 into r14;
    is.neq r14 0u64 into r15;
    branch.eq r15 false to end_then_0_0;
    cast r1 0u8 into r16 as collection_key_data;
    hash.bhp256 r16 into r17 as field;
    get.or_use minted_counts[r17] 0u64 into r18;
    lt r18 r14 into r19;
    assert.eq r19 true;
    branch.eq true true to end_otherwise_0_1;
    position end_then_0_0;
    position end_otherwise_0_1;
    branch.eq r4 false to end_then_0_2;
    cast r1 1u8 into r20 as collection_key_data;
    hash.bhp256 r20 into r21 as field;
    get.or_use supply_caps[r21] 0u64 into r22;
    is.neq r22 0u64 into r23;
    branch.eq r23 false to end_then_1_4;
    cast r1 1u8 into r24 as collection_key_data;
    hash.bhp256 r24 into r25 as field;
    get.or_use minted_counts[r25] 0u64 into r26;
    lt r26 r22 into r27;
    assert.eq r27 true;
    branch.eq true true to end_otherwise_1_5;
    position end_then_1_4;
    position end_otherwise_1_5;
    branch.eq true true to end_otherwise_0_3;
    position end_then_0_2;
    position end_otherwise_0_3;
    get.or_use nft_commits[r3] false into r28;
    not r28 into r29;
    assert.eq r29 true;
    set true into nft_commits[r3];
    cast r1 r2 into r30 as nft_content;
    set r30 into nft_contents[r3];
    cast r1 0u8 into r31 as collection_key_data;
    hash.bhp256 r31 into r32 as field;
    get.or_use minted_counts[r32] 0u64 into r33;
    cast r1 0u8 into r34 as collection_key_data;
    hash.bhp256 r34 into r35 as field;
    add r33 1u64 into r36;
    set r36 into minted_counts[r35];
    branch.eq r4 false to end_then_0_6;
    cast r1 1u8 into r37 as collection_key_data;
    hash.bhp256 r37 into r38 as field;
    get.or_use minted_counts[r38] 0u64 into r39;
    cast r1 1u8 into r40 as collection_key_data;
    hash.bhp256 r40 into r41 as field;
    add r39 1u64 into r42;
    set r42 into minted_counts[r41];
    branch.eq true true to end_otherwise_0_7;
    position end_then_0_6;
    position end_otherwise_0_7;

function mint_private_public_id:
    input r0 as field.public;
    input r1 as address.private;
    input r2 as data.public;
    input r3 as scalar.public;
    cast r1 r0 r2 r3 into r4 as PrivateNFT.record;
    cast r0 r2 into r5 as commit_input;
    hash.bhp256 r5 into r6 as field;
    commit.bhp256 r6 r3 into r7 as field;
    is.eq r3 1scalar into r8;
    async mint_private_public_id self.caller r0 r2 r7 r3 r8 into r9;
    output r4 as PrivateNFT.record;
    output r9 as mogate_arc721_multiprivate_v2.aleo/mint_private_public_id.future;

finalize mint_private_public_id:
    input r0 as address.public;
    input r1 as field.public;
    input r2 as data.public;
    input r3 as field.public;
    input r4 as scalar.public;
    input r5 as boolean.public;
    get collections[r1] into r6;
    assert.eq r6.public_token_id true;
    cast r1 r0 into r7 as minter_key_data;
    hash.bhp256 r7 into r8 as field;
    get.or_use collection_minters[r8] false into r9;
    is.eq r0 r6.admin into r10;
    or r10 r9 into r11;
    assert.eq r11 true;
    cast r1 0u8 into r12 as collection_key_data;
    hash.bhp256 r12 into r13 as field;
    get.or_use supply_caps[r13] 0u64 into r14;
    is.neq r14 0u64 into r15;
    branch.eq r15 false to end_then_0_8;
    cast r1 0u8 into r16 as collection_key_data;
    hash.bhp256 r16 into r17 as field;
    get.or_use minted_counts[r17] 0u64 into r18;
    lt r18 r14 into r19;
    assert.eq r19 true;
    branch.eq true true to end_otherwise_0_9;
    position end_then_0_8;
    position end_otherwise_0_9;
    branch.eq r5 false to end_then_0_10;
    cast r1 1u8 into r20 as collection_key_data;
    hash.bhp256 r20 into r21 as field;
    get.or_use supply_caps[r21] 0u64 into r22;
    is.neq r22 0u64 into r23;
    branch.eq r23 false to end_then_1_12;
    cast r1 1u8 into r24 as collection_key_data;
    hash.bhp256 r24 into r25 as field;
    get.or_use minted_counts[r25] 0u64 into r26;
    lt r26 r22 into r27;
    assert.eq r27 true;
    branch.eq true true to end_otherwise_1_13;
    position end_then_1_12;
    position end_otherwise_1_13;
    branch.eq true true to end_otherwise_0_11;
    position end_then_0_10;
    position end_otherwise_0_11;
    get.or_use nft_commits[r3] false into r28;
    not r28 into r29;
    assert.eq r29 true;
    cast r1 r4 into r30 as token_key_data;
    hash.bhp256 r30 into r31 as field;
    contains token_to_commit[r31] into r32;
    not r32 into r33;
    assert.eq r33 true;
    set true into nft_commits[r3];
    cast r1 r2 into r34 as nft_content;
    set r34 into nft_contents[r3];
    set r3 into token_to_commit[r31];
    set r4 into commit_to_token[r3];
    cast r1 0u8 into r35 as collection_key_data;
    hash.bhp256 r35 into r36 as field;
    get.or_use minted_counts[r36] 0u64 into r37;
    cast r1 0u8 into r38 as collection_key_data;
    hash.bhp256 r38 into r39 as field;
    add r37 1u64 into r40;
    set r40 into minted_counts[r39];
    branch.eq r5 false to end_then_0_14;
    cast r1 1u8 into r41 as collection_key_data;
    hash.bhp256 r41 into r42 as field;
    get.or_use minted_counts[r42] 0u64 into r43;
    cast r1 1u8 into r44 as collection_key_data;
    hash.bhp256 r44 into r45 as field;
    add r43 1u64 into r46;
    set r46 into minted_counts[r45];
    branch.eq true true to end_otherwise_0_15;
    position end_then_0_14;
    position end_otherwise_0_15;

function transfer_private:
    input r0 as PrivateNFT.record;
    input r1 as address.private;
    cast r1 r0.collection_id r0.data r0.token_id into r2 as PrivateNFT.record;
    output r2 as PrivateNFT.record;

function burn_private:
    input r0 as PrivateNFT.record;
    cast r0.collection_id r0.data into r1 as commit_input;
    hash.bhp256 r1 into r2 as field;
    commit.bhp256 r2 r0.token_id into r3 as field;
    async burn_private r3 into r4;
    output r4 as mogate_arc721_multiprivate_v2.aleo/burn_private.future;

finalize burn_private:
    input r0 as field.public;
    get.or_use nft_commits[r0] false into r1;
    assert.eq r1 true;
    contains nft_contents[r0] into r2;
    assert.eq r2 true;
    get nft_contents[r0] into r3;
    contains commit_to_token[r0] into r4;
    branch.eq r4 false to end_then_0_16;
    get commit_to_token[r0] into r5;
    cast r3.collection_id r5 into r6 as token_key_data;
    hash.bhp256 r6 into r7 as field;
    remove token_to_commit[r7];
    remove commit_to_token[r0];
    branch.eq true true to end_otherwise_0_17;
    position end_then_0_16;
    position end_otherwise_0_17;
    remove nft_contents[r0];
    remove nft_commits[r0];

function burn_private_with_receipt:
    input r0 as PrivateNFT.record;
    cast r0.collection_id r0.data into r1 as commit_input;
    hash.bhp256 r1 into r2 as field;
    commit.bhp256 r2 r0.token_id into r3 as field;
    cast self.caller r0.owner r0.collection_id r3 r0.data.metadata r0.token_id into r4 as BurnReceipt.record;
    async burn_private_with_receipt r4.nft_commit into r5;
    output r4 as BurnReceipt.record;
    output r5 as mogate_arc721_multiprivate_v2.aleo/burn_private_with_receipt.future;

finalize burn_private_with_receipt:
    input r0 as field.public;
    get.or_use nft_commits[r0] false into r1;
    assert.eq r1 true;
    contains nft_contents[r0] into r2;
    assert.eq r2 true;
    get nft_contents[r0] into r3;
    contains commit_to_token[r0] into r4;
    branch.eq r4 false to end_then_0_18;
    get commit_to_token[r0] into r5;
    cast r3.collection_id r5 into r6 as token_key_data;
    hash.bhp256 r6 into r7 as field;
    remove token_to_commit[r7];
    remove commit_to_token[r0];
    branch.eq true true to end_otherwise_0_19;
    position end_then_0_18;
    position end_otherwise_0_19;
    remove nft_contents[r0];
    remove nft_commits[r0];

function burn_private_with_receipt_to:
    input r0 as PrivateNFT.record;
    input r1 as address.public;
    cast r0.collection_id r0.data into r2 as commit_input;
    hash.bhp256 r2 into r3 as field;
    commit.bhp256 r3 r0.token_id into r4 as field;
    cast r1 r0.owner r0.collection_id r4 r0.data.metadata r0.token_id into r5 as BurnReceipt.record;
    async burn_private_with_receipt_to r5.nft_commit into r6;
    output r5 as BurnReceipt.record;
    output r6 as mogate_arc721_multiprivate_v2.aleo/burn_private_with_receipt_to.future;

finalize burn_private_with_receipt_to:
    input r0 as field.public;
    get.or_use nft_commits[r0] false into r1;
    assert.eq r1 true;
    contains nft_contents[r0] into r2;
    assert.eq r2 true;
    get nft_contents[r0] into r3;
    contains commit_to_token[r0] into r4;
    branch.eq r4 false to end_then_0_20;
    get commit_to_token[r0] into r5;
    cast r3.collection_id r5 into r6 as token_key_data;
    hash.bhp256 r6 into r7 as field;
    remove token_to_commit[r7];
    remove commit_to_token[r0];
    branch.eq true true to end_otherwise_0_21;
    position end_then_0_20;
    position end_otherwise_0_21;
    remove nft_contents[r0];
    remove nft_commits[r0];

constructor:
    assert.eq edition 0u16;
