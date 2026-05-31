import { ethers } from "ethers";
import { fheNftConfig } from "../config.js";

interface OrderTransaction {
  txHash: string;
  blockNumber: number;
  timestamp: number;
  success: boolean;
  functionName: string;
  paymentToken?: string;
  amount?: bigint;
  tokenId?: bigint;
  gasUsed?: bigint;
  error?: string;
}

interface OrderStatus {
  orderId: string;
  transactions: OrderTransaction[];
  hasSuccessfulPayment: boolean;
  hasSuccessfulExecution: boolean;
  finalStatus: "success" | "failed" | "partial" | "none";
  summary: {
    totalTransactions: number;
    successfulPayments: number;
    successfulExecutions: number;
    failedTransactions: number;
  };
}

function getGatewayAddress(erc721mg: any): string {
  return (
    process.env.AUTHORITY_GATEWAY_ADDRESS ||
    process.env.ERC721MG_GATEWAY_ADDRESS ||
    erc721mg.gatewayAddress ||
    erc721mg.FHE_gatewayAddress
  );
}

async function getOrderTransactions(
  provider: ethers.JsonRpcProvider,
  gatewayAddress: string,
  orderId: string,
  fromBlock: number = 0,
  toBlock?: number,
): Promise<OrderTransaction[]> {
  const transactions: OrderTransaction[] = [];

  // Gateway event interface
  const gatewayIface = new ethers.Interface([
    "event OrderPaymentReceived(string indexed orderId, address indexed payer, address indexed paymentToken, uint256 amount)",
    "event OrderExecuted(string indexed orderId, address indexed payer, uint256 indexed tokenId, bool success)",
    "event Purchased(address indexed collection, address indexed buyer, uint256 indexed tokenId, address indexed paymentToken, uint256 amount)",
    "event Minted(address indexed collection, uint256 indexed tokenId, address indexed to, string uri)",
  ]);

  // Function signatures to look for
  const functionSelectors = {
    unsafeCheckout: "0xcabb82ac", // unsafeCheckout(string,address,address,string,(uint256,uint8,uint8,bytes),string,address,uint256,bool)
    unsafeOrder: "0xf372f9f6", // unsafeOrder(string,address,uint256,bool)
    unsafeMint: "0x8d5d2062", // unsafeMint(string,address,address,string,(uint256,uint8,uint8,bytes),string)
  };

  try {
    // Get the latest block number
    const latestBlock = toBlock || (await provider.getBlockNumber());
    const maxBlockRange = 10000; // Conservative block range to avoid RPC limits

    // Query logs in chunks to avoid block range limits
    let currentFromBlock = fromBlock;

    while (currentFromBlock <= latestBlock) {
      const currentToBlock = Math.min(
        currentFromBlock + maxBlockRange - 1,
        latestBlock,
      );

      try {
        // Get gateway logs for this order ID in current chunk
        const logs = await provider.getLogs({
          address: gatewayAddress,
          topics: [
            null, // Any event
            ethers.id(orderId), // Order ID as indexed topic
          ],
          fromBlock: currentFromBlock,
          toBlock: currentToBlock,
        });

        // Process each log
        for (const log of logs) {
          try {
            const parsed = gatewayIface.parseLog(log);
            const receipt = await provider.getTransactionReceipt(
              log.transactionHash,
            );
            const tx = await provider.getTransaction(log.transactionHash);

            if (!tx || !receipt) continue;

            const transaction: OrderTransaction = {
              txHash: log.transactionHash,
              blockNumber: log.blockNumber,
              timestamp:
                (await provider.getBlock(log.blockNumber))?.timestamp || 0,
              success: receipt.status === 1,
              functionName: parsed.name,
              gasUsed: receipt.gasUsed,
            };

            // Extract specific details based on event type
            if (parsed.name === "OrderPaymentReceived") {
              transaction.paymentToken = parsed.args.paymentToken;
              transaction.amount = parsed.args.amount;
            } else if (parsed.name === "OrderExecuted") {
              transaction.tokenId = parsed.args.tokenId;
              transaction.success = parsed.args.success && receipt.status === 1;
            } else if (parsed.name === "Purchased") {
              transaction.paymentToken = parsed.args.paymentToken;
              transaction.amount = parsed.args.amount;
              transaction.tokenId = parsed.args.tokenId;
            }

            transactions.push(transaction);
          } catch (err) {
            // If log parsing fails, try to get transaction details anyway
            try {
              const receipt = await provider.getTransactionReceipt(
                log.transactionHash,
              );
              const tx = await provider.getTransaction(log.transactionHash);

              if (tx && receipt) {
                let functionName = "unknown";

                // Try to identify function by selector
                const selector = tx.data.slice(0, 10);
                for (const [name, selectorHex] of Object.entries(
                  functionSelectors,
                )) {
                  if (selector === selectorHex) {
                    functionName = name;
                    break;
                  }
                }

                transactions.push({
                  txHash: log.transactionHash,
                  blockNumber: log.blockNumber,
                  timestamp:
                    (await provider.getBlock(log.blockNumber))?.timestamp || 0,
                  success: receipt.status === 1,
                  functionName,
                  gasUsed: receipt.gasUsed,
                  error:
                    receipt.status === 0 ? "Transaction failed" : undefined,
                });
              }
            } catch {
              // Skip if we can't get transaction details
            }
          }
        }
      } catch (chunkErr) {
        console.log(
          `Warning: Could not fetch logs for blocks ${currentFromBlock}-${currentToBlock}: ${
            (chunkErr as Error).message
          }`,
        );
        // Continue to next chunk even if current one fails
      }

      currentFromBlock = currentToBlock + 1;
    }
  } catch (err) {
    console.error("Error fetching order transactions:", err);
  }

  // Sort by block number (chronological order)
  return transactions.sort((a, b) => a.blockNumber - b.blockNumber);
}

function analyzeOrderStatus(
  transactions: OrderTransaction[],
): OrderStatus["finalStatus"] {
  const hasSuccessfulPayment = transactions.some(
    (tx) =>
      tx.success &&
      (tx.functionName === "OrderPaymentReceived" ||
        tx.functionName === "Purchased"),
  );
  const hasSuccessfulExecution = transactions.some(
    (tx) => tx.success && tx.functionName === "OrderExecuted" && tx.success,
  );
  const hasFailedTx = transactions.some((tx) => !tx.success);

  if (hasSuccessfulExecution) return "success";
  if (hasSuccessfulPayment && !hasSuccessfulExecution) return "partial";
  if (hasFailedTx && !hasSuccessfulPayment) return "failed";
  return "none";
}

async function main() {
  const { network, erc721mg } = fheNftConfig;

  const rpcUrl = network.rpcUrls[network.target];
  const gatewayAddress = getGatewayAddress(erc721mg);

  // Get order ID from command line args or prompt
  const orderId = process.argv[2];
  if (!orderId) {
    console.error("Usage: bun run 2h-check-order-status.ts <order-id>");
    console.error(
      "Example: bun run 2h-check-order-status.ts test-order-123456",
    );
    process.exit(1);
  }

  if (!rpcUrl)
    throw new Error(
      `RPC URL for target network '${network.target}' is required`,
    );
  if (!gatewayAddress) throw new Error("Gateway address is required");

  const provider = new ethers.JsonRpcProvider(rpcUrl, undefined, {
    batchMaxCount: 1,
  });

  console.log(`🔍 Checking order status for: ${orderId}`);
  console.log(`🌐 Network: ${network.target}`);
  console.log(`🏭 Gateway: ${gatewayAddress}`);
  console.log("");

  // Get all transactions for this order
  const transactions = await getOrderTransactions(
    provider,
    gatewayAddress,
    orderId,
  );

  if (transactions.length === 0) {
    console.log(`❌ No transactions found for order ID: ${orderId}`);
    return;
  }

  // Analyze the order status
  const summary = {
    totalTransactions: transactions.length,
    successfulPayments: transactions.filter(
      (tx) =>
        tx.success &&
        (tx.functionName === "OrderPaymentReceived" ||
          tx.functionName === "Purchased"),
    ).length,
    successfulExecutions: transactions.filter(
      (tx) => tx.success && tx.functionName === "OrderExecuted" && tx.success,
    ).length,
    failedTransactions: transactions.filter((tx) => !tx.success).length,
  };

  const hasSuccessfulPayment = summary.successfulPayments > 0;
  const hasSuccessfulExecution = summary.successfulExecutions > 0;
  const finalStatus = analyzeOrderStatus(transactions);

  const orderStatus: OrderStatus = {
    orderId,
    transactions,
    hasSuccessfulPayment,
    hasSuccessfulExecution,
    finalStatus,
    summary,
  };

  // Display results
  console.log("📊 ORDER STATUS SUMMARY");
  console.log("=".repeat(50));
  console.log(`🆔 Order ID: ${orderId}`);
  console.log(`📈 Final Status: ${finalStatus.toUpperCase()}`);
  console.log(`📋 Total Transactions: ${summary.totalTransactions}`);
  console.log(`✅ Successful Payments: ${summary.successfulPayments}`);
  console.log(`🎯 Successful Executions: ${summary.successfulExecutions}`);
  console.log(`❌ Failed Transactions: ${summary.failedTransactions}`);
  console.log("");

  // Smart logic explanation
  console.log("🧠 SMART STATUS LOGIC");
  console.log("=".repeat(50));
  if (finalStatus === "success") {
    console.log(
      "✅ Order completed successfully - at least one execution succeeded",
    );
  } else if (finalStatus === "partial") {
    console.log(
      "⚠️  Order partially completed - payment received but execution pending/failed",
    );
    console.log(
      "💡 Note: Even if later transactions fail, the successful payment is preserved",
    );
  } else if (finalStatus === "failed") {
    console.log(
      "❌ Order failed - all transactions failed, no successful payments",
    );
  } else {
    console.log(
      "🔍 No clear status - no successful payments or executions found",
    );
  }
  console.log("");

  // Show transaction details
  console.log("📜 TRANSACTION DETAILS");
  console.log("=".repeat(50));

  for (let i = 0; i < transactions.length; i++) {
    const tx = transactions[i];
    const status = tx.success ? "✅" : "❌";
    const time = new Date(tx.timestamp * 1000).toLocaleString();

    console.log(`${status} Transaction #${i + 1}`);
    console.log(`   Hash: ${tx.txHash}`);
    console.log(`   Block: ${tx.blockNumber}`);
    console.log(`   Time: ${time}`);
    console.log(`   Function: ${tx.functionName}`);
    console.log(`   Gas Used: ${tx.gasUsed?.toString() || "N/A"}`);

    if (tx.paymentToken) {
      console.log(`   Payment Token: ${tx.paymentToken}`);
    }
    if (tx.amount) {
      console.log(`   Amount: ${ethers.formatUnits(tx.amount, 6)} cUSDC`); // Assuming 6 decimals for cUSDC
    }
    if (tx.tokenId) {
      console.log(`   Token ID: ${tx.tokenId.toString()}`);
    }
    if (tx.error) {
      console.log(`   Error: ${tx.error}`);
    }
    console.log("");
  }

  // Double payment detection
  if (summary.successfulPayments > 1) {
    console.log("⚠️  DOUBLE PAYMENT DETECTED");
    console.log("=".repeat(50));
    console.log(
      `📊 Found ${summary.successfulPayments} successful payments for the same order ID`,
    );
    console.log(
      "💡 Smart logic preserves the first successful payment and shows all attempts",
    );
    console.log(
      "🔍 Check transaction details above to see all payment attempts",
    );
  }

  console.log(`\n🏁 Final verdict: Order ${orderId} is ${finalStatus}`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
