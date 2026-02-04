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

  console.log("Verifying Raffle contract on Polygon Amoy");
  console.log("Contract address:", CONTRACT_ADDRESS);

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

  // Prepare verification request
  const params = new URLSearchParams({
    apikey: ETHERSCAN_API_KEY,
    module: "contract",
    action: "verifysourcecode",
    contractaddress: CONTRACT_ADDRESS,
    sourceCode: JSON.stringify(standardInput),
    codeformat: "solidity-standard-json-input",
    contractname: "contracts/Raffle.sol:Raffle",
    compilerversion: "v0.8.20+commit.a1b79de6",
    optimizationUsed: "1",
    runs: "200",
    licenseType: "3", // MIT
  });

  console.log("\nSubmitting verification request...");

  const verifyResponse = await fetch("https://api-amoy.polygonscan.com/api", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params.toString(),
  });

  const responseText = await verifyResponse.text();
  console.log("Raw response:", responseText);

  let verifyResult;
  try {
    verifyResult = JSON.parse(responseText);
  } catch (e) {
    console.error("Failed to parse response as JSON");
    throw new Error(`Invalid response: ${responseText}`);
  }

  console.log("Verification response:", verifyResult);

  if (verifyResult.status === "1" || verifyResult.result) {
    const guid = verifyResult.result;
    console.log("\n✅ Verification submitted successfully!");
    console.log("GUID:", guid);
    console.log("\nChecking verification status...");

    // Wait and check status
    await new Promise((resolve) => setTimeout(resolve, 10000));

    const statusParams = new URLSearchParams({
      apikey: ETHERSCAN_API_KEY,
      module: "contract",
      action: "checkverifystatus",
      guid: guid,
    });

    const statusResponse = await fetch(
      `https://api-amoy.polygonscan.com/api?${statusParams.toString()}`,
    );

    const statusResult = await statusResponse.json();
    console.log("Status:", statusResult);

    if (
      statusResult.status === "1" ||
      statusResult.result === "Pass - Verified"
    ) {
      console.log("\n✅ Contract verified successfully!");
      console.log(
        "View on explorer:",
        `https://amoy.polygonscan.com/address/${CONTRACT_ADDRESS}#code`,
      );
    } else {
      console.log("\n⏳ Verification pending. Check status at:");
      console.log(
        `https://amoy.polygonscan.com/address/${CONTRACT_ADDRESS}#code`,
      );
      console.log("\nStatus result:", statusResult.result);
    }
  } else {
    console.error("\n❌ Verification failed:");
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
