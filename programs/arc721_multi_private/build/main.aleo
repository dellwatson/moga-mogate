program mogate_arc721_multiprivate.aleo;

struct data:
    metadata as [field; 4u32];

record PrivateNFT:
    owner as address.private;
    collection_id as field.private;
    data as data.private;
    edition as scalar.private;

record BurnReceipt:
    owner as address.private;
    nft_owner as address.private;
    collection_id as field.private;
    nft_commit as field.private;
    metadata as [field; 4u32].private;
    edition as scalar.private;

struct collection_meta:
    admin as address;
    name as [field; 4u32];
    symbol as [field; 4u32];
    metadata as [field; 4u32];
    is_bridged as boolean;
    origin_chain_id as u32;
    origin_collection as [field; 4u32];

struct nft_content:
    collection_id as field;
    data as data;
    edition as scalar;

struct commit_input:
    collection_id as field;
    data as data;

struct minter_key_data:
    collection_id as field;
    minter as address;

struct collection_key_data:
    collection_id as field;
    index as u8;

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
    output r1 as mogate_arc721_multiprivate.aleo/initialize.future;

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
    input r6 as u32.public;
    input r7 as [field; 4u32].public;
    input r8 as u64.public;
    input r9 as u64.public;
    async create_collection self.caller r0 r1 r2 r3 r4 r5 r6 r7 r8 r9 into r10;
    output r10 as mogate_arc721_multiprivate.aleo/create_collection.future;

finalize create_collection:
    input r0 as address.public;
    input r1 as field.public;
    input r2 as address.public;
    input r3 as [field; 4u32].public;
    input r4 as [field; 4u32].public;
    input r5 as [field; 4u32].public;
    input r6 as boolean.public;
    input r7 as u32.public;
    input r8 as [field; 4u32].public;
    input r9 as u64.public;
    input r10 as u64.public;
    get program_admin[0u8] into r11;
    assert.eq r0 r11;
    contains collections[r1] into r12;
    not r12 into r13;
    assert.eq r13 true;
    cast r2 r3 r4 r5 r6 r7 r8 into r14 as collection_meta;
    set r14 into collections[r1];
    cast r1 0u8 into r15 as collection_key_data;
    hash.bhp256 r15 into r16 as field;
    set r9 into supply_caps[r16];
    cast r1 1u8 into r17 as collection_key_data;
    hash.bhp256 r17 into r18 as field;
    set r10 into supply_caps[r18];

function set_collection_admin:
    input r0 as field.public;
    input r1 as address.public;
    async set_collection_admin self.caller r0 r1 into r2;
    output r2 as mogate_arc721_multiprivate.aleo/set_collection_admin.future;

finalize set_collection_admin:
    input r0 as address.public;
    input r1 as field.public;
    input r2 as address.public;
    get collections[r1] into r3;
    assert.eq r0 r3.admin;
    cast r2 r3.name r3.symbol r3.metadata r3.is_bridged r3.origin_chain_id r3.origin_collection into r4 as collection_meta;
    set r4 into collections[r1];

function set_minter:
    input r0 as field.public;
    input r1 as address.public;
    input r2 as boolean.public;
    async set_minter self.caller r0 r1 r2 into r3;
    output r3 as mogate_arc721_multiprivate.aleo/set_minter.future;

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
    input r1 as address.public;
    input r2 as data.private;
    input r3 as scalar.private;
    cast r1 r0 r2 r3 into r4 as PrivateNFT.record;
    async mint_private self.caller r0 r1 r2 r3 into r5;
    output r4 as PrivateNFT.record;
    output r5 as mogate_arc721_multiprivate.aleo/mint_private.future;

finalize mint_private:
    input r0 as address.public;
    input r1 as field.public;
    input r2 as address.public;
    input r3 as data.public;
    input r4 as scalar.public;
    get collections[r1] into r5;
    cast r1 r0 into r6 as minter_key_data;
    hash.bhp256 r6 into r7 as field;
    get.or_use collection_minters[r7] false into r8;
    is.eq r0 r5.admin into r9;
    or r9 r8 into r10;
    assert.eq r10 true;
    cast r1 0u8 into r11 as collection_key_data;
    hash.bhp256 r11 into r12 as field;
    get.or_use supply_caps[r12] 0u64 into r13;
    is.neq r13 0u64 into r14;
    branch.eq r14 false to end_then_0_0;
    cast r1 0u8 into r15 as collection_key_data;
    hash.bhp256 r15 into r16 as field;
    get.or_use minted_counts[r16] 0u64 into r17;
    lt r17 r13 into r18;
    assert.eq r18 true;
    branch.eq true true to end_otherwise_0_1;
    position end_then_0_0;
    position end_otherwise_0_1;
    is.eq r4 1scalar into r19;
    branch.eq r19 false to end_then_0_2;
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
    cast r1 r3 into r28 as commit_input;
    hash.bhp256 r28 into r29 as field;
    commit.bhp256 r29 r4 into r30 as field;
    get.or_use nft_commits[r30] false into r31;
    not r31 into r32;
    assert.eq r32 true;
    set true into nft_commits[r30];
    cast r1 0u8 into r33 as collection_key_data;
    hash.bhp256 r33 into r34 as field;
    get.or_use minted_counts[r34] 0u64 into r35;
    cast r1 0u8 into r36 as collection_key_data;
    hash.bhp256 r36 into r37 as field;
    add r35 1u64 into r38;
    set r38 into minted_counts[r37];
    branch.eq r19 false to end_then_0_6;
    cast r1 1u8 into r39 as collection_key_data;
    hash.bhp256 r39 into r40 as field;
    get.or_use minted_counts[r40] 0u64 into r41;
    cast r1 1u8 into r42 as collection_key_data;
    hash.bhp256 r42 into r43 as field;
    add r41 1u64 into r44;
    set r44 into minted_counts[r43];
    branch.eq true true to end_otherwise_0_7;
    position end_then_0_6;
    position end_otherwise_0_7;

function transfer_private:
    input r0 as PrivateNFT.record;
    input r1 as address.public;
    cast r1 r0.collection_id r0.data r0.edition into r2 as PrivateNFT.record;
    async transfer_private self.caller r0.owner r0.collection_id r0.data r0.edition into r3;
    output r2 as PrivateNFT.record;
    output r3 as mogate_arc721_multiprivate.aleo/transfer_private.future;

finalize transfer_private:
    input r0 as address.public;
    input r1 as address.public;
    input r2 as field.public;
    input r3 as data.public;
    input r4 as scalar.public;
    assert.eq r0 r1;
    cast r2 r3 into r5 as commit_input;
    hash.bhp256 r5 into r6 as field;
    commit.bhp256 r6 r4 into r7 as field;
    get.or_use nft_commits[r7] false into r8;
    assert.eq r8 true;

function burn_private:
    input r0 as PrivateNFT.record;
    async burn_private self.caller r0.owner r0.collection_id r0.data r0.edition into r1;
    output r1 as mogate_arc721_multiprivate.aleo/burn_private.future;

finalize burn_private:
    input r0 as address.public;
    input r1 as address.public;
    input r2 as field.public;
    input r3 as data.public;
    input r4 as scalar.public;
    assert.eq r0 r1;
    cast r2 r3 into r5 as commit_input;
    hash.bhp256 r5 into r6 as field;
    commit.bhp256 r6 r4 into r7 as field;
    get.or_use nft_commits[r7] false into r8;
    assert.eq r8 true;
    remove nft_commits[r7];
    contains nft_contents[r7] into r9;
    branch.eq r9 false to end_then_0_8;
    remove nft_contents[r7];
    branch.eq true true to end_otherwise_0_9;
    position end_then_0_8;
    position end_otherwise_0_9;

function burn_private_with_receipt:
    input r0 as PrivateNFT.record;
    cast r0.collection_id r0.data into r1 as commit_input;
    hash.bhp256 r1 into r2 as field;
    commit.bhp256 r2 r0.edition into r3 as field;
    cast self.caller r0.owner r0.collection_id r3 r0.data.metadata r0.edition into r4 as BurnReceipt.record;
    async burn_private_with_receipt self.caller r0.owner r0.collection_id r0.data r0.edition into r5;
    output r4 as BurnReceipt.record;
    output r5 as mogate_arc721_multiprivate.aleo/burn_private_with_receipt.future;

finalize burn_private_with_receipt:
    input r0 as address.public;
    input r1 as address.public;
    input r2 as field.public;
    input r3 as data.public;
    input r4 as scalar.public;
    assert.eq r0 r1;
    cast r2 r3 into r5 as commit_input;
    hash.bhp256 r5 into r6 as field;
    commit.bhp256 r6 r4 into r7 as field;
    get.or_use nft_commits[r7] false into r8;
    assert.eq r8 true;
    remove nft_commits[r7];
    contains nft_contents[r7] into r9;
    branch.eq r9 false to end_then_0_10;
    remove nft_contents[r7];
    branch.eq true true to end_otherwise_0_11;
    position end_then_0_10;
    position end_otherwise_0_11;

function burn_private_with_receipt_to:
    input r0 as PrivateNFT.record;
    input r1 as address.public;
    cast r0.collection_id r0.data into r2 as commit_input;
    hash.bhp256 r2 into r3 as field;
    commit.bhp256 r3 r0.edition into r4 as field;
    cast r1 r0.owner r0.collection_id r4 r0.data.metadata r0.edition into r5 as BurnReceipt.record;
    async burn_private_with_receipt_to self.caller r0.owner r0.collection_id r0.data r0.edition into r6;
    output r5 as BurnReceipt.record;
    output r6 as mogate_arc721_multiprivate.aleo/burn_private_with_receipt_to.future;

finalize burn_private_with_receipt_to:
    input r0 as address.public;
    input r1 as address.public;
    input r2 as field.public;
    input r3 as data.public;
    input r4 as scalar.public;
    assert.eq r0 r1;
    cast r2 r3 into r5 as commit_input;
    hash.bhp256 r5 into r6 as field;
    commit.bhp256 r6 r4 into r7 as field;
    get.or_use nft_commits[r7] false into r8;
    assert.eq r8 true;
    remove nft_commits[r7];
    contains nft_contents[r7] into r9;
    branch.eq r9 false to end_then_0_12;
    remove nft_contents[r7];
    branch.eq true true to end_otherwise_0_13;
    position end_then_0_12;
    position end_otherwise_0_13;

function publish_nft_content_owner:
    input r0 as PrivateNFT.record;
    async publish_nft_content_owner self.caller r0.owner r0.collection_id r0.data r0.edition into r1;
    output r1 as mogate_arc721_multiprivate.aleo/publish_nft_content_owner.future;

finalize publish_nft_content_owner:
    input r0 as address.public;
    input r1 as address.public;
    input r2 as field.public;
    input r3 as data.public;
    input r4 as scalar.public;
    assert.eq r0 r1;
    cast r2 r3 into r5 as commit_input;
    hash.bhp256 r5 into r6 as field;
    commit.bhp256 r6 r4 into r7 as field;
    get.or_use nft_commits[r7] false into r8;
    assert.eq r8 true;
    cast r2 r3 r4 into r9 as nft_content;
    set r9 into nft_contents[r7];

function publish_nft_content_admin:
    input r0 as field.public;
    input r1 as data.public;
    input r2 as scalar.public;
    async publish_nft_content_admin self.caller r0 r1 r2 into r3;
    output r3 as mogate_arc721_multiprivate.aleo/publish_nft_content_admin.future;

finalize publish_nft_content_admin:
    input r0 as address.public;
    input r1 as field.public;
    input r2 as data.public;
    input r3 as scalar.public;
    get collections[r1] into r4;
    assert.eq r0 r4.admin;
    cast r1 r2 into r5 as commit_input;
    hash.bhp256 r5 into r6 as field;
    commit.bhp256 r6 r3 into r7 as field;
    get.or_use nft_commits[r7] false into r8;
    assert.eq r8 true;
    cast r1 r2 r3 into r9 as nft_content;
    set r9 into nft_contents[r7];

constructor:
    assert.eq edition 0u16;
