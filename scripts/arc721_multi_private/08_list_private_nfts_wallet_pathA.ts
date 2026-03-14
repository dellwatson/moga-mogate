#!/usr/bin/env node
/**
 * Path-A inventory demo (wallet provides records / decrypts for us).
 *
 * This file is intentionally "frontend-ready":
 * - In Node: we only print guidance (wallet extensions don't exist in Node).
 * - In Browser/Frontend: you can copy these helpers and wire them to:
 *   - Puzzle SDK `getRecords()` (recommended for Puzzle Wallet), OR
 *   - Leo Wallet Adapter `requestRecords()` / `decrypt()`.
 *
 * For Node testing, use:
 * - `scripts/arc721_multi_private/06_list_private_nfts.ts` (private key)
 * - `scripts/arc721_multi_private/06_list_private_nfts.ts --view-key ...` (view key only)
 */

import { programNames } from "../aleo-utils.ts";
import { listMyPrivateNFTsViaWallet, listPrivateNFTsViaPuzzleGetRecords, listPrivateNFTsViaLeoWallet } from "../../ts-sdk/src/wallet.ts";

function isBrowser(): boolean {
  return typeof window !== "undefined" && typeof document !== "undefined";
}

async function demoPuzzle(getRecords: any) {
  const programId = programNames().arc721Private;
  const { nfts, pageCount } = await listPrivateNFTsViaPuzzleGetRecords(getRecords, {
    programId,
    recordName: "PrivateNFT",
    status: "Unspent",
  });
  console.log("Puzzle getRecords -> PrivateNFTs");
  console.log(JSON.stringify({ count: nfts.length, pageCount, nfts }, null, 2));
}

async function demoLeo(wallet: any) {
  const programId = programNames().arc721Private;
  const nfts = await listPrivateNFTsViaLeoWallet(wallet, {
    programId,
    recordName: "PrivateNFT",
    // If you use the Leo Wallet Adapter, pass:
    // decryptPermission: DecryptPermission.AutoDecrypt,
    // network: WalletAdapterNetwork.Testnet,
  });
  console.log("Leo wallet -> PrivateNFTs");
  console.log(JSON.stringify({ count: nfts.length, nfts }, null, 2));
}

async function main() {
  if (!isBrowser()) {
    console.log("This script is a frontend demo (wallet extensions are not available in Node).");
    console.log("");
    console.log("Use one of these instead:");
    console.log("- node scripts/arc721_multi_private/06_list_private_nfts.ts");
    console.log("- node scripts/arc721_multi_private/06_list_private_nfts.ts --view-key <AViewKey...>");
    console.log("");
    console.log("To use Path-A on frontend:");
    console.log("- Puzzle Wallet: call Puzzle SDK getRecords() and pass it to demoPuzzle(getRecords)");
    console.log("- Leo Wallet: use the wallet adapter / injected provider and pass it to demoLeo(wallet)");
    return;
  }

  // Browser mode (examples):
  // 1) Puzzle Wallet (React): const { getRecords } = useRecords(); await demoPuzzle(getRecords);
  // 2) Leo adapter (React): const { requestRecords, decrypt, ... } = useWallet(); await demoLeo(walletLike)
  console.log("Browser mode:");
  console.log("- If you already have getRecords/requestRecords objects, call demoPuzzle/demoLeo.");
  console.log("- Or use the unified helper: listMyPrivateNFTsViaWallet(provider, { programId }).");
}

main().catch((err) => {
  console.error("❌ Error:", err);
  process.exit(1);
});
