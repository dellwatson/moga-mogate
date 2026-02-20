import mogate_arc721_private.aleo;

program mogate_authority_mint_v3.aleo;

struct attribute:
    trait_type as [field; 4u32];
    trait_value as [field; 4u32];

struct data:
    metadata as [field; 4u32];
    name as [field; 4u32];
    image as [field; 16u32];
    attributes as [attribute; 4u32];

function mint_private:
    input r0 as address.public;
    input r1 as data.private;
    input r2 as scalar.private;
    call mogate_arc721_private.aleo/mint_private r0 r1 r2 into r3 r4;
    async mint_private r4 into r5;
    output r3 as mogate_arc721_private.aleo/PrivateNFT.record;
    output r5 as mogate_authority_mint_v3.aleo/mint_private.future;

finalize mint_private:
    input r0 as mogate_arc721_private.aleo/mint_private.future;
    await r0;

function mint_private_with_signature:
    input r0 as address.public;
    input r1 as data.private;
    input r2 as scalar.private;
    input r3 as signature.public;
    call mogate_arc721_private.aleo/mint_private r0 r1 r2 into r4 r5;
    async mint_private_with_signature r5 into r6;
    output r4 as mogate_arc721_private.aleo/PrivateNFT.record;
    output r6 as mogate_authority_mint_v3.aleo/mint_private_with_signature.future;

finalize mint_private_with_signature:
    input r0 as mogate_arc721_private.aleo/mint_private.future;
    await r0;

constructor:
    assert.eq edition 0u16;
