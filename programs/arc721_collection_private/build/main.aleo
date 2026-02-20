program mogate_arc721_private.aleo;

struct attribute:
    trait_type as [field; 4u32];
    trait_value as [field; 4u32];

struct data:
    metadata as [field; 4u32];
    name as [field; 4u32];
    image as [field; 16u32];
    attributes as [attribute; 4u32];

record PrivateNFT:
    owner as address.private;
    data as data.private;
    edition as scalar.private;

record BurnReceipt:
    owner as address.private;
    nft_owner as address.private;
    nft_commit as field.private;

struct nft_content:
    data as data;
    edition as scalar;

mapping nft_commits:
    key as field.public;
    value as boolean.public;

mapping nft_contents:
    key as field.public;
    value as nft_content.public;

mapping general_settings:
    key as u8.public;
    value as field.public;

mapping collection_admin:
    key as u8.public;
    value as address.public;

mapping minters:
    key as address.public;
    value as boolean.public;

mapping supply_caps:
    key as u8.public;
    value as u64.public;

mapping minted_counts:
    key as u8.public;
    value as u64.public;

function compute_nft_commit:
    input r0 as data.public;
    input r1 as scalar.public;
    hash.bhp256 r0 into r2 as field;
    commit.bhp256 r2 r1 into r3 as field;
    output r3 as field.private;

function initialize:
    input r0 as address.public;
    input r1 as u64.public;
    input r2 as u64.public;
    input r3 as field.public;
    async initialize r0 r1 r2 r3 into r4;
    output r4 as mogate_arc721_private.aleo/initialize.future;

finalize initialize:
    input r0 as address.public;
    input r1 as u64.public;
    input r2 as u64.public;
    input r3 as field.public;
    contains collection_admin[0u8] into r4;
    not r4 into r5;
    assert.eq r5 true;
    set r0 into collection_admin[0u8];
    cast r1 into r6 as field;
    cast r2 into r7 as field;
    set r6 into general_settings[0u8];
    set r7 into general_settings[1u8];
    set r3 into general_settings[2u8];
    hash.bhp256 r0 into r8 as field;
    set r8 into general_settings[7u8];
    set r1 into supply_caps[0u8];
    set r2 into supply_caps[1u8];

function set_minter:
    input r0 as address.public;
    input r1 as boolean.public;
    async set_minter self.caller r0 r1 into r2;
    output r2 as mogate_arc721_private.aleo/set_minter.future;

finalize set_minter:
    input r0 as address.public;
    input r1 as address.public;
    input r2 as boolean.public;
    get collection_admin[0u8] into r3;
    assert.eq r0 r3;
    set r2 into minters[r1];

function mint_private:
    input r0 as address.public;
    input r1 as data.private;
    input r2 as scalar.private;
    cast r0 r1 r2 into r3 as PrivateNFT.record;
    async mint_private self.caller r0 r1 r2 into r4;
    output r3 as PrivateNFT.record;
    output r4 as mogate_arc721_private.aleo/mint_private.future;

finalize mint_private:
    input r0 as address.public;
    input r1 as address.public;
    input r2 as data.public;
    input r3 as scalar.public;
    get collection_admin[0u8] into r4;
    get.or_use minters[r0] false into r5;
    is.eq r0 r4 into r6;
    or r6 r5 into r7;
    assert.eq r7 true;
    get.or_use supply_caps[0u8] 0u64 into r8;
    is.neq r8 0u64 into r9;
    branch.eq r9 false to end_then_0_0;
    get.or_use minted_counts[0u8] 0u64 into r10;
    lt r10 r8 into r11;
    assert.eq r11 true;
    branch.eq true true to end_otherwise_0_1;
    position end_then_0_0;
    position end_otherwise_0_1;
    is.eq r3 1scalar into r12;
    branch.eq r12 false to end_then_0_2;
    get.or_use supply_caps[1u8] 0u64 into r13;
    is.neq r13 0u64 into r14;
    branch.eq r14 false to end_then_1_4;
    get.or_use minted_counts[1u8] 0u64 into r15;
    lt r15 r13 into r16;
    assert.eq r16 true;
    branch.eq true true to end_otherwise_1_5;
    position end_then_1_4;
    position end_otherwise_1_5;
    branch.eq true true to end_otherwise_0_3;
    position end_then_0_2;
    position end_otherwise_0_3;
    hash.bhp256 r2 into r17 as field;
    commit.bhp256 r17 r3 into r18 as field;
    get.or_use nft_commits[r18] false into r19;
    not r19 into r20;
    assert.eq r20 true;
    set true into nft_commits[r18];
    get.or_use minted_counts[0u8] 0u64 into r21;
    add r21 1u64 into r22;
    set r22 into minted_counts[0u8];
    branch.eq r12 false to end_then_0_6;
    get.or_use minted_counts[1u8] 0u64 into r23;
    add r23 1u64 into r24;
    set r24 into minted_counts[1u8];
    branch.eq true true to end_otherwise_0_7;
    position end_then_0_6;
    position end_otherwise_0_7;

function transfer_private:
    input r0 as PrivateNFT.record;
    input r1 as address.public;
    cast r1 r0.data r0.edition into r2 as PrivateNFT.record;
    async transfer_private self.caller r0.owner r0.data r0.edition into r3;
    output r2 as PrivateNFT.record;
    output r3 as mogate_arc721_private.aleo/transfer_private.future;

finalize transfer_private:
    input r0 as address.public;
    input r1 as address.public;
    input r2 as data.public;
    input r3 as scalar.public;
    assert.eq r0 r1;
    hash.bhp256 r2 into r4 as field;
    commit.bhp256 r4 r3 into r5 as field;
    get.or_use nft_commits[r5] false into r6;
    assert.eq r6 true;

function burn_private:
    input r0 as PrivateNFT.record;
    async burn_private self.caller r0.owner r0.data r0.edition into r1;
    output r1 as mogate_arc721_private.aleo/burn_private.future;

finalize burn_private:
    input r0 as address.public;
    input r1 as address.public;
    input r2 as data.public;
    input r3 as scalar.public;
    assert.eq r0 r1;
    hash.bhp256 r2 into r4 as field;
    commit.bhp256 r4 r3 into r5 as field;
    get.or_use nft_commits[r5] false into r6;
    assert.eq r6 true;
    remove nft_commits[r5];
    contains nft_contents[r5] into r7;
    branch.eq r7 false to end_then_0_8;
    remove nft_contents[r5];
    branch.eq true true to end_otherwise_0_9;
    position end_then_0_8;
    position end_otherwise_0_9;

function burn_private_with_receipt:
    input r0 as PrivateNFT.record;
    hash.bhp256 r0.data into r1 as field;
    commit.bhp256 r1 r0.edition into r2 as field;
    cast r0.owner r0.owner r2 into r3 as BurnReceipt.record;
    async burn_private_with_receipt self.caller r0.owner r0.data r0.edition into r4;
    output r3 as BurnReceipt.record;
    output r4 as mogate_arc721_private.aleo/burn_private_with_receipt.future;

finalize burn_private_with_receipt:
    input r0 as address.public;
    input r1 as address.public;
    input r2 as data.public;
    input r3 as scalar.public;
    assert.eq r0 r1;
    hash.bhp256 r2 into r4 as field;
    commit.bhp256 r4 r3 into r5 as field;
    get.or_use nft_commits[r5] false into r6;
    assert.eq r6 true;
    remove nft_commits[r5];
    contains nft_contents[r5] into r7;
    branch.eq r7 false to end_then_0_10;
    remove nft_contents[r5];
    branch.eq true true to end_otherwise_0_11;
    position end_then_0_10;
    position end_otherwise_0_11;

function burn_private_with_receipt_to:
    input r0 as PrivateNFT.record;
    input r1 as address.public;
    hash.bhp256 r0.data into r2 as field;
    commit.bhp256 r2 r0.edition into r3 as field;
    cast r1 r0.owner r3 into r4 as BurnReceipt.record;
    async burn_private_with_receipt_to self.caller r0.owner r0.data r0.edition into r5;
    output r4 as BurnReceipt.record;
    output r5 as mogate_arc721_private.aleo/burn_private_with_receipt_to.future;

finalize burn_private_with_receipt_to:
    input r0 as address.public;
    input r1 as address.public;
    input r2 as data.public;
    input r3 as scalar.public;
    assert.eq r0 r1;
    hash.bhp256 r2 into r4 as field;
    commit.bhp256 r4 r3 into r5 as field;
    get.or_use nft_commits[r5] false into r6;
    assert.eq r6 true;
    remove nft_commits[r5];
    contains nft_contents[r5] into r7;
    branch.eq r7 false to end_then_0_12;
    remove nft_contents[r5];
    branch.eq true true to end_otherwise_0_13;
    position end_then_0_12;
    position end_otherwise_0_13;

function publish_nft_content_owner:
    input r0 as PrivateNFT.record;
    async publish_nft_content_owner self.caller r0.owner r0.data r0.edition into r1;
    output r1 as mogate_arc721_private.aleo/publish_nft_content_owner.future;

finalize publish_nft_content_owner:
    input r0 as address.public;
    input r1 as address.public;
    input r2 as data.public;
    input r3 as scalar.public;
    assert.eq r0 r1;
    hash.bhp256 r2 into r4 as field;
    commit.bhp256 r4 r3 into r5 as field;
    get.or_use nft_commits[r5] false into r6;
    assert.eq r6 true;
    cast r2 r3 into r7 as nft_content;
    set r7 into nft_contents[r5];

function publish_nft_content_admin:
    input r0 as data.public;
    input r1 as scalar.public;
    async publish_nft_content_admin self.caller r0 r1 into r2;
    output r2 as mogate_arc721_private.aleo/publish_nft_content_admin.future;

finalize publish_nft_content_admin:
    input r0 as address.public;
    input r1 as data.public;
    input r2 as scalar.public;
    get collection_admin[0u8] into r3;
    assert.eq r0 r3;
    hash.bhp256 r1 into r4 as field;
    commit.bhp256 r4 r2 into r5 as field;
    get.or_use nft_commits[r5] false into r6;
    assert.eq r6 true;
    cast r1 r2 into r7 as nft_content;
    set r7 into nft_contents[r5];

function get_nft_content:
    input r0 as field.public;
    async get_nft_content r0 into r1;
    output r1 as mogate_arc721_private.aleo/get_nft_content.future;

finalize get_nft_content:
    input r0 as field.public;
    get nft_contents[r0] into r1;
    gte r1.edition 0scalar into r2;
    assert.eq r2 true;

constructor:
    assert.eq edition 0u16;
