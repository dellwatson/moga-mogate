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
  getDefaultAddressTreeInfo,
  deriveAddressSeedV2,
  deriveAddressV2,
} from "@lightprotocol/stateless.js";

const RPC_URL =
  process.env.SOLANA_RPC_URL ||
  process.env.HELIUS_RPC_URL ||
  "https://api.devnet.solana.com";

const PROGRAM_ID = new PublicKey(
  "86okKaT6umcjVHcwpcgH1FWKfov2PywWrnTbsYWfmo5o",
);

const RAFFLE_INFO_PATH = path.join(__dirname, "raffle-info.json");
const REVEAL_CONFIG_PATH = path.join(__dirname, "reveal-config.json");

async function main() {
  if (!RPC_URL) {
    throw new Error("RPC_URL is not set");
  }

  const raffleInfo = JSON.parse(fs.readFileSync(RAFFLE_INFO_PATH, "utf8"));
  const rafflePubkey = new PublicKey(raffleInfo.rafflePda);

  let slotId = 1;
  if (process.env.REVEAL_SLOT_ID) {
    slotId = Number(process.env.REVEAL_SLOT_ID);
  } else if (fs.existsSync(REVEAL_CONFIG_PATH)) {
    const cfg = JSON.parse(fs.readFileSync(REVEAL_CONFIG_PATH, "utf8"));
    if (typeof cfg.slotId === "number") {
      slotId = cfg.slotId;
    }
  }

  (featureFlags as any).version = (VERSION as any).V2 ?? VERSION.V2;
  const rpc = createRpc(RPC_URL, RPC_URL, RPC_URL);

  const addressTreeInfo = getDefaultAddressTreeInfo();
  if (raffleInfo.addressTree && raffleInfo.addressTree !== addressTreeInfo.tree.toBase58()) {
    throw new Error(
      `Address tree mismatch. Raffle uses ${raffleInfo.addressTree} but default is ${addressTreeInfo.tree.toBase58()}`,
    );
  }

  const encoder = new TextEncoder();
  const slotPrefix = encoder.encode("slot");
  const slotIdBuf = Buffer.alloc(4);
  slotIdBuf.writeUInt32LE(slotId, 0);
  const seed = deriveAddressSeedV2([
    slotPrefix,
    rafflePubkey.toBytes(),
    slotIdBuf,
  ]);
  const slotAddress = deriveAddressV2(seed, addressTreeInfo.tree, PROGRAM_ID);

  const compressed = await rpc.getCompressedAccount(bn(slotAddress.toBytes()));
  if (!compressed) {
    throw new Error(`Compressed slot not found for slot ${slotId}`);
  }

  const proofResult = await rpc.getValidityProofV0(
    [
      {
        hash: compressed.hash,
        tree: compressed.treeInfo.tree,
        queue: compressed.treeInfo.queue,
      },
    ],
    [],
  );

  const config = SystemAccountMetaConfig.new(PROGRAM_ID);
  const packedAccounts = PackedAccounts.newWithSystemAccountsV2(config);
  const merkleTreeIndex = packedAccounts.insertOrGet(compressed.treeInfo.tree);
  const queueIndex = packedAccounts.insertOrGet(compressed.treeInfo.queue);

  const packedStateTreeInfo = {
    rootIndex: proofResult.rootIndices[0],
    proveByIndex: !!proofResult.proveByIndices[0],
    merkleTreePubkeyIndex: merkleTreeIndex,
    queuePubkeyIndex: queueIndex,
    leafIndex: proofResult.leafIndices[0],
  };

  const proof = {
    0: proofResult.compressedProof,
  };

  const { remainingAccounts, systemStart } = packedAccounts.toAccountMetas();

  const revealProof = {
    slotId,
    slotAddress: slotAddress.toBase58(),
    proof,
    stateTreeInfo: packedStateTreeInfo,
    systemAccountsOffset: systemStart,
    remainingAccounts: remainingAccounts.map((meta: any) => ({
      pubkey: meta.pubkey.toBase58(),
      isSigner: meta.isSigner,
      isWritable: meta.isWritable,
    })),
    stateTree: compressed.treeInfo.tree.toBase58(),
    stateQueue: compressed.treeInfo.queue.toBase58(),
  };

  fs.writeFileSync(
    path.join(__dirname, "reveal-proof.json"),
    JSON.stringify(revealProof, null, 2),
  );

  console.log("✅ Wrote scripts/inco/verA-light/reveal-proof.json");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
