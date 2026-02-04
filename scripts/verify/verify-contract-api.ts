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

  console.log(
    `Verifying Raffle at ${address} on ${network} (chainId: ${chainId})...`,
  );

  // Read standard JSON input
  const __dirname = path.dirname(new URL(import.meta.url).pathname);
  const jsonPath = path.join(__dirname, "..", "..", "raffle-standard-input.json");
  const standardInput = fs.readFileSync(jsonPath, "utf8");

  const params = new URLSearchParams({
    apikey: apiKey,
    module: "contract",
    action: "verifysourcecode",
    contractaddress: address,
    sourceCode: standardInput,
    codeformat: "solidity-standard-json-input",
    contractname: "contracts/Raffle.sol:Raffle",
    compilerversion: "v0.8.20+commit.a1b79de6",
    constructorArguements: "",
  });

  console.log("Submitting verification request...");

  const response = await fetch(apiUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });

  const responseText = await response.text();
  console.log("Raw API Response:", responseText);

  let result;
  try {
    result = JSON.parse(responseText);
  } catch (e) {
    console.error("Failed to parse JSON response");
    throw new Error(`API returned non-JSON: ${responseText.substring(0, 500)}`);
  }
  console.log("Parsed Response:", result);

  const explorerUrls: Record<string, string> = {
    polygonAmoy: "https://amoy.polygonscan.com",
    arbitrumSepolia: "https://sepolia.arbiscan.io",
    sepolia: "https://sepolia.etherscan.io",
  };

  const explorerUrl = explorerUrls[network];

  if (result.status === "1") {
    console.log(`✅ Verification submitted! GUID: ${result.result}`);
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
