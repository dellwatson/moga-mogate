import mogate_nft_collection_rwa.aleo;

program mogate_authority_mint_v2.aleo;

function mint:
    input r0 as address.public;
    input r1 as field.public;
    input r2 as u64.public;
    call mogate_nft_collection_rwa.aleo/mint_with_token_id r0 r2 r1 into r3 r4;
    async mint r4 into r5;
    output r5 as mogate_authority_mint_v2.aleo/mint.future;

finalize mint:
    input r0 as mogate_nft_collection_rwa.aleo/mint_with_token_id.future;
    await r0;

function mint_nft:
    input r0 as address.public;
    input r1 as field.public;
    call mogate_nft_collection_rwa.aleo/mint_to r0 r1 into r2 r3;
    async mint_nft r3 into r4;
    output r4 as mogate_authority_mint_v2.aleo/mint_nft.future;

finalize mint_nft:
    input r0 as mogate_nft_collection_rwa.aleo/mint_to.future;
    await r0;

function mint_with_signature:
    input r0 as address.public;
    input r1 as field.public;
    input r2 as u64.public;
    input r3 as signature.public;
    call mogate_nft_collection_rwa.aleo/mint_with_token_id r0 r2 r1 into r4 r5;
    async mint_with_signature r5 into r6;
    output r6 as mogate_authority_mint_v2.aleo/mint_with_signature.future;

finalize mint_with_signature:
    input r0 as mogate_nft_collection_rwa.aleo/mint_with_token_id.future;
    await r0;

constructor:
    assert.eq edition 0u16;
