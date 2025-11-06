// Ticket (refund NFT) helpers
// Uses DAS searchAssets to list compressed NFTs for a collection owned by address.

export async function listRefundTicketsViaDas(
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
      displayOptions: { showCollectionMetadata: true, showUnverifiedCollections: false },
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
