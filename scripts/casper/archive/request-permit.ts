#!/usr/bin/env bun
/**
 * Request a mint permit from backend
 *
 * Usage:
 *   bun run casper:request-permit [RECIPIENT_ACCOUNT_HASH]
 */

import { TIXIA_1O1_COLLECTION_HASH } from "../../ts-sdk/src/casper-authority-mint";

async function main() {
  const recipientAccountHash =
    process.argv[2] ||
    "1877cb2417eb4f7f93a1cdbf22fe658071e6bc3d11e1e4b7cbe6a8e7263094e8";

  console.log("📝 Requesting mint permit...");
  console.log("   Collection:", TIXIA_1O1_COLLECTION_HASH);
  console.log("   Recipient:", recipientAccountHash);

  // Request permit from backend
  const response = await fetch(
    "http://localhost:3000/api/casper/request-mint-permit",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        collectionHash: TIXIA_1O1_COLLECTION_HASH,
        recipientAccountHash,
        metadata: {
          name: "Tixia $100 Flight Credit",
          token_uri:
            "https://raw.githubusercontent.com/dellwatson/moga-mogate/refs/heads/master/metadata/v2-test/nfts/casper/tixia/1o1/100/metadata.json",
        },
        validitySeconds: 3600, // 1 hour
      }),
    }
  );

  const data = await response.json();

  if (data.success) {
    console.log("\n✅ Permit issued!");
    console.log("\nPermit Details:");
    console.log("   Nonce:", data.permit.nonce);
    console.log(
      "   Expiry:",
      new Date(data.permit.expiry * 1000).toISOString()
    );
    console.log(
      "   Signature:",
      data.permit.signature.substring(0, 32) + "..."
    );

    console.log("\n📋 Full Permit (copy this):");
    console.log(JSON.stringify(data.permit, null, 2));
  } else {
    console.error("\n❌ Failed to get permit:", data.error);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error("Error:", error);
  process.exit(1);
});
