import { ethers } from "ethers";
import { createPublicClient, createWalletClient, http } from "viem";
import { sepolia } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";
import { createCofheConfig, createCofheClient } from "@cofhe/sdk/node";
import { FheTypes } from "@cofhe/sdk";
import { chains } from "@cofhe/sdk/chains";
import { fheNftConfig } from "../config.js";

async function main() {
  const { network, erc721mg } = fheNftConfig;

  const rpcUrl = network.rpcUrls[network.target];
  const pk = network.privateKey;

  const collectionAddress = erc721mg.collectionAddress;
  const tokenId = erc721mg.decrypt.tokenId;

  if (!rpcUrl)
    throw new Error(
      `RPC URL for target network '${network.target}' is required`,
    );
  if (!pk)
    throw new Error("PRIVATE_KEY_ETH or PRIVATE_KEY_ETH_2 env var is required");
  if (!collectionAddress)
    throw new Error("fheNftConfig.erc721mg.collectionAddress is required");

  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const signer = new ethers.Wallet(pk, provider);

  console.log("Decrypting giftcode for token:", tokenId.toString());
  console.log("Holder (signer):", signer.address);

  const collection = new ethers.Contract(
    collectionAddress,
    [
      "function encryptedKey(uint256 tokenId) external view returns (uint256)",
      "function cipherRef(uint256 tokenId) external view returns (string)",
      "function isRedeemed(uint256 tokenId) external view returns (bool)",
      "function ownerOf(uint256 tokenId) external view returns (address)",
    ],
    signer,
  );

  const keyHandle: bigint = await collection.encryptedKey(tokenId);
  const cipherRef: string = await collection.cipherRef(tokenId);
  const isRedeemed: boolean = await collection.isRedeemed(tokenId);
  const owner: string = await collection.ownerOf(tokenId);

  console.log("cipherRef:", cipherRef || "<none>");
  console.log("encrypted key handle (ctHash):", keyHandle.toString());
  console.log("isRedeemed:", isRedeemed);
  console.log("owner:", owner);
  console.log("signer:", signer.address);
  console.log(
    "signer is owner:",
    owner.toLowerCase() === signer.address.toLowerCase(),
  );

  // CoFHE client for decrypting the key
  const publicClient = createPublicClient({
    chain: sepolia,
    transport: http(rpcUrl),
  });
  const account = privateKeyToAccount(
    pk.startsWith("0x") ? (pk as `0x${string}`) : (`0x${pk}` as `0x${string}`),
  );
  const walletClient = createWalletClient({
    account,
    chain: sepolia,
    transport: http(rpcUrl),
  });

  const cofheConfig = createCofheConfig({
    supportedChains: [chains.sepolia],
  });
  const cofheClient = createCofheClient(cofheConfig);

  await cofheClient.connect(publicClient, walletClient);
  console.log("FHE client connected successfully");

  // Try old-style decrypt (if still available)
  console.log("Attempting legacy decrypt approach...");
  try {
    // Try direct decrypt without permit system
    const result = await cofheClient
      .decryptForView(keyHandle, FheTypes.Uint128)
      .execute();
    console.log("Decrypted AES key (uint128 as bigint):", result);
    console.log("SUCCESS: Legacy decrypt worked!");
  } catch (error: any) {
    console.error("Legacy decrypt failed:", error.message);

    // Try mock environment as fallback
    console.log("Trying mock environment for testing...");
    const mockConfig = createCofheConfig({
      supportedChains: [chains.sepolia],
      // Force mock mode
      mock: true,
    });
    const mockClient = createCofheClient(mockConfig);
    await mockClient.connect(publicClient, walletClient);

    try {
      const mockResult = await mockClient
        .decryptForView(keyHandle, FheTypes.Uint128)
        .execute();
      console.log("Mock decrypt result:", mockResult);
      console.log("NOTE: This is mock data, not real decryption");
    } catch (mockError: any) {
      console.error("Mock decrypt also failed:", mockError.message);
      console.log(
        "FHE decrypt is currently unavailable due to network transition",
      );
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
