import fs from "node:fs";
import path from "node:path";

async function main() {
  const network = process.env.TARGET_NETWORK || "sepolia";
  const address = process.env.CONTRACT_ADDRESS;
  const apiKey = process.env.ETHERSCAN_API_KEY;

  if (!address) throw new Error("CONTRACT_ADDRESS env var is required");
  if (!apiKey) throw new Error("ETHERSCAN_API_KEY env var is required");

  const chainIds: Record<string, string> = {
    polygonAmoy: "80002",
    arbitrumSepolia: "421614",
    sepolia: "11155111",
  };

  const chainId = chainIds[network];
  if (!chainId) throw new Error(`Unsupported network: ${network}`);

  const apiUrl = `https://api.etherscan.io/v2/api?chainid=${chainId}`;

  console.log(
    `Verifying RaffleWithVaultV1 at ${address} on ${network} (chainId: ${chainId})...`,
  );

  // Read contract source
  const __dirname = path.dirname(new URL(import.meta.url).pathname);
  const repoRoot = path.join(__dirname, "..", "..");
  const contractPath = path.join(repoRoot, "contracts", "Raffle.vault.v1.sol");
  const contractSource = fs.readFileSync(contractPath, "utf8");

  // Read OpenZeppelin dependencies
  const ownablePath = path.join(
    repoRoot,
    "node_modules",
    "@openzeppelin",
    "contracts",
    "access",
    "Ownable.sol",
  );
  const ownableSource = fs.readFileSync(ownablePath, "utf8");

  const contextPath = path.join(
    repoRoot,
    "node_modules",
    "@openzeppelin",
    "contracts",
    "utils",
    "Context.sol",
  );
  const contextSource = fs.readFileSync(contextPath, "utf8");

  const eip712Path = path.join(
    repoRoot,
    "node_modules",
    "@openzeppelin",
    "contracts",
    "utils",
    "cryptography",
    "EIP712.sol",
  );
  const eip712Source = fs.readFileSync(eip712Path, "utf8");

  const ecdsaPath = path.join(
    repoRoot,
    "node_modules",
    "@openzeppelin",
    "contracts",
    "utils",
    "cryptography",
    "ECDSA.sol",
  );
  const ecdsaSource = fs.readFileSync(ecdsaPath, "utf8");

  const messageHashUtilsPath = path.join(
    repoRoot,
    "node_modules",
    "@openzeppelin",
    "contracts",
    "utils",
    "cryptography",
    "MessageHashUtils.sol",
  );
  const messageHashUtilsSource = fs.readFileSync(messageHashUtilsPath, "utf8");

  const mathPath = path.join(
    repoRoot,
    "node_modules",
    "@openzeppelin",
    "contracts",
    "utils",
    "math",
    "Math.sol",
  );
  const mathSource = fs.readFileSync(mathPath, "utf8");

  const signedMathPath = path.join(
    repoRoot,
    "node_modules",
    "@openzeppelin",
    "contracts",
    "utils",
    "math",
    "SignedMath.sol",
  );
  const signedMathSource = fs.readFileSync(signedMathPath, "utf8");

  const stringsPath = path.join(
    repoRoot,
    "node_modules",
    "@openzeppelin",
    "contracts",
    "utils",
    "Strings.sol",
  );
  const stringsSource = fs.readFileSync(stringsPath, "utf8");

  const shortStringsPath = path.join(
    repoRoot,
    "node_modules",
    "@openzeppelin",
    "contracts",
    "utils",
    "ShortStrings.sol",
  );
  const shortStringsSource = fs.readFileSync(shortStringsPath, "utf8");

  const storageSlotPath = path.join(
    repoRoot,
    "node_modules",
    "@openzeppelin",
    "contracts",
    "utils",
    "StorageSlot.sol",
  );
  const storageSlotSource = fs.readFileSync(storageSlotPath, "utf8");

  const safeCastPath = path.join(
    repoRoot,
    "node_modules",
    "@openzeppelin",
    "contracts",
    "utils",
    "math",
    "SafeCast.sol",
  );
  const safeCastSource = fs.readFileSync(safeCastPath, "utf8");

  const ierc5267Path = path.join(
    repoRoot,
    "node_modules",
    "@openzeppelin",
    "contracts",
    "interfaces",
    "IERC5267.sol",
  );
  const ierc5267Source = fs.readFileSync(ierc5267Path, "utf8");

  const panicPath = path.join(
    repoRoot,
    "node_modules",
    "@openzeppelin",
    "contracts",
    "utils",
    "Panic.sol",
  );
  const panicSource = fs.readFileSync(panicPath, "utf8");

  // Prepare standard JSON input for verification
  const sourceCode = JSON.stringify({
    language: "Solidity",
    sources: {
      "contracts/Raffle.vault.v1.sol": { content: contractSource },
      "@openzeppelin/contracts/access/Ownable.sol": {
        content: ownableSource,
      },
      "@openzeppelin/contracts/utils/Context.sol": { content: contextSource },
      "@openzeppelin/contracts/utils/cryptography/EIP712.sol": {
        content: eip712Source,
      },
      "@openzeppelin/contracts/utils/cryptography/ECDSA.sol": {
        content: ecdsaSource,
      },
      "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol": {
        content: messageHashUtilsSource,
      },
      "@openzeppelin/contracts/utils/math/Math.sol": { content: mathSource },
      "@openzeppelin/contracts/utils/math/SignedMath.sol": {
        content: signedMathSource,
      },
      "@openzeppelin/contracts/utils/math/SafeCast.sol": {
        content: safeCastSource,
      },
      "@openzeppelin/contracts/utils/Strings.sol": { content: stringsSource },
      "@openzeppelin/contracts/utils/ShortStrings.sol": {
        content: shortStringsSource,
      },
      "@openzeppelin/contracts/utils/StorageSlot.sol": {
        content: storageSlotSource,
      },
      "@openzeppelin/contracts/interfaces/IERC5267.sol": {
        content: ierc5267Source,
      },
      "@openzeppelin/contracts/utils/Panic.sol": { content: panicSource },
    },
    settings: {
      optimizer: { enabled: true, runs: 200 },
      viaIR: true,
      evmVersion: "cancun",
      outputSelection: {
        "*": {
          "*": ["evm.bytecode", "evm.deployedBytecode", "abi"],
        },
      },
    },
  });

  // No constructor arguments for RaffleWithVaultV1
  const constructorArgs = "";

  const params = new URLSearchParams({
    apikey: apiKey,
    module: "contract",
    action: "verifysourcecode",
    contractaddress: address,
    sourceCode: sourceCode,
    codeformat: "solidity-standard-json-input",
    contractname: "contracts/Raffle.vault.v1.sol:RaffleWithVaultV1",
    compilerversion: "v0.8.25+commit.b61c2a91",
    constructorArguements: constructorArgs,
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

    // Wait and check status
    await new Promise((resolve) => setTimeout(resolve, 5000));

    const statusParams = new URLSearchParams({
      apikey: apiKey,
      module: "contract",
      action: "checkverifystatus",
      guid: result.result,
    });

    const statusUrl = `https://api.etherscan.io/v2/api?chainid=${chainId}`;
    const statusResponse = await fetch(
      `${statusUrl}&${statusParams.toString()}`,
    );
    const statusResult = await statusResponse.json();
    console.log("Verification status:", statusResult);

    if (statusResult.status === "1") {
      console.log(`✅ Contract verified successfully!`);
      const explorerUrls: Record<string, string> = {
        sepolia: "https://sepolia.etherscan.io",
        polygonAmoy: "https://amoy.polygonscan.com",
        arbitrumSepolia: "https://sepolia.arbiscan.io",
      };
      console.log(`View at: ${explorerUrls[network]}/address/${address}#code`);
    } else {
      console.log(`⏳ Verification pending: ${statusResult.result}`);
    }
  } else {
    console.error("❌ Verification failed:", result.result);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
