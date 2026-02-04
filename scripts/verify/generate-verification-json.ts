import fs from "node:fs";
import path from "node:path";

async function main() {
  const __dirname = path.dirname(new URL(import.meta.url).pathname);
  const repoRoot = path.join(__dirname, "..", "..");

  // Read contract source
  const contractPath = path.join(repoRoot, "contracts", "Raffle.sol");
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
  const standardInput = {
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
  };

  const outputPath = path.join(repoRoot, "raffle-standard-input.json");
  fs.writeFileSync(outputPath, JSON.stringify(standardInput, null, 2));

  console.log("✅ Standard JSON input generated at:", outputPath);
  console.log("\nYou can upload this file when verifying on:");
  console.log("- Polygon Amoy: https://amoy.polygonscan.com/verifyContract");
  console.log("- Arbitrum Sepolia: https://sepolia.arbiscan.io/verifyContract");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
