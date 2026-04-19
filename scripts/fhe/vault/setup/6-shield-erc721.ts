import { ethers } from "ethers";
import * as dotenv from "dotenv";

dotenv.config();

async function main() {
  const target = process.env.TARGET_NETWORK || "sepolia";

  const vaultAddress = process.env.VAULT_ADDRESS;
  const collectionAddress = process.env.COLLECTION_ADDRESS;
  const tokenIdRaw = process.env.TOKEN_ID;

  if (!vaultAddress) throw new Error("VAULT_ADDRESS env var is required");
  if (!collectionAddress) throw new Error("COLLECTION_ADDRESS env var is required");
  if (!tokenIdRaw) throw new Error("TOKEN_ID env var is required");

  const tokenId = BigInt(tokenIdRaw);

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

  const pk =
    process.env.PRIVATE_KEY_ETH ||
    process.env.SEPOLIA_PRIVATE_KEY ||
    process.env.PRIVATE_KEY_ETH_2;

  if (!rpcUrl) throw new Error("RPC URL env var is required for target network");
  if (!pk) throw new Error("PRIVATE_KEY_ETH / PRIVATE_KEY_ETH_2 or SEPOLIA_PRIVATE_KEY is required");

  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const signer = new ethers.Wallet(pk, provider);

  const encOwnerHex = process.env.ENC_OWNER_HEX || "";
  const data = encOwnerHex ? ethers.getBytes(encOwnerHex) : new Uint8Array();

  console.log("Signer:", signer.address);
  console.log("Vault:", vaultAddress);
  console.log("Collection:", collectionAddress);
  console.log("TokenId:", tokenId.toString());
  console.log("Has ENC_OWNER_HEX:", !!encOwnerHex);

  const nft = new ethers.Contract(
    collectionAddress,
    [
      "function safeTransferFrom(address from, address to, uint256 tokenId, bytes data) external",
    ],
    signer,
  );

  const tx = await nft.safeTransferFrom(signer.address, vaultAddress, tokenId, data);
  console.log("Tx:", tx.hash);
  const receipt = await tx.wait();
  console.log("Confirmed in block:", receipt.blockNumber);

  // Optional dev helper: if no encrypted owner provided, finalize with a plaintext owner.
  const plaintextOwner = process.env.UNSAFE_PLAINTEXT_OWNER || "";
  if (!encOwnerHex && plaintextOwner) {
    const vault = new ethers.Contract(
      vaultAddress,
      [
        "function unsafeFinalizeReceivedERC721(address collection, uint256 tokenId, address plaintextOwner) external",
      ],
      signer,
    );
    const tx2 = await vault.unsafeFinalizeReceivedERC721(collectionAddress, tokenId, plaintextOwner);
    console.log("Unsafe finalize tx:", tx2.hash);
    const receipt2 = await tx2.wait();
    console.log("Unsafe finalize confirmed in block:", receipt2.blockNumber);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

