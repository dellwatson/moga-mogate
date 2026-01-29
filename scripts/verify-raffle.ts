import fs from "node:fs";
import path from "node:path";

async function main() {
  const network = process.env.TARGET_NETWORK || "polygonAmoy";
  const address = process.env.CONTRACT_ADDRESS;
  const apiKey = process.env.ETHERSCAN_API_KEY;

  if (!address) throw new Error("CONTRACT_ADDRESS env var is required");
  if (!apiKey) throw new Error("ETHERSCAN_API_KEY env var is required");

  const apiUrls: Record<string, string> = {
    polygonAmoy: "https://api-amoy.polygonscan.com/api",
    arbitrumSepolia: "https://api-sepolia.arbiscan.io/api",
    sepolia: "https://api-sepolia.etherscan.io/api",
  };

  const apiUrl = apiUrls[network];
  if (!apiUrl) throw new Error(`Unsupported network: ${network}`);

  console.log(`Verifying Raffle at ${address} on ${network}...`);

  // Read contract source
  const __dirname = path.dirname(new URL(import.meta.url).pathname);
  const contractPath = path.join(__dirname, "..", "contracts", "Raffle.sol");
  const contractSource = fs.readFileSync(contractPath, "utf8");

  // Read Ownable dependency
  const ownablePath = path.join(
    __dirname,
    "..",
    "node_modules",
    "@openzeppelin",
    "contracts",
    "access",
    "Ownable.sol",
  );
  const ownableSource = fs.readFileSync(ownablePath, "utf8");

  // Read Context dependency (required by Ownable)
  const contextPath = path.join(
    __dirname,
    "..",
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
      "contracts/Raffle.sol": { content: contractSource },
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
    contractname: "contracts/Raffle.sol:Raffle",
    compilerversion: "v0.8.20+commit.a1b79de6",
    constructorArguements: "", // No constructor args
  });

  const response = await fetch(apiUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });

  const result = await response.json();
  console.log("Verification submitted:", result);

  if (result.status === "1") {
    console.log(`✅ Verification GUID: ${result.result}`);
    console.log(
      `Check status at: ${apiUrl}?module=contract&action=checkverifystatus&guid=${result.result}`,
    );
  } else {
    console.error("❌ Verification failed:", result.result);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
