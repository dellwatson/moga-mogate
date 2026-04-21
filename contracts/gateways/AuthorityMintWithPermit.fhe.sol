// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import { ECDSA } from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import { MessageHashUtils } from "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";
import { FHE, InEuint128 } from "@fhenixprotocol/cofhe-contracts/FHE.sol";

interface IFHECollection {
    /// @notice Mint a new giftcode NFT with encrypted key.
    /// @param to Recipient address.
    /// @param uri Metadata URI for the newly minted token.
    /// @param encKey FHE encrypted key handle.
    /// @param cipherRef Reference to ciphertext payload.
    /// @return tokenId The minted token id.
    function mint(address to, string calldata uri, InEuint128 calldata encKey, string calldata cipherRef) external returns (uint256 tokenId);
}

/// @title FHEAuthorityMintWithPermit
/// @notice FHE-enabled authority mint contract that mints giftcode NFTs based on signed permits.
/// @dev The backend signs permits off-chain; users submit them on-chain to mint.
/// This allows dynamic minting rules and pricing to live in the backend.
contract FHEAuthorityMintWithPermit is Ownable {

    /// @notice Target FHE giftcode collection that will receive minted tokens.
    IFHECollection public collection;
    /// @notice Backend EOA that signs mint permits.
    address public backendSigner;

    /// @notice Tracks which permit hashes have already been consumed.
    mapping(bytes32 => bool) public usedPermits;

    /// @notice Emitted when the backend signer address is updated.
    event BackendSignerUpdated(address indexed signer);
    /// @notice Emitted when the target collection address is updated.
    event CollectionUpdated(address indexed collection);
    /// @notice Emitted after a successful permit-based mint.
    event MintedWithPermit(address indexed to, uint256 indexed tokenId, uint256 nonce, string uri);

    /// @param backendSigner_ Initial backend signer EOA.
    /// @param collection_ Initial target collection contract.
    constructor(address backendSigner_, address collection_)
        Ownable(msg.sender)
    {
        require(backendSigner_ != address(0), "Invalid signer");
        require(collection_ != address(0), "Invalid collection");
        backendSigner = backendSigner_;
        collection = IFHECollection(collection_);
    }

    /// @notice Update the backend signer that is allowed to authorize mints.
    /// @param backendSigner_ New backend signer EOA.
    function setBackendSigner(address backendSigner_) external onlyOwner {
        require(backendSigner_ != address(0), "Invalid signer");
        backendSigner = backendSigner_;
        emit BackendSignerUpdated(backendSigner_);
    }

    /// @notice Point this authority contract at a new collection.
    /// @param collection_ New collection contract address.
    function setCollection(address collection_) external onlyOwner {
        require(collection_ != address(0), "Invalid collection");
        collection = IFHECollection(collection_);
        emit CollectionUpdated(collection_);
    }

    /// @notice Mint a new giftcode NFT using a signed backend permit.
    /// @dev The permit binds (this contract, recipient, uri, encKey, cipherRef, amount, nonce, expiry).
    /// Reverts if the permit is expired, reused, or not signed by `backendSigner`.
    /// @param to Recipient of the NFT.
    /// @param uri Metadata URI for the NFT.
    /// @param encKey FHE encrypted key handle.
    /// @param cipherRef Reference to ciphertext payload.
    /// @param amount Payment amount required.
    /// @param nonce Unique nonce to prevent replay.
    /// @param expiry Unix timestamp after which the permit is invalid.
    /// @param signature Backend ECDSA signature over the permit payload.
    function mintWithPermit(
        address to,
        string calldata uri,
        InEuint128 calldata encKey,
        string calldata cipherRef,
        uint256 amount,
        uint256 nonce,
        uint256 expiry,
        bytes calldata signature
    ) external payable returns (uint256 tokenId) {
        require(block.timestamp <= expiry, "Permit expired");
        require(to != address(0), "Invalid recipient");
        require(amount > 0, "Amount must be greater than 0");

        bytes32 permitId = keccak256(abi.encodePacked(address(this), to, keccak256(bytes(uri)), encKey.ctHash, keccak256(bytes(cipherRef)), amount, nonce, expiry));
        require(!usedPermits[permitId], "Permit used");

        bytes32 hash = MessageHashUtils.toEthSignedMessageHash(permitId);
        address signer = ECDSA.recover(hash, signature);
        require(signer == backendSigner, "Invalid signature");

        usedPermits[permitId] = true;

        tokenId = collection.mint(to, uri, encKey, cipherRef);

        emit MintedWithPermit(to, tokenId, nonce, uri);
    }
}
