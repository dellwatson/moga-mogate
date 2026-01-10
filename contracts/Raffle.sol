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
}

/// @title Multi-raffle engine (chain-agnostic spec, EVM implementation)
/// @notice Implements the RAFFLE.md logic using native ETH payments and an
/// external NFT collection for prizes.
/// @dev Each raffle is identified by a string `raffleId` (hashed to bytes32
/// for storage) and uses explicit slot numbers owned by participant addresses.
contract Raffle is Ownable {
    constructor() Ownable(msg.sender) {}

    // ==== Multi-raffle implementation (RAFFLE.md spec, native ETH) ====

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
        uint256 pricePerSlot;
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
    mapping(address => string[]) private _userRafflesMulti;

    uint256 public nextPrizeTokenId;

    event MultiRaffleHosted(bytes32 indexed id, string raffleId, address indexed organizer);
    event MultiRaffleJoined(bytes32 indexed id, address indexed payer, uint256[] slots, uint256 paidAmount);
    event MultiRaffleFilled(bytes32 indexed id, uint256 totalSlots);
    event MultiRaffleDrawn(bytes32 indexed id, uint256 winnerSlot, address indexed winner);
    event MultiRafflePrizeMinted(bytes32 indexed id, address indexed to, uint256 tokenId, string metadataUri);
    event MultiRaffleProceedsWithdrawn(address indexed to, uint256 amount);

    /// @notice Create a new raffle with the specified parameters.
    /// @dev Reverts if a raffle with the same `raffleId` already exists.
    /// Sets status to OPEN and resets counters.
    function hostRaffle(
        string calldata raffleId,
        uint256 totalSlots,
        uint256 maxSlotsPerAddress,
        uint256 pricePerSlot,
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

        r.raffleId = raffleId;
        r.totalSlots = totalSlots;
        r.maxSlotsPerAddress = maxSlotsPerAddress;
        r.pricePerSlot = pricePerSlot;
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

    /// @notice Join an existing raffle by purchasing specific slot IDs.
    /// @dev Payment is in native ETH; msg.value must equal pricePerSlot * (slots - bonusFreeSlots).
    /// Reverts if raffle is not OPEN, expired, or any slot is invalid/taken.
    function joinRaffle(
        string calldata raffleId,
        uint256[] calldata slotIds
    ) external payable {
        require(slotIds.length > 0, "NoSlots");

        bytes32 id = keccak256(bytes(raffleId));
        MultiRaffle storage r = _multiRaffles[id];
        require(bytes(r.raffleId).length != 0, "RaffleNotFound");
        require(r.status == MultiRaffleStatus.OPEN, "NotOpen");
        if (r.expiresAt != 0) {
            require(block.timestamp <= r.expiresAt, "RaffleExpired");
        }

        _joinRaffle(id, r, slotIds, msg.sender, 0);
    }

    /// @notice Convenience helper that both hosts and joins a raffle in one tx.
    /// @dev The first `min(bonusFreeSlots, slotIds.length)` slots are free.
    function unsafeJoinHostRaffle(
        string calldata raffleId,
        uint256 totalSlots,
        uint256 maxSlotsPerAddress,
        uint256 pricePerSlot,
        string calldata metadataUri,
        address collection,
        bool premintContract,
        bool premint,
        bool autoClaim,
        uint64 expiresAt,
        uint256[] calldata slotIds,
        uint256 bonusFreeSlots
    ) external payable returns (bytes32 id) {
        id = hostRaffle(
            raffleId,
            totalSlots,
            maxSlotsPerAddress,
            pricePerSlot,
            metadataUri,
            collection,
            premintContract,
            premint,
            autoClaim,
            expiresAt
        );

        MultiRaffle storage r = _multiRaffles[id];
        _joinRaffle(id, r, slotIds, msg.sender, bonusFreeSlots);
    }

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

    /// @notice Return basic load information for a raffle.
    /// @return totalSlots Total number of slots.
    /// @return soldSlots Number of slots sold.
    /// @return status Raffle status as uint8.
    function getRaffleLoad(
        string calldata raffleId
    ) external view returns (uint256 totalSlots, uint256 soldSlots, uint8 status) {
        bytes32 id = keccak256(bytes(raffleId));
        MultiRaffle storage r = _multiRaffles[id];
        require(bytes(r.raffleId).length != 0, "RaffleNotFound");
        return (r.totalSlots, r.soldSlots, uint8(r.status));
    }

    /// @notice Get all raffleIds that the given user has ever joined.
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
    /// @return allAvailable True if no invalid/taken slots are found.
    /// @return unavailable List of slot numbers that are out-of-range or taken.
    function checkSlotsAvailability(
        string calldata raffleId,
        uint256[] calldata slotIds
    ) external view returns (bool allAvailable, uint256[] memory unavailable) {
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
        allAvailable = (count == 0);
    }

    function _joinRaffle(
        bytes32 id,
        MultiRaffle storage r,
        uint256[] calldata slotIds,
        address payer,
        uint256 bonusFreeSlots
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

        uint256 freeSlots = bonusFreeSlots < requested ? bonusFreeSlots : requested;
        uint256 payableSlots = requested - freeSlots;
        uint256 expectedPayment = r.pricePerSlot * payableSlots;
        require(msg.value == expectedPayment, "BadPayment");

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

        emit MultiRaffleJoined(id, payer, slotIds, expectedPayment);

        if (r.soldSlots == r.totalSlots) {
            r.status = MultiRaffleStatus.FILLED;
            emit MultiRaffleFilled(id, r.totalSlots);
            _endRaffleInternal(id, r);
        }
    }

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
            _mintPrize(id, r, winner);
            r.claimed = true;
        }
    }

    function _mintPrize(bytes32 id, MultiRaffle storage r, address to) internal {
        require(r.collection != address(0), "NoCollection");

        uint256 tokenId = ++nextPrizeTokenId;
        uint256 mintedId = ICollectionMint(r.collection).mintWithTokenId(
            to,
            tokenId,
            r.metadataUri
        );

        emit MultiRafflePrizeMinted(id, to, mintedId, r.metadataUri);
    }
}
