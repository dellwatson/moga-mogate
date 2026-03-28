import fs from "node:fs";
import path from "node:path";

async function main() {
  const network = process.env.TARGET_NETWORK || "polygonAmoy";
  const address = process.env.CONTRACT_ADDRESS;
  const apiKey = process.env.ETHERSCAN_API_KEY;

  if (!address) throw new Error("CONTRACT_ADDRESS env var is required");
  if (!apiKey) throw new Error("ETHERSCAN_API_KEY env var is required");

  const chainIds: Record<string, string> = {
    polygonAmoy: "80002",
    arbitrumSepolia: "421614",
    sepolia: "11155111",
    polkadotTestnet: "420420417",
  };

  const chainId = chainIds[network];
  if (!chainId) throw new Error(`Unsupported network: ${network}`);

  const apiUrls: Record<string, string> = {
    polygonAmoy: "https://api-amoy.polygonscan.com/api",
    arbitrumSepolia: "https://api-sepolia.arbiscan.io/api",
    sepolia: "https://api-sepolia.etherscan.io/api",
    polkadotTestnet:
      "https://api.routescan.io/v2/network/testnet/evm/420420417/etherscan",
  };

  const apiUrl = apiUrls[network];
  if (!apiUrl) throw new Error(`Unsupported network: ${network}`);

  console.log(`Verifying AuthorityMintGateway at ${address} on ${network}...`);

  // Read contract source
  const __dirname = path.dirname(new URL(import.meta.url).pathname);
  const repoRoot = path.join(__dirname, "..", "..");
  const contractPath = path.join(
    repoRoot,
    "contracts",
    "AuthorityMintGateway.sol",
  );
  const contractSource = fs.readFileSync(contractPath, "utf8");

  // Read Ownable dependency
  const ownablePath = path.join(
    repoRoot,
    "node_modules",
    "@openzeppelin",
    "contracts",
    "access",
    "Ownable.sol",
  );
  const ownableSource = fs.readFileSync(ownablePath, "utf8");

  // Read Context dependency (required by Ownable)
  const contextPath = path.join(
    repoRoot,
    "node_modules",
    "@openzeppelin",
    "contracts",
    "utils",
    "Context.sol",
  );
  const contextSource = fs.readFileSync(contextPath, "utf8");

  // Prepare standard JSON input for verification
  const sourceCode = JSON.stringify({
    language: "Solidity",
    sources: {
      "contracts/AuthorityMintGateway.sol": { content: contractSource },
      "@openzeppelin/contracts/access/Ownable.sol": { content: ownableSource },
      "@openzeppelin/contracts/utils/Context.sol": { content: contextSource },
    },
    settings: {
      optimizer: { enabled: true, runs: 200 },
      viaIR: true,
      outputSelection: {
        "*": {
          "*": ["evm.bytecode", "evm.deployedBytecode", "abi"],
        },
      },
    },
  });

  const params = new URLSearchParams({
    apikey: apiKey,
    module: "contract",
    action: "verifysourcecode",
    contractaddress: address,
    sourceCode: sourceCode,
    codeformat: "solidity-standard-json-input",
    contractname: "contracts/AuthorityMintGateway.sol:AuthorityMintGateway",
    compilerversion: "v0.8.20+commit.a1b79de6",
    constructorArguements: "", // No constructor args
  });

  console.log("Submitting verification request...");

  const response = await fetch(apiUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });

  const result = await response.json();
  console.log("Verification submitted:", result);

  const explorerUrls: Record<string, string> = {
    polygonAmoy: "https://amoy.polygonscan.com",
    arbitrumSepolia: "https://sepolia.arbiscan.io",
    sepolia: "https://sepolia.etherscan.io",
    polkadotTestnet: "https://testnet-explorer.polkadot.io",
  };

  const explorerUrl = explorerUrls[network];

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

    const statusUrl =
      network === "polkadotTestnet"
        ? "https://api.routescan.io/v2/network/testnet/evm/420420417/etherscan"
        : `https://api.etherscan.io/v2/api?chainid=${chainId}`;
    const statusResponse = await fetch(
      `${statusUrl}&${statusParams.toString()}`,
    );
    const statusText = await statusResponse.text();
    console.log("Status response:", statusText);

    const statusResult = JSON.parse(statusText);

    if (statusResult.status === "1") {
      console.log(`\n✅ Contract verified successfully!`);
      console.log(`View at: ${explorerUrl}/address/${address}#code`);
    } else {
      console.log(`\n⏳ Verification pending: ${statusResult.result}`);
      console.log(`Check status at: ${explorerUrl}/address/${address}#code`);
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
