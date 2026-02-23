import mogate_arc721_private.aleo;
program mogate_auth_mint_permit.aleo;

struct mint_permit_data:
    recipient as address;
    nft_commit as field;
    nonce as u64;

struct attribute:
    trait_type as [field; 4u32];
    trait_value as [field; 4u32];

struct data:
    metadata as [field; 4u32];
    name as [field; 4u32];
    image as [field; 16u32];
    attributes as [attribute; 4u32];

mapping gateway_admin:
    key as u8.public;
    value as address.public;

mapping permit_signer:
    key as u8.public;
    value as address.public;

mapping permit_used:
    key as field.public;
    value as boolean.public;

function compute_nft_commit:
    input r0 as data.public;
    input r1 as scalar.public;
    hash.bhp256 r0 into r2 as field;
    commit.bhp256 r2 r1 into r3 as field;
    output r3 as field.private;

function compute_permit_key:
    input r0 as address.public;
    input r1 as field.public;
    input r2 as u64.public;
    cast r0 r1 r2 into r3 as mint_permit_data;
    hash.bhp256 r3 into r4 as field;
    output r4 as field.private;

function initialize:
    input r0 as address.public;
    input r1 as address.public;
    async initialize r0 r1 into r2;
    output r2 as mogate_auth_mint_permit.aleo/initialize.future;

finalize initialize:
    input r0 as address.public;
    input r1 as address.public;
    contains gateway_admin[0u8] into r2;
    not r2 into r3;
    assert.eq r3 true;
    set r0 into gateway_admin[0u8];
    set r1 into permit_signer[0u8];

function set_permit_signer:
    input r0 as address.public;
    async set_permit_signer self.caller r0 into r1;
    output r1 as mogate_auth_mint_permit.aleo/set_permit_signer.future;

finalize set_permit_signer:
    input r0 as address.public;
    input r1 as address.public;
    get gateway_admin[0u8] into r2;
    assert.eq r0 r2;
    set r1 into permit_signer[0u8];

function mint_private_admin:
    input r0 as address.public;
    input r1 as data.private;
    input r2 as scalar.private;
    call mogate_arc721_private.aleo/mint_private r0 r1 r2 into r3 r4;
    async mint_private_admin self.caller r4 into r5;
    output r3 as mogate_arc721_private.aleo/PrivateNFT.record;
    output r5 as mogate_auth_mint_permit.aleo/mint_private_admin.future;

finalize mint_private_admin:
    input r0 as address.public;
    input r1 as mogate_arc721_private.aleo/mint_private.future;
    get gateway_admin[0u8] into r2;
    assert.eq r0 r2;
    await r1;

function mint_private_with_permit:
    input r0 as address.public;
    input r1 as data.private;
    input r2 as scalar.private;
    input r3 as u64.public;
    input r4 as address.public;
    input r5 as signature.public;
    hash.bhp256 r1 into r6 as field;
    commit.bhp256 r6 r2 into r7 as field;
    cast r0 r7 r3 into r8 as mint_permit_data;
    sign.verify r5 r4 r8 into r9;
    assert.eq r9 true;
    hash.bhp256 r8 into r10 as field;
    call mogate_arc721_private.aleo/mint_private r0 r1 r2 into r11 r12;
    async mint_private_with_permit self.caller r0 r10 r4 r12 into r13;
    output r11 as mogate_arc721_private.aleo/PrivateNFT.record;
    output r13 as mogate_auth_mint_permit.aleo/mint_private_with_permit.future;

finalize mint_private_with_permit:
    input r0 as address.public;
    input r1 as address.public;
    input r2 as field.public;
    input r3 as address.public;
    input r4 as mogate_arc721_private.aleo/mint_private.future;
    assert.eq r0 r1;
    get gateway_admin[0u8] into r5;
    get.or_use permit_signer[0u8] r5 into r6;
    assert.eq r3 r6;
    get.or_use permit_used[r2] false into r7;
    not r7 into r8;
    assert.eq r8 true;
    set true into permit_used[r2];
    await r4;

constructor:
    assert.eq edition 0u16;
