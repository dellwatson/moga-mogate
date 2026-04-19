import { ethers } from "ethers";
import { fheNftConfig } from "../config.js";

async function main() {
  const { network, erc721mg } = fheNftConfig;

  const rpcUrl = network.rpcUrls[network.target];
  const pk = network.backendPrivateKey;

  const collectionAddress = erc721mg.collectionAddress;
  const tokenId = erc721mg.decrypt.tokenId;

  if (!rpcUrl)
    throw new Error("RPC URL env var is required for target network");
  if (!pk)
    throw new Error("BACKEND_PRIVATE_KEY or PRIVATE_KEY_ETH is required");
  if (!collectionAddress) throw new Error("ERC721MG_ADDRESS is required");

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
