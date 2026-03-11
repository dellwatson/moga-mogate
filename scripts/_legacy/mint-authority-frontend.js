/**
 * Mint NFT through Authority Gateway V2 (PUBLIC)
 *
 * FRONTEND-COMPATIBLE VERSION
 * This shows the pattern for using in React/Vue/etc
 *
 * Note: In actual frontend, you'll use a bundler (Vite/Webpack)
 * that handles the Aleo SDK's WASM properly
 */

// This is how you'd import in your frontend
// import { createClient } from '../ts-sdk/src/index';

/**
 * Mint an NFT through the authority gateway
 *
 * @param {string} privateKey - User's Aleo private key
 * @param {string} toAddress - Recipient Aleo address
 * @param {string} uriHash - Metadata URI hash (as field)
 * @returns {Promise<string>} Transaction result
 */
export async function mintNFT(privateKey, toAddress, uriHash) {
  // Dynamic import to avoid issues with SSR/build
  const { createClient } = await import("../../ts-sdk/src/index.js");

  // Create client with user's private key
  const client = createClient(privateKey);

  // Generate token ID from timestamp
  const tokenId = `${Date.now()}u64`;

  console.log("🎨 Minting NFT...");
  console.log("To:", toAddress);
  console.log("URI Hash:", uriHash);
  console.log("Token ID:", tokenId);

  // Execute mint through gateway
  const result = await client.mintAuthority(toAddress, uriHash, tokenId);

  console.log("✅ Mint successful!");
  console.log("Result:", result);

  return result;
}

/**
 * React Component Example
 */
export function MintNFTButton() {
  const handleMint = async () => {
    try {
      const privateKey = "APrivateKey1zkp..."; // From wallet
      const toAddress =
        "aleo1yv0wuzhwr68dkstlcl4keu4j6s0d3fzhqz0fzge6fz4w3wjwmq9s6jza3u";
      const uriHash = "123456789field";

      const result = await mintNFT(privateKey, toAddress, uriHash);
      alert("NFT Minted! TX: " + result);
    } catch (error) {
      console.error("Mint failed:", error);
      alert("Mint failed: " + error.message);
    }
  };

  return <button onClick={handleMint}>Mint NFT</button>;
}

/**
 * Vue Component Example
 */
export const MintNFTComponent = {
  template: `
    <button @click="handleMint">
      Mint NFT
    </button>
  `,
  methods: {
    async handleMint() {
      try {
        const privateKey = "APrivateKey1zkp..."; // From wallet
        const toAddress =
          "aleo1yv0wuzhwr68dkstlcl4keu4j6s0d3fzhqz0fzge6fz4w3wjwmq9s6jza3u";
        const uriHash = "123456789field";

        const result = await mintNFT(privateKey, toAddress, uriHash);
        alert("NFT Minted! TX: " + result);
      } catch (error) {
        console.error("Mint failed:", error);
        alert("Mint failed: " + error.message);
      }
    },
  },
};

// Export for use in other modules
export default { mintNFT, MintNFTButton, MintNFTComponent };
