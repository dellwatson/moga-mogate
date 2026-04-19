import { config as loadEnv } from "dotenv";
import { ethers } from "ethers";

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

  const pk = process.env.BACKEND_PRIVATE_KEY || process.env.PRIVATE_KEY_ETH;
  const collectionAddress = process.env.ERC721MG_ADDRESS;
  const tokenIdRaw = process.env.GIFTCODE_TOKEN_ID;

  if (!rpcUrl)
    throw new Error("RPC URL env var is required for target network");
  if (!pk)
    throw new Error("BACKEND_PRIVATE_KEY or PRIVATE_KEY_ETH is required");
  if (!collectionAddress) throw new Error("ERC721MG_ADDRESS is required");
  if (!tokenIdRaw) throw new Error("GIFTCODE_TOKEN_ID is required");

  const tokenId = BigInt(tokenIdRaw);

  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const signer = new ethers.Wallet(pk, provider);

  console.log("Backend burn for redeemed token:", tokenId.toString());
  console.log("Backend signer:", signer.address);

  const collection = new ethers.Contract(
    collectionAddress,
    ["function backendBurnRedeemed(uint256 tokenId) external"],
    signer,
  );

  const tx = await collection.backendBurnRedeemed(tokenId);
  console.log("backendBurnRedeemed tx:", tx.hash);
  const receipt = await tx.wait();
  console.log("Confirmed in block:", receipt.blockNumber);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
