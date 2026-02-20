program mogate_nft_collection_rwa.aleo;

record NFT:
    owner as address.private;
    token_id as u64.private;
    uri as field.private;
    collection as address.private;

mapping operators:
    key as address.public;
    value as boolean.public;

mapping minters:
    key as address.public;
    value as boolean.public;

mapping token_owners:
    key as u64.public;
    value as address.public;

mapping token_uris:
    key as u64.public;
    value as field.public;

mapping next_token_id:
    key as u8.public;
    value as u64.public;

mapping collection_owner:
    key as u8.public;
    value as address.public;

function initialize:
    input r0 as address.public;
    async initialize r0 into r1;
    output r1 as mogate_nft_collection_rwa.aleo/initialize.future;

finalize initialize:
    input r0 as address.public;
    set r0 into collection_owner[0u8];
    set 0u64 into next_token_id[0u8];

function set_operator:
    input r0 as address.public;
    input r1 as boolean.public;
    async set_operator self.caller r0 r1 into r2;
    output r2 as mogate_nft_collection_rwa.aleo/set_operator.future;

finalize set_operator:
    input r0 as address.public;
    input r1 as address.public;
    input r2 as boolean.public;
    get collection_owner[0u8] into r3;
    assert.eq r0 r3;
    set r2 into operators[r1];

function set_minter:
    input r0 as address.public;
    input r1 as boolean.public;
    async set_minter self.caller r0 r1 into r2;
    output r2 as mogate_nft_collection_rwa.aleo/set_minter.future;

finalize set_minter:
    input r0 as address.public;
    input r1 as address.public;
    input r2 as boolean.public;
    get collection_owner[0u8] into r3;
    get.or_use operators[r0] false into r4;
    is.eq r0 r3 into r5;
    or r5 r4 into r6;
    assert.eq r6 true;
    set r2 into minters[r1];

function mint_to:
    input r0 as address.public;
    input r1 as field.public;
    cast r0 0u64 r1 mogate_nft_collection_rwa.aleo into r2 as NFT.record;
    async mint_to self.caller r0 r1 into r3;
    output r2 as NFT.record;
    output r3 as mogate_nft_collection_rwa.aleo/mint_to.future;

finalize mint_to:
    input r0 as address.public;
    input r1 as address.public;
    input r2 as field.public;
    get.or_use minters[r0] false into r3;
    assert.eq r3 true;
    get.or_use next_token_id[0u8] 0u64 into r4;
    add r4 1u64 into r5;
    set r5 into next_token_id[0u8];
    set r1 into token_owners[r5];
    set r2 into token_uris[r5];

function mint_with_token_id:
    input r0 as address.public;
    input r1 as u64.public;
    input r2 as field.public;
    cast r0 r1 r2 mogate_nft_collection_rwa.aleo into r3 as NFT.record;
    async mint_with_token_id self.caller r0 r1 r2 into r4;
    output r3 as NFT.record;
    output r4 as mogate_nft_collection_rwa.aleo/mint_with_token_id.future;

finalize mint_with_token_id:
    input r0 as address.public;
    input r1 as address.public;
    input r2 as u64.public;
    input r3 as field.public;
    get.or_use minters[r0] false into r4;
    assert.eq r4 true;
    contains token_owners[r2] into r5;
    not r5 into r6;
    assert.eq r6 true;
    set r1 into token_owners[r2];
    set r3 into token_uris[r2];

function transfer:
    input r0 as NFT.record;
    input r1 as address.public;
    cast r1 r0.token_id r0.uri r0.collection into r2 as NFT.record;
    async transfer r0.token_id r1 into r3;
    output r2 as NFT.record;
    output r3 as mogate_nft_collection_rwa.aleo/transfer.future;

finalize transfer:
    input r0 as u64.public;
    input r1 as address.public;
    set r1 into token_owners[r0];

function burn:
    input r0 as NFT.record;
    async burn r0.token_id into r1;
    output r1 as mogate_nft_collection_rwa.aleo/burn.future;

finalize burn:
    input r0 as u64.public;
    remove token_owners[r0];
    remove token_uris[r0];

function get_token_owner:
    input r0 as u64.public;
    async get_token_owner r0 into r1;
    output r1 as mogate_nft_collection_rwa.aleo/get_token_owner.future;

finalize get_token_owner:
    input r0 as u64.public;
    get token_owners[r0] into r1;

function get_token_uri:
    input r0 as u64.public;
    async get_token_uri r0 into r1;
    output r1 as mogate_nft_collection_rwa.aleo/get_token_uri.future;

finalize get_token_uri:
    input r0 as u64.public;
    get token_uris[r0] into r1;

constructor:
    assert.eq edition 0u16;
