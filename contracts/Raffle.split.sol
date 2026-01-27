// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";

/// @notice Minimal interface for the external NFT collection used for prizes.
interface ICollectionMint {
    /// @notice Mint a token with a specific `tokenId` and metadata URI to `to`.
    function mintWithTokenId(
        address to,
        uint256 tokenId,
        string calldata uri
    ) external returns (uint256);
    /// @notice Mint a token with a specific `tokenId` and metadata URI to `to`.
    function mintTo(
        address to,
        string calldata uri
    ) external returns (uint256);
}

/// @title Multi-raffle engine (chain-agnostic spec, EVM implementation)
/// @notice Implements the RAFFLE.md logic using native ETH payments and an
/// external NFT collection for prizes.
/// @dev Each raffle is identified by a string `raffleId` (hashed to bytes32
/// for storage) and uses explicit slot numbers owned by participant addresses.

contract Raffle is Ownable {
    constructor() Ownable(msg.sender) {}

    // =============================================================
    // Core types and storage
    // =============================================================

    /// @notice High-level status for each raffle.
    enum MultiRaffleStatus {
        OPEN,
        FILLED,
        DRAWN,
        CANCELLED
    }

    /// @notice Per-raffle configuration and runtime state.
    struct MultiRaffle {
        string raffleId;
        uint256 totalSlots;
        uint256 maxSlotsPerAddress;
        string metadataUri;
        address collection;
        bool premintContract;
        bool premint;
        bool autoClaim;
        uint64 createdAt;
        uint64 expiresAt;
        MultiRaffleStatus status;
        uint256 soldSlots;
        uint256 winnerSlot;
        address winner;
        bool claimed;
    }

    // raffleId hash => raffle data
    mapping(bytes32 => MultiRaffle) private _multiRaffles;
    mapping(bytes32 => mapping(uint256 => address)) private _slotOwnerMulti;
    mapping(bytes32 => mapping(address => uint256)) private _userSlotCountMulti;
    mapping(bytes32 => mapping(address => uint256[])) private _userSlotsMulti;
    mapping(bytes32 => mapping(address => uint256)) private _userPaidMulti;
    mapping(address => string[]) private _userRafflesMulti;

    uint256 public nextPrizeTokenId;
    uint256 public constant REFUND_FEE_BPS = 500;

    // =============================================================
    // Events
    // =============================================================

    event MultiRaffleHosted(bytes32 indexed id, string raffleId, address indexed organizer);
    event MultiRaffleJoined(bytes32 indexed id, address indexed payer, uint256[] slots, uint256 paidAmount);
    event MultiRaffleFilled(bytes32 indexed id, uint256 totalSlots);
    event MultiRaffleDrawn(bytes32 indexed id, uint256 winnerSlot, address indexed winner);
    event MultiRafflePrizeMinted(bytes32 indexed id, address indexed to, uint256 tokenId, string metadataUri);
    event MultiRaffleProceedsWithdrawn(address indexed to, uint256 amount);

    // =============================================================
    // External host/join (safe variants - signature based, TODO)
    // =============================================================

    /// @notice Host a raffle with off-chain pricing/signature (safe variant, not implemented yet).
    function hostRaffle(
        string calldata raffleId,
        uint256 totalSlots,
        uint256 maxSlotsPerAddress,
        string calldata metadataUri,
        address collection,
        bool premintContract,
        bool premint,
        bool autoClaim,
        uint64 expiresAt,
        bytes calldata /*signature*/
    ) external returns (bytes32 id) {
        revert("NotImplemented");
    }

    // =============================================================
    // External host/join (unsafe variants - no signature)
    // =============================================================

    /// @notice Create a new raffle with the specified parameters (unsafe, no signature).
    /// @dev Reverts if a raffle with the same `raffleId` already exists.
    /// Sets status to OPEN and resets counters.
    function unsafeHostRaffle(
        string calldata raffleId,
        uint256 totalSlots,
        uint256 maxSlotsPerAddress,
        string calldata metadataUri,
        address collection,
        bool premintContract,
        bool premint,
        bool autoClaim,
        uint64 expiresAt
    ) external returns (bytes32 id) {
        require(totalSlots > 0, "TotalSlotsZero");
        require(maxSlotsPerAddress > 0, "MaxSlotsZero");

        id = keccak256(bytes(raffleId));
        MultiRaffle storage r = _multiRaffles[id];
        require(bytes(r.raffleId).length == 0, "RaffleExists");

        // need to update if it's not premint, then need the tokenID or perhaps request of hold of the NFT
        r.raffleId = raffleId;
        r.totalSlots = totalSlots;
        r.maxSlotsPerAddress = maxSlotsPerAddress;
        r.metadataUri = metadataUri;
        r.collection = collection;
        r.premintContract = premintContract;
        r.premint = premint;
        r.autoClaim = autoClaim;
        r.createdAt = uint64(block.timestamp);
        r.expiresAt = expiresAt;
        r.status = MultiRaffleStatus.OPEN;
        r.soldSlots = 0;
        r.claimed = false;

        emit MultiRaffleHosted(id, raffleId, msg.sender);
    }

    /// @notice Join an existing raffle by purchasing specific slot IDs (safe variant, not implemented yet).
    function joinRaffle(
        string calldata raffleId,
        uint256[] calldata slotIds,
        uint256 /*amount*/,
        address /*token*/,
        bytes calldata /*signature*/
    ) external payable {
        revert("NotImplemented");
    }

    /// @notice Join an existing raffle by purchasing specific slot IDs (unsafe, no signature).
    /// @dev Payment amount and token are provided by the off-chain backend.
    /// Reverts if raffle is not OPEN, expired, or any slot is invalid/taken.
    function unsafeJoinRaffle(
        string calldata raffleId,
        uint256[] calldata slotIds,
        uint256 amount,
        address token
    ) external payable {
        require(slotIds.length > 0, "NoSlots");

        bytes32 id = keccak256(bytes(raffleId));
        MultiRaffle storage r = _multiRaffles[id];
        require(bytes(r.raffleId).length != 0, "RaffleNotFound");
        require(r.status == MultiRaffleStatus.OPEN, "NotOpen");
        if (r.expiresAt != 0) {
            require(block.timestamp <= r.expiresAt, "RaffleExpired");
        }

        if (amount > 0) {
            if (token == address(0)) {
                _handleNativePayment(id, msg.sender, amount);
            } else {
                // TODO: support ERC20 tokens in the future
                // IERC20(token).transferFrom(msg.sender, address(this), amount);
                revert("ERC20Disabled");
            }
        }

        _joinRaffle(id, r, slotIds, msg.sender, 0, amount);
    }

    /// @notice Host and join a raffle in a single call (safe variant, not implemented yet).
    function hostAndJoinRaffle(
        string calldata raffleId,
        uint256 totalSlots,
        uint256 maxSlotsPerAddress,
        string calldata metadataUri,
        address collection,
        bool premintContract,
        bool premint,
        bool autoClaim,
        uint64 expiresAt,
        uint256[] calldata slotIds,
        uint256 /*amount*/,
        address /*token*/,
        uint256 /*bonusFreeSlots*/,
        bytes calldata /*signature*/
    ) external payable returns (bytes32 id) {
        revert("NotImplemented");
    }

    /// @notice Convenience helper that both hosts and joins a raffle in one tx (unsafe, no signature).
    /// @dev The first `min(bonusFreeSlots, slotIds.length)` slots are treated as free off-chain.
    function unsafeHostAndJoinRaffle(
        string calldata raffleId,
        uint256 totalSlots,
        uint256 maxSlotsPerAddress,
        string calldata metadataUri,
        address collection,
        bool premintContract,
        bool premint,
        bool autoClaim,
        uint64 expiresAt,
        uint256[] calldata slotIds,
        uint256 amount,
        address token,
        uint256 bonusFreeSlots
    ) external payable returns (bytes32 id) {
        require(totalSlots > 0, "TotalSlotsZero");
        require(maxSlotsPerAddress > 0, "MaxSlotsZero");

        id = keccak256(bytes(raffleId));
        MultiRaffle storage r = _multiRaffles[id];
        require(bytes(r.raffleId).length == 0, "RaffleExists");

        // need to update if it's not premint, then need the tokenID or perhaps request of hold of the NFT
        r.raffleId = raffleId;
        r.totalSlots = totalSlots;
        r.maxSlotsPerAddress = maxSlotsPerAddress;
        r.metadataUri = metadataUri;
        r.collection = collection;
        r.premintContract = premintContract;
        r.premint = premint;
        r.autoClaim = autoClaim;
        r.createdAt = uint64(block.timestamp);
        r.expiresAt = expiresAt;
        r.status = MultiRaffleStatus.OPEN;
        r.soldSlots = 0;
        r.claimed = false;

        emit MultiRaffleHosted(id, raffleId, msg.sender);

        if (amount > 0) {
            if (token == address(0)) {
                _handleNativePayment(id, msg.sender, amount);
            } else {
                // TODO: support ERC20 tokens in the future
                // IERC20(token).transferFrom(msg.sender, address(this), amount);
                revert("ERC20Disabled");
            }
        }

        _joinRaffle(id, r, slotIds, msg.sender, bonusFreeSlots, amount);
    }

    // =============================================================
    // External prize + treasury + refund
    // =============================================================

    /// @notice Claim the prize for a raffle where the caller is the recorded winner.
    function claim(string calldata raffleId) external {
        bytes32 id = keccak256(bytes(raffleId));
        MultiRaffle storage r = _multiRaffles[id];
        require(bytes(r.raffleId).length != 0, "RaffleNotFound");
        require(r.status == MultiRaffleStatus.DRAWN, "NotDrawn");
        require(!r.claimed, "AlreadyClaimed");
        require(msg.sender == r.winner, "NotWinner");

        _mintPrize(id, r, msg.sender);
        r.claimed = true;
    }

    /// @notice Admin function to manually execute raffle draw for a filled raffle.
    /// @dev Useful when autoClaim is disabled or gas costs are too high for automatic draw.
    function drawRaffle(string calldata raffleId) external  {
        bytes32 id = keccak256(bytes(raffleId));
        MultiRaffle storage r = _multiRaffles[id];
        require(bytes(r.raffleId).length != 0, "RaffleNotFound");
        require(r.status == MultiRaffleStatus.FILLED, "NotFilled");
        
        _endRaffleInternal(id, r);
    }

    /// @notice Withdraw native token proceeds accumulated in this contract.
    /// @param to Recipient address.
    /// @param amount Amount of wei to withdraw.
    function withdrawProceeds(address to, uint256 amount) external onlyOwner {
        require(to != address(0), "InvalidRecipient");
        require(amount <= address(this).balance, "InsufficientBalance");
        (bool ok, ) = to.call{value: amount}("");
        require(ok, "TransferFailed");
        emit MultiRaffleProceedsWithdrawn(to, amount);
    }

    // =============================================================
    // View helpers
    // =============================================================

    /// @notice Return basic raffle configuration.
    /// @return totalSlots Total number of slots.
    /// @return soldSlots Number of slots sold.
    /// @return maxSlotsPerAddress Maximum slots per address.
    /// @return status Raffle status as uint8.
    function getRaffleBasic(
        string calldata raffleId
    ) external view returns (
        uint256 totalSlots,
        uint256 soldSlots,
        uint256 maxSlotsPerAddress,
        uint8 status
    ) {
        bytes32 id = keccak256(bytes(raffleId));
        MultiRaffle storage r = _multiRaffles[id];
        require(bytes(r.raffleId).length != 0, "RaffleNotFound");
        
        return (
            r.totalSlots,
            r.soldSlots,
            r.maxSlotsPerAddress,
            uint8(r.status)
        );
    }

    /// @notice Return raffle prize configuration.
    /// @return metadataUri Metadata URI for the raffle.
    /// @return collection NFT collection address for prizes.
    /// @return premintContract Whether collection uses premint contract.
    /// @return premint Whether prize is preminted.
    /// @return autoClaim Whether prize auto-claims on fill.
    function getRafflePrize(
        string calldata raffleId
    ) external view returns (
        string memory metadataUri,
        address collection,
        bool premintContract,
        bool premint,
        bool autoClaim
    ) {
        bytes32 id = keccak256(bytes(raffleId));
        MultiRaffle storage r = _multiRaffles[id];
        require(bytes(r.raffleId).length != 0, "RaffleNotFound");
        
        return (
            r.metadataUri,
            r.collection,
            r.premintContract,
            r.premint,
            r.autoClaim
        );
    }

    /// @notice Return raffle timing information.
    /// @return createdAt Creation timestamp (UNIX).
    /// @return expiresAt Expiration timestamp (UNIX, 0 = no expiry).
    function getRaffleTiming(
        string calldata raffleId
    ) external view returns (
        uint64 createdAt,
        uint64 expiresAt
    ) {
        bytes32 id = keccak256(bytes(raffleId));
        MultiRaffle storage r = _multiRaffles[id];
        require(bytes(r.raffleId).length != 0, "RaffleNotFound");
        
        return (r.createdAt, r.expiresAt);
    }

    /// @notice Return raffle result information.
    /// @return winnerSlot Winning slot number (0 = not drawn).
    /// @return winner Winner address (zero address = not drawn).
    /// @return claimed Whether prize has been claimed.
    /// @return status Raffle status as uint8.
    function getRaffleResult(
        string calldata raffleId
    ) external view returns (
        uint256 winnerSlot,
        address winner,
        bool claimed,
        uint8 status
    ) {
        bytes32 id = keccak256(bytes(raffleId));
        MultiRaffle storage r = _multiRaffles[id];
        require(bytes(r.raffleId).length != 0, "RaffleNotFound");
        
        return (
            r.winnerSlot,
            r.winner,
            r.claimed,
            uint8(r.status)
        );
    }

    /// @notice Check if joining specific slots will fill the raffle and trigger draw.
    /// @return willFill True if joining these slots will fill the raffle.
    /// @return willAutoDraw True if filling will trigger automatic draw (gas intensive).
    /// @return remainingSlots Number of slots remaining before fill.
    function checkJoinWillFill(
        string calldata raffleId,
        uint256 slotCount
    ) external view returns (
        bool willFill,
        bool willAutoDraw,
        uint256 remainingSlots
    ) {
        bytes32 id = keccak256(bytes(raffleId));
        MultiRaffle storage r = _multiRaffles[id];
        require(bytes(r.raffleId).length != 0, "RaffleNotFound");
        
        remainingSlots = r.totalSlots - r.soldSlots;
        willFill = slotCount >= remainingSlots;
        willAutoDraw = willFill && !r.autoClaim;
        
        return (willFill, willAutoDraw, remainingSlots);
    }

    /// @notice Return basic information for multiple raffles in a single call.
    /// @dev All returned arrays have the same length as `raffleIds` and are index-aligned.
    function getRafflesBasic(
        string[] calldata raffleIds
    )
        external
        view
        returns (
            uint256[] memory totalSlots,
            uint256[] memory soldSlots,
            uint256[] memory maxSlotsPerAddress,
            uint8[] memory status
        )
    {
        uint256 len = raffleIds.length;
        totalSlots = new uint256[](len);
        soldSlots = new uint256[](len);
        maxSlotsPerAddress = new uint256[](len);
        status = new uint8[](len);

        for (uint256 i = 0; i < len; i++) {
            bytes32 id = keccak256(bytes(raffleIds[i]));
            MultiRaffle storage r = _multiRaffles[id];
            require(bytes(r.raffleId).length != 0, "RaffleNotFound");
            totalSlots[i] = r.totalSlots;
            soldSlots[i] = r.soldSlots;
            maxSlotsPerAddress[i] = r.maxSlotsPerAddress;
            status[i] = uint8(r.status);
        }
    }

    /// @notice Return result information for multiple raffles in a single call.
    /// @dev All returned arrays have the same length as `raffleIds` and are index-aligned.
    function getRafflesResults(
        string[] calldata raffleIds
    )
        external
        view
        returns (
            uint256[] memory winnerSlots,
            address[] memory winners,
            bool[] memory claimed,
            uint8[] memory status
        )
    {
        uint256 len = raffleIds.length;
        winnerSlots = new uint256[](len);
        winners = new address[](len);
        claimed = new bool[](len);
        status = new uint8[](len);

        for (uint256 i = 0; i < len; i++) {
            bytes32 id = keccak256(bytes(raffleIds[i]));
            MultiRaffle storage r = _multiRaffles[id];
            require(bytes(r.raffleId).length != 0, "RaffleNotFound");
            winnerSlots[i] = r.winnerSlot;
            winners[i] = r.winner;
            claimed[i] = r.claimed;
            status[i] = uint8(r.status);
        }
    }

    /// @notice Get all raffleIds that the given user has ever joined.
    // this is for history -list raffle join
    function getUserRaffles(address user) external view returns (string[] memory) {
        string[] storage list = _userRafflesMulti[user];
        string[] memory out = new string[](list.length);
        for (uint256 i = 0; i < list.length; i++) {
            out[i] = list[i];
        }
        return out;
    }

    /// @notice Get all slot numbers owned by `user` in the given raffle.
    function getUserRaffleSlots(
        string calldata raffleId,
        address user
    ) external view returns (uint256[] memory) {
        bytes32 id = keccak256(bytes(raffleId));
        MultiRaffle storage r = _multiRaffles[id];
        require(bytes(r.raffleId).length != 0, "RaffleNotFound");
        uint256[] storage slots = _userSlotsMulti[id][user];
        uint256[] memory out = new uint256[](slots.length);
        for (uint256 i = 0; i < slots.length; i++) {
            out[i] = slots[i];
        }
        return out;
    }

    /// @notice Check whether the given `slotIds` are free and in-range.
    /// @return unavailable List of slot numbers that are out-of-range or taken.
    function checkSlotsAvailability(
        string calldata raffleId,
        uint256[] calldata slotIds
    ) external view returns (uint256[] memory unavailable) {
        bytes32 id = keccak256(bytes(raffleId));
        MultiRaffle storage r = _multiRaffles[id];
        require(bytes(r.raffleId).length != 0, "RaffleNotFound");

        uint256 len = slotIds.length;
        uint256[] memory tmp = new uint256[](len);
        uint256 count;

        for (uint256 i = 0; i < len; i++) {
            uint256 slot = slotIds[i];
            if (slot < 1 || slot > r.totalSlots || _slotOwnerMulti[id][slot] != address(0)) {
                tmp[count] = slot;
                count++;
            }
        }

        unavailable = new uint256[](count);
        for (uint256 i = 0; i < count; i++) {
            unavailable[i] = tmp[i];
        }
    }
 
    /// @notice Get all taken slots in the given inclusive slot range for a raffle.
    /// @dev Use (startSlot = 1, endSlot = totalSlots) for a full scan, or smaller ranges for paging.
    function getTakenSlotsInRange(
        string calldata raffleId,
        uint256 startSlot,
        uint256 endSlot
    ) external view returns (uint256[] memory takenSlots) {
        bytes32 id = keccak256(bytes(raffleId));
        MultiRaffle storage r = _multiRaffles[id];
        require(bytes(r.raffleId).length != 0, "RaffleNotFound");
        require(startSlot >= 1 && endSlot >= startSlot && endSlot <= r.totalSlots, "InvalidRange");

        uint256 len = endSlot - startSlot + 1;
        uint256[] memory tmp = new uint256[](len);
        uint256 count;

        for (uint256 slot = startSlot; slot <= endSlot; slot++) {
            if (_slotOwnerMulti[id][slot] != address(0)) {
                tmp[count] = slot;
                count++;
            }
        }

        takenSlots = new uint256[](count);
        for (uint256 i = 0; i < count; i++) {
            takenSlots[i] = tmp[i];
        }
    }

    /// @notice Get all available (free) slots in the given inclusive slot range for a raffle.
    /// @dev Use (startSlot = 1, endSlot = totalSlots) for a full scan, or smaller ranges for paging.
    function getAvailableSlotsInRange(
        string calldata raffleId,
        uint256 startSlot,
        uint256 endSlot
    ) external view returns (uint256[] memory availableSlots) {
        bytes32 id = keccak256(bytes(raffleId));
        MultiRaffle storage r = _multiRaffles[id];
        require(bytes(r.raffleId).length != 0, "RaffleNotFound");
        require(startSlot >= 1 && endSlot >= startSlot && endSlot <= r.totalSlots, "InvalidRange");

        uint256 len = endSlot - startSlot + 1;
        uint256[] memory tmp = new uint256[](len);
        uint256 count;

        for (uint256 slot = startSlot; slot <= endSlot; slot++) {
            if (_slotOwnerMulti[id][slot] == address(0)) {
                tmp[count] = slot;
                count++;
            }
        }

        availableSlots = new uint256[](count);
        for (uint256 i = 0; i < count; i++) {
            availableSlots[i] = tmp[i];
        }
    }

    /// @notice Claim a refund for an expired raffle that did not sell out.
    /// todo add: if subscribed (then return full) ->> this using signature
    function claimRefund(string calldata raffleId) external {
        bytes32 id = keccak256(bytes(raffleId));
        MultiRaffle storage r = _multiRaffles[id];
        require(bytes(r.raffleId).length != 0, "RaffleNotFound");
        require(r.expiresAt != 0 && block.timestamp > r.expiresAt, "NotExpired");
        require(r.soldSlots < r.totalSlots, "RaffleFilled");
        require(
            r.status == MultiRaffleStatus.OPEN || r.status == MultiRaffleStatus.CANCELLED,
            "BadStatus"
        );

        uint256 paid = _userPaidMulti[id][msg.sender];
        require(paid > 0, "NothingToRefund");

        if (r.status == MultiRaffleStatus.OPEN) {
            r.status = MultiRaffleStatus.CANCELLED;
        }

        _userPaidMulti[id][msg.sender] = 0;

        uint256 refundAmount = (paid * (10000 - REFUND_FEE_BPS)) / 10000;

        (bool ok, ) = msg.sender.call{value: refundAmount}("");
        require(ok, "RefundFailed");
    }

    // =============================================================
    // Internal helpers
    // =============================================================

    function _handleNativePayment(bytes32 id, address payer, uint256 amount) internal {
        require(msg.value == amount, "BadPayment");
        if (amount > 0) {
            _userPaidMulti[id][payer] += amount;
        }
    }

    function _joinRaffle(
        bytes32 id,
        MultiRaffle storage r,
        uint256[] calldata slotIds,
        address payer,
        uint256 bonusFreeSlots,
        uint256 paidAmount
    ) internal {
        uint256 requested = slotIds.length;
        require(requested > 0, "NoSlots");

        uint256 remaining = r.totalSlots - r.soldSlots;
        require(requested <= remaining, "OverCapacity");

        uint256 current = _userSlotCountMulti[id][payer];
        require(current + requested <= r.maxSlotsPerAddress, "MaxSlotsPerAddress");

        for (uint256 i = 0; i < requested; i++) {
            uint256 slot = slotIds[i];
            require(slot >= 1 && slot <= r.totalSlots, "SlotOutOfRange");

            for (uint256 j = 0; j < i; j++) {
                require(slotIds[j] != slot, "DuplicateSlot");
            }

            require(_slotOwnerMulti[id][slot] == address(0), "SlotTaken");
        }

        if (current == 0) {
            _userRafflesMulti[payer].push(r.raffleId);
        }

        for (uint256 i = 0; i < requested; i++) {
            uint256 slot = slotIds[i];
            _slotOwnerMulti[id][slot] = payer;
            _userSlotsMulti[id][payer].push(slot);
        }

        _userSlotCountMulti[id][payer] = current + requested;
        r.soldSlots += requested;

        emit MultiRaffleJoined(id, payer, slotIds, paidAmount);

        if (r.soldSlots == r.totalSlots) {
            r.status = MultiRaffleStatus.FILLED;
            emit MultiRaffleFilled(id, r.totalSlots);
            
            // Only auto-draw if autoClaim is false to save gas
            // If autoClaim is true, admin must call adminDrawRaffle() manually
            if (!r.autoClaim) {
                _endRaffleInternal(id, r);
            }
        }
    }


    // will be called by draw or by join
    function _endRaffleInternal(bytes32 id, MultiRaffle storage r) internal {
        require(r.status == MultiRaffleStatus.FILLED || r.status == MultiRaffleStatus.OPEN, "BadStatus");

        uint256 winnerSlot = (block.timestamp % r.totalSlots) + 1;
        address winner = _slotOwnerMulti[id][winnerSlot];
        require(winner != address(0), "NoWinner");

        r.winnerSlot = winnerSlot;
        r.winner = winner;
        r.status = MultiRaffleStatus.DRAWN;

        emit MultiRaffleDrawn(id, winnerSlot, winner);

        if (r.autoClaim) {

            // todo: check if prize erc721, erc1155, erc404
            _mintPrize(id, r, winner);
            r.claimed = true;
        }
    }

    /// @notice Test function to mint NFT directly (for testing purposes only).
    /// @dev Allows testing the NFT minting flow without needing a full raffle.
    function unsafeTestMint(
        string calldata raffleId,
        address to
    ) external {
        bytes32 id = keccak256(bytes(raffleId));
        MultiRaffle storage r = _multiRaffles[id];
        require(bytes(r.raffleId).length != 0, "RaffleNotFound");
        require(r.collection != address(0), "NoCollection");
        
        _mintPrize(id, r, to);
    }

    function _mintPrize(bytes32 id, MultiRaffle storage r, address to) internal {
        require(r.collection != address(0), "NoCollection");

        // uint256 tokenId = ++nextPrizeTokenId; //must read from the contract first
        // uint256 mintedId = ICollectionMint(r.collection).mintWithTokenId(
        //     to,
        //     tokenId,
        //     r.metadataUri
        // );
        uint256 mintedId = ICollectionMint(r.collection).mintTo(
            to,
            r.metadataUri
        );

        emit MultiRafflePrizeMinted(id, to, mintedId, r.metadataUri);
    }
}
