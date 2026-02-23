import mogate_arc721_private.aleo;
import credits.aleo;
program mogate_mkt_escrow_private.aleo;

struct listing:
    seller as address;
    nft_commit as field;
    price as u64;
    custodian as address;
    buyer as address;
    paid as boolean;
    active as boolean;

struct attribute:
    trait_type as [field; 4u32];
    trait_value as [field; 4u32];

struct data:
    metadata as [field; 4u32];
    name as [field; 4u32];
    image as [field; 16u32];
    attributes as [attribute; 4u32];

mapping listings:
    key as u64.public;
    value as listing.public;

function create_escrow_listing:
    input r0 as u64.public;
    input r1 as mogate_arc721_private.aleo/PrivateNFT.record;
    input r2 as u64.public;
    input r3 as address.public;
    hash.bhp256 r1.data into r4 as field;
    commit.bhp256 r4 r1.edition into r5 as field;
    call mogate_arc721_private.aleo/transfer_private r1 r3 into r6 r7;
    async create_escrow_listing self.caller r0 r5 r2 r3 r7 into r8;
    output r8 as mogate_mkt_escrow_private.aleo/create_escrow_listing.future;

finalize create_escrow_listing:
    input r0 as address.public;
    input r1 as u64.public;
    input r2 as field.public;
    input r3 as u64.public;
    input r4 as address.public;
    input r5 as mogate_arc721_private.aleo/transfer_private.future;
    contains listings[r1] into r6;
    not r6 into r7;
    assert.eq r7 true;
    gt r3 0u64 into r8;
    assert.eq r8 true;
    is.eq r0 r4 into r9;
    not r9 into r10;
    assert.eq r10 true;
    await r5;
    cast r0 r2 r3 r4 r0 false true into r11 as listing;
    set r11 into listings[r1];

function update_escrow_price:
    input r0 as u64.public;
    input r1 as u64.public;
    async update_escrow_price self.caller r0 r1 into r2;
    output r2 as mogate_mkt_escrow_private.aleo/update_escrow_price.future;

finalize update_escrow_price:
    input r0 as address.public;
    input r1 as u64.public;
    input r2 as u64.public;
    gt r2 0u64 into r3;
    assert.eq r3 true;
    get listings[r1] into r4;
    assert.eq r4.active true;
    not r4.paid into r5;
    assert.eq r5 true;
    assert.eq r0 r4.seller;
    cast r4.seller r4.nft_commit r2 r4.custodian r4.buyer false true into r6 as listing;
    set r6 into listings[r1];

function pay_escrow_listing:
    input r0 as u64.public;
    input r1 as address.public;
    input r2 as u64.public;
    input r3 as credits.aleo/credits.record;
    call credits.aleo/transfer_private_to_public r3 r1 r2 into r4 r5;
    async pay_escrow_listing self.caller r0 r1 r2 r5 into r6;
    output r4 as credits.aleo/credits.record;
    output r6 as mogate_mkt_escrow_private.aleo/pay_escrow_listing.future;

finalize pay_escrow_listing:
    input r0 as address.public;
    input r1 as u64.public;
    input r2 as address.public;
    input r3 as u64.public;
    input r4 as credits.aleo/transfer_private_to_public.future;
    get listings[r1] into r5;
    assert.eq r5.active true;
    not r5.paid into r6;
    assert.eq r6 true;
    assert.eq r2 r5.seller;
    assert.eq r3 r5.price;
    is.eq r0 r5.seller into r7;
    not r7 into r8;
    assert.eq r8 true;
    await r4;
    cast r5.seller r5.nft_commit r5.price r5.custodian r0 true true into r9 as listing;
    set r9 into listings[r1];

function release_escrow_to_buyer:
    input r0 as u64.public;
    input r1 as mogate_arc721_private.aleo/PrivateNFT.record;
    input r2 as address.public;
    hash.bhp256 r1.data into r3 as field;
    commit.bhp256 r3 r1.edition into r4 as field;
    call mogate_arc721_private.aleo/transfer_private r1 r2 into r5 r6;
    async release_escrow_to_buyer self.caller r0 r4 r2 r6 into r7;
    output r7 as mogate_mkt_escrow_private.aleo/release_escrow_to_buyer.future;

finalize release_escrow_to_buyer:
    input r0 as address.public;
    input r1 as u64.public;
    input r2 as field.public;
    input r3 as address.public;
    input r4 as mogate_arc721_private.aleo/transfer_private.future;
    get listings[r1] into r5;
    assert.eq r5.active true;
    assert.eq r5.paid true;
    assert.eq r0 r5.custodian;
    assert.eq r2 r5.nft_commit;
    assert.eq r3 r5.buyer;
    await r4;
    cast r5.seller r5.nft_commit r5.price r5.custodian r5.buyer true false into r6 as listing;
    set r6 into listings[r1];

function cancel_escrow_listing:
    input r0 as u64.public;
    input r1 as mogate_arc721_private.aleo/PrivateNFT.record;
    input r2 as address.public;
    hash.bhp256 r1.data into r3 as field;
    commit.bhp256 r3 r1.edition into r4 as field;
    call mogate_arc721_private.aleo/transfer_private r1 r2 into r5 r6;
    async cancel_escrow_listing self.caller r0 r4 r2 r6 into r7;
    output r7 as mogate_mkt_escrow_private.aleo/cancel_escrow_listing.future;

finalize cancel_escrow_listing:
    input r0 as address.public;
    input r1 as u64.public;
    input r2 as field.public;
    input r3 as address.public;
    input r4 as mogate_arc721_private.aleo/transfer_private.future;
    get listings[r1] into r5;
    assert.eq r5.active true;
    not r5.paid into r6;
    assert.eq r6 true;
    assert.eq r0 r5.custodian;
    assert.eq r2 r5.nft_commit;
    assert.eq r3 r5.seller;
    await r4;
    cast r5.seller r5.nft_commit r5.price r5.custodian r5.buyer false false into r7 as listing;
    set r7 into listings[r1];

constructor:
    assert.eq edition 0u16;
