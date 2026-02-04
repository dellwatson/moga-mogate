import * as dotenv from "dotenv";
import * as fs from "fs";
import * as path from "path";

dotenv.config();

const CONTRACT_ADDRESS = "0xF62ED4a31D712501d3E61277A03bba7Ac34EE4db";
const ETHERSCAN_API_KEY = process.env.ETHERSCAN_API_KEY || "";

async function main() {
  if (!ETHERSCAN_API_KEY) {
    throw new Error("Missing ETHERSCAN_API_KEY in .env");
  }

  console.log(
    "Verifying Raffle contract on Polygon Amoy using Etherscan API V2",
  );
  console.log("Contract address:", CONTRACT_ADDRESS);
  console.log("API Key:", ETHERSCAN_API_KEY.substring(0, 10) + "...");

  // Read contract source
  const rafflePath = path.join(process.cwd(), "contracts/Raffle.sol");
  const raffleSource = fs.readFileSync(rafflePath, "utf8");

  // Read OpenZeppelin dependencies
  const ownablePath = path.join(
    process.cwd(),
    "node_modules/@openzeppelin/contracts/access/Ownable.sol",
  );
  const contextPath = path.join(
    process.cwd(),
    "node_modules/@openzeppelin/contracts/utils/Context.sol",
  );

  const ownableSource = fs.readFileSync(ownablePath, "utf8");
  const contextSource = fs.readFileSync(contextPath, "utf8");

  // Create standard JSON input
  const standardInput = {
    language: "Solidity",
    sources: {
      "contracts/Raffle.sol": {
        content: raffleSource,
      },
      "@openzeppelin/contracts/access/Ownable.sol": {
        content: ownableSource,
      },
      "@openzeppelin/contracts/utils/Context.sol": {
        content: contextSource,
      },
    },
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
      viaIR: true,
      outputSelection: {
        "*": {
          "*": ["evm.bytecode", "evm.deployedBytecode", "abi"],
        },
      },
    },
  };

  // Use V2 API endpoint with proper format
  const params = new URLSearchParams({
    chainId: "80002",
    module: "contract",
    action: "verifysourcecode",
    codeformat: "solidity-standard-json-input",
    sourceCode: JSON.stringify(standardInput),
    contractaddress: CONTRACT_ADDRESS,
    contractname: "contracts/Raffle.sol:Raffle",
    compilerversion: "v0.8.20+commit.a1b79de6",
    optimizationUsed: "1",
    runs: "200",
    licenseType: "3",
  });

  console.log("\nSubmitting verification request to Etherscan V2 API...");

  const verifyResponse = await fetch(
    `https://api.etherscan.io/v2/api?chainid=80002&apikey=${ETHERSCAN_API_KEY}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    },
  );

  const responseText = await verifyResponse.text();
  console.log("Raw response:", responseText);

  let verifyResult;
  try {
    verifyResult = JSON.parse(responseText);
  } catch (e) {
    console.error("Failed to parse response as JSON");
    throw new Error(`Invalid response: ${responseText}`);
  }

  console.log("Verification response:", JSON.stringify(verifyResult, null, 2));

  if (verifyResult.status === "1" || verifyResult.result) {
    const guid = verifyResult.result;
    console.log("\n✅ Verification submitted successfully!");
    console.log("GUID:", guid);
    console.log("\nWaiting 15 seconds before checking status...");

    await new Promise((resolve) => setTimeout(resolve, 15000));

    // Check status using V2 API
    const statusResponse = await fetch(
      `https://api.etherscan.io/v2/api?chainid=80002&apikey=${ETHERSCAN_API_KEY}&guid=${guid}&module=contract&action=checkverifystatus`,
    );

    const statusResult = await statusResponse.json();
    console.log("Status response:", JSON.stringify(statusResult, null, 2));

    if (
      statusResult.status === "1" ||
      statusResult.result === "Pass - Verified" ||
      (statusResult.result && statusResult.result.includes("Pass"))
    ) {
      console.log("\n✅ Contract verified successfully!");
      console.log(
        "View on explorer:",
        `https://amoy.polygonscan.com/address/${CONTRACT_ADDRESS}#code`,
      );
    } else if (statusResult.result && statusResult.result.includes("Pending")) {
      console.log("\n⏳ Verification is pending. This may take a few minutes.");
      console.log("Status:", statusResult.result);
      console.log(
        "Check status at:",
        `https://amoy.polygonscan.com/address/${CONTRACT_ADDRESS}#code`,
      );
    } else {
      console.log("\n⚠️ Verification status unclear:");
      console.log(statusResult);
      console.log(
        "\nCheck manually at:",
        `https://amoy.polygonscan.com/address/${CONTRACT_ADDRESS}#code`,
      );
    }
  } else {
    console.error("\n❌ Verification submission failed:");
    console.error(verifyResult);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\n❌ Error:");
    console.error(error);
    process.exit(1);
  });
