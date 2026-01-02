/**
 * Example usage of Casper Authority Mint SDK
 */

import {
  CasperAuthorityMintClient,
  TIXIA_1O1_COLLECTION_HASH,
  TIXIA_SFT_COLLECTION_HASH,
  stripAccountHashPrefix,
} from "./casper-authority-mint";
import { Keys } from "casper-js-sdk";

// Example 1: Mint NFT from backend with private key
async function mintFromBackend() {
  // Load keys from PEM files
  const keys = Keys.Ed25519.parseKeyFiles(
    "./public_key.pem",
    "./secret_key.pem"
  );

  const client = new CasperAuthorityMintClient();

  // Mint to a recipient
  const recipientAccountHash = stripAccountHashPrefix(
    "account-hash-1877cb2417eb4f7f93a1cdbf22fe658071e6bc3d11e1e4b7cbe6a8e7263094e8"
  );

  const deployHash = await client.mintNFT(
    {
      collectionHash: TIXIA_1O1_COLLECTION_HASH,
      recipientAccountHash,
      metadata: {
        name: "Tixia $100 Flight Credit",
        token_uri:
          "https://raw.githubusercontent.com/dellwatson/moga-mogate/refs/heads/master/metadata/v2-test/nfts/casper/tixia/1o1/100/metadata.json",
      },
      paymentAmount: "5000000000", // 5 CSPR
    },
    keys
  );

  console.log("Deploy hash:", deployHash);
  console.log("Explorer:", `https://testnet.cspr.live/deploy/${deployHash}`);

  // Wait for execution
  const result = await client.waitForDeploy(deployHash);
  if (result.success) {
    console.log("✅ NFT minted successfully!");
  } else {
    console.error("❌ Mint failed:", result.error);
  }
}

// Example 2: Mint NFT from frontend with wallet
async function mintFromFrontend() {
  // This would run in browser with Casper Wallet extension

  // @ts-ignore - window.casperlabsHelper is injected by Casper Wallet
  const casperWallet = window.casperlabsHelper;

  if (!casperWallet) {
    throw new Error("Casper Wallet not installed");
  }

  // Connect wallet
  await casperWallet.requestConnection();
  const publicKeyHex = await casperWallet.getActivePublicKey();
  const publicKey = CLPublicKey.fromHex(publicKeyHex);

  // Get user's account hash
  const accountHash = publicKey.toAccountHashStr().replace("account-hash-", "");

  const client = new CasperAuthorityMintClient();

  // Build unsigned deploy
  const deploy = client.buildMintNFTDeploy(
    {
      collectionHash: TIXIA_1O1_COLLECTION_HASH,
      recipientAccountHash: accountHash,
      metadata: {
        name: "Tixia $50 Hotel Credit",
        token_uri:
          "https://raw.githubusercontent.com/dellwatson/moga-mogate/refs/heads/master/metadata/v2-test/nfts/casper/tixia/1o1/50/metadata.json",
      },
    },
    publicKey
  );

  // Sign with wallet
  const signedDeployJson = await casperWallet.sign(
    JSON.stringify(DeployUtil.deployToJson(deploy)),
    publicKeyHex
  );
  const signedDeploy = DeployUtil.deployFromJson(
    JSON.parse(signedDeployJson)
  ).unwrap();

  // Send deploy
  const deployHash = await client.sendDeploy(signedDeploy);

  console.log("Deploy hash:", deployHash);
  return deployHash;
}

// Example 3: Batch mint multiple NFTs
async function batchMint() {
  const keys = Keys.Ed25519.parseKeyFiles(
    "./public_key.pem",
    "./secret_key.pem"
  );
  const client = new CasperAuthorityMintClient();

  const recipients = [
    "account-hash-1877cb2417eb4f7f93a1cdbf22fe658071e6bc3d11e1e4b7cbe6a8e7263094e8",
    "account-hash-2877cb2417eb4f7f93a1cdbf22fe658071e6bc3d11e1e4b7cbe6a8e7263094e9",
    "account-hash-3877cb2417eb4f7f93a1cdbf22fe658071e6bc3d11e1e4b7cbe6a8e7263094ea",
  ];

  const nftValues = [100, 50, 25]; // Different NFT values

  for (let i = 0; i < recipients.length; i++) {
    const deployHash = await client.mintNFT(
      {
        collectionHash: TIXIA_1O1_COLLECTION_HASH,
        recipientAccountHash: stripAccountHashPrefix(recipients[i]),
        metadata: {
          name: `Tixia $${nftValues[i]} Flight Credit`,
          token_uri: `https://raw.githubusercontent.com/dellwatson/moga-mogate/refs/heads/master/metadata/v2-test/nfts/casper/tixia/1o1/${nftValues[i]}/metadata.json`,
        },
      },
      keys
    );

    console.log(`Minted NFT ${i + 1}/${recipients.length}: ${deployHash}`);

    // Wait 30s between mints to avoid nonce conflicts
    await new Promise((resolve) => setTimeout(resolve, 30000));
  }

  console.log("✅ Batch mint complete!");
}

// Example 4: Mint SFT (Semi-Fungible Token)
async function mintSFT() {
  const keys = Keys.Ed25519.parseKeyFiles(
    "./public_key.pem",
    "./secret_key.pem"
  );
  const client = new CasperAuthorityMintClient();

  const deployHash = await client.mintNFT(
    {
      collectionHash: TIXIA_SFT_COLLECTION_HASH, // Use SFT collection
      recipientAccountHash: stripAccountHashPrefix(
        "account-hash-1877cb2417eb4f7f93a1cdbf22fe658071e6bc3d11e1e4b7cbe6a8e7263094e8"
      ),
      metadata: {
        name: "Tixia $10 Credit",
        token_uri:
          "https://raw.githubusercontent.com/dellwatson/moga-mogate/refs/heads/master/metadata/v2-test/nfts/casper/tixia/sft/10/metadata.json",
      },
    },
    keys
  );

  console.log("SFT minted:", deployHash);
}

// Run examples
if (require.main === module) {
  // mintFromBackend().catch(console.error);
  // mintFromFrontend().catch(console.error);
  // batchMint().catch(console.error);
  // mintSFT().catch(console.error);
}

export { mintFromBackend, mintFromFrontend, batchMint, mintSFT };
