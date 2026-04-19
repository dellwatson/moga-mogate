import fs from "node:fs";
import * as path from "path";
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
import type { InEuint128Input } from "@cofhe/sdk";

type InEuint128Input = {
  ctHash: bigint;
  securityZone: number;
  utype: number;
  signature: string;
};

async function main() {
  const { network, erc721mg } = fheNftConfig;
  const { mint } = erc721mg;

  const rpcUrl = network.rpcUrls[network.target];
  const pk = network.privateKey;

  const collectionAddress = erc721mg.collectionAddress;
  const to = mint.to;
  const uri = mint.uri;
  const existingCipherRef = mint.cipherRef || "";
  const plaintextGiftcode = mint.plaintextGiftcode;

  if (!rpcUrl)
    throw new Error(
      `RPC URL for target network '${network.target}' is required`,
    );
  if (!pk)
    throw new Error("PRIVATE_KEY_ETH or PRIVATE_KEY_ETH_2 env var is required");
  if (!collectionAddress)
    throw new Error("fheNftConfig.erc721mg.collectionAddress is required");
  if (!to) throw new Error("fheNftConfig.erc721mg.mint.to is required");
  if (!uri) throw new Error("fheNftConfig.erc721mg.mint.uri is required");

  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const signer = new ethers.Wallet(pk, provider);

  console.log("Minting ERC721MG giftcode with signer:", signer.address);
  console.log("Collection:", collectionAddress);
  console.log("Recipient:", to);
  if (plaintextGiftcode) {
    console.log("Giftcode (plaintext, off-chain):", plaintextGiftcode);
  }

  // CoFHE client for encrypting the AES key
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

  // Generate random AES key for each mint (16 bytes = 128 bits)
  const aesKeyBytes = crypto.getRandomValues(new Uint8Array(16));
  const aesKeyHex = Array.from(aesKeyBytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  const aesKeyBigInt = BigInt("0x" + aesKeyHex);

  console.log("Generated AES key (hex):", "0x" + aesKeyHex);

  // ACTUALLY ENCRYPT THE GIFTCODE WITH AES
  const giftcode = `MOGATE_TEST_GIFTCODE_${Date.now().toString().slice(-6)}`;
  console.log("Giftcode (plaintext):", giftcode);

  // Simple AES encryption using Web Crypto API
  const encoder = new TextEncoder();
  const giftcodeData = encoder.encode(giftcode);

  // Import AES key
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    aesKeyBytes,
    { name: "AES-GCM" },
    false,
    ["encrypt"],
  );

  // Encrypt giftcode
  const iv = crypto.getRandomValues(new Uint8Array(12)); // 96-bit IV for AES-GCM
  const encryptedGiftcode = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    cryptoKey,
    giftcodeData,
  );

  // Store encrypted giftcode and IV together
  const encryptedPayload = new Uint8Array(
    iv.length + encryptedGiftcode.byteLength,
  );
  encryptedPayload.set(iv);
  encryptedPayload.set(new Uint8Array(encryptedGiftcode), iv.length);

  // Save to local file (in production, use IPFS)
  const cipherRef = `giftcode_${Date.now()}.bin`;
  const fs = await import("fs/promises");
  await fs.writeFile(cipherRef, encryptedPayload);
  console.log("Encrypted giftcode saved to:", cipherRef);

  console.log("Encrypting AES key with CoFHE...");
  const [encKey] = await cofheClient
    .encryptInputs([Encryptable.uint128(aesKeyBigInt)])
    .execute();

  console.log("encKey type:", typeof encKey);
  console.log("encKey:", encKey);

  if (encKey.ctHash === undefined || !encKey.signature) {
    throw new Error(
      "Invalid CoFHE encrypted input: missing ctHash/signature. Ensure the wallet used for encryption is connected and signs input proofs.",
    );
  }

  // IMPORTANT: InEuint128 is (uint256 ctHash, uint8 securityZone, uint8 utype, bytes signature).
  // Do not pass the older (bytes data, int32 securityZone, ...) tuple shape.
  const encKeyForContract: InEuint128Input = {
    ctHash: BigInt(encKey.ctHash),
    securityZone: Number(encKey.securityZone ?? 0),
    utype: Number(encKey.utype ?? 6),
    signature: String(encKey.signature ?? "0x"),
  };

  console.log("encKeyForContract:", encKeyForContract);

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

  console.log("Calling mintGiftcode...");
  const tx = await collection.mintGiftcode(
    to,
    uri,
    encKeyForContract,
    cipherRef,
  );
  console.log("mintGiftcode tx:", tx.hash);
  const receipt = await tx.wait();
  console.log("Confirmed in block:", receipt.blockNumber);

  // Derive the newly minted tokenId from the ERC721 Transfer event and persist it
  const erc721Iface = new ethers.Interface([
    "event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)",
  ]);

  let mintedTokenId: bigint | null = null;
  for (const log of receipt.logs) {
    try {
      const parsed = erc721Iface.parseLog(log);
      if (
        parsed.name === "Transfer" &&
        parsed.args.from === ethers.ZeroAddress &&
        String(parsed.args.to).toLowerCase() === to.toLowerCase()
      ) {
        mintedTokenId = parsed.args.tokenId as bigint;
        break;
      }
    } catch {
      // ignore non-ERC721 logs
    }
  }

  if (mintedTokenId !== null) {
    console.log("Minted tokenId:", mintedTokenId.toString());

    // Update config with new token info
    const __dirname = path.dirname(new URL(import.meta.url).pathname);
    const configPath = path.join(__dirname, "..", "config.js");

    try {
      // Read current config
      const configContent = fs.readFileSync(configPath, "utf8");

      // Update the decrypt section with new token info
      const updatedConfig = configContent.replace(
        /decrypt: \{[\s\S]*?tokenId: \d+[\s\S]*?\}/,
        `decrypt: {\n    tokenId: ${mintedTokenId},\n    cipherRef: "${cipherRef}",\n    giftcode: "${giftcode}", // For testing only\n    aesKeyHex: "0x${aesKeyHex}" // For testing only\n  }`,
      );

      fs.writeFileSync(configPath, updatedConfig, "utf8");
      console.log("Updated config with new token info");

      // Also update the state file
      const statePath = path.join(__dirname, "..", "erc721mg_state.json");
      fs.writeFileSync(
        statePath,
        JSON.stringify({ lastTokenId: mintedTokenId.toString() }, null, 2),
        "utf8",
      );
      console.log("Updated state file:", statePath);
    } catch (err) {
      console.error("Failed to update config", err);
    }
  } else {
    console.warn(
      "Could not infer minted tokenId from logs; decrypt script will keep previous value.",
    );
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
