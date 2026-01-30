// Authority Mint Gateway Program for Aleo - V2
// Public minting with signature verification (coming soon)

import mogate_nft_collection_rwa.aleo;

program mogate_authority_mint_v2.aleo {
    @noupgrade
    async constructor() {}

    // Public mint - anyone can mint with specific token ID
    // Cross-calls collection contract
    async transition mint(
        public to: address,
        public uri_hash: field,
        public token_id: u64
    ) -> Future {
        // Call the collection contract to mint
        let (nft, mint_future): (mogate_nft_collection_rwa.aleo/NFT, Future) = 
            mogate_nft_collection_rwa.aleo/mint_with_token_id(to, token_id, uri_hash);
        
        return finalize_mint(mint_future);
    }

    async function finalize_mint(mint_future: Future) {
        // No permission checks - public access
        mint_future.await();
    }

    // Public mint with auto-incrementing token ID
    // Cross-calls collection contract
    async transition mint_nft(
        public to: address,
        public uri_hash: field
    ) -> Future {
        // Call the collection contract to mint with auto-increment
        let (nft, mint_future): (mogate_nft_collection_rwa.aleo/NFT, Future) = 
            mogate_nft_collection_rwa.aleo/mint_to(to, uri_hash);
        
        return finalize_mint_nft(mint_future);
    }

    async function finalize_mint_nft(mint_future: Future) {
        // No permission checks - public access
        mint_future.await();
    }

    // Signature-based mint (PLACEHOLDER - to be implemented)
    // Will verify signature before minting
    async transition mint_with_signature(
        public to: address,
        public uri_hash: field,
        public token_id: u64,
        public signature: signature
    ) -> Future {
        // TODO: Implement signature verification
        // For now, just call mint
        let (nft, mint_future): (mogate_nft_collection_rwa.aleo/NFT, Future) = 
            mogate_nft_collection_rwa.aleo/mint_with_token_id(to, token_id, uri_hash);
        
        return finalize_mint_with_signature(mint_future);
    }

    async function finalize_mint_with_signature(mint_future: Future) {
        // TODO: Add signature verification logic here
        // For now, just await the mint
        mint_future.await();
    }
}

