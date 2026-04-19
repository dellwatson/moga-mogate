import { ethers } from "ethers";
import { createPublicClient, createWalletClient, custom, http } from "viem";
import { sepolia } from "viem/chains";
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
    ],
    signer,
  );

  const keyHandle: bigint = await collection.encryptedKey(tokenId);
  const cipherRef: string = await collection.cipherRef(tokenId);

  console.log("cipherRef:", cipherRef || "<none>");
  console.log("encrypted key handle (ctHash):", keyHandle.toString());

  // CoFHE client for decrypting the key
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

  console.log("Calling decryptForView on encrypted key...");
  const aesKeyBigInt = await cofheClient
    .decryptForView(keyHandle, FheTypes.Uint128)
    .execute();

  console.log("Decrypted AES key (uint128 as bigint):", aesKeyBigInt);
  console.log(
    "Use this key together with cipherRef ciphertext (off-chain AES decrypt) to recover the voucher code.",
  );
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
