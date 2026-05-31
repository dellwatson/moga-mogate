// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import { ECDSA } from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import { MessageHashUtils } from "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";
import { FHE, euint64, InEuint64, InEuint128 } from "@fhenixprotocol/cofhe-contracts/FHE.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

interface IFHECollection {
    /// @notice Mint a new giftcode NFT with encrypted key.
    /// @param to Recipient address.
    /// @param uri Metadata URI for the newly minted token.
    /// @param encKey FHE encrypted key handle.
    /// @param cipherRef Reference to ciphertext payload.
    /// @return tokenId The minted token id.
    function mint(address to, string calldata uri, InEuint128 calldata encKey, string calldata cipherRef) external returns (uint256 tokenId);
}

interface IFHERC20 {
    function confidentialTransfer(address to, euint64 amount) external returns (euint64);
    function confidentialTransferFrom(address from, address to, euint64 amount) external returns (euint64);
}

/// @title FHEAuthorityMintWithPermit
/// @notice FHE-enabled authority mint contract that mints giftcode NFTs based on signed permits.
/// @dev The backend signs permits off-chain; users submit them on-chain to mint.
/// This allows dynamic minting rules and pricing to live in the backend.
contract FHEAuthorityMintWithPermit is Ownable {
    using SafeERC20 for IERC20;

    /// @notice Mapping of allowed collections
    mapping(address => bool) public allowedCollections;
    /// @notice Backend EOA that signs mint permits.
    address public backendSigner;

    /// @notice Tracks which permit hashes have already been consumed.
    mapping(bytes32 => bool) public usedPermits;

    struct CheckoutParams {
        string orderId;
        address collection;
        address to;
        string uri;
        InEuint128 encKey;
        string cipherRef;
    }

    /// @notice Emitted when the backend signer address is updated.
    event BackendSignerUpdated(address indexed signer);
    /// @notice Emitted when a collection is allowed/disallowed.
    event CollectionAllowed(address indexed collection, bool allowed);
    /// @notice Emitted after a successful permit-based mint.
    event MintedWithPermit(address indexed to, uint256 indexed tokenId, uint256 nonce, string uri, address indexed collection);
    /// @notice Emitted when payment is received for an order.
    event OrderPaymentReceived(
        string indexed orderId,
        address indexed payer,
        address paymentToken,
        uint256 amount
    );
    event ConfidentialOrderPaymentReceived(
        string indexed orderId,
        address indexed payer,
        address indexed paymentToken,
        bytes32 transferredAmount
    );
    /// @notice Emitted when an order is executed.
    event OrderExecuted(
        string indexed orderId,
        address indexed executor,
        uint256 indexed tokenId,
        bool success
    );

    /// @param backendSigner_ Initial backend signer EOA.
    constructor(address backendSigner_)
        Ownable(msg.sender)
    {
        require(backendSigner_ != address(0), "Invalid signer");
        backendSigner = backendSigner_;
    }

    /// @notice Update the backend signer that is allowed to authorize mints.
    /// @param backendSigner_ New backend signer EOA.
    function setBackendSigner(address backendSigner_) external onlyOwner {
        require(backendSigner_ != address(0), "Invalid signer");
        backendSigner = backendSigner_;
        emit BackendSignerUpdated(backendSigner_);
    }

    /// @notice Allow or disallow a target collection to be minted into via this gateway.
    /// @param collection The collection contract address.
    /// @param allowed True to allow, false to disallow.
    function setCollectionAllowed(address collection, bool allowed) external onlyOwner {
        require(collection != address(0), "Invalid collection");
        allowedCollections[collection] = allowed;
        emit CollectionAllowed(collection, allowed);
    }

    function _collectStandardPayment(
        address paymentToken,
        uint256 amount
    ) internal {
        require(amount > 0, "Amount must be greater than 0");

        if (paymentToken == address(0)) {
            require(msg.value >= amount, "Insufficient ETH payment");
        } else {
            require(msg.value == 0, "ETH not accepted for ERC20 payment");
            IERC20(paymentToken).safeTransferFrom(
                msg.sender,
                address(this),
                amount
            );
        }
    }

    function _collectFherc20Payment(
        string calldata orderId,
        address paymentToken,
        address payer,
        InEuint64 calldata encAmount
    ) internal returns (bytes32 transferredAmount) {
        require(paymentToken != address(0), "Invalid FHERC20 token");
        require(msg.value == 0, "ETH not accepted for FHERC20 payment");

        euint64 amount = FHE.asEuint64(encAmount);
        FHE.allow(amount, paymentToken);

        euint64 transferred = IFHERC20(paymentToken).confidentialTransferFrom(
            payer,
            address(this),
            amount
        );
        FHE.allow(transferred, backendSigner);
        FHE.allow(transferred, owner());
        transferredAmount = euint64.unwrap(transferred);

        emit ConfidentialOrderPaymentReceived(
            orderId,
            payer,
            paymentToken,
            transferredAmount
        );
    }

    function _withdrawFherc20(
        address token,
        InEuint64 calldata encAmount
    ) internal returns (bytes32 transferredAmount) {
        require(token != address(0), "Invalid FHERC20 token");

        euint64 amount = FHE.asEuint64(encAmount);
        FHE.allow(amount, token);

        euint64 transferred = IFHERC20(token).confidentialTransfer(
            owner(),
            amount
        );
        return euint64.unwrap(transferred);
    }

    function _mintCheckout(
        CheckoutParams calldata checkout,
        uint256 nonce
    ) internal returns (uint256 tokenId) {
        require(bytes(checkout.orderId).length > 0, "Invalid order ID");
        require(checkout.collection != address(0), "Invalid collection");
        require(allowedCollections[checkout.collection], "Collection not allowed");
        require(checkout.to != address(0), "Invalid recipient");

        tokenId = IFHECollection(checkout.collection).mint(
            checkout.to,
            checkout.uri,
            checkout.encKey,
            checkout.cipherRef
        );

        emit OrderExecuted(checkout.orderId, msg.sender, tokenId, true);
        emit MintedWithPermit(checkout.to, tokenId, nonce, checkout.uri, checkout.collection);
    }

    function _checkoutPermitId(
        bytes32 mode,
        CheckoutParams calldata checkout,
        address paymentToken,
        uint256 amount,
        uint256 nonce,
        uint256 expiry
    ) internal view returns (bytes32) {
        return keccak256(abi.encode(
            address(this),
            msg.sender,
            mode,
            checkout.orderId,
            checkout.collection,
            checkout.to,
            keccak256(bytes(checkout.uri)),
            checkout.encKey.ctHash,
            keccak256(bytes(checkout.cipherRef)),
            paymentToken,
            amount,
            nonce,
            expiry
        ));
    }

    function _orderPermitId(
        bytes32 mode,
        string calldata orderId,
        address paymentToken,
        uint256 amount,
        uint256 nonce,
        uint256 expiry
    ) internal view returns (bytes32) {
        return keccak256(abi.encode(
            address(this),
            msg.sender,
            mode,
            orderId,
            paymentToken,
            amount,
            nonce,
            expiry
        ));
    }

    function _orderFherc20PermitId(
        bytes32 mode,
        string calldata orderId,
        address paymentToken,
        InEuint64 calldata encAmount,
        uint256 nonce,
        uint256 expiry
    ) internal view returns (bytes32) {
        return keccak256(abi.encode(
            address(this),
            msg.sender,
            mode,
            orderId,
            paymentToken,
            encAmount.ctHash,
            encAmount.securityZone,
            encAmount.utype,
            keccak256(encAmount.signature),
            nonce,
            expiry
        ));
    }

    function mintWithPermit(
        CheckoutParams calldata checkout,
        address paymentToken,
        uint256 amount,
        uint256 nonce,
        uint256 expiry,
        bytes calldata signature
    ) external payable returns (uint256 tokenId) {
        require(block.timestamp <= expiry, "Permit expired");

        _verifyAndUsePermit(
            _checkoutPermitId(
                "mintWithPermit",
                checkout,
                paymentToken,
                amount,
                nonce,
                expiry
            ),
            signature
        );

        _collectStandardPayment(paymentToken, amount);
        tokenId = _mintCheckout(checkout, nonce);

        emit OrderPaymentReceived(checkout.orderId, msg.sender, paymentToken, amount);
    }

    /// @notice Withdraw collected funds to owner.
    /// @param token Token address (address(0) for native ETH).
    /// @param amount Amount to withdraw.
    function withdraw(address token, uint256 amount) external onlyOwner {
        if (token == address(0)) {
            // Withdraw native ETH
            require(
                address(this).balance >= amount,
                "Insufficient ETH balance"
            );
            payable(owner()).transfer(amount);
        } else {
            // Withdraw ERC20 tokens
            IERC20 erc20 = IERC20(token);
            require(
                erc20.balanceOf(address(this)) >= amount,
                "Insufficient token balance"
            );
            erc20.safeTransfer(owner(), amount);
        }
    }

    function withdrawFherc20(
        address token,
        InEuint64 calldata encAmount
    ) external onlyOwner returns (bytes32 transferredAmount) {
        return _withdrawFherc20(token, encAmount);
    }

    /// @notice Reusable function to verify permit signature and mark as used.
    /// @param permitId The permit hash to verify.
    /// @param signature The ECDSA signature to verify.
    /// @return valid True if signature is valid and permit not used.
    function _verifyAndUsePermit(bytes32 permitId, bytes calldata signature) internal returns (bool valid) {
        require(!usedPermits[permitId], "Permit used");
        
        bytes32 hash = MessageHashUtils.toEthSignedMessageHash(permitId);
        address signer = ECDSA.recover(hash, signature);
        require(signer == backendSigner, "Invalid signature");
        
        usedPermits[permitId] = true;
        return true;
    }

    function safeCheckoutWithPermit(
        CheckoutParams calldata checkout,
        address paymentToken,
        uint256 amount,
        uint256 nonce,
        uint256 expiry,
        bytes calldata signature
    )
        external
        payable
        returns (uint256 tokenId)
    {
        require(block.timestamp <= expiry, "Permit expired");

        _verifyAndUsePermit(
            _checkoutPermitId(
                "safeCheckout",
                checkout,
                paymentToken,
                amount,
                nonce,
                expiry
            ),
            signature
        );

        _collectStandardPayment(paymentToken, amount);
        tokenId = _mintCheckout(checkout, nonce);

        emit OrderPaymentReceived(checkout.orderId, msg.sender, paymentToken, amount);
    }

    /// @notice Safe order payment with signature verification.
    /// @dev Requires backend signature to authorize the payment.
    /// @param orderId Unique order identifier for tracking.
    /// @param paymentToken Payment token (address(0) for native ETH).
    /// @param amount Payment amount required.
    /// @param nonce Unique nonce to prevent replay.
    /// @param expiry Unix timestamp after which the permit is invalid.
    /// @param signature Backend ECDSA signature over the permit payload.
    function safeOrderWithPermit(
        string calldata orderId,
        address paymentToken,
        uint256 amount,
        uint256 nonce,
        uint256 expiry,
        bytes calldata signature
    )
        external
        payable
        returns (uint256)
    {
        require(bytes(orderId).length > 0, "Invalid order ID");
        require(block.timestamp <= expiry, "Permit expired");

        _verifyAndUsePermit(
            _orderPermitId(
                "safeOrder",
                orderId,
                paymentToken,
                amount,
                nonce,
                expiry
            ),
            signature
        );

        _collectStandardPayment(paymentToken, amount);

        emit OrderPaymentReceived(orderId, msg.sender, paymentToken, amount);
        return amount;
    }

    function safeOrderFherc20WithPermit(
        string calldata orderId,
        address paymentToken,
        InEuint64 calldata encAmount,
        uint256 nonce,
        uint256 expiry,
        bytes calldata signature
    )
        external
        returns (bytes32 transferredAmount)
    {
        require(bytes(orderId).length > 0, "Invalid order ID");
        require(block.timestamp <= expiry, "Permit expired");

        _verifyAndUsePermit(
            _orderFherc20PermitId(
                "safeOrderFherc20",
                orderId,
                paymentToken,
                encAmount,
                nonce,
                expiry
            ),
            signature
        );

        return _collectFherc20Payment(
            orderId,
            paymentToken,
            msg.sender,
            encAmount
        );
    }

    /// @notice Safe mint with signature verification.
    /// @dev Requires backend signature to authorize the mint.
    /// @param orderId Unique order identifier for tracking.
    /// @param collection Target collection contract.
    /// @param to Recipient address.
    /// @param uri Metadata URI.
    /// @param encKey FHE encrypted key handle.
    /// @param cipherRef Reference to ciphertext payload.
    /// @param nonce Unique nonce to prevent replay.
    /// @param expiry Unix timestamp after which the permit is invalid.
    /// @param signature Backend ECDSA signature over the permit payload.
    function safeMintWithPermit(
        string calldata orderId,
        address collection,
        address to,
        string calldata uri,
        InEuint128 calldata encKey,
        string calldata cipherRef,
        uint256 nonce,
        uint256 expiry,
        bytes calldata signature
    )
        external
        returns (uint256 tokenId)
    {
        require(collection != address(0), "Invalid collection");
        require(allowedCollections[collection], "Collection not allowed");
        require(to != address(0), "Invalid recipient");
        require(bytes(orderId).length > 0, "Invalid order ID");
        require(block.timestamp <= expiry, "Permit expired");

        // Create permit hash
        bytes32 permitId = keccak256(abi.encodePacked(
            address(this),
            "safeMint",
            orderId,
            collection,
            to,
            keccak256(bytes(uri)),
            encKey.ctHash,
            keccak256(bytes(cipherRef)),
            nonce,
            expiry
        ));

        // Verify signature and mark permit as used
        _verifyAndUsePermit(permitId, signature);

        tokenId = IFHECollection(collection).mint(to, uri, encKey, cipherRef);

        emit OrderExecuted(orderId, msg.sender, tokenId, true);
        emit MintedWithPermit(to, tokenId, nonce, uri, collection);
        return tokenId;
    }

    /// @notice Allow contract to receive ETH
    receive() external payable {}
}
