# Devnet Setup (MOGA, USDC, MRFT)

This guide helps you create devnet assets used by the raffle flow.

## 1) Stable coin (USDC) and MOGA (SPL-Token)

Recommended for best tooling & DEX support on devnet.

```bash
# USDC (6 decimals)
spl-token create-token --decimals 6            # -> USDC_DEV_MINT
spl-token create-account <USDC_DEV_MINT>
spl-token mint <USDC_DEV_MINT> 1000000000      # 1,000 USDC

# MOGA (9 decimals)
spl-token create-token --decimals 9            # -> MOGA_DEV_MINT
spl-token create-account <MOGA_DEV_MINT>
spl-token mint <MOGA_DEV_MINT> 1000000000000   # adjust supply
```

## 2) Optional: Token-2022

If you need Token-2022 extensions (fees, non-transferable, etc.), create mints with the Token-2022 program id:

```bash
spl-token create-token --decimals 9 --token-program <TOKEN_2022_PROGRAM_ID>   # -> MOGA_DEV_MINT
spl-token create-account <MOGA_DEV_MINT>
spl-token mint <MOGA_DEV_MINT> 1000000000000
```

Use SPL for USDC and Token-2022 for MOGA only if you need 2022 features.

## 3) Refund Ticket Collection (MRFT)

- Use Metaplex Bubblegum (compressed NFTs) with a devnet collection.
- Record the collection mint and tree authority in your `.env`.

## 4) Environment

```
SOLANA_RPC_URL=https://api.devnet.solana.com
RWA_RAFFLE_PROGRAM_ID=<PROGRAM_ID>
MOGA_MINT=<MOGA_DEV_MINT>
USDC_MINT=<USDC_DEV_MINT>
MRFT_COLLECTION_MINT=<MRFT_COLLECTION_MINT>
HELIUS_DAS_RPC=<DAS_ENDPOINT>
```

## 5) Listing tickets and balances from the SDK

```ts
import { Connection, clusterApiUrl, PublicKey } from "@solana/web3.js";
import { getSplTokenBalance, listRefundTicketsViaDas, toUiAmount } from "@moga/rwa-raffle-sdk";

const conn = new Connection(clusterApiUrl("devnet"));
const owner = new PublicKey("<wallet>");
const mogaMint = new PublicKey(process.env.MOGA_MINT!);

const { amount, decimals } = await getSplTokenBalance(conn, owner, mogaMint);
console.log("MOGA:", toUiAmount(amount, decimals));

const items = await listRefundTicketsViaDas(process.env.HELIUS_DAS_RPC!, owner.toBase58(), process.env.MRFT_COLLECTION_MINT!);
console.log("Refund tickets:", items.length);
```
