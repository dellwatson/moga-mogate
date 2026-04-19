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
  const aesKeyHex = process.env.GIFTCODE_AES_KEY_HEX;
  const cipherRef = process.env.GIFTCODE_CIPHER_REF || "";

  if (!rpcUrl)
    throw new Error("RPC URL env var is required for target network");
  if (!pk)
    throw new Error("PRIVATE_KEY_ETH or PRIVATE_KEY_ETH_2 env var is required");
  if (!collectionAddress) throw new Error("ERC721MG_ADDRESS is required");
  if (!to) throw new Error("GIFTCODE_TO is required");
  if (!uri) throw new Error("GIFTCODE_URI is required");
  if (!aesKeyHex) throw new Error("GIFTCODE_AES_KEY_HEX is required");

  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const signer = new ethers.Wallet(pk, provider);

  console.log("Minting ERC721MG giftcode with signer:", signer.address);
  console.log("Collection:", collectionAddress);
  console.log("Recipient:", to);

  // CoFHE client for encrypting the AES key
  const publicClient = createPublicClient({
    chain: sepolia,
    transport: http(rpcUrl),
  });

  const cofheConfig = createCofheConfig({
    supportedChains: [chains.sepolia],
  });
  const cofheClient = createCofheClient(cofheConfig);

  await cofheClient.connect(publicClient, null as any);

  const normalizedKey = aesKeyHex.startsWith("0x")
    ? aesKeyHex
    : `0x${aesKeyHex}`;
  const aesKeyBigInt = BigInt(normalizedKey);

  console.log("Encrypting AES key with CoFHE...");
  const [encKey] = await cofheClient
    .encryptInputs([Encryptable.uint128(aesKeyBigInt)])
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

  console.log("Calling mintGiftcode...");
  const tx = await collection.mintGiftcode(to, uri, encKey as any, cipherRef);
  console.log("mintGiftcode tx:", tx.hash);
  const receipt = await tx.wait();
  console.log("Confirmed in block:", receipt.blockNumber);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
