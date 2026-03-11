// Authority Mint Gateway Program for Aleo - V2 (private ARC-721)
// Public minting with signature verification (coming soon)
// FOR FAUCET PURPOSE - TESTNET ONLY
// v3: replace with private

import mogate_arc721_multiprivate.aleo;

program mogate_authority_mint_v4.aleo {
    @noupgrade
    async constructor() {}

    // Public mint of private NFT (record-based)
    // Cross-calls the private ARC-721 collection
    async transition mint_private(
        public collection_id: field,
        public to: address,
        private nft_data: data,
        private nft_edition: scalar
    ) -> (mogate_arc721_multiprivate.aleo/PrivateNFT, Future) {
        let (nft, mint_future): (mogate_arc721_multiprivate.aleo/PrivateNFT, Future) =
            mogate_arc721_multiprivate.aleo/mint_private(
                collection_id,
                to,
                nft_data,
                nft_edition
            );

        let future: Future = finalize_mint_private(mint_future);
        return (nft, future);
    }

    async function finalize_mint_private(mint_future: Future) {
        // No permission checks - public access
        mint_future.await();
    }

    // Signature-based mint (PLACEHOLDER - to be implemented)
    // Will verify signature before minting
    async transition mint_private_with_signature(
        public collection_id: field,
        public to: address,
        private nft_data: data,
        private nft_edition: scalar,
        public signature: signature
    ) -> (mogate_arc721_multiprivate.aleo/PrivateNFT, Future) {
        // TODO: Implement signature verification
        let (nft, mint_future): (mogate_arc721_multiprivate.aleo/PrivateNFT, Future) =
            mogate_arc721_multiprivate.aleo/mint_private(
                collection_id,
                to,
                nft_data,
                nft_edition
            );

        let future: Future = finalize_mint_sig(mint_future);
        return (nft, future);
    }

    async function finalize_mint_sig(mint_future: Future) {
        // TODO: Add signature verification logic here
        mint_future.await();
    }
}
