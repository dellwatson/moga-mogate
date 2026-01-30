/**
 * Frontend Mint Client
 *
 * Use this in your React/Vue frontend to call the mint API
 */

const API_URL = "http://localhost:3001";

/**
 * Mint an NFT through the backend API
 *
 * @param {string} toAddress - Recipient Aleo address
 * @param {string} uriHash - Metadata URI hash (as field)
 * @param {string} tokenId - Optional token ID (defaults to timestamp)
 * @returns {Promise<object>} Mint result with transaction ID
 */
export async function mintNFT(toAddress, uriHash, tokenId) {
  const response = await fetch(`${API_URL}/mint`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      toAddress,
      uriHash,
      tokenId: tokenId || `${Date.now()}u64`,
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || "Mint failed");
  }

  return data;
}

/**
 * React Component Example
 */
export function MintNFTButton({ toAddress, uriHash }) {
  const [loading, setLoading] = React.useState(false);
  const [result, setResult] = React.useState(null);
  const [error, setError] = React.useState(null);

  const handleMint = async () => {
    setLoading(true);
    setError(null);

    try {
      const data = await mintNFT(toAddress, uriHash);
      setResult(data);
      alert(`NFT Minted! TX: ${data.transactionId}`);
    } catch (err) {
      setError(err.message);
      alert(`Mint failed: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <button onClick={handleMint} disabled={loading}>
        {loading ? "Minting..." : "Mint NFT"}
      </button>
      {result && <p>✅ TX: {result.transactionId}</p>}
      {error && <p>❌ Error: {error}</p>}
    </div>
  );
}

/**
 * Vue Component Example
 */
export const MintNFTComponent = {
  props: ["toAddress", "uriHash"],
  data() {
    return {
      loading: false,
      result: null,
      error: null,
    };
  },
  methods: {
    async handleMint() {
      this.loading = true;
      this.error = null;

      try {
        const data = await mintNFT(this.toAddress, this.uriHash);
        this.result = data;
        alert(`NFT Minted! TX: ${data.transactionId}`);
      } catch (err) {
        this.error = err.message;
        alert(`Mint failed: ${err.message}`);
      } finally {
        this.loading = false;
      }
    },
  },
  template: `
    <div>
      <button @click="handleMint" :disabled="loading">
        {{ loading ? 'Minting...' : 'Mint NFT' }}
      </button>
      <p v-if="result">✅ TX: {{ result.transactionId }}</p>
      <p v-if="error">❌ Error: {{ error }}</p>
    </div>
  `,
};

export default { mintNFT, MintNFTButton, MintNFTComponent };
