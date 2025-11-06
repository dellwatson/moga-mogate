// RWA helpers (metadata fetch via DAS)
// These are client-side helpers for display/validation; on-chain checks happen in set_prize_nft.

export async function getAssetViaDas(dasRpcUrl: string, id: string): Promise<any> {
  const body = {
    jsonrpc: "2.0",
    id: "get-asset",
    method: "getAsset",
    params: { id },
  };
  const res = await fetch(dasRpcUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`DAS error: ${res.status} ${await res.text()}`);
  const json = await res.json();
  return json?.result;
}

export async function listAssetsByCollection(
  dasRpcUrl: string,
  ownerAddress: string,
  collectionMint: string,
  page = 1,
  limit = 1000,
): Promise<any[]> {
  const body = {
    jsonrpc: "2.0",
    id: "search-assets",
    method: "searchAssets",
    params: {
      ownerAddress,
      grouping: ["collection", collectionMint],
      page,
      limit,
      displayOptions: { showCollectionMetadata: true },
    },
  };
  const res = await fetch(dasRpcUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`DAS error: ${res.status} ${await res.text()}`);
  const json = await res.json();
  return json?.result?.items || [];
}
