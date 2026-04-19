import { ethers } from "ethers";
import * as dotenv from "dotenv";

dotenv.config();

async function main() {
  const target = process.env.TARGET_NETWORK || "sepolia";

  const vaultAddress = process.env.VAULT_ADDRESS;
  const collectionAddress = process.env.COLLECTION_ADDRESS;
  const tokenIdRaw = process.env.TOKEN_ID;
  const to = process.env.UNSHIELD_TO;

  if (!vaultAddress) throw new Error("VAULT_ADDRESS env var is required");
  if (!collectionAddress) throw new Error("COLLECTION_ADDRESS env var is required");
  if (!tokenIdRaw) throw new Error("TOKEN_ID env var is required");
  if (!to) throw new Error("UNSHIELD_TO env var is required");

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

  console.log("Signer (must be executor):", signer.address);
  console.log("Vault:", vaultAddress);
  console.log("Collection:", collectionAddress);
  console.log("TokenId:", tokenId.toString());
  console.log("To:", to);

  const vault = new ethers.Contract(
    vaultAddress,
    ["function executeUnshieldERC721(address collection, uint256 tokenId, address to) external"],
    signer,
  );

  const tx = await vault.executeUnshieldERC721(collectionAddress, tokenId, to);
  console.log("Tx:", tx.hash);
  const receipt = await tx.wait();
  console.log("Confirmed in block:", receipt.blockNumber);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

