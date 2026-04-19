import { ethers } from "ethers";
import fs from "node:fs";

async function main() {
  const network = process.env.TARGET_NETWORK || "sepolia";
  const address = process.env.CONTRACT_ADDRESS;
  const apiKey = process.env.ETHERSCAN_API_KEY;

  if (!address) throw new Error("CONTRACT_ADDRESS env var is required");
  if (!apiKey) throw new Error("ETHERSCAN_API_KEY env var is required");

  console.log(`Verifying ERC721MG at ${address} on ${network}...`);

  // Read the pre-built verification input from Hardhat
  const sourceCode = fs.readFileSync("/tmp/erc721mg-verify-fixed.json", "utf8");

  // Constructor arguments: name and symbol (encoded)
  const name = process.env.ERC721MG_NAME || "Mogate Giftcode";
  const symbol = process.env.ERC721MG_SYMBOL || "MGC";

  // Encode constructor arguments
  const constructorArgs = ethers.AbiCoder.defaultAbiCoder()
    .encode(["string", "string"], [name, symbol])
    .slice(2); // Remove 0x prefix

  const params = new URLSearchParams({
    apikey: apiKey,
    module: "contract",
    action: "verifysourcecode",
    contractaddress: address,
    sourceCode: sourceCode,
    codeformat: "solidity-standard-json-input",
    contractname: "contracts/ERC721MG.sol:ERC721MG",
    compilerversion: "v0.8.25+commit.b61c2a91",
    constructorArguements: constructorArgs,
  });

  console.log("Submitting verification request...");

  const response = await fetch(
    network === "sepolia"
      ? `https://api.etherscan.io/v2/api?chainid=11155111&apikey=${apiKey}`
      : `https://api-sepolia.etherscan.io/api`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString(),
    },
  );

  const result = await response.json();
  console.log("Verification submitted:", result);

  if (result.status === "1") {
    console.log(`✅ Verification GUID: ${result.result}`);
    console.log(`\nChecking verification status...`);

    // Wait a bit then check status
    await new Promise((resolve) => setTimeout(resolve, 5000));

    const statusParams = new URLSearchParams({
      apikey: apiKey,
      module: "contract",
      action: "checkverifystatus",
      guid: result.result,
    });

    const statusResponse = await fetch(
      `https://api.etherscan.io/v2/api?chainid=11155111&${statusParams.toString()}`,
    );
    const statusText = await statusResponse.text();
    console.log("Status response:", statusText);

    const statusResult = JSON.parse(statusText);

    if (statusResult.status === "1") {
      console.log(`\n✅ Contract verified successfully!`);
      console.log(
        `View at: https://sepolia.etherscan.io/address/${address}#code`,
      );
    } else {
      console.log(`\n⏳ Verification pending: ${statusResult.result}`);
      console.log(
        `Check status at: https://sepolia.etherscan.io/address/${address}#code`,
      );
    }
  } else {
    console.error("❌ Verification failed:", result.result);
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
