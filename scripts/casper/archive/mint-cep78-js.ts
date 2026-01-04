#!/usr/bin/env bun
import { CEP78Client } from "/Users/dellwatson/Desktop/casper/cep-78-enhanced-nft/client-js/src/CEP78Client";
import { CasperClient, CLPublicKey, Keys } from "casper-js-sdk";
import * as fs from "fs";

const NODE_URL = "http://65.109.83.79:7777";
const CHAIN_NAME = "casper-test";
const CONTRACT_HASH =
  "hash-68eaf8107a04d354202e4b60ed261ff17bc7c4a63411194bbb15939dcdbfdbcc";
const SECRET_KEY_PATH =
  "/Users/dellwatson/Desktop/nov2025/mogate-rwa-raffle-monorepo/Account 1_secret_key.pem";

async function main() {
  // Load keys
  const keyPair = Keys.Ed25519.parseKeyFiles(
    SECRET_KEY_PATH.replace("_secret_key.pem", "_public_key.pem"),
    SECRET_KEY_PATH
  );

  // Create Casper client
  const casperClient = new CasperClient(NODE_URL);

  // Create CEP-78 client
  const cep78 = new CEP78Client(casperClient, CHAIN_NAME);
  cep78.setContractHash(CONTRACT_HASH);

  console.log("🎫 Minting NFT via JavaScript SDK");
  console.log(`   Contract: ${CONTRACT_HASH}`);
  console.log(`   Deployer: ${keyPair.publicKey.toHex()}`);

  // NFT721 metadata format
  const metadata = {
    name: "Tixia Flight Credit",
    symbol: "TIX",
    token_uri:
      "https://raw.githubusercontent.com/dellwatson/moga-mogate/refs/heads/casper-network/metadata/v2-test/nfts/casper/tixia/1o1/200/metadata.json",
  };

  const recipient = CLPublicKey.fromHex(keyPair.publicKey.toHex());

  try {
    const deployHash = await cep78.mint(
      {
        owner: recipient,
        meta: metadata,
      },
      "5000000000", // payment
      keyPair.publicKey,
      [keyPair]
    );

    console.log(`✅ Mint deploy submitted!`);
    console.log(`   Deploy hash: ${deployHash}`);
    console.log(`\nWaiting for deploy to finalize...`);

    // Wait for deploy
    await new Promise((resolve) => setTimeout(resolve, 20000));

    const result = await casperClient.getDeploy(deployHash);
    const executionResult = result[1].execution_results[0].result;

    if (executionResult.Success) {
      console.log("✅ MINT SUCCESSFUL!");
    } else {
      console.log("❌ Mint failed:");
      console.log(JSON.stringify(executionResult, null, 2));
    }
  } catch (error) {
    console.error("❌ Error:", error);
  }
}

main();
