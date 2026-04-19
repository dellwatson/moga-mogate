import { config as loadEnv } from "dotenv";
import { createPublicClient, http } from "viem";
import { sepolia } from "viem/chains";
import {
  createCofheConfig,
  createCofheClient,
  Encryptable,
} from "@cofhe/sdk/node";
import { chains } from "@cofhe/sdk/chains";
import { ethers } from "ethers";

loadEnv();

async function main() {
  const target = process.env.TARGET_NETWORK || "sepolia";
  if (target !== "sepolia") {
    console.warn(
      "[warn] This script currently assumes Sepolia for FHE config.",
    );
  }

  const rpcUrl = process.env.SEPOLIA_RPC_URL;
  if (!rpcUrl) throw new Error("Missing SEPOLIA_RPC_URL in .env");

  const ownerAddress = process.env.OWNER_ADDRESS;
  if (!ownerAddress)
    throw new Error("Set OWNER_ADDRESS (the wallet to encrypt) in .env");

  const publicClient = createPublicClient({
    chain: sepolia,
    transport: http(rpcUrl),
  });

  const cofheConfig = createCofheConfig({
    supportedChains: [chains.sepolia],
  });
  const cofheClient = createCofheClient(cofheConfig);

  // Node script has no wallet connection requirement for pure encryption.
  // We only create a stateless client to perform encryptInputs.
  await cofheClient.connect(publicClient, null as any);

  console.log("Encrypting address for vault:", ownerAddress);

  const [encrypted] = await cofheClient
    .encryptInputs([Encryptable.address(ownerAddress)])
    .execute();

  // `encrypted` is an InEaddress struct. Encode it as bytes so it can be passed
  // to Vault.erc721 via `data` or `encryptedNewOwner`.
  const abiCoder = ethers.AbiCoder.defaultAbiCoder();
  const encoded = abiCoder.encode(
    ["tuple(uint256 ctHash,uint8 securityZone,uint8 utype,bytes signature)"],
    [encrypted as any],
  );

  console.log("ENC_OWNER_HEX=", encoded);
  console.log(
    "Use this value as ENC_OWNER_HEX or ENC_NEW_OWNER_HEX in the existing vault scripts.",
  );
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
