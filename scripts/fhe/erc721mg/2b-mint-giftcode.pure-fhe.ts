import { config as loadEnv } from "dotenv";
import { ethers } from "ethers";
import { createPublicClient, http } from "viem";
import { sepolia } from "viem/chains";
import {
  createCofheConfig,
  createCofheClient,
  Encryptable,
} from "@cofhe/sdk/node";
import { chains } from "@cofhe/sdk/chains";

loadEnv();

/**
 * Simple encoder: convert a string giftcode to a uint128
 * For demo purposes, we'll use the first 16 bytes of the string.
 * In production, use a proper encoding scheme.
 */
function encodeGiftcodeToUint128(code: string): bigint {
  // Convert string to bytes, take first 16 bytes, pad if needed
  const encoder = new TextEncoder();
  const bytes = encoder.encode(code);
  const padded = new Uint8Array(16);
  padded.set(bytes.slice(0, 16));

  // Convert to bigint (little-endian)
  let result = 0n;
  for (let i = 0; i < 16; i++) {
    result |= BigInt(padded[i]) << (BigInt(i) * 8n);
  }
  return result;
}

async function main() {
  const target = process.env.TARGET_NETWORK || "sepolia";

  let rpcUrl: string | undefined;
  if (target === "polygonAmoy") {
    rpcUrl = process.env.POLYGON_AMOY_RPC_URL;
  } else if (target === "arbitrumSepolia") {
    rpcUrl = process.env.ARBITRUM_SEPOLIA_RPC_URL;
  } else if (target === "polkadotTestnet") {
    rpcUrl = process.env.POLKADOT_TESTNET_RPC_URL;
  } else {
    rpcUrl = process.env.SEPOLIA_RPC_URL;
  }

  const pk = process.env.PRIVATE_KEY_ETH || process.env.PRIVATE_KEY_ETH_2;
  const collectionAddress = process.env.ERC721MG_ADDRESS;
  const to = process.env.GIFTCODE_TO;
  const uri = process.env.GIFTCODE_URI;
  const giftcodePlain = process.env.GIFTCODE_PLAIN;

  if (!rpcUrl)
    throw new Error("RPC URL env var is required for target network");
  if (!pk)
    throw new Error("PRIVATE_KEY_ETH or PRIVATE_KEY_ETH_2 env var is required");
  if (!collectionAddress) throw new Error("ERC721MG_ADDRESS is required");
  if (!to) throw new Error("GIFTCODE_TO is required");
  if (!uri) throw new Error("GIFTCODE_URI is required");
  if (!giftcodePlain)
    throw new Error("GIFTCODE_PLAIN is required for pure-FHE mode");

  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const signer = new ethers.Wallet(pk, provider);

  console.log(
    "Minting ERC721MG giftcode (pure-FHE) with signer:",
    signer.address,
  );
  console.log("Collection:", collectionAddress);
  console.log("Recipient:", to);
  console.log("Giftcode (plaintext):", giftcodePlain);

  // Encode giftcode to uint128
  const codeBigInt = encodeGiftcodeToUint128(giftcodePlain);
  console.log("Encoded giftcode as uint128:", codeBigInt.toString());

  // CoFHE client for encrypting the giftcode directly
  const publicClient = createPublicClient({
    chain: sepolia,
    transport: http(rpcUrl),
  });

  const cofheConfig = createCofheConfig({
    supportedChains: [chains.sepolia],
  });
  const cofheClient = createCofheClient(cofheConfig);

  await cofheClient.connect(publicClient, null as any);

  console.log("Encrypting giftcode with CoFHE (pure-FHE mode)...");
  const [encGiftcode] = await cofheClient
    .encryptInputs([Encryptable.uint128(codeBigInt)])
    .execute();

  const collection = new ethers.Contract(
    collectionAddress,
    [
      "function setMinter(address minter, bool allowed) external",
      "function mintGiftcode(address to, string uri, (bytes data,int32 securityZone,uint8 utype,bytes signature) encKey, string cipherRef) external returns (uint256)",
    ],
    signer,
  );

  // Ensure signer is a minter
  const txRole = await collection.setMinter(signer.address, true);
  console.log("setMinter tx:", txRole.hash);
  await txRole.wait();

  console.log("Calling mintGiftcode (pure-FHE mode)...");
  // In pure-FHE mode, cipherRef is empty since we store everything in the FHE ciphertext
  const tx = await collection.mintGiftcode(to, uri, encGiftcode as any, "");
  console.log("mintGiftcode tx:", tx.hash);
  const receipt = await tx.wait();
  console.log("Confirmed in block:", receipt.blockNumber);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
