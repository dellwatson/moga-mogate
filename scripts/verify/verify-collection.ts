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
  };

  const chainId = chainIds[network];
  if (!chainId) throw new Error(`Unsupported network: ${network}`);

  const apiUrl = `https://api.etherscan.io/v2/api?chainid=${chainId}`;

  console.log(`Verifying Collection at ${address} on ${network}...`);

  // Read contract source
  const __dirname = path.dirname(new URL(import.meta.url).pathname);
  const repoRoot = path.join(__dirname, "..", "..");
  const contractPath = path.join(
    repoRoot,
    "contracts",
    "Collection.sol",
  );
  const contractSource = fs.readFileSync(contractPath, "utf8");

  // Read ERC721URIStorage dependency
  const erc721URIStoragePath = path.join(
    repoRoot,
    "node_modules",
    "@openzeppelin",
    "contracts",
    "token",
    "ERC721",
    "extensions",
    "ERC721URIStorage.sol",
  );
  const erc721URIStorageSource = fs.readFileSync(erc721URIStoragePath, "utf8");

  // Read ERC721 dependency
  const erc721Path = path.join(
    repoRoot,
    "node_modules",
    "@openzeppelin",
    "contracts",
    "token",
    "ERC721",
    "ERC721.sol",
  );
  const erc721Source = fs.readFileSync(erc721Path, "utf8");

  // Read IERC721Metadata dependency
  const ierc721MetadataPath = path.join(
    repoRoot,
    "node_modules",
    "@openzeppelin",
    "contracts",
    "token",
    "ERC721",
    "extensions",
    "IERC721Metadata.sol",
  );
  const ierc721MetadataSource = fs.readFileSync(ierc721MetadataPath, "utf8");

  // Read IERC721 dependency
  const ierc721Path = path.join(
    repoRoot,
    "node_modules",
    "@openzeppelin",
    "contracts",
    "token",
    "ERC721",
    "IERC721.sol",
  );
  const ierc721Source = fs.readFileSync(ierc721Path, "utf8");

  // Read IERC165 dependency
  const ierc165Path = path.join(
    repoRoot,
    "node_modules",
    "@openzeppelin",
    "contracts",
    "utils",
    "introspection",
    "IERC165.sol",
  );
  const ierc165Source = fs.readFileSync(ierc165Path, "utf8");

  // Read ERC165 dependency
  const erc165Path = path.join(
    repoRoot,
    "node_modules",
    "@openzeppelin",
    "contracts",
    "utils",
    "introspection",
    "ERC165.sol",
  );
  const erc165Source = fs.readFileSync(erc165Path, "utf8");

  // Read IERC721Receiver dependency
  const ierc721ReceiverPath = path.join(
    repoRoot,
    "node_modules",
    "@openzeppelin",
    "contracts",
    "token",
    "ERC721",
    "IERC721Receiver.sol",
  );
  const ierc721ReceiverSource = fs.readFileSync(ierc721ReceiverPath, "utf8");

  // Read ERC721Utils dependency
  const erc721UtilsPath = path.join(
    repoRoot,
    "node_modules",
    "@openzeppelin",
    "contracts",
    "token",
    "ERC721",
    "utils",
    "ERC721Utils.sol",
  );
  const erc721UtilsSource = fs.readFileSync(erc721UtilsPath, "utf8");

  // Read draft-IERC6093 dependency
  const ierc6093Path = path.join(
    repoRoot,
    "node_modules",
    "@openzeppelin",
    "contracts",
    "interfaces",
    "draft-IERC6093.sol",
  );
  const ierc6093Source = fs.readFileSync(ierc6093Path, "utf8");

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

  // Read Strings dependency
  const stringsPath = path.join(
    repoRoot,
    "node_modules",
    "@openzeppelin",
    "contracts",
    "utils",
    "Strings.sol",
  );
  const stringsSource = fs.readFileSync(stringsPath, "utf8");

  // Read Math dependency
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

  // Read SignedMath dependency
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

  // Prepare standard JSON input for verification
  const sourceCode = JSON.stringify({
    language: "Solidity",
    sources: {
      "contracts/Collection.sol": { content: contractSource },
      "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol": {
        content: erc721URIStorageSource,
      },
      "@openzeppelin/contracts/token/ERC721/ERC721.sol": {
        content: erc721Source,
      },
      "@openzeppelin/contracts/token/ERC721/extensions/IERC721Metadata.sol": {
        content: ierc721MetadataSource,
      },
      "@openzeppelin/contracts/token/ERC721/IERC721.sol": {
        content: ierc721Source,
      },
      "@openzeppelin/contracts/utils/introspection/IERC165.sol": {
        content: ierc165Source,
      },
      "@openzeppelin/contracts/utils/introspection/ERC165.sol": {
        content: erc165Source,
      },
      "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol": {
        content: ierc721ReceiverSource,
      },
      "@openzeppelin/contracts/token/ERC721/utils/ERC721Utils.sol": {
        content: erc721UtilsSource,
      },
      "@openzeppelin/contracts/interfaces/draft-IERC6093.sol": {
        content: ierc6093Source,
      },
      "@openzeppelin/contracts/access/Ownable.sol": { content: ownableSource },
      "@openzeppelin/contracts/utils/Context.sol": { content: contextSource },
      "@openzeppelin/contracts/utils/Strings.sol": { content: stringsSource },
      "@openzeppelin/contracts/utils/math/Math.sol": { content: mathSource },
      "@openzeppelin/contracts/utils/math/SignedMath.sol": {
        content: signedMathSource,
      },
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

  // Constructor arguments: name and symbol
  // From lisk-amoy.md, we need to check what was deployed
  // For now, we'll leave it empty and let the user provide if needed
  const constructorArgs = process.env.CONSTRUCTOR_ARGS || "";

  const params = new URLSearchParams({
    apikey: apiKey,
    module: "contract",
    action: "verifysourcecode",
    contractaddress: address,
    sourceCode: sourceCode,
    codeformat: "solidity-standard-json-input",
    contractname: "contracts/Collection.sol:Collection",
    compilerversion: "v0.8.20+commit.a1b79de6",
    constructorArguements: constructorArgs,
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

    const statusUrl = `https://api.etherscan.io/v2/api?chainid=${chainId}`;
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
