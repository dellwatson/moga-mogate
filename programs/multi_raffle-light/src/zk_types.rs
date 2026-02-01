// ZK-Compression types for Light Protocol integration
use anchor_lang::prelude::*;
use light_hasher::Poseidon;

/// Represents a single slot in the compressed Merkle tree
/// Each slot is a leaf with: raffle ID, slot number, and owner
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug)]
pub struct SlotLeaf {
    pub raffle: Pubkey,
    pub slot_id: u32,
    pub owner: Pubkey,
}

impl SlotLeaf {
    /// Hash the leaf for Merkle tree insertion
    pub fn hash(&self) -> [u8; 32] {
        let mut data = Vec::new();
        data.extend_from_slice(&self.raffle.to_bytes());
        data.extend_from_slice(&self.slot_id.to_le_bytes());
        data.extend_from_slice(&self.owner.to_bytes());
        
        // Use Poseidon hash (Light Protocol standard)
        let mut hasher = Poseidon::new();
        hasher.hash(&data)
    }
    
    /// Create an empty (unoccupied) slot
    pub fn empty(raffle: Pubkey, slot_id: u32) -> Self {
        Self {
            raffle,
            slot_id,
            owner: Pubkey::default(),
        }
    }
    
    /// Check if slot is empty
    pub fn is_empty(&self) -> bool {
        self.owner == Pubkey::default()
    }
}

/// Merkle proof for verifying slot ownership
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug)]
pub struct MerkleProof {
    pub leaf: [u8; 32],
    pub proof: Vec<[u8; 32]>,
    pub leaf_index: u32,
}

impl MerkleProof {
    /// Verify proof against a root
    pub fn verify(&self, root: &[u8; 32]) -> bool {
        let mut current = self.leaf;
        let mut index = self.leaf_index;
        
        for sibling in &self.proof {
            current = if index % 2 == 0 {
                hash_pair(&current, sibling)
            } else {
                hash_pair(sibling, &current)
            };
            index /= 2;
        }
        
        current == *root
    }
}

/// Hash two nodes together (Poseidon)
pub fn hash_pair(left: &[u8; 32], right: &[u8; 32]) -> [u8; 32] {
    let mut data = Vec::new();
    data.extend_from_slice(left);
    data.extend_from_slice(right);
    
    let mut hasher = Poseidon::new();
    hasher.hash(&data)
}

/// Empty Merkle root constant (for newly initialized trees)
pub const EMPTY_MERKLE_ROOT: [u8; 32] = [0u8; 32];

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_slot_leaf_hash() {
        let raffle = Pubkey::new_unique();
        let leaf = SlotLeaf {
            raffle,
            slot_id: 1,
            owner: Pubkey::default(),
        };
        
        let hash1 = leaf.hash();
        let hash2 = leaf.hash();
        
        // Hashing should be deterministic
        assert_eq!(hash1, hash2);
    }
    
    #[test]
    fn test_empty_slot() {
        let raffle = Pubkey::new_unique();
        let empty = SlotLeaf::empty(raffle, 5);
        
        assert!(empty.is_empty());
        assert_eq!(empty.slot_id, 5);
        assert_eq!(empty.raffle, raffle);
    }
}
