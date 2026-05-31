// ⚠️⚠️⚠️ WARNING: TESTNET ONLY - DO NOT DEPLOY ON MAINNET ⚠️⚠️⚠️
// THIS IS A TESTNET VERSION FOR TESTING PURPOSES ONLY
// FOR MAINNET DEPLOYMENT, USE THE MAINNET VERSION OF THIS CONTRACT
// UNAUTHORIZED MAINNET DEPLOYMENT MAY RESULT IN LOSS OF FUNDS
// ⚠️⚠️⚠️ WARNING: TESTNET ONLY - DO NOT DEPLOY ON MAINNET ⚠️⚠️⚠️

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import {FHE, euint64, euint128, InEuint64, InEuint128} from "@fhenixprotocol/cofhe-contracts/FHE.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

interface ICollectionGateway {
    function mintWithTokenId(
        address to,
        uint256 tokenId,
        string calldata uri,
        InEuint128 calldata encKey,
        string calldata cipherRef
    ) external returns (uint256);

    function mint(
        address to,
        string calldata uri,
        InEuint128 calldata encKey,
        string calldata cipherRef
    ) external returns (uint256);
}

interface IFHERC20 {
    function confidentialTransfer(address to, euint64 amount) external returns (euint64);
    function confidentialTransferFrom(address from, address to, euint64 amount) external returns (euint64);
}

/// @title AuthorityMintGateway
/// @notice Simple, collection-agnostic authority minting gateway.
/// @dev Intended mainly for testing / faucet-style mints.
/// Frontends or tools call this contract instead of individual collections.
/// The owner configures which collection contracts are allowed, and this
/// contract must be granted `minter` on each target collection.
contract AuthorityMintGateway is Ownable {
    using SafeERC20 for IERC20;

    mapping(address => bool) public allowedCollections;
    address public backendSigner;

    struct CheckoutParams {
        string orderId;
        address collection;
        address to;
        string uri;
        InEuint128 encKey;
        string cipherRef;
    }

    event CollectionAllowed(address indexed collection, bool allowed);
    event BackendSignerUpdated(address indexed signer);
    event Minted(
        address indexed collection,
        uint256 indexed tokenId,
        address indexed to,
        string uri
    );
    event Purchased(
        address indexed collection,
        address indexed buyer,
        uint256 indexed tokenId,
        address paymentToken,
        uint256 amount
    );

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
    
    event OrderExecuted(
        string indexed orderId,
        address indexed executor,
        uint256 indexed tokenId,
        bool success
    );

    constructor() Ownable(msg.sender) {
        backendSigner = msg.sender;
        emit BackendSignerUpdated(msg.sender);
    }

    function setBackendSigner(address backendSigner_) external onlyOwner {
        require(backendSigner_ != address(0), "Invalid signer");
        backendSigner = backendSigner_;
        emit BackendSignerUpdated(backendSigner_);
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

    function _mintCheckout(
        CheckoutParams calldata checkout
    ) internal returns (uint256 tokenId) {
        require(checkout.collection != address(0), "Invalid collection");
        require(checkout.to != address(0), "Invalid recipient");
        require(bytes(checkout.orderId).length > 0, "Invalid order ID");

        tokenId = ICollectionGateway(checkout.collection).mint(
            checkout.to,
            checkout.uri,
            checkout.encKey,
            checkout.cipherRef
        );

        emit OrderExecuted(checkout.orderId, msg.sender, tokenId, true);
        emit Minted(checkout.collection, tokenId, checkout.to, checkout.uri);
    }

    /// @notice Allow or disallow a target collection to be minted into via this gateway.
    /// @param collection The collection contract address.
    /// @param allowed True to allow, false to disallow.
    // purpose: to easily ban the collection
    function setCollectionAllowed(
        address collection,
        bool allowed
    ) external onlyOwner {
        require(collection != address(0), "Invalid collection");
        allowedCollections[collection] = allowed;
        emit CollectionAllowed(collection, allowed);
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

    /// probably admin can just unwrap ?
    /// @notice Withdraw FHERC20 tokens using an encrypted amount.
    /// @dev The legacy withdraw path cannot use FHERC20 because FHERC20 disables
    /// `balanceOf` as a real balance read and disables ERC20 `transfer`.
    function withdrawFherc20(
        address token,
        InEuint64 calldata encAmount
    ) external onlyOwner returns (bytes32 transferredAmount) {
        require(token != address(0), "Invalid FHERC20 token");

        euint64 amount = FHE.asEuint64(encAmount);
        FHE.allow(amount, token);

        euint64 transferred = IFHERC20(token).confidentialTransfer(
            owner(),
            amount
        );
        return euint64.unwrap(transferred);
    }

    /// @notice Mint into an arbitrary allowed collection with specific tokenId.
    function mintWithTokenId(
        address collection,
        address to,
        uint256 tokenId,
        string calldata uri,
        InEuint128 calldata encKey,
        string calldata cipherRef
    )
        external
        // this is a signature in permit version
        onlyOwner
        returns (uint256)
    {
        require(collection != address(0), "Invalid collection");
        // require(allowedCollections[collection], "Collection not allowed");
        require(to != address(0), "Invalid recipient");

        uint256 mintedId = ICollectionGateway(collection).mintWithTokenId(
            to,
            tokenId,
            uri,
            encKey,
            cipherRef
        );

        emit Minted(collection, mintedId, to, uri);
        return mintedId;
    }

    /// @notice Unsafe purchase - mint NFT with direct payment (no signature required).
    /// @dev WARNING: This function allows anyone to mint if they pay the required amount.
    ///      Use only for testing or when access control is handled elsewhere.
    ///      For production, use the permit-based version with signature verification.
    /// @param checkout Mint and order parameters.
    /// @param paymentToken Payment token (address(0) for native ETH).
    /// @param amount Payment amount required.
    function unsafeCheckout(
        CheckoutParams calldata checkout,
        address paymentToken,
        uint256 amount
        // reserved for signature
    )
        external
        payable
        returns (
            // signature here for safe version
            uint256
        )
    {
        _collectStandardPayment(paymentToken, amount);
        uint256 tokenId = _mintCheckout(checkout);

        emit Purchased(
            checkout.collection,
            msg.sender,
            tokenId,
            paymentToken,
            amount
        );
        return tokenId;
    }

    function unsafeOrder(
        string calldata orderId,
        address paymentToken,
        uint256 amount
        // reserve for signature
    )
        external
        payable
        returns (
            // signature here for safe version
            uint256
        )
    {
        require(bytes(orderId).length > 0, "Invalid order ID");
        _collectStandardPayment(paymentToken, amount);

        emit OrderPaymentReceived(orderId, msg.sender, paymentToken, amount);
        return amount;
    }

    /// @notice Unsafe order payment using FHERC20 confidential transfer.
    /// @dev Caller must first set this gateway as FHERC20 operator with
    /// `setOperator(gateway, until)`.
    function unsafeOrderFherc20(
        string calldata orderId,
        address paymentToken,
        InEuint64 calldata encAmount
    )
        external
        returns (bytes32 transferredAmount)
    {
        require(bytes(orderId).length > 0, "Invalid order ID");
        return _collectFherc20Payment(
            orderId,
            paymentToken,
            msg.sender,
            encAmount
        );
    }

    /// @notice Faucet-style mint helper that skips the allowed-collection check.
    /// @dev Intended only for testing or local faucet flows. Do NOT expose this
    /// in untrusted environments without additional access control.
    /// The target collection must still treat this gateway as a minter.
    function unsafeMint(
        string calldata,
        address collection,
        address to,
        string calldata uri,
        InEuint128 calldata encKey,
        string calldata cipherRef
        // signature here
    )
        external
        returns (
            // signature here for safe version
            uint256
        )
    {
        require(collection != address(0), "Invalid collection");
        // require(allowedCollections[collection], "Collection not allowed");
        require(to != address(0), "Invalid recipient");

        uint256 mintedId = ICollectionGateway(collection).mint(
            to,
            uri,
            encKey,
            cipherRef
        );

        emit Minted(collection, mintedId, to, uri);
        return mintedId;
    }

    /// @notice Batch mint multiple NFTs into an allowed collection.
    function unsafeBatchMint(
        address collection,
        address[] calldata to,
        string[] calldata uris,
        InEuint128[] calldata encKeys,
        string[] calldata cipherRefs
    )
        external
        //signature here for safe version
        onlyOwner
        returns (uint256[] memory tokenIds)
    {
        require(collection != address(0), "Invalid collection");
        // require(allowedCollections[collection], "Collection not allowed");
        require(
            to.length == uris.length &&
                uris.length == encKeys.length &&
                encKeys.length == cipherRefs.length,
            "Array length mismatch"
        );

        tokenIds = new uint256[](to.length);
        for (uint256 i = 0; i < to.length; i++) {
            require(to[i] != address(0), "Invalid recipient");
            tokenIds[i] = ICollectionGateway(collection).mint(
                to[i],
                uris[i],
                encKeys[i],
                cipherRefs[i]
            );
        }
    }

    /// @notice Allow contract to receive ETH
    receive() external payable {}
}
