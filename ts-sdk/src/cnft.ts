import { type Address, getAddressEncoder } from "@solana/addresses";
import { getProgramDerivedAddress } from "@solana/addresses";

// Bubblegum + Token Metadata PDA helpers (tree-shake friendly)
// - We do NOT hardcode program IDs; pass them from the caller
// - Uses the modular Solana v2 libs so this works both in bun and browser

export type BubblegumPrograms = {
  bubblegumProgram: Address; // mpl_bubblegum program id
  compressionProgram: Address; // spl_account_compression program id
  noopProgram: Address; // spl_noop program id
  tokenMetadataProgram: Address; // metaplex token metadata program id
};

const enc = getAddressEncoder();

// ----------------------------------------------------------------------------
// Token Metadata PDAs
// ----------------------------------------------------------------------------
export async function deriveMetadataPda(
  tokenMetadataProgram: Address,
  mint: Address
) {
  const seeds = [
    new TextEncoder().encode("metadata"),
    enc.encode(tokenMetadataProgram),
    enc.encode(mint),
  ];
  return await getProgramDerivedAddress({
    programAddress: tokenMetadataProgram,
    seeds,
  });
}

export async function deriveMasterEditionPda(
  tokenMetadataProgram: Address,
  mint: Address
) {
  const seeds = [
    new TextEncoder().encode("metadata"),
    enc.encode(tokenMetadataProgram),
    enc.encode(mint),
    new TextEncoder().encode("edition"),
  ];
  return await getProgramDerivedAddress({
    programAddress: tokenMetadataProgram,
    seeds,
  });
}

export async function deriveCollectionAuthorityRecordPda(
  tokenMetadataProgram: Address,
  collectionMint: Address,
  collectionAuthority: Address
) {
  const seeds = [
    new TextEncoder().encode("metadata"),
    enc.encode(tokenMetadataProgram),
    enc.encode(collectionMint),
    new TextEncoder().encode("collection_authority"),
    enc.encode(collectionAuthority),
  ];
  return await getProgramDerivedAddress({
    programAddress: tokenMetadataProgram,
    seeds,
  });
}

// ----------------------------------------------------------------------------
// Bubblegum PDAs
// ----------------------------------------------------------------------------
// TreeConfig PDA: PDA owned by Bubblegum derived from the merkle tree address
export async function deriveTreeConfigPda(
  bubblegumProgram: Address,
  merkleTree: Address
) {
  const seeds = [enc.encode(merkleTree)];
  return await getProgramDerivedAddress({
    programAddress: bubblegumProgram,
    seeds,
  });
}

// Your program-specific collection authority PDA used to verify collections
export async function deriveProgramCollectionAuthorityPda(
  programId: Address,
  collectionMint: Address
) {
  const seeds = [
    new TextEncoder().encode("collection_authority"),
    enc.encode(collectionMint),
  ];
  return await getProgramDerivedAddress({ programAddress: programId, seeds });
}

export type MintToCollectionAccounts = {
  // bubblegum
  bubblegumProgram: Address;
  compressionProgram: Address;
  noopProgram: Address;
  treeConfig: Address;
  merkleTree: Address;
  bubblegumSigner: Address; // pass canonical signer as required by Bubblegum
  // collection
  collectionMint: Address;
  collectionMetadata: Address;
  collectionMasterEdition: Address;
  collectionAuthority: Address; // program PDA you delegated to
  collectionAuthorityRecord?: Address | null; // optional legacy CAR PDA
  // recipients
  leafOwner: Address;
  leafDelegate: Address;
  // metas
  tokenMetadataProgram: Address;
  systemProgram: Address;
  sysvarInstructions: Address;
};

export async function composeMintToCollectionAccounts(params: {
  programs: BubblegumPrograms;
  programId: Address; // your authority_mint program id (for collection authority PDA)
  merkleTree: Address;
  collectionMint: Address;
  collectionAuthorityRecord?: Address | null;
  bubblegumSigner: Address; // caller must supply canonical signer address
  leafOwner: Address;
  leafDelegate?: Address | null;
  systemProgram: Address;
  sysvarInstructions: Address;
}) {
  const {
    programs,
    programId,
    merkleTree,
    collectionMint,
    collectionAuthorityRecord,
    bubblegumSigner,
    leafOwner,
    leafDelegate,
    systemProgram,
    sysvarInstructions,
  } = params;

  const [treeConfig] = await deriveTreeConfigPda(
    programs.bubblegumProgram,
    merkleTree
  );
  const [collectionMetadata] = await deriveMetadataPda(
    programs.tokenMetadataProgram,
    collectionMint
  );
  const [collectionMasterEdition] = await deriveMasterEditionPda(
    programs.tokenMetadataProgram,
    collectionMint
  );
  const [collectionAuthority] = await deriveProgramCollectionAuthorityPda(
    programId,
    collectionMint
  );

  return {
    bubblegumProgram: programs.bubblegumProgram,
    compressionProgram: programs.compressionProgram,
    noopProgram: programs.noopProgram,
    treeConfig,
    merkleTree,
    bubblegumSigner,
    collectionMint,
    collectionMetadata,
    collectionMasterEdition,
    collectionAuthority,
    collectionAuthorityRecord: collectionAuthorityRecord ?? null,
    leafOwner,
    leafDelegate: leafDelegate ?? leafOwner,
    tokenMetadataProgram: programs.tokenMetadataProgram,
    systemProgram,
    sysvarInstructions,
  } as MintToCollectionAccounts;
}
