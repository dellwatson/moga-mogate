import { ethers } from "ethers";
import { createPublicClient, createWalletClient, custom, http } from "viem";
import { sepolia } from "viem/chains";
import {
  createCofheConfig,
  createCofheClient,
  FheTypes,
} from "@cofhe/sdk/node";
import { chains } from "@cofhe/sdk/chains";
import { fheNftConfig } from "../config.js";

/**
 * Simple decoder: convert uint128 back to string giftcode
 * Reverses the encoding from 2b-mint-giftcode-pure-fhe.ts
 */
function decodeGiftcodeFromUint128(value: bigint): string {
  // Convert bigint to bytes (little-endian)
  const bytes = new Uint8Array(16);
  for (let i = 0; i < 16; i++) {
    bytes[i] = Number((value >> (BigInt(i) * 8n)) & 0xffn);
  }

  // Remove trailing zeros and convert to string
  let trimmed = bytes;
  for (let i = bytes.length - 1; i >= 0; i--) {
    if (bytes[i] !== 0) {
      trimmed = bytes.slice(0, i + 1);
      break;
    }
  }

  const decoder = new TextDecoder();
  return decoder.decode(trimmed);
}

async function main() {
  const { network, erc721mg } = fheNftConfig;

  const rpcUrl = network.rpcUrls[network.target];
  const pk = network.privateKey;

  const collectionAddress = erc721mg.collectionAddress;
  const tokenIdRaw = erc721mg.decrypt.tokenId;

  if (!rpcUrl)
    throw new Error("RPC URL env var is required for target network");
  if (!pk)
    throw new Error(
      "PRIVATE_KEY_ETH / PRIVATE_KEY_ETH_2 or SEPOLIA_PRIVATE_KEY is required",
    );
  if (!collectionAddress) throw new Error("ERC721MG_ADDRESS is required");
  if (!tokenIdRaw) throw new Error("GIFTCODE_TOKEN_ID is required");

  const tokenId = BigInt(tokenIdRaw);

  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const signer = new ethers.Wallet(pk, provider);

  console.log("Decrypting giftcode (pure-FHE) for token:", tokenId.toString());
  console.log("Holder (signer):", signer.address);

  const collection = new ethers.Contract(
    collectionAddress,
    [
      "function encryptedKey(uint256 tokenId) external view returns (uint256)",
      "function cipherRef(uint256 tokenId) external view returns (string)",
      "function isRedeemed(uint256 tokenId) external view returns (bool)",
    ],
    signer,
  );

  const keyHandle: bigint = await collection.encryptedKey(tokenId);
  const cipherRef: string = await collection.cipherRef(tokenId);
  const isRedeemed: boolean = await collection.isRedeemed(tokenId);

  console.log(
    "cipherRef:",
    cipherRef || "<none> (should be empty in pure-FHE mode)",
  );
  console.log("encrypted key handle (ctHash):", keyHandle.toString());
  console.log("isRedeemed:", isRedeemed);

  if (!isRedeemed) {
    console.log(
      "⚠️  Token has not been redeemed yet. You must call redeemToSoulbound first to get decrypt permissions.",
    );
    process.exit(1);
  }

  // CoFHE client for decrypting the giftcode directly
  const publicClient = createPublicClient({
    chain: sepolia,
    transport: http(rpcUrl),
  });

  // Wallet client used only for signing permits; here we use a viem walletClient
  const walletClient = createWalletClient({
    chain: sepolia,
    transport: custom({
      request: async ({ method, params }) => {
        // Delegate to ethers signer for signing
        if (method === "eth_sign" || method === "personal_sign") {
          const [msg, addr] = params as [string, string];
          const sig = await signer.signMessage(ethers.getBytes(msg));
          return sig as any;
        }
        throw new Error(`Unsupported method for walletClient: ${method}`);
      },
    } as any),
  });

  const cofheConfig = createCofheConfig({
    supportedChains: [chains.sepolia],
  });
  const cofheClient = createCofheClient(cofheConfig);

  await cofheClient.connect(publicClient, walletClient as any);

  // Ensure we have a permit for this account
  await cofheClient.permits.getOrCreateSelfPermit();

  console.log("Calling decryptForView on encrypted giftcode...");
  const giftcodeBigInt = await cofheClient
    .decryptForView(keyHandle, FheTypes.Uint128)
    .execute();

  console.log(
    "Decrypted giftcode (uint128 as bigint):",
    giftcodeBigInt.toString(),
  );

  // Decode back to string
  const giftcodePlain = decodeGiftcodeFromUint128(giftcodeBigInt);
  console.log("🎉 Decrypted giftcode (plaintext):", giftcodePlain);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
