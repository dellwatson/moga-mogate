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
  getStateTreeInfoByPubkey,
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
const JOIN_CONFIG_PATH = path.join(__dirname, "join-config.json");

async function main() {
  if (!RPC_URL) {
    throw new Error("RPC_URL is not set");
  }

  const raffleInfo = JSON.parse(fs.readFileSync(RAFFLE_INFO_PATH, "utf8"));
  const rafflePubkey = new PublicKey(raffleInfo.rafflePda);

  let slotIds = [1, 2, 3, 4, 5];
  if (fs.existsSync(JOIN_CONFIG_PATH)) {
    const cfg = JSON.parse(fs.readFileSync(JOIN_CONFIG_PATH, "utf8"));
    if (Array.isArray(cfg.slotIds)) {
      slotIds = cfg.slotIds;
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

  const stateTreeInfos = await rpc.getStateTreeInfos();
  let stateTreeInfo = selectStateTreeInfo(stateTreeInfos);
  if (raffleInfo.stateTree) {
    stateTreeInfo = getStateTreeInfoByPubkey(
      stateTreeInfos,
      new PublicKey(raffleInfo.stateTree),
    );
  } else if (raffleInfo.stateQueue) {
    stateTreeInfo = getStateTreeInfoByPubkey(
      stateTreeInfos,
      new PublicKey(raffleInfo.stateQueue),
    );
  }

  // Build compressed slot addresses
  const encoder = new TextEncoder();
  const slotPrefix = encoder.encode("slot");
  const slotAddresses = slotIds.map((slotId) => {
    const slotIdBuf = Buffer.alloc(4);
    slotIdBuf.writeUInt32LE(slotId, 0);
    const seed = deriveAddressSeedV2([
      slotPrefix,
      rafflePubkey.toBytes(),
      slotIdBuf,
    ]);
    return deriveAddressV2(seed, addressTreeInfo.tree, PROGRAM_ID);
  });

  const proofResult = await rpc.getValidityProofV0(
    [],
    slotAddresses.map((address) => ({
      tree: addressTreeInfo.tree,
      queue: addressTreeInfo.queue,
      address: bn(address.toBytes()),
    })),
  );

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

  const proof = {
    0: proofResult.compressedProof,
  };

  const { remainingAccounts, systemStart } = packedAccounts.toAccountMetas();

  const lightProof = {
    slotIds,
    proof,
    addressTreeInfo: packedAddressTreeInfo,
    outputStateTreeIndex,
    systemAccountsOffset: systemStart,
    remainingAccounts: remainingAccounts.map((meta: any) => ({
      pubkey: meta.pubkey.toBase58(),
      isSigner: meta.isSigner,
      isWritable: meta.isWritable,
    })),
    addressTree: addressTreeInfo.tree.toBase58(),
    addressQueue: addressTreeInfo.queue.toBase58(),
    stateTree: stateTreeInfo.tree.toBase58(),
    stateQueue: stateTreeInfo.queue.toBase58(),
    slotAddresses: slotAddresses.map((a) => a.toBase58()),
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
