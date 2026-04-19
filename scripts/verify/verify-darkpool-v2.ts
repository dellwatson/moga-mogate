import fs from "node:fs";
import path from "node:path";

async function main() {
  const target = process.env.TARGET_NETWORK || "sepolia";
  const address = process.env.CONTRACT_ADDRESS;
  const apiKey = process.env.ETHERSCAN_API_KEY;

  if (!address) throw Error("CONTRACT_ADDRESS env var is required");
  if (!apiKey) throw Error("ETHERSCAN_API_KEY env var is required");

  const chainIds: Record<string, string> = {
    sepolia: "11155111",
    polygonAmoy: "80002",
    arbitrumSepolia: "421614",
  };

  const chainId = chainIds[target];
  if (!chainId) throw Error(`Unsupported target network: ${target}`);

  const apiUrl = `https://api.etherscan.io/v2/api?chainid=${chainId}`;

  console.log(
    `Verifying RaffleDarkpoolV2Relayer at ${address} on ${target} (chainId: ${chainId})...`,
  );

  const __dirname = path.dirname(new URL(import.meta.url).pathname);
  const repoRoot = path.join(__dirname, "..", "..");

  // Read contract source
  const contractPath = path.join(
    repoRoot,
    "contracts",
    "Raffle.darkpool.v2.relayer.sol",
  );
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

  // Read FHE dependencies
  const fhePath = path.join(
    repoRoot,
    "node_modules",
    "@fhenixprotocol",
    "cofhe-contracts",
    "FHE.sol",
  );
  const fheSource = fs.readFileSync(fhePath, "utf8");

  const icofhePath = path.join(
    repoRoot,
    "node_modules",
    "@fhenixprotocol",
    "cofhe-contracts",
    "ICofhe.sol",
  );
  const icofheSource = fs.readFileSync(icofhePath, "utf8");

  // Additional OpenZeppelin dependencies
  const stringsPath = path.join(
    repoRoot,
    "node_modules",
    "@openzeppelin",
    "contracts",
    "utils",
    "Strings.sol",
  );
  const stringsSource = fs.readFileSync(stringsPath, "utf8");

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
      "contracts/Raffle.darkpool.v2.relayer.sol": { content: contractSource },
      "@openzeppelin/contracts/access/Ownable.sol": { content: ownableSource },
      "@openzeppelin/contracts/utils/Context.sol": { content: contextSource },
      "@openzeppelin/contracts/utils/Strings.sol": { content: stringsSource },
      "@openzeppelin/contracts/utils/math/Math.sol": { content: mathSource },
      "@openzeppelin/contracts/utils/math/SignedMath.sol": {
        content: signedMathSource,
      },
      "@openzeppelin/contracts/utils/math/SafeCast.sol": {
        content: safeCastSource,
      },
      "@openzeppelin/contracts/utils/Panic.sol": { content: panicSource },
      "@fhenixprotocol/cofhe-contracts/FHE.sol": { content: fheSource },
      "@fhenixprotocol/cofhe-contracts/ICofhe.sol": { content: icofheSource },
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

  // Constructor arguments (initialObserver address)
  const constructorArgs =
    "0000000000000000000000000000000000000000000000000000000000000000";

  const params = new URLSearchParams({
    apikey: apiKey,
    module: "contract",
    action: "verifysourcecode",
    contractaddress: address,
    sourceCode: sourceCode,
    codeformat: "solidity-standard-json-input",
    contractname:
      "contracts/Raffle.darkpool.v2.relayer.sol:RaffleDarkpoolV2Relayer",
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
    const guid = result.result;
    console.log(`✅ Verification GUID: ${guid}`);

    // Poll for verification status
    let attempts = 0;
    const maxAttempts = 10;

    while (attempts < maxAttempts) {
      await new Promise((resolve) => setTimeout(resolve, 10000)); // Wait 10 seconds

      const statusParams = new URLSearchParams({
        apikey: apiKey,
        module: "contract",
        action: "checkverifystatus",
        guid: guid,
      });

      const statusResponse = await fetch(
        `${apiUrl}&${statusParams.toString()}`,
      );
      const statusResult = await statusResponse.json();

      console.log(`Verification status:`, statusResult);

      if (statusResult.result === "Pass - Verified") {
        console.log("🎉 Contract verified successfully!");
        return;
      } else if (statusResult.result.includes("Fail")) {
        console.log("❌ Verification failed:", statusResult.result);
        return;
      } else if (statusResult.result === "Pending in queue") {
        console.log("⏳ Verification pending: Pending in queue");
      }

      attempts++;
    }

    console.log(
      "⏰ Verification is taking longer than expected. Please check manually.",
    );
  } else {
    console.log("❌ Verification submission failed:", result);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
