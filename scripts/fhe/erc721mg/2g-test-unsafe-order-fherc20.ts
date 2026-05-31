import { ethers } from "ethers";
import { createCofheClient, createCofheConfig } from "@cofhe/sdk/node";
import { Ethers6Adapter } from "@cofhe/sdk/adapters";
import { Encryptable, FheTypes } from "@cofhe/sdk";
import { arbSepolia, baseSepolia, sepolia } from "@cofhe/sdk/chains";
import { fheNftConfig } from "../config.js";

type InEuint64Input = {
  ctHash: bigint | string;
  securityZone: number;
  utype: number;
  signature: string;
};

const FHERC20_ERRORS = new ethers.Interface([
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

function formatMaybeUnits(value: bigint, decimals: number): string {
  try {
    return ethers.formatUnits(value, decimals);
  } catch {
    return value.toString();
  }
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
      const parsed = FHERC20_ERRORS.parseError(data);
      if (parsed?.name === "FHERC20IncompatibleFunction") {
        return "FHERC20 rejected an ERC20-style function. Use setOperator + confidentialTransferFrom with an encrypted InEuint64 amount.";
      }
      if (parsed?.name === "FHERC20UnauthorizedSpender") {
        return `Gateway is not an FHERC20 operator for ${parsed.args.from}. Run setOperator(gateway, until) first.`;
      }
      if (parsed?.name === "FHERC20UnauthorizedUseOfEncryptedAmount") {
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

async function main() {
  const { network, erc721mg } = fheNftConfig;
  const { fherc20: fherc20Config } = erc721mg;

  const rpcUrl = network.rpcUrls[network.target];
  const pk = network.backendPrivateKey || network.privateKey;
  const gatewayAddress = erc721mg.FHE_gatewayAddress;
  const fherc20Address =
    process.env.FHERC20_TOKEN_ADDRESS || fherc20Config.cUSDC;
  const paymentAmount = process.env.FHERC20_PAYMENT_AMOUNT || "3";
  const operatorTtlSeconds = Number(
    process.env.FHERC20_OPERATOR_TTL_SECONDS || 3600,
  );
  const dryRun =
    process.argv.includes("--dry-run") ||
    ["1", "true", "yes"].includes(
      (process.env.FHERC20_DRY_RUN || process.env.DRY_RUN || "").toLowerCase(),
    );

  if (!rpcUrl)
    throw new Error(
      `RPC URL for target network '${network.target}' is required`,
    );
  if (!pk)
    throw new Error(
      "BACKEND_PRIVATE_KEY, PRIVATE_KEY_ETH, or PRIVATE_KEY_ETH_2 env var is required",
    );
  if (!gatewayAddress)
    throw new Error("fheNftConfig.erc721mg.FHE_gatewayAddress is required");
  if (!fherc20Address)
    throw new Error("fheNftConfig.erc721mg.fherc20.cUSDC is required");

  const provider = new ethers.JsonRpcProvider(rpcUrl, undefined, {
    batchMaxCount: 1,
  });
  const signer = new ethers.Wallet(pk, provider);
  await provider.getNetwork();

  const { publicClient, walletClient } = await Ethers6Adapter(
    provider,
    signer,
  );
  const cofheClient = createCofheClient(
    createCofheConfig({ supportedChains: [getCofheChain(network.target)] }),
  );
  await cofheClient.connect(publicClient, walletClient);
  await cofheClient.permits.createSelf({
    name: "Mogate FHERC20 payment",
    type: "self",
    issuer: signer.address as `0x${string}`,
    expiration: 1_000_000_000_000,
  });

  console.log("Testing unsafeOrderFherc20 with confidential FHERC20 payment");
  console.log("Signer:", signer.address);
  console.log("Gateway:", gatewayAddress);
  console.log("FHERC20 Token:", fherc20Address);
  console.log("Network:", network.target);
  console.log("Dry run:", dryRun);

  const orderId = `test-order-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 11)}`;

  const fherc20 = new ethers.Contract(
    fherc20Address,
    [
      "function balanceOf(address) view returns (uint256)",
      "function balanceOfIsIndicator() view returns (bool)",
      "function confidentialBalanceOf(address) view returns (bytes32)",
      "function isOperator(address holder, address spender) view returns (bool)",
      "function setOperator(address operator, uint48 until)",
      "function indicatorTick() view returns (uint256)",
      "function decimals() view returns (uint8)",
      "function symbol() view returns (string)",
      "function name() view returns (string)",
    ],
    signer,
  );

  const gateway = new ethers.Contract(
    gatewayAddress,
    [
      "function unsafeOrderFherc20(string orderId, address paymentToken, (uint256 ctHash,uint8 securityZone,uint8 utype,bytes signature) encAmount) external returns (bytes32)",
      "event ConfidentialOrderPaymentReceived(string indexed orderId, address indexed payer, address indexed paymentToken, bytes32 transferredAmount)",
    ],
    signer,
  );

  const [tokenName, tokenSymbol, tokenDecimals] = await Promise.all([
    fherc20.name().catch(() => "Unknown FHERC20"),
    fherc20.symbol().catch(() => "FHERC20"),
    fherc20.decimals().catch(() => fherc20Config.decimals),
  ]);
  const decimals = Number(tokenDecimals);
  const amount = ethers.parseUnits(paymentAmount, decimals);

  console.log("Order ID:", orderId);
  console.log("Token:", tokenName, `(${tokenSymbol})`);
  console.log("Payment amount:", paymentAmount, tokenSymbol);
  console.log("Raw payment amount:", amount.toString());

  const [publicIndicator, balanceOfIsIndicator, confidentialBalance] =
    await Promise.all([
      fherc20.balanceOf(signer.address),
      fherc20.balanceOfIsIndicator().catch(() => true),
      fherc20.confidentialBalanceOf(signer.address),
    ]);

  console.log("\nBalance:");
  console.log(
    "balanceOf public value:",
    formatMaybeUnits(publicIndicator, decimals),
    balanceOfIsIndicator ? "(indicator, not spendable balance)" : "",
  );
  console.log("confidentialBalanceOf handle:", confidentialBalance);

  try {
    const realBalance = BigInt(
      await cofheClient
        .decryptForView(confidentialBalance, FheTypes.Uint64)
        .execute(),
    );
    console.log(
      "Decrypted real balance:",
      formatMaybeUnits(realBalance, decimals),
      tokenSymbol,
    );
    if (realBalance < amount) {
      throw new Error(
        `Insufficient real FHERC20 balance. Required ${paymentAmount} ${tokenSymbol}, decrypted ${formatMaybeUnits(
          realBalance,
          decimals,
        )} ${tokenSymbol}`,
      );
    }
  } catch (err) {
    console.log(
      "Could not decrypt real balance; continuing because FHERC20 transfers are checked confidentially:",
      getRevertMessage(err),
    );
  }

  const operatorUntil = Math.floor(Date.now() / 1000) + operatorTtlSeconds;
  const isOperator = await fherc20.isOperator(
    signer.address,
    gatewayAddress,
  );
  console.log("Gateway is FHERC20 operator:", isOperator);

  console.log("Encrypting payment amount as InEuint64...");
  const [encAmount] = (await cofheClient
    .encryptInputs([Encryptable.uint64(amount)])
    .execute()) as InEuint64Input[];

  console.log("Encrypted amount handle:", encAmount.ctHash.toString());
  console.log("Preflighting unsafeOrderFherc20...");

  try {
    await gateway.unsafeOrderFherc20.staticCall(
      orderId,
      fherc20Address,
      encAmount,
    );
    console.log("Preflight successful");
  } catch (err) {
    const message = getRevertMessage(err);
    if (!isOperator && message.includes("not an FHERC20 operator")) {
      if (dryRun) {
        console.log(
          "Dry run: gateway is not an operator; would call setOperator before payment.",
        );
        return;
      }

      console.log("Setting gateway as FHERC20 operator...");
      const operatorTx = await fherc20.setOperator(
        gatewayAddress,
        operatorUntil,
      );
      console.log("setOperator tx:", operatorTx.hash);
      await operatorTx.wait();
      console.log("Operator approval confirmed until:", operatorUntil);

      await gateway.unsafeOrderFherc20.staticCall(
        orderId,
        fherc20Address,
        encAmount,
      );
      console.log("Preflight successful after operator approval");
    } else {
      throw new Error(
        [
          `unsafeOrderFherc20 preflight failed: ${message}`,
          "If the error says the function does not exist, redeploy AuthorityMintGateway.fhe.faucet.sol with unsafeOrderFherc20().",
        ].join("\n"),
      );
    }
  }

  if (dryRun) {
    console.log("Dry run complete; transaction was not sent.");
    return;
  }

  console.log("Calling unsafeOrderFherc20...");
  const tx = await gateway.unsafeOrderFherc20(
    orderId,
    fherc20Address,
    encAmount,
  );

  console.log("unsafeOrderFherc20 tx:", tx.hash);
  const receipt = await tx.wait();
  console.log("Confirmed in block:", receipt.blockNumber);

  let transferredHandle: string | null = null;

  console.log("\nTransaction Events:");
  for (const log of receipt.logs) {
    try {
      if (String(log.address).toLowerCase() !== gatewayAddress.toLowerCase()) {
        continue;
      }
      const parsed = gateway.interface.parseLog(log);
      console.log(`Event: ${parsed?.name}`);
      console.log("Args:", parsed?.args);
      console.log("---");
      if (parsed?.name === "ConfidentialOrderPaymentReceived") {
        transferredHandle = parsed.args.transferredAmount;
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
    await cofheClient
      .decryptForView(transferredHandle, FheTypes.Uint64)
      .execute(),
  );
  console.log(
    "Decrypted transferred amount:",
    formatMaybeUnits(transferredAmount, decimals),
    tokenSymbol,
  );

  if (transferredAmount !== amount) {
    throw new Error(
      [
        "FHERC20 payment did not transfer the requested amount.",
        `Requested: ${formatMaybeUnits(amount, decimals)} ${tokenSymbol}`,
        `Transferred: ${formatMaybeUnits(transferredAmount, decimals)} ${tokenSymbol}`,
        "FHERC20 preserves privacy by transferring zero instead of reverting on insufficient balance.",
      ].join("\n"),
    );
  }

  console.log("\nunsafeOrderFherc20 test completed successfully");
  console.log(`Order ID: ${orderId}`);
  console.log(`Payment: ${paymentAmount} ${tokenSymbol}`);
  console.log(`Tx: ${tx.hash}`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
