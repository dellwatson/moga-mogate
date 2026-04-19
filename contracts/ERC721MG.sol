// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";

import { FHE, euint128, InEuint128 } from "@fhenixprotocol/cofhe-contracts/FHE.sol";

/// @title ERC721MG - Mogate Giftcode NFT with FHE-encrypted voucher codes
/// @notice Standard ERC721 compatible collection that stores an encrypted
///         giftcode handle per token, supports one-way redeem to soulbound,
///         and backend-only burn/cleanup.
contract ERC721MG is ERC721URIStorage, Ownable {
    mapping(address => bool) public operators;
    mapping(address => bool) public minters;

    uint256 private _nextTokenId;

    // =============================================================
    // Giftcode storage (FHE + optional ciphertext reference)
    // =============================================================

    /// @dev Encrypted AES (or other secret) key handle per token.
    ///      The value is an euint128 ciphertext managed by FHE ACL.
    mapping(uint256 => euint128) private _encKey;

    /// @dev Optional reference to the ciphertext payload (e.g. IPFS CID,
    ///      HTTPS URL, or on-chain hex-encoded blob).
    mapping(uint256 => string) private _cipherRef;

    /// @dev Tracks whether a token has been redeemed and is now soulbound.
    mapping(uint256 => bool) private _redeemed;

    // =============================================================
    // Modifiers & roles
    // =============================================================

    modifier onlyOwnerOrOperator() {
        require(owner() == msg.sender || operators[msg.sender], "Not owner/operator");
        _;
    }

    modifier onlyMinter() {
        require(minters[msg.sender], "Not minter");
        _;
    }

    constructor(string memory name_, string memory symbol_)
        ERC721(name_, symbol_)
        Ownable(msg.sender)
    {}

    // =============================================================
    // Admin role management
    // =============================================================

    function setOperator(address operator, bool allowed) external onlyOwner {
        operators[operator] = allowed;
    }

    /// @notice Manage addresses allowed to mint giftcode NFTs.
    /// @dev This role is only for issuance control and is independent from
    ///      FHE decrypt permissions (granted on redeem).
    function setMinter(address minter, bool allowed) external onlyOwnerOrOperator {
        minters[minter] = allowed;
    }

    // =============================================================
    // Minting / tokenisation
    // =============================================================

    /// @notice Mint a new giftcode NFT with an encrypted key and optional ciphertext reference.
    /// @param to Recipient of the NFT.
    /// @param uri Public metadata URI (visible to everyone).
    /// @param encKey Encrypted key produced by @cofhe/sdk (InEuint128).
    /// @param cipherRef Reference to ciphertext payload (IPFS CID, URL, or hex string).
    function mintGiftcode(
        address to,
        string calldata uri,
        InEuint128 calldata encKey,
        string calldata cipherRef
    ) external onlyMinter returns (uint256 tokenId) {
        tokenId = ++_nextTokenId;
        _safeMint(to, tokenId);
        _setTokenURI(tokenId, uri);

        euint128 keyHandle = FHE.asEuint128(encKey);
        FHE.allowThis(keyHandle);

        _encKey[tokenId] = keyHandle;
        _cipherRef[tokenId] = cipherRef;
    }

    /// @notice Optional variant that mints with an explicit tokenId.
    function mintGiftcodeWithTokenId(
        address to,
        uint256 tokenId,
        string calldata uri,
        InEuint128 calldata encKey,
        string calldata cipherRef
    ) external onlyMinter returns (uint256) {
        _safeMint(to, tokenId);
        _setTokenURI(tokenId, uri);

        euint128 keyHandle = FHE.asEuint128(encKey);
        FHE.allowThis(keyHandle);

        _encKey[tokenId] = keyHandle;
        _cipherRef[tokenId] = cipherRef;

        if (tokenId > _nextTokenId) {
            _nextTokenId = tokenId;
        }

        return tokenId;
    }

    // =============================================================
    // Read helpers
    // =============================================================

    function cipherRef(uint256 tokenId) external view returns (string memory) {
        require(_ownerOf(tokenId) != address(0), "Nonexistent");
        return _cipherRef[tokenId];
    }

    /// @notice Return the encrypted key handle for this token.
    /// @dev The handle is safe to expose; only addresses granted by FHE ACL
    ///      can decrypt it using cofhe SDK.
    function encryptedKey(uint256 tokenId) external view returns (euint128) {
        require(_ownerOf(tokenId) != address(0), "Nonexistent");
        return _encKey[tokenId];
    }

    function isRedeemed(uint256 tokenId) external view returns (bool) {
        require(_ownerOf(tokenId) != address(0), "Nonexistent");
        return _redeemed[tokenId];
    }

    // =============================================================
    // Redeem → Soulbound + FHE unlock (no backend)
    // =============================================================

    /// @notice Redeem a giftcode NFT into a soulbound token and grant
    ///         the redeemer (current holder) FHE read access.
    function redeemToSoulbound(uint256 tokenId) external {
        require(ownerOf(tokenId) == msg.sender, "NotOwner");
        require(!_redeemed[tokenId], "AlreadyRedeemed");

        _redeemed[tokenId] = true;

        euint128 keyHandle = _encKey[tokenId];
        require(FHE.isInitialized(keyHandle), "CodeMissing");

        // Allow this holder to decrypt via cofhe SDK decryptForView.
        FHE.allow(keyHandle, msg.sender);
    }

    // =============================================================
    // Backend-only burn / cleanup
    // =============================================================

    /// @notice Burn a redeemed (soulbound) token and clear encrypted data.
    /// @dev Intended to be called by backend after the off-chain giftcode
    ///      has been invalidated/consumed at the merchant.
    function backendBurnRedeemed(uint256 tokenId) external onlyOwnerOrOperator {
        require(_redeemed[tokenId], "NotRedeemed");
        _burn(tokenId);

        _encKey[tokenId] = euint128.wrap(0);
        _cipherRef[tokenId] = "";

    }

    // =============================================================
    // Soulbound behaviour
    // =============================================================

    function _requireNotSoulbound(uint256 tokenId) internal view {
        require(!_redeemed[tokenId], "Soulbound");
    }

    function transferFrom(
        address from,
        address to,
        uint256 tokenId
    ) public override(ERC721, IERC721) {
        _requireNotSoulbound(tokenId);
        super.transferFrom(from, to, tokenId);
    }

    function safeTransferFrom(
        address from,
        address to,
        uint256 tokenId,
        bytes memory data
    ) public override(ERC721, IERC721) {
        _requireNotSoulbound(tokenId);
        super.safeTransferFrom(from, to, tokenId, data);
    }

    // =============================================================
    // Optional user burn (pre-redeem only)
    // =============================================================

    /// @notice Allow holder/approved to burn a non-redeemed NFT.
    function burn(uint256 tokenId) external {
        address owner_ = ownerOf(tokenId);
        require(!_redeemed[tokenId], "Soulbound");
        require(
            msg.sender == owner_ ||
                isApprovedForAll(owner_, msg.sender) ||
                getApproved(tokenId) == msg.sender,
            "Not owner/approved"
        );
        _burn(tokenId);

        _encKey[tokenId] = euint128.wrap(0);
        _cipherRef[tokenId] = "";
    }
}
