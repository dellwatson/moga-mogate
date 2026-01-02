#!/usr/bin/env bun
/**
 * Mint NFT using a signed permit
 *
 * Usage:
 *   bun run casper:mint-with-permit <PERMIT_JSON>
 */

import {
  CasperClient,
  CLValueBuilder,
  DeployUtil,
  RuntimeArgs,
  Keys,
} from "casper-js-sdk";

const AUTHORITY_MINT_PERMIT_HASH = "YOUR_DEPLOYED_CONTRACT_HASH"; // Update after deployment
const NODE_ADDRESS = "http://65.109.83.79:7777";
const CHAIN_NAME = "casper-test";

async function main() {
  const permitJson = process.argv[2];

  if (!permitJson) {
    console.error("Usage: bun run casper:mint-with-permit <PERMIT_JSON>");
    console.error(
      'Example: bun run casper:mint-with-permit \'{"collection_hash":"...","token_owner":"...","nonce":"...","expiry":123,"signature":"..."}\''
    );
    process.exit(1);
  }

  const permit = JSON.parse(permitJson);

  console.log("🎫 Minting NFT with permit...");
  console.log("   Nonce:", permit.nonce);
  console.log("   Expiry:", new Date(permit.expiry * 1000).toISOString());

  // Load user keys
  const keys = Keys.Ed25519.parseKeyFiles(
    "./Account 1_public_key.pem",
    "./Account 1_secret_key.pem"
  );

  const client = new CasperClient(NODE_ADDRESS);

  // Build deploy
  const deploy = DeployUtil.makeDeploy(
    new DeployUtil.DeployParams(keys.publicKey, CHAIN_NAME, 1, 1800000),
    DeployUtil.ExecutableDeployItem.newStoredContractByHash(
      Uint8Array.from(Buffer.from(AUTHORITY_MINT_PERMIT_HASH, "hex")),
      "mint_nft_with_permit",
      RuntimeArgs.fromMap({
        collection_hash: new CLValueBuilder.ByteArray(
          Uint8Array.from(Buffer.from(permit.collection_hash, "hex"))
        ),
        token_owner: CLValueBuilder.key(
          CLValueBuilder.byteArray(
            Uint8Array.from(
              Buffer.from(
                permit.token_owner.replace("account-hash-", ""),
                "hex"
              )
            )
          )
        ),
        token_metadata: CLValueBuilder.string(permit.token_metadata),
        nonce: CLValueBuilder.string(permit.nonce),
        expiry: CLValueBuilder.u64(permit.expiry),
        signature: CLValueBuilder.list(
          Array.from(Buffer.from(permit.signature, "hex")).map((b) =>
            CLValueBuilder.u8(b)
          )
        ),
      })
    ),
    DeployUtil.standardPayment("5000000000")
  );

  // Sign deploy
  const signedDeploy = deploy.sign([keys]);

  // Send deploy
  const deployHash = await client.putDeploy(signedDeploy);

  console.log("\n✅ Deploy submitted!");
  console.log("   Deploy Hash:", deployHash);
  console.log("   Explorer:", `https://testnet.cspr.live/deploy/${deployHash}`);

  console.log("\n⏳ Waiting for execution...");
  const [_, rawDeploy] = await client.getDeploy(deployHash);

  // Wait for execution
  let attempts = 0;
  while (attempts < 60) {
    await new Promise((resolve) => setTimeout(resolve, 5000));

    try {
      const [__, updatedRaw] = await client.getDeploy(deployHash);
      if (
        updatedRaw.execution_results &&
        updatedRaw.execution_results.length > 0
      ) {
        const result = updatedRaw.execution_results[0].result;
        if (result.Success) {
          console.log("✅ NFT minted successfully with permit!");
          return;
        } else if (result.Failure) {
          console.error("❌ Mint failed:", result.Failure.error_message);
          process.exit(1);
        }
      }
    } catch (e) {
      // Continue waiting
    }

    attempts++;
  }

  console.log("⏱️  Deploy pending... Check explorer for status");
}

main().catch((error) => {
  console.error("Error:", error);
  process.exit(1);
});
