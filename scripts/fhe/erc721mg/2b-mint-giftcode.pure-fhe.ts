import { ethers } from "ethers";
import { createPublicClient, createWalletClient, http } from "viem";
import { sepolia } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";
import {
  createCofheConfig,
  createCofheClient,
  Encryptable,
} from "@cofhe/sdk/node";
import { chains } from "@cofhe/sdk/chains";
import { fheNftConfig } from "../config.js";

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
  const { network, erc721mg } = fheNftConfig;
  const { mint } = erc721mg;

  const rpcUrl = network.rpcUrls[network.target];
  const pk = network.privateKey;

  const collectionAddress = erc721mg.collectionAddress;
  const to = mint.to;
  const uri = mint.uri;
  const giftcodePlain = mint.plaintextGiftcode;

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

  console.log("Encrypting giftcode with CoFHE (pure-FHE mode)...");
  const [encGiftcode] = await cofheClient
    .encryptInputs([Encryptable.uint128(codeBigInt)])
    .execute();
  if (encGiftcode.ctHash === undefined || !encGiftcode.signature) {
    throw new Error(
      "Invalid CoFHE encrypted input: missing ctHash/signature. Ensure the wallet used for encryption is connected and signs input proofs.",
    );
  }

  const collection = new ethers.Contract(
    collectionAddress,
    [
      "function setMinter(address minter, bool allowed) external",
      "function owner() view returns (address)",
      "function operators(address) view returns (bool)",
      "function minters(address) view returns (bool)",
      "function mintGiftcode(address to, string uri, (uint256 ctHash,uint8 securityZone,uint8 utype,bytes signature) encKey, string cipherRef) external returns (uint256)",
    ],
    signer,
  );

  // Ensure signer is a minter. Only owner/operator can grant this role.
  const isMinter = await collection.minters(signer.address);
  if (!isMinter) {
    const [ownerAddress, isOperator] = await Promise.all([
      collection.owner(),
      collection.operators(signer.address),
    ]);
    const canGrantRole =
      ownerAddress.toLowerCase() === signer.address.toLowerCase() || isOperator;
    if (!canGrantRole) {
      throw new Error(
        `Signer ${signer.address} is not a minter and cannot call setMinter. Ask owner/operator to whitelist this wallet first.`,
      );
    }
    const txRole = await collection.setMinter(signer.address, true);
    console.log("setMinter tx:", txRole.hash);
    await txRole.wait();
  } else {
    console.log("Signer already has minter role; skipping setMinter.");
  }

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
