#!/usr/bin/env bun

import { PublicKey } from "@solana/web3.js";
import fs from "fs";
import path from "path";
import {
  bn,
  createRpc,
  featureFlags,
  VERSION,
  PackedAccounts,
  SystemAccountMetaConfig,
  selectStateTreeInfo,
  deriveAddressSeedV2,
  deriveAddressV2,
  lightSystemProgram,
} from "@lightprotocol/stateless.js";

const RPC_URL =
  process.env.SOLANA_RPC_URL ||
  process.env.HELIUS_RPC_URL ||
  "https://api.devnet.solana.com"; // fallback to devnet RPC

// This must match the program id used on-chain for LIGHT compressed tickets
const PROGRAM_ID = new PublicKey(
  "86okKaT6umcjVHcwpcgH1FWKfov2PywWrnTbsYWfmo5o",
);

// Example: load raffle + user from raffle-info.json or env
const RAFFLE_INFO_PATH = path.join(__dirname, "raffle-info.json");

async function main() {
  if (!RPC_URL) {
    throw new Error("RPC_URL is not set");
  }

  // Load raffle + user info (host wallet joins its own raffle by default)
  const raffleInfo = JSON.parse(fs.readFileSync(RAFFLE_INFO_PATH, "utf8"));
  const rafflePubkey = new PublicKey(raffleInfo.rafflePda);
  const userPubkey = new PublicKey(
    raffleInfo.hostWallet ?? raffleInfo.authority ?? raffleInfo.payer,
  );

  // 1) Construct the seeds for the compressed ticket address
  //    Must exactly match the Rust derive_address seeds:
  //    &[b"ticket", raffle.key().as_ref(), payer.key().as_ref()]
  const encoder = new TextEncoder();
  const ticketPrefix = encoder.encode("ticket");
  const seed = deriveAddressSeedV2([
    ticketPrefix,
    rafflePubkey.toBytes(),
    userPubkey.toBytes(),
  ]);

  // 2) Initialize Light / Photon client (Helius endpoint used for all three)
  const rpc = createRpc(RPC_URL, RPC_URL, RPC_URL);

  // Force V2 behavior (same as Light program-examples)
  (featureFlags as any).version = (VERSION as any).V2 ?? VERSION.V2;

  // 3) Fetch state & address tree infos and derive the compressed ticket address
  const stateTreeInfos = await rpc.getStateTreeInfos();
  const stateTreeInfo = selectStateTreeInfo(stateTreeInfos);

  const addressTreeInfo = await rpc.getAddressTreeInfoV2();

  const ticketAddress = deriveAddressV2(seed, addressTreeInfo.tree, PROGRAM_ID);

  // 4) Ask Light/Photon for a validity proof that this ticket address is fresh
  const proofResult = await rpc.getValidityProofV0(
    [],
    [
      {
        tree: addressTreeInfo.tree,
        queue: addressTreeInfo.queue,
        address: bn(ticketAddress.toBytes()),
      },
    ],
  );

  // 5) Build PackedAddressTreeInfo + output_state_tree_index using PackedAccounts
  const config = SystemAccountMetaConfig.new(PROGRAM_ID);
  const packedAccounts = PackedAccounts.newWithSystemAccountsV2(config);

  const outputStateTreeIndex = packedAccounts.insertOrGet(stateTreeInfo.queue);
  const addressQueueIndex = packedAccounts.insertOrGet(addressTreeInfo.queue);
  const addressTreeIndex = packedAccounts.insertOrGet(addressTreeInfo.tree);

  const packedAddressTreeInfo = {
    rootIndex: proofResult.rootIndices[0],
    addressMerkleTreePubkeyIndex: addressTreeIndex,
    addressQueuePubkeyIndex: addressQueueIndex,
  };

  // ValidityProof is represented in Anchor TS as an object with index 0
  const proof = {
    0: proofResult.compressedProof,
  };

  // Remaining accounts and system accounts offset are required by LIGHT CPI
  const { remainingAccounts, systemStart } = packedAccounts.toAccountMetas();

  // 6) Write structured light-proof.json consumed by join.ts / join-test.ts
  const lightProof = {
    // LIGHT proof and tree info (passed directly into Anchor program methods)
    proof,
    addressTreeInfo: packedAddressTreeInfo,
    outputStateTreeIndex,

    // Where system accounts start inside remainingAccounts
    systemAccountsOffset: systemStart,

    // Remaining account metas required by LIGHT system program CPI
    remainingAccounts: remainingAccounts.map((meta: any) => ({
      pubkey: meta.pubkey.toBase58(),
      isSigner: meta.isSigner,
      isWritable: meta.isWritable,
    })),

    // Convenience fields for scripts
    lightStateTree: stateTreeInfo.queue.toBase58(),
    lightSystemProgram,
    ticketAddress: ticketAddress.toBase58(),
  };

  fs.writeFileSync(
    path.join(__dirname, "light-proof.json"),
    JSON.stringify(lightProof, null, 2),
  );

  console.log("✅ Wrote scripts/inco/verA-light/light-proof.json");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
