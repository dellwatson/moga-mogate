import fs from "node:fs";
import path from "node:path";
import { ethers } from "ethers";
import { createCofheClient, createCofheConfig } from "@cofhe/sdk/node";
import { Ethers6Adapter } from "@cofhe/sdk/adapters";
import { Encryptable, FheTypes } from "@cofhe/sdk";
import { arbSepolia, baseSepolia, sepolia } from "@cofhe/sdk/chains";
import { fheNftConfig } from "../config.js";

type EncPart = {
  name?: string;
  ctHash?: string | number | bigint;
  securityZone?: number;
  utype?: number;
  signature?: string;
  handle?: string;
};

type KeyHandlePayload = {
  scheme?: string;
  parts?: EncPart[];
  ctHash?: string | number | bigint;
  securityZone?: number;
  utype?: number;
  signature?: string;
};

type InEuint128Input = {
  ctHash: bigint;
  securityZone: number;
  utype: number;
  signature: string;
};

type InEuint64Input = {
  ctHash: bigint | string;
  securityZone: number;
  utype: number;
  signature: string;
};

const DEFAULT_GATEWAY_ADDRESS = "0xA91D70aE85af28Efc23D5d90348a72A08C56056A";
const invalidSignerIface = new ethers.Interface([
  "error InvalidSigner(address signer, address expected)",
]);
const fherc20ErrorsIface = new ethers.Interface([
  "error FHERC20IncompatibleFunction()",
  "error FHERC20UnauthorizedSpender(address from,address spender)",
  "error FHERC20UnauthorizedUseOfEncryptedAmount(bytes32 amount,address spender)",
]);

function getCofheChain(target: string) {
  if (target === "sepolia") return sepolia;
  if (target === "arbitrumSepolia") return arbSepolia;
  if (target === "baseSepolia") return baseSepolia;
  throw new Error(`No CoFHE SDK chain mapping for target '${target}'`);
}

function getGatewayAddress(erc721mg: any): string {
  return (
    process.env.AUTHORITY_GATEWAY_ADDRESS ||
    process.env.ERC721MG_GATEWAY_ADDRESS ||
    erc721mg.gatewayAddress ||
    DEFAULT_GATEWAY_ADDRESS
  );
}

function getFHERC20Address(): string {
  const fherc20Address =
    process.env.FHERC20_TOKEN_ADDRESS || fheNftConfig.erc721mg.fherc20?.cUSDC;
  if (!fherc20Address) {
    throw new Error(
      "FHERC20_TOKEN_ADDRESS env var is required for FHERC20 payments",
    );
  }
  return fherc20Address;
}

function getMintMethod(): "unsafeMint" {
  const method = process.env.FHE_GATEWAY_MINT_METHOD || "unsafeMint";
  if (method !== "unsafeMint" && method !== "unsafeCheckout") {
    throw new Error(
      "FHE_GATEWAY_MINT_METHOD must be either 'unsafeMint' or 'unsafeCheckout'",
    );
  }
  if (method === "unsafeCheckout") {
    throw new Error(
      "FHERC20 atomic checkout was removed. Use unsafeOrderFherc20 to pay, let the backend decrypt/verify transferredAmount, then call unsafeMint for the demo flow.",
    );
  }
  return "unsafeMint";
}

function formatMaybeUnits(value: bigint, decimals: number): string {
  try {
    return ethers.formatUnits(value, decimals);
  } catch {
    return value.toString();
  }
}

function selectEncPart(keyHandle: string): EncPart {
  try {
    const parsed = JSON.parse(keyHandle) as KeyHandlePayload;
    if (parsed && Array.isArray(parsed.parts) && parsed.parts.length > 0) {
      const low = parsed.parts.find((p) => p.name === "low");
      return low ?? parsed.parts[0];
    }
    if (parsed && parsed.ctHash) {
      return parsed;
    }
  } catch {
    // not JSON
  }
  throw new Error("key_handle must be JSON with ctHash or parts array");
}

function encKeyFromHandle(keyHandle: string): InEuint128Input {
  const part = selectEncPart(keyHandle);
  if (!part.ctHash || !part.signature) {
    throw new Error("key_handle part missing ctHash/signature");
  }
  return {
    ctHash: BigInt(part.ctHash),
    securityZone: Number(part.securityZone ?? 0),
    utype: Number(part.utype ?? 6),
    signature: String(part.signature),
  };
}

function updateConfig(mintedTokenId: bigint, cipherRef: string) {
  const __dirname = path.dirname(new URL(import.meta.url).pathname);
  const configPath = path.join(__dirname, "..", "config.js");
  const content = fs.readFileSync(configPath, "utf8");

  let updated = content;
  const tokenReplaced = /tokenId:\s*\d+/.test(updated);
  updated = updated.replace(/tokenId:\s*\d+/, `tokenId: ${mintedTokenId}`);

  const cipherReplaced = /cipherRef:\s*"[^"]*"/.test(updated);
  updated = updated.replace(
    /cipherRef:\s*"[^"]*"/,
    `cipherRef: "${cipherRef}"`,
  );

  fs.writeFileSync(configPath, updated, "utf8");
  console.log(
    "Updated config.js decrypt block",
    `(tokenId ${tokenReplaced ? "replaced" : "missing match"}, cipherRef ${
      cipherReplaced ? "replaced" : "missing match"
    })`,
  );
}

function updateState(mintedTokenId: bigint) {
  const __dirname = path.dirname(new URL(import.meta.url).pathname);
  const statePath = path.join(__dirname, "..", "erc721mg_state.json");
  fs.writeFileSync(
    statePath,
    JSON.stringify({ lastTokenId: mintedTokenId.toString() }, null, 2),
    "utf8",
  );
  console.log("Updated state file:", statePath);
}

function getRevertMessage(err: unknown): string {
  const error = err as any;
  const data =
    typeof error?.data === "string"
      ? error.data
      : typeof error?.info?.error?.data === "string"
        ? error.info.error.data
        : undefined;

  if (data) {
    try {
      const decoded = invalidSignerIface.parseError(data);
      if (decoded?.name === "InvalidSigner") {
        return [
          "FHE encrypted input is not valid for the gateway caller.",
          `Recovered signer: ${decoded.args.signer}`,
          `Expected verifier: ${decoded.args.expected}`,
          `Regenerate sample.json with CoFHE setAccount(${fheNftConfig.erc721mg.gatewayAddress}) for gateway minting.`,
        ].join("\n");
      }
    } catch {
      // Unknown custom error; fall through to generic handling.
    }

    try {
      const decoded = fherc20ErrorsIface.parseError(data);
      if (decoded?.name === "FHERC20IncompatibleFunction") {
        return "FHERC20 rejected an ERC20-style function. Use setOperator + unsafeOrderFherc20 with an encrypted InEuint64 amount.";
      }
      if (decoded?.name === "FHERC20UnauthorizedSpender") {
        return `Gateway is not an FHERC20 operator for ${decoded.args.from}. Run setOperator(gateway, until) first.`;
      }
      if (decoded?.name === "FHERC20UnauthorizedUseOfEncryptedAmount") {
        return "Encrypted amount was not allowed for the FHERC20 contract. The gateway must FHE.allow(amount, token) before transfer.";
      }
    } catch {
      // Unknown custom error; fall through to generic handling.
    }
  }
  return (
    error?.shortMessage ||
    error?.reason ||
    error?.info?.error?.message ||
    error?.message ||
    String(err)
  );
}

async function connectCofhe(
  provider: ethers.JsonRpcProvider,
  signer: ethers.Wallet,
  target: string,
  permitName: string,
) {
  const { publicClient, walletClient } = await Ethers6Adapter(provider, signer);
  const cofheClient = createCofheClient(
    createCofheConfig({ supportedChains: [getCofheChain(target)] }),
  );
  await cofheClient.connect(publicClient, walletClient);
  await cofheClient.permits.createSelf({
    name: permitName,
    type: "self",
    issuer: signer.address as `0x${string}`,
    expiration: 1_000_000_000_000,
  });
  return cofheClient;
}

async function main() {
  const { network, erc721mg } = fheNftConfig;
  const { mint } = erc721mg;

  const rpcUrl = network.rpcUrls[network.target];
  const backendPk = network.backendPrivateKey || network.privateKey;
  const payerPk =
    process.env.FHERC20_PAYER_PRIVATE_KEY ||
    process.env.PAYER_PRIVATE_KEY ||
    backendPk;
  const collectionAddress =
    erc721mg.gatewayCollectionAddress || erc721mg.latestCollectionAddress;
  const gatewayAddress = getGatewayAddress(erc721mg);
  const fherc20Address = getFHERC20Address();
  const mintMethod = getMintMethod();
  const dryRun =
    process.argv.includes("--dry-run") ||
    ["1", "true", "yes"].includes(
      (process.env.FHE_GATEWAY_DRY_RUN || "").toLowerCase(),
    );
  const paymentAmount = process.env.FHERC20_PAYMENT_AMOUNT || "3";
  const operatorTtlSeconds = Number(
    process.env.FHERC20_OPERATOR_TTL_SECONDS || 3600,
  );

  // Load data from sample.json like 2c-mint-only.ts
  const __dirname = path.dirname(new URL(import.meta.url).pathname);
  const samplePath = path.join(__dirname, "..", "sample.json");
  const sampleData = JSON.parse(fs.readFileSync(samplePath, "utf8"));

  const to = sampleData.prepared?.receiver_wallet || mint.to;
  const uri = sampleData.prepared?.metadata?.upload?.url || mint.uri;
  const orderId =
    sampleData.checkout_id ||
    sampleData.prepared?.permit?.permit_id ||
    `manual-${Date.now()}`;
  const existingCipherRef = sampleData.prepared?.encryption?.cipher_ref || "";
  const keyHandle = sampleData.prepared?.encryption?.key_handle || "";

  if (!to) throw new Error("Missing recipient wallet in sample.json");
  if (!uri) throw new Error("Missing metadata URI in sample.json");

  if (!rpcUrl)
    throw new Error(
      `RPC URL for target network '${network.target}' is required`,
    );
  if (!backendPk)
    throw new Error(
      "BACKEND_PRIVATE_KEY, PRIVATE_KEY_ETH, or PRIVATE_KEY_ETH_2 env var is required",
    );
  if (!payerPk)
    throw new Error(
      "FHERC20_PAYER_PRIVATE_KEY, PAYER_PRIVATE_KEY, BACKEND_PRIVATE_KEY, PRIVATE_KEY_ETH, or PRIVATE_KEY_ETH_2 env var is required",
    );
  if (!collectionAddress)
    throw new Error("fheNftConfig.erc721mg.collectionAddress is required");
  if (!gatewayAddress)
    throw new Error("fheNftConfig.erc721mg.gatewayAddress is required");
  if (!to) throw new Error("fheNftConfig.erc721mg.mint.to is required");
  if (!uri) throw new Error("fheNftConfig.erc721mg.mint.uri is required");

  const provider = new ethers.JsonRpcProvider(rpcUrl, undefined, {
    batchMaxCount: 1,
  });
  const backendSigner = new ethers.Wallet(backendPk, provider);
  const payerSigner = new ethers.Wallet(payerPk, provider);
  await provider.getNetwork();

  const payerCofheClient = await connectCofhe(
    provider,
    payerSigner,
    network.target,
    "Mogate FHERC20 payer",
  );
  const backendCofheClient =
    backendSigner.address.toLowerCase() === payerSigner.address.toLowerCase()
      ? payerCofheClient
      : await connectCofhe(
          provider,
          backendSigner,
          network.target,
          "Mogate FHERC20 backend",
        );

  console.log("Gateway FHERC20 order payment + unsafeMint demo");
  console.log("Payer:", payerSigner.address);
  console.log("Backend signer:", backendSigner.address);
  console.log("Gateway:", gatewayAddress);
  console.log("Collection:", collectionAddress);
  console.log("FHERC20 Token:", fherc20Address);
  console.log("Order ID:", orderId);
  console.log("Recipient:", to);
  console.log("URI:", uri);
  console.log("Payment amount:", paymentAmount);
  console.log("Mint method:", mintMethod);
  console.log("Dry run:", dryRun);

  const collection = new ethers.Contract(
    collectionAddress,
    [
      "function minters(address) view returns (bool)",
      "function owner() view returns (address)",
    ],
    provider,
  );

  const fherc20 = new ethers.Contract(
    fherc20Address,
    [
      "function balanceOf(address) view returns (uint256)",
      "function balanceOfIsIndicator() view returns (bool)",
      "function confidentialBalanceOf(address) view returns (bytes32)",
      "function isOperator(address holder, address spender) view returns (bool)",
      "function setOperator(address operator, uint48 until)",
      "function decimals() view returns (uint8)",
      "function symbol() view returns (string)",
    ],
    payerSigner,
  );

  const tokenSymbol = await fherc20.symbol().catch(() => "cUSDC");
  const tokenDecimals = Number(
    await fherc20.decimals().catch(() => 6),
  );
  console.log("Token symbol:", tokenSymbol);
  console.log("Token decimals:", tokenDecimals);

  const paymentGateway = new ethers.Contract(
    gatewayAddress,
    [
      "function allowedCollections(address) view returns (bool)",
      "function backendSigner() view returns (address)",
      "function owner() view returns (address)",
      "function unsafeOrderFherc20(string orderId, address paymentToken, (uint256 ctHash,uint8 securityZone,uint8 utype,bytes signature) encAmount) external returns (bytes32)",
      "function unsafeMint(string orderId, address collection, address to, string uri, (uint256 ctHash,uint8 securityZone,uint8 utype,bytes signature) encKey, string cipherRef) external returns (uint256)",
      "event ConfidentialOrderPaymentReceived(string indexed orderId, address indexed payer, address indexed paymentToken, bytes32 transferredAmount)",
    ],
    payerSigner,
  );
  const mintGateway = paymentGateway.connect(backendSigner) as ethers.Contract;

  const gatewayCode = await provider.getCode(gatewayAddress);
  if (gatewayCode === "0x") {
    throw new Error(
      `No contract deployed at gateway address ${gatewayAddress}`,
    );
  }

  const collectionCode = await provider.getCode(collectionAddress);
  if (collectionCode === "0x") {
    throw new Error(
      `No contract deployed at collection address ${collectionAddress}`,
    );
  }

  const fherc20Code = await provider.getCode(fherc20Address);
  if (fherc20Code === "0x") {
    throw new Error(
      `No contract deployed at FHERC20 token address ${fherc20Address}`,
    );
  }

  const [gatewayIsMinter, collectionAllowed] = await Promise.all([
    collection.minters(gatewayAddress),
    paymentGateway.allowedCollections(collectionAddress).catch(() => false),
  ]);

  console.log("Gateway is collection minter:", gatewayIsMinter);
  console.log("Collection allowed in gateway:", collectionAllowed);

  const gatewayOwner = await paymentGateway.owner().catch(() => null);
  const contractBackendSigner = await paymentGateway
    .backendSigner()
    .catch(() => null);
  if (contractBackendSigner) {
    console.log("Contract backendSigner:", contractBackendSigner);
  }
  if (gatewayOwner) {
    console.log("Gateway owner:", gatewayOwner);
  }
  if (
    contractBackendSigner &&
    backendSigner.address.toLowerCase() !==
      String(contractBackendSigner).toLowerCase() &&
    (!gatewayOwner ||
      backendSigner.address.toLowerCase() !== String(gatewayOwner).toLowerCase())
  ) {
    throw new Error(
      [
        "Backend signer cannot decrypt the FHERC20 transferred handle for this gateway.",
        `Script backend signer: ${backendSigner.address}`,
        `Contract backendSigner: ${contractBackendSigner}`,
        `Gateway owner: ${gatewayOwner}`,
        `Call setBackendSigner(${backendSigner.address}) first, or run this script with the gateway owner key.`,
      ].join("\n"),
    );
  }

  const publicBalance = await fherc20.balanceOf(payerSigner.address);
  const balanceIsIndicator = await fherc20
    .balanceOfIsIndicator()
    .catch(() => true);
  const confidentialBalance = await fherc20.confidentialBalanceOf(
    payerSigner.address,
  );

  console.log(
    "FHERC20 balanceOf public value:",
    ethers.formatUnits(publicBalance, tokenDecimals),
    balanceIsIndicator ? "(indicator, not spendable balance)" : "",
  );
  console.log("FHERC20 confidentialBalanceOf handle:", confidentialBalance);

  if (!gatewayIsMinter) {
    const collectionOwner = await collection.owner();
    throw new Error(
      [
        "Gateway is not a minter on the configured collection.",
        `Call setMinter(${gatewayAddress}, true) on ${collectionAddress} first.`,
        `Collection owner: ${collectionOwner}`,
      ].join("\n"),
    );
  }

  // Use existing encrypted data from sample.json (no new encryption)
  if (!existingCipherRef || !keyHandle) {
    throw new Error(
      "Missing cipherRef or keyHandle in sample.json - cannot do mint-only mode",
    );
  }

  console.log("Using existing encrypted data from sample.json");
  console.log("CipherRef:", existingCipherRef);
  console.log("KeyHandle:", keyHandle);

  const encKeyForContract = encKeyFromHandle(keyHandle);

  console.log("EncKey:", encKeyForContract);

  const amount = ethers.parseUnits(paymentAmount, tokenDecimals);
  console.log("Payment amount:", paymentAmount, tokenSymbol);
  console.log("Payment amount (wei):", amount.toString());

  try {
    const realBalance = BigInt(
      await payerCofheClient
        .decryptForView(confidentialBalance, FheTypes.Uint64)
        .execute(),
    );
    console.log(
      "Decrypted real FHERC20 balance:",
      ethers.formatUnits(realBalance, tokenDecimals),
      tokenSymbol,
    );
    if (realBalance < amount) {
      throw new Error(
        `Insufficient real FHERC20 balance. Required: ${ethers.formatUnits(
          amount,
          tokenDecimals,
        )}, Available: ${ethers.formatUnits(realBalance, tokenDecimals)}`,
      );
    }
  } catch (err) {
    console.log(
      "Warning: Could not decrypt real FHERC20 balance:",
      (err as Error).message,
    );
  }

  const isOperator = await fherc20.isOperator(
    payerSigner.address,
    gatewayAddress,
  );
  console.log("Gateway is FHERC20 operator:", isOperator);

  console.log("Encrypting FHERC20 payment amount as InEuint64...");
  const [encAmount] = (await payerCofheClient
    .encryptInputs([Encryptable.uint64(amount)])
    .execute()) as InEuint64Input[];
  console.log("Encrypted payment amount handle:", encAmount.ctHash.toString());

  console.log("Preflighting unsafeOrderFherc20 payment...");
  try {
    await paymentGateway.unsafeOrderFherc20.staticCall(
      orderId,
      fherc20Address,
      encAmount,
    );
    console.log("FHERC20 payment preflight successful");
  } catch (err) {
    const message = getRevertMessage(err);
    if (!isOperator && message.includes("not an FHERC20 operator")) {
      if (dryRun) {
        console.log(
          "Dry run: gateway is not an operator; would call setOperator before payment.",
        );
      } else {
        const operatorUntil = Math.floor(Date.now() / 1000) + operatorTtlSeconds;
        console.log("Setting gateway as FHERC20 operator...");
        const operatorTx = await fherc20.setOperator(
          gatewayAddress,
          operatorUntil,
        );
        console.log("setOperator tx:", operatorTx.hash);
        await operatorTx.wait();
        console.log("Operator approval confirmed until:", operatorUntil);

        await paymentGateway.unsafeOrderFherc20.staticCall(
          orderId,
          fherc20Address,
          encAmount,
        );
        console.log("FHERC20 payment preflight successful after operator approval");
      }
    } else {
      throw new Error(
        [
          `unsafeOrderFherc20 preflight failed: ${message}`,
          "Redeploy AuthorityMintGateway.fhe.faucet.sol if this gateway does not yet expose unsafeOrderFherc20().",
        ].join("\n"),
      );
    }
  }

  console.log("Preflighting gateway mint...");

  try {
    await mintGateway.unsafeMint.staticCall(
      orderId,
      collectionAddress,
      to,
      uri,
      encKeyForContract,
      existingCipherRef,
    );
  } catch (err) {
    console.error("Full error details:", err);
    if (err instanceof Error) {
      console.error("Error message:", err.message);
      console.error("Error stack:", err.stack);
    }
    throw new Error(`Gateway mint preflight failed: ${getRevertMessage(err)}`);
  }

  if (dryRun) {
    console.log("Dry run complete; payment and mint transactions were not sent.");
    return;
  }

  // No file writing needed - using existing encrypted data from sample.json
  console.log("Using existing encrypted data, no new files created");

  console.log("Calling unsafeOrderFherc20 payment...");
  const paymentTx = await paymentGateway.unsafeOrderFherc20(
    orderId,
    fherc20Address,
    encAmount,
  );
  console.log("unsafeOrderFherc20 tx:", paymentTx.hash);
  const paymentReceipt = await paymentTx.wait();
  console.log("Payment confirmed in block:", paymentReceipt.blockNumber);

  let transferredHandle: string | null = null;
  for (const log of paymentReceipt.logs) {
    try {
      if (String(log.address).toLowerCase() !== gatewayAddress.toLowerCase()) {
        continue;
      }
      const parsed = paymentGateway.interface.parseLog(log);
      if (parsed?.name === "ConfidentialOrderPaymentReceived") {
        transferredHandle = parsed.args.transferredAmount;
        break;
      }
    } catch {
      // Ignore non-gateway logs.
    }
  }

  if (!transferredHandle) {
    throw new Error(
      "Could not find ConfidentialOrderPaymentReceived; cannot verify actual FHERC20 amount transferred.",
    );
  }

  const transferredAmount = BigInt(
    await backendCofheClient
      .decryptForView(transferredHandle, FheTypes.Uint64)
      .execute(),
  );
  console.log(
    "Decrypted transferred amount:",
    formatMaybeUnits(transferredAmount, tokenDecimals),
    tokenSymbol,
  );

  if (transferredAmount !== amount) {
    throw new Error(
      [
        "FHERC20 payment did not transfer the requested amount, so mint is blocked.",
        `Requested: ${formatMaybeUnits(amount, tokenDecimals)} ${tokenSymbol}`,
        `Transferred: ${formatMaybeUnits(
          transferredAmount,
          tokenDecimals,
        )} ${tokenSymbol}`,
        "FHERC20 preserves privacy by transferring zero instead of reverting on insufficient balance.",
      ].join("\n"),
    );
  }

  console.log("FHERC20 payment confirmed; forwarding to unsafeMint...");
  const tx = await mintGateway.unsafeMint(
    orderId,
    collectionAddress,
    to,
    uri,
    encKeyForContract,
    existingCipherRef,
  );

  console.log("gateway mint tx:", tx.hash);
  const receipt = await tx.wait();
  console.log("Confirmed in block:", receipt.blockNumber);

  const erc721Iface = new ethers.Interface([
    "event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)",
  ]);

  let mintedTokenId: bigint | null = null;
  for (const log of receipt.logs) {
    try {
      if (
        String(log.address).toLowerCase() !== collectionAddress.toLowerCase()
      ) {
        continue;
      }
      const parsed = erc721Iface.parseLog(log);
      if (
        parsed.name === "Transfer" &&
        parsed.args.from === ethers.ZeroAddress &&
        String(parsed.args.to).toLowerCase() === to.toLowerCase()
      ) {
        mintedTokenId = parsed.args.tokenId as bigint;
        break;
      }
    } catch {
      // ignore non-ERC721 logs
    }
  }

  if (mintedTokenId === null) {
    console.warn(
      "Could not infer minted tokenId from logs; config/state were not updated.",
    );
    return;
  }

  console.log("Minted tokenId:", mintedTokenId.toString());
  updateConfig(mintedTokenId, existingCipherRef);
  updateState(mintedTokenId);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
