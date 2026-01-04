const { CasperClient } = require("casper-js-sdk");
const { execSync } = require("child_process");
const fs = require("fs");

const NODE_URL = "http://65.109.83.79:7777";
const PUBLIC_CEP95_DEPLOY =
  "f076c460dc1132fd5150c1c91e8291c9de18c9ce8fe03322aaaf26d3c0d6a136";
const AUTHORITY_MINT_DEPLOY =
  "bee140f4675f8fe6cba9ffcd1fef3ff4e3a07b5d6001acd747009cc7d21af965";

async function checkDeployAndExtractHash(deployHash, contractName) {
  console.log(`\n🔍 Checking ${contractName}...`);
  console.log(`Deploy: ${deployHash}`);

  const client = new CasperClient(NODE_URL);

  try {
    const result = await client.getDeploy(deployHash);

    if (
      !result[1] ||
      !result[1].execution_results ||
      !result[1].execution_results[0]
    ) {
      console.log(`⏳ ${contractName} still pending...`);
      return null;
    }

    const executionResult = result[1].execution_results[0].result;

    if (executionResult.Success) {
      console.log(`✅ ${contractName} deployed successfully!`);

      // Extract contract hash from named keys
      const namedKeys = executionResult.Success.effect.transforms;
      let contractHash = null;

      for (const transform of namedKeys) {
        if (transform.transform && transform.transform.WriteContract) {
          const contractPackageHash = transform.key;
          console.log(`Contract package: ${contractPackageHash}`);
        }
        if (transform.transform && transform.transform.WriteCLValue) {
          const clValue = transform.transform.WriteCLValue;
          if (clValue.parsed && clValue.parsed.startsWith("contract-")) {
            contractHash = clValue.parsed.replace("contract-", "hash-");
            console.log(`Contract hash: ${contractHash}`);
          }
        }
      }

      // Alternative: extract from account named keys
      if (!contractHash) {
        const accountInfo = result[0].deploy.session;
        console.log("Checking account info for contract hash...");

        // Try to get contract hash from state root hash
        const stateRootHash = result[1].header.state_root_hash;
        console.log(`State root: ${stateRootHash}`);

        // For now, we'll need to query the account to get named keys
        // This is a simplified approach - you may need to adjust based on actual response
      }

      return contractHash;
    } else if (executionResult.Failure) {
      console.log(
        `❌ ${contractName} FAILED:`,
        executionResult.Failure.error_message
      );
      return "FAILED";
    }
  } catch (error) {
    console.log(`⚠️  Error checking ${contractName}:`, error.message);
    return null;
  }
}

async function main() {
  console.log(
    "🚀 Checking deployment status and extracting contract hashes...\n"
  );

  const publicCep95Hash = await checkDeployAndExtractHash(
    PUBLIC_CEP95_DEPLOY,
    "PUBLIC CEP-95"
  );
  const authorityMintHash = await checkDeployAndExtractHash(
    AUTHORITY_MINT_DEPLOY,
    "Authority Mint"
  );

  console.log("\n" + "=".repeat(60));
  console.log("📊 DEPLOYMENT STATUS");
  console.log("=".repeat(60));

  const status = {
    timestamp: new Date().toISOString(),
    publicCep95: {
      deployHash: PUBLIC_CEP95_DEPLOY,
      contractHash: publicCep95Hash || "PENDING",
      status:
        publicCep95Hash === "FAILED"
          ? "FAILED"
          : publicCep95Hash
          ? "SUCCESS"
          : "PENDING",
      explorerLink: `https://testnet.cspr.live/deploy/${PUBLIC_CEP95_DEPLOY}`,
    },
    authorityMint: {
      deployHash: AUTHORITY_MINT_DEPLOY,
      contractHash: authorityMintHash || "PENDING",
      status:
        authorityMintHash === "FAILED"
          ? "FAILED"
          : authorityMintHash
          ? "SUCCESS"
          : "PENDING",
      explorerLink: `https://testnet.cspr.live/deploy/${AUTHORITY_MINT_DEPLOY}`,
    },
  };

  console.log("\nPUBLIC CEP-95:");
  console.log(`  Status: ${status.publicCep95.status}`);
  console.log(`  Hash: ${status.publicCep95.contractHash}`);

  console.log("\nAuthority Mint:");
  console.log(`  Status: ${status.authorityMint.status}`);
  console.log(`  Hash: ${status.authorityMint.contractHash}`);

  // Save status
  fs.writeFileSync(
    "deployment-casper/CONTRACT-HASHES.json",
    JSON.stringify(status, null, 2)
  );
  console.log("\n📁 Status saved to deployment-casper/CONTRACT-HASHES.json");

  // If both are ready, update the mint scripts
  if (
    publicCep95Hash &&
    publicCep95Hash !== "FAILED" &&
    authorityMintHash &&
    authorityMintHash !== "FAILED"
  ) {
    console.log("\n" + "=".repeat(60));
    console.log("✅ BOTH CONTRACTS DEPLOYED! Updating mint scripts...");
    console.log("=".repeat(60));

    // Update direct mint script
    let directMintScript = fs.readFileSync(
      "scripts/casper/FINAL-direct-mint-PUBLIC-cep95.js",
      "utf8"
    );
    directMintScript = directMintScript.replace(
      /const PUBLIC_CEP95_HASH = "[^"]+"/,
      `const PUBLIC_CEP95_HASH = "${publicCep95Hash}"`
    );
    fs.writeFileSync(
      "scripts/casper/FINAL-direct-mint-PUBLIC-cep95.js",
      directMintScript
    );
    console.log("✅ Updated FINAL-direct-mint-PUBLIC-cep95.js");

    // Update delegate mint script
    let delegateMintScript = fs.readFileSync(
      "scripts/casper/FINAL-delegate-mint-PUBLIC-cep95.js",
      "utf8"
    );
    delegateMintScript = delegateMintScript.replace(
      /const NEW_AUTHORITY_MINT_HASH = "[^"]+"/,
      `const NEW_AUTHORITY_MINT_HASH = "${authorityMintHash}"`
    );
    delegateMintScript = delegateMintScript.replace(
      /const PUBLIC_CEP95_HASH = "[^"]+"/,
      `const PUBLIC_CEP95_HASH = "${publicCep95Hash}"`
    );
    fs.writeFileSync(
      "scripts/casper/FINAL-delegate-mint-PUBLIC-cep95.js",
      delegateMintScript
    );
    console.log("✅ Updated FINAL-delegate-mint-PUBLIC-cep95.js");

    console.log("\n" + "=".repeat(60));
    console.log("🎯 READY TO MINT!");
    console.log("=".repeat(60));
    console.log("\nRun these commands:");
    console.log("\n1. Direct mint on PUBLIC CEP-95:");
    console.log("   node scripts/casper/FINAL-direct-mint-PUBLIC-cep95.js");
    console.log("\n2. Delegate mint (Authority Mint → PUBLIC CEP-95):");
    console.log("   node scripts/casper/FINAL-delegate-mint-PUBLIC-cep95.js");
  } else {
    console.log("\n⏳ Waiting for contracts to deploy...");
    console.log("Run this script again in 1-2 minutes.");
  }
}

main().catch(console.error);
