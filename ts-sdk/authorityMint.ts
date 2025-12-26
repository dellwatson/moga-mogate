import {
  Connection,
  PublicKey,
  Keypair,
  Transaction,
  TransactionInstruction,
  SystemProgram,
  SYSVAR_RENT_PUBKEY,
  ComputeBudgetProgram,
} from "@solana/web3.js";
import {
  getAssociatedTokenAddressSync,
  TOKEN_PROGRAM_ID as SPL_TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { createHash } from "crypto";

// Constants
export const TOKEN_METADATA_PROGRAM_ID = new PublicKey(
  "metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s"
);
export const SPL_ASSOCIATED_TOKEN_PROGRAM_ID = new PublicKey(
  "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL"
);

export type MintArgs = {
  name: string;
  symbol: string;
  uri: string;
  maxSupply?: bigint | null;
  collectionMint: PublicKey;
  programId: PublicKey; // authority_mint program id
  payer: PublicKey;
  isSizedCollection?: boolean; // Default to true for backwards compatibility
};

// No longer using PDA for mint - using Keypair instead
// export function findMintPdaForPayer(payer: PublicKey, programId: PublicKey) {
//   return PublicKey.findProgramAddressSync(
//     [Buffer.from("mint"), payer.toBuffer()],
//     programId
//   )[0];
// }

export function findMetadataPda(mint: PublicKey) {
  return PublicKey.findProgramAddressSync(
    [
      Buffer.from("metadata"),
      TOKEN_METADATA_PROGRAM_ID.toBuffer(),
      mint.toBuffer(),
    ],
    TOKEN_METADATA_PROGRAM_ID
  )[0];
}

export function findMasterEditionPda(mint: PublicKey) {
  return PublicKey.findProgramAddressSync(
    [
      Buffer.from("metadata"),
      TOKEN_METADATA_PROGRAM_ID.toBuffer(),
      mint.toBuffer(),
      Buffer.from("edition"),
    ],
    TOKEN_METADATA_PROGRAM_ID
  )[0];
}

export function findCollectionAuthorityPda(
  collectionMint: PublicKey,
  programId: PublicKey
) {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("collection_authority"), collectionMint.toBuffer()],
    programId
  )[0];
}

export function findCollectionAuthorityRecordPda(
  collectionMint: PublicKey,
  newAuthority: PublicKey
) {
  return PublicKey.findProgramAddressSync(
    [
      Buffer.from("metadata"),
      TOKEN_METADATA_PROGRAM_ID.toBuffer(),
      collectionMint.toBuffer(),
      Buffer.from("collection_authority"),
      newAuthority.toBuffer(),
    ],
    TOKEN_METADATA_PROGRAM_ID
  )[0];
}

function encodeString(s: string): Buffer {
  const bytes = new TextEncoder().encode(s);
  const len = Buffer.alloc(4);
  len.writeUInt32LE(bytes.length, 0);
  return Buffer.concat([len, Buffer.from(bytes)]);
}

function encodeOptionU64(v?: bigint | null): Buffer {
  if (v === null || v === undefined) return Buffer.from([0]);
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64LE(BigInt(v));
  return Buffer.concat([Buffer.from([1]), buf]);
}

export function buildMintNftIx(args: MintArgs & { mintKeypair: Keypair }) {
  const {
    name,
    symbol,
    uri,
    maxSupply,
    collectionMint,
    programId,
    payer,
    mintKeypair,
    isSizedCollection,
  } = args;

  const mint = mintKeypair.publicKey;
  const ata = getAssociatedTokenAddressSync(mint, payer, false);
  const metadata = findMetadataPda(mint);
  const masterEdition = findMasterEditionPda(mint);

  const collectionMetadata = findMetadataPda(collectionMint);
  const collectionMasterEdition = findMasterEditionPda(collectionMint);
  const collectionAuthority = findCollectionAuthorityPda(
    collectionMint,
    programId
  );
  const collectionAuthorityRecord = findCollectionAuthorityRecordPda(
    collectionMint,
    collectionAuthority
  );

  const sysvarInstructions = new PublicKey(
    "Sysvar1nstructions1111111111111111111111111"
  );

  const disc = createHash("sha256")
    .update("global:mint_nft")
    .digest()
    .subarray(0, 8);
  const isSized = isSizedCollection ?? true; // Default to true for backwards compatibility
  const data = Buffer.concat([
    Buffer.from(disc),
    encodeString(name),
    encodeString(symbol),
    encodeString(uri),
    encodeOptionU64(maxSupply ?? null),
    Buffer.from([isSized ? 1 : 0]), // boolean as u8
  ]);

  const keys = [
    { pubkey: payer, isSigner: true, isWritable: true },
    { pubkey: collectionMint, isSigner: false, isWritable: true },
    { pubkey: collectionMetadata, isSigner: false, isWritable: true },
    { pubkey: collectionMasterEdition, isSigner: false, isWritable: true },
    { pubkey: collectionAuthority, isSigner: false, isWritable: true },
    { pubkey: collectionAuthorityRecord, isSigner: false, isWritable: false },
    { pubkey: mint, isSigner: true, isWritable: true },
    { pubkey: ata, isSigner: false, isWritable: true },
    { pubkey: metadata, isSigner: false, isWritable: true },
    { pubkey: masterEdition, isSigner: false, isWritable: true },
    { pubkey: SPL_TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
    {
      pubkey: SPL_ASSOCIATED_TOKEN_PROGRAM_ID,
      isSigner: false,
      isWritable: false,
    },
    { pubkey: TOKEN_METADATA_PROGRAM_ID, isSigner: false, isWritable: false },
    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false },
    { pubkey: sysvarInstructions, isSigner: false, isWritable: false },
  ];

  return new TransactionInstruction({ programId, keys, data });
}

export async function sendMintNftTx(
  args: MintArgs & { connection: Connection; payerKeypair: Keypair }
) {
  const { connection, payerKeypair, ...rest } = args;

  // Generate a fresh mint keypair for each mint
  const mintKeypair = Keypair.generate();
  const ix = buildMintNftIx({ ...rest, mintKeypair });

  const { blockhash, lastValidBlockHeight } =
    await connection.getLatestBlockhash();
  const tx = new Transaction();
  tx.feePayer = payerKeypair.publicKey;
  tx.recentBlockhash = blockhash;

  // Request 400k compute units (default is 200k, not enough for mint + verify_collection)
  tx.add(ComputeBudgetProgram.setComputeUnitLimit({ units: 400_000 }));
  tx.add(ix);

  // Sign with both payer and mint keypairs
  tx.sign(payerKeypair, mintKeypair);
  const sig = await connection.sendRawTransaction(tx.serialize());
  await connection.confirmTransaction(
    { signature: sig, blockhash, lastValidBlockHeight },
    "confirmed"
  );

  console.log(
    "Minted NFT with mint address:",
    mintKeypair.publicKey.toBase58()
  );
  return sig;
}
