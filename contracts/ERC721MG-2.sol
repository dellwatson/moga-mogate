// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/EIP712.sol";

/// @title ERC721MGProgrammableVault
/// @notice Experimental next-generation Mogate giftcard .
/// @dev This contract intentionally does not replace ERC721MG. It sketches:
///      - pre-unwrap programmable transfer codes,
///      - post-unwrap soulbound redemption state,
///      - per-token native fee reserve for merchant-paid execution,
///      - email/embedded-wallet claim,
///      - optional encrypted private-key references for future FHE signing R&D.
contract ERC721MGProgrammableVault is ERC721, ERC721Enumerable, ERC721URIStorage, EIP712, Ownable {
    using ECDSA for bytes32;

    enum GiftcardKind {
        HybridCode,
        FullOnchainVault
    }

    enum CapabilityAction {
        TransferBeforeUnwrap,
        PayAfterUnwrap,
        WithdrawAfterUnwrap
    }

    struct GiftcardConfig {
        GiftcardKind kind;
        bool unwrapped;
        bool pendingEmailClaim;
        uint96 feeReserve;
        bytes32 emailCommitment;
        string encryptedGiftcodeRef;
        string encryptedPrivateKeyRef;
    }

    struct TransferCode {
        uint256 tokenId;
        address holder;
        address recipient;
        uint256 nonce;
        uint256 expiry;
        uint96 maxExecutorReward;
        bool bearer;
    }

    struct EmailClaim {
        uint256 tokenId;
        address recipient;
        bytes32 emailCommitment;
        uint256 nonce;
        uint256 expiry;
    }

    bytes32 private constant TRANSFER_CODE_TYPEHASH = keccak256(
        "TransferCode(uint256 tokenId,address holder,address recipient,uint256 nonce,uint256 expiry,uint96 maxExecutorReward,bool bearer)"
    );
    bytes32 private constant EMAIL_CLAIM_TYPEHASH = keccak256(
        "EmailClaim(uint256 tokenId,address recipient,bytes32 emailCommitment,uint256 nonce,uint256 expiry)"
    );

    uint256 private _nextTokenId;

    address public emailVerifier;
    mapping(address => bool) public minters;
    mapping(uint256 => GiftcardConfig) private _giftcards;
    mapping(bytes32 => bool) public usedCodes;
    mapping(bytes32 => bool) public usedEmailClaims;

    event MinterUpdated(address indexed minter, bool allowed);
    event EmailVerifierUpdated(address indexed verifier);
    event GiftcardMinted(
        uint256 indexed tokenId,
        address indexed owner,
        GiftcardKind kind,
        bool pendingEmailClaim,
        bytes32 emailCommitment
    );
    event FeeReserveDeposited(uint256 indexed tokenId, address indexed from, uint256 amount);
    event ExecutorRewardPaid(uint256 indexed tokenId, address indexed executor, uint256 amount);
    event TransferCodeRedeemed(
        uint256 indexed tokenId,
        address indexed executor,
        address indexed from,
        address to,
        bool bearer
    );
    event EmailGiftcardClaimed(uint256 indexed tokenId, address indexed recipient, bytes32 emailCommitment);
    event GiftcardUnwrapped(uint256 indexed tokenId, address indexed holder);
    event ExperimentalEncryptedPrivateKeyRefSet(uint256 indexed tokenId, string encryptedPrivateKeyRef);

    modifier onlyMinter() {
        require(minters[msg.sender] || msg.sender == owner(), "NotMinter");
        _;
    }

    constructor(address initialOwner, address initialEmailVerifier)
        ERC721("Mogate Programmable Giftcard", "MPG")
        EIP712("MogateProgrammableGiftcard", "1")
        Ownable(initialOwner)
    {
        emailVerifier = initialEmailVerifier;
        emit EmailVerifierUpdated(initialEmailVerifier);
    }

    receive() external payable {}

    function setMinter(address minter, bool allowed) external onlyOwner {
        minters[minter] = allowed;
        emit MinterUpdated(minter, allowed);
    }

    function setEmailVerifier(address verifier) external onlyOwner {
        emailVerifier = verifier;
        emit EmailVerifierUpdated(verifier);
    }

    function mintToHolder(
        address to,
        string calldata uri,
        GiftcardKind kind,
        string calldata encryptedGiftcodeRef,
        string calldata encryptedPrivateKeyRef
    ) external payable onlyMinter returns (uint256 tokenId) {
        require(to != address(0), "BadRecipient");

        tokenId = _mintGiftcard(to, uri, kind, bytes32(0), false, encryptedGiftcodeRef, encryptedPrivateKeyRef);
        if (msg.value > 0) {
            _giftcards[tokenId].feeReserve += uint96(msg.value);
            emit FeeReserveDeposited(tokenId, msg.sender, msg.value);
        }
    }

    /// @notice Mint to contract escrow until the email owner claims into an embedded wallet.
    /// @dev `emailCommitment` should be a hash/commitment, not a plaintext email.
    function mintToEmail(
        string calldata uri,
        GiftcardKind kind,
        bytes32 emailCommitment,
        string calldata encryptedGiftcodeRef,
        string calldata encryptedPrivateKeyRef
    ) external payable onlyMinter returns (uint256 tokenId) {
        require(emailCommitment != bytes32(0), "BadEmailCommitment");

        tokenId = _mintGiftcard(
            address(this),
            uri,
            kind,
            emailCommitment,
            true,
            encryptedGiftcodeRef,
            encryptedPrivateKeyRef
        );
        if (msg.value > 0) {
            _giftcards[tokenId].feeReserve += uint96(msg.value);
            emit FeeReserveDeposited(tokenId, msg.sender, msg.value);
        }
    }

    function depositFeeReserve(uint256 tokenId) external payable {
        require(_ownerOf(tokenId) != address(0), "Nonexistent");
        require(msg.value > 0, "NoValue");
        _giftcards[tokenId].feeReserve += uint96(msg.value);
        emit FeeReserveDeposited(tokenId, msg.sender, msg.value);
    }

    function claimEmailGiftcard(EmailClaim calldata claim, bytes calldata verifierSignature) external {
        GiftcardConfig storage card = _giftcards[claim.tokenId];
        require(card.pendingEmailClaim, "NotPendingEmail");
        require(ownerOf(claim.tokenId) == address(this), "NotEscrowed");
        require(claim.recipient != address(0), "BadRecipient");
        require(claim.emailCommitment == card.emailCommitment, "BadEmailCommitment");
        require(block.timestamp <= claim.expiry, "Expired");

        bytes32 digest = _hashTypedDataV4(
            keccak256(
                abi.encode(
                    EMAIL_CLAIM_TYPEHASH,
                    claim.tokenId,
                    claim.recipient,
                    claim.emailCommitment,
                    claim.nonce,
                    claim.expiry
                )
            )
        );
        require(!usedEmailClaims[digest], "ClaimUsed");
        require(digest.recover(verifierSignature) == emailVerifier, "BadVerifier");

        usedEmailClaims[digest] = true;
        card.pendingEmailClaim = false;
        _transfer(address(this), claim.recipient, claim.tokenId);

        emit EmailGiftcardClaimed(claim.tokenId, claim.recipient, claim.emailCommitment);
    }

    /// @notice Redeem a pre-unwrap transfer code. Merchant/recipient can call and receive gas reward.
    /// @dev If `code.bearer` is true, `redeemTo` receives the NFT. If false, `code.recipient` receives it.
    function redeemTransferCode(
        TransferCode calldata code,
        address redeemTo,
        bytes calldata holderSignature
    ) external {
        GiftcardConfig storage card = _giftcards[code.tokenId];
        require(!card.unwrapped, "AlreadyUnwrapped");
        require(!card.pendingEmailClaim, "PendingEmailClaim");
        require(block.timestamp <= code.expiry, "Expired");
        require(ownerOf(code.tokenId) == code.holder, "HolderChanged");

        address recipient = code.bearer ? redeemTo : code.recipient;
        require(recipient != address(0), "BadRecipient");

        bytes32 digest = transferCodeDigest(code);
        require(!usedCodes[digest], "CodeUsed");
        require(digest.recover(holderSignature) == code.holder, "BadHolderSignature");

        usedCodes[digest] = true;
        _transfer(code.holder, recipient, code.tokenId);
        _payExecutorReward(code.tokenId, msg.sender, code.maxExecutorReward);

        emit TransferCodeRedeemed(code.tokenId, msg.sender, code.holder, recipient, code.bearer);
    }

    /// @notice Convert the NFT into a soulbound redeemed state.
    /// @dev Hybrid cards can reveal/decrypt giftcode after this. Full-onchain cards enable future pay/withdraw flows.
    function unwrap(uint256 tokenId) external {
        require(ownerOf(tokenId) == msg.sender, "NotOwner");
        GiftcardConfig storage card = _giftcards[tokenId];
        require(!card.unwrapped, "AlreadyUnwrapped");
        require(!card.pendingEmailClaim, "PendingEmailClaim");

        card.unwrapped = true;
        emit GiftcardUnwrapped(tokenId, msg.sender);
    }

    function transferCodeDigest(TransferCode calldata code) public view returns (bytes32) {
        return _hashTypedDataV4(
            keccak256(
                abi.encode(
                    TRANSFER_CODE_TYPEHASH,
                    code.tokenId,
                    code.holder,
                    code.recipient,
                    code.nonce,
                    code.expiry,
                    code.maxExecutorReward,
                    code.bearer
                )
            )
        );
    }

    function giftcardConfig(uint256 tokenId) external view returns (GiftcardConfig memory) {
        require(_ownerOf(tokenId) != address(0), "Nonexistent");
        return _giftcards[tokenId];
    }

    function _mintGiftcard(
        address to,
        string calldata uri,
        GiftcardKind kind,
        bytes32 emailCommitment,
        bool pendingEmailClaim,
        string calldata encryptedGiftcodeRef,
        string calldata encryptedPrivateKeyRef
    ) internal returns (uint256 tokenId) {
        tokenId = _nextTokenId++;
        if (to == address(this)) {
            _mint(to, tokenId);
        } else {
            _safeMint(to, tokenId);
        }
        _setTokenURI(tokenId, uri);

        _giftcards[tokenId] = GiftcardConfig({
            kind: kind,
            unwrapped: false,
            pendingEmailClaim: pendingEmailClaim,
            feeReserve: 0,
            emailCommitment: emailCommitment,
            encryptedGiftcodeRef: encryptedGiftcodeRef,
            encryptedPrivateKeyRef: encryptedPrivateKeyRef
        });

        emit GiftcardMinted(tokenId, to, kind, pendingEmailClaim, emailCommitment);
        if (bytes(encryptedPrivateKeyRef).length > 0) {
            emit ExperimentalEncryptedPrivateKeyRefSet(tokenId, encryptedPrivateKeyRef);
        }
    }

    function _payExecutorReward(uint256 tokenId, address executor, uint96 maxReward) internal {
        if (maxReward == 0 || executor == address(0)) return;

        GiftcardConfig storage card = _giftcards[tokenId];
        uint96 reward = card.feeReserve < maxReward ? card.feeReserve : maxReward;
        if (reward == 0) return;

        card.feeReserve -= reward;
        (bool ok, ) = payable(executor).call{value: reward}("");
        require(ok, "RewardFailed");
        emit ExecutorRewardPaid(tokenId, executor, reward);
    }

    function _requireNotSoulbound(uint256 tokenId) internal view {
        require(!_giftcards[tokenId].unwrapped, "Soulbound");
    }

    function transferFrom(address from, address to, uint256 tokenId) public override(ERC721, IERC721) {
        _requireNotSoulbound(tokenId);
        super.transferFrom(from, to, tokenId);
    }

    function safeTransferFrom(address from, address to, uint256 tokenId, bytes memory data)
        public
        override(ERC721, IERC721)
    {
        _requireNotSoulbound(tokenId);
        super.safeTransferFrom(from, to, tokenId, data);
    }

    function _update(address to, uint256 tokenId, address auth)
        internal
        override(ERC721, ERC721Enumerable)
        returns (address)
    {
        return super._update(to, tokenId, auth);
    }

    function _increaseBalance(address account, uint128 value) internal override(ERC721, ERC721Enumerable) {
        super._increaseBalance(account, value);
    }

    function tokenURI(uint256 tokenId) public view override(ERC721, ERC721URIStorage) returns (string memory) {
        return super.tokenURI(tokenId);
    }

    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721, ERC721URIStorage, ERC721Enumerable)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}
