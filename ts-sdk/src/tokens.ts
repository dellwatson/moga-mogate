import { Connection, PublicKey } from "@solana/web3.js";

export async function getSplTokenBalance(
  conn: Connection,
  owner: PublicKey,
  mint: PublicKey,
): Promise<{ amount: bigint; decimals: number }>
{
  const resp = await conn.getParsedTokenAccountsByOwner(owner, { mint });
  let amount = 0n;
  let decimals = 0;
  for (const { account } of resp.value) {
    const data: any = account.data;
    if (data?.parsed?.info?.tokenAmount) {
      const info = data.parsed.info.tokenAmount;
      decimals = Number(info.decimals);
      amount += BigInt(info.amount);
    }
  }
  return { amount, decimals };
}

export function toUiAmount(amount: bigint, decimals: number): number {
  return Number(amount) / 10 ** decimals;
}
