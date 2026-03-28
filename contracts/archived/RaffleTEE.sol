// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";

/// @notice Minimal interface for the external NFT collection used for prizes.
interface ICollectionMint {
    function mintWithTokenId(
        address to,
        uint256 tokenId,
        string calldata uri
    ) external returns (uint256);

    function mintTo(
        address to,
        string calldata uri
    ) external returns (uint256);
}

/// @title TEE-backed raffle (EVM)
/// @notice Privacy modes:
///  - SLOTS_ONLY: on-chain buyers + payments, but slot selection is hidden (commitments only)
///  - FULL: no on-chain buyers; only a tickets root + iExec TEE result are published
/// @dev Winner selection is performed inside a TEE (iExec) and delivered via receiveResult().
contract RaffleTEE is Ownable {
    constructor(address iexecHub_) Ownable(msg.sender) {
        require(iexecHub_ != address(0), "InvalidIexecHub");
        iexecHub = iexecHub_;
    }

    // =============================================================
    // Core types
    // =============================================================

    enum PrivacyMode {
        SLOTS_ONLY,
        FULL
    }

    enum RaffleStatus {
        OPEN,
        DRAWING,
        DRAWN,
        CANCELLED
    }

    enum PrizeTokenType {
        NONE,
        ERC721,
        ERC1155,
        ERC404
    }

    struct Raffle {
        string raffleId;
        address organizer;
        uint256 totalSlots;
        uint256 soldTickets;
        uint256 maxTicketsPerAddress;
        uint256 ticketPriceWei;
        string metadataUri;
        address collection;
        bool premintContract;
        bool premint;
        PrizeTokenType prizeType;
        uint256 prizeAmount;
        bool autoClaim;
        uint64 createdAt;
        uint64 expiresAt;
        PrivacyMode privacy;
        RaffleStatus status;
        address winner;
        uint256 winnerIndex;
        bytes32 ticketsRoot;
        bool claimed;
    }

    // =============================================================
    // Storage
    // =============================================================

    address public immutable iexecHub;

    mapping(bytes32 => Raffle) private _raffles;

    // Slots-only commitments (slot + salt + address) are stored as hashes.
    mapping(bytes32 => bytes32[]) private _ticketCommitments;
    mapping(bytes32 => mapping(bytes32 => bool)) private _commitmentUsed;
    mapping(bytes32 => mapping(address => uint256)) private _userTicketCount;
    mapping(bytes32 => mapping(address => uint256)) private _userPaid;
    mapping(bytes32 => mapping(uint256 => bool)) private _slotTaken;

    // iExec call mapping: callId <-> raffleIdHash.
    mapping(bytes32 => bytes32) public drawCallByRaffle;
    mapping(bytes32 => bytes32) public raffleByCall;
    mapping(bytes32 => bool) public callConsumed;

    // =============================================================
    // Events
    // =============================================================

    event RaffleCreated(
        bytes32 indexed id,
        string raffleId,
        address indexed organizer,
        PrivacyMode privacy
    );
    event TicketsPurchased(
        bytes32 indexed id,
        address indexed buyer,
        uint256 ticketCount,
        uint256 paidAmount
    );
    event SlotTaken(bytes32 indexed id, uint256 slotId, address indexed buyer);
    event TicketsRootCommitted(
        bytes32 indexed id,
        bytes32 ticketsRoot,
        uint256 soldTickets
    );
    event RaffleReadyForDraw(bytes32 indexed id);
    event DrawCallRegistered(bytes32 indexed id, bytes32 indexed callId);
    event RaffleDrawn(bytes32 indexed id, address indexed winner, uint256 winnerIndex);
    event PrizeMinted(bytes32 indexed id, address indexed to, uint256 tokenId, string metadataUri);
    event ProceedsWithdrawn(address indexed to, uint256 amount);

    // =============================================================
    // Modifiers
    // =============================================================

    modifier onlyOrganizer(bytes32 id) {
        require(
            msg.sender == _raffles[id].organizer || msg.sender == owner(),
            "NotOrganizer"
        );
        _;
    }

    // =============================================================
    // External: create
    // =============================================================

    function createRaffle(
        string calldata raffleId,
        uint256 totalSlots,
        uint256 maxTicketsPerAddress,
        uint256 ticketPriceWei,
        string calldata metadataUri,
        address collection,
        bool premintContract,
        bool premint,
        PrizeTokenType prizeType,
        uint256 prizeAmount,
        bool autoClaim,
        uint64 expiresAt,
        PrivacyMode privacy
    ) external returns (bytes32 id) {
        require(totalSlots > 0, "TotalSlotsZero");
        require(maxTicketsPerAddress > 0, "MaxTicketsZero");

        id = keccak256(bytes(raffleId));
        Raffle storage r = _raffles[id];
        require(bytes(r.raffleId).length == 0, "RaffleExists");

        r.raffleId = raffleId;
        r.organizer = msg.sender;
        r.totalSlots = totalSlots;
        r.maxTicketsPerAddress = maxTicketsPerAddress;
        r.ticketPriceWei = ticketPriceWei;
        r.metadataUri = metadataUri;
        r.collection = collection;
        r.premintContract = premintContract;
        r.premint = premint;
        r.prizeType = prizeType;
        r.prizeAmount = prizeAmount;
        r.autoClaim = autoClaim;
        r.createdAt = uint64(block.timestamp);
        r.expiresAt = expiresAt;
        r.privacy = privacy;
        r.status = RaffleStatus.OPEN;
        r.soldTickets = 0;
        r.claimed = false;

        emit RaffleCreated(id, raffleId, msg.sender, privacy);
    }

    // =============================================================
    // External: slots-only join
    // =============================================================

    /// @notice Join a raffle in SLOTS_ONLY mode using opaque commitments.
    /// @dev Each commitment should be a hash of (raffleIdHash, slotId, salt, buyer).
    function joinSlotsOnly(
        string calldata raffleId,
        bytes32[] calldata commitments
    ) external payable {
        bytes32 id = keccak256(bytes(raffleId));
        Raffle storage r = _raffles[id];
        require(bytes(r.raffleId).length != 0, "RaffleNotFound");
        require(r.privacy == PrivacyMode.SLOTS_ONLY, "WrongPrivacyMode");
        require(r.status == RaffleStatus.OPEN, "NotOpen");
        if (r.expiresAt != 0) {
            require(block.timestamp <= r.expiresAt, "RaffleExpired");
        }

        uint256 count = commitments.length;
        require(count > 0, "NoCommitments");
        require(r.soldTickets + count <= r.totalSlots, "OverCapacity");

        uint256 current = _userTicketCount[id][msg.sender];
        require(current + count <= r.maxTicketsPerAddress, "MaxTicketsPerAddress");

        uint256 expected = r.ticketPriceWei * count;
        require(msg.value == expected, "BadPayment");

        for (uint256 i = 0; i < count; i++) {
            bytes32 c = commitments[i];
            require(c != bytes32(0), "BadCommitment");
            require(!_commitmentUsed[id][c], "CommitmentUsed");
            _commitmentUsed[id][c] = true;
            _ticketCommitments[id].push(c);
        }

        _userTicketCount[id][msg.sender] = current + count;
        _userPaid[id][msg.sender] += msg.value;
        r.soldTickets += count;

        emit TicketsPurchased(id, msg.sender, count, msg.value);

        if (r.soldTickets == r.totalSlots) {
            r.status = RaffleStatus.DRAWING;
            emit RaffleReadyForDraw(id);
        }
    }

    /// @notice Join a raffle in SLOTS_ONLY mode while reserving explicit slotIds.
    /// @dev Slot IDs become public to prevent duplicates. Each slotId must be unique.
    function joinSlotsOnlyWithSlots(
        string calldata raffleId,
        uint256[] calldata slotIds,
        bytes32[] calldata commitments
    ) external payable {
        bytes32 id = keccak256(bytes(raffleId));
        Raffle storage r = _raffles[id];
        require(bytes(r.raffleId).length != 0, "RaffleNotFound");
        require(r.privacy == PrivacyMode.SLOTS_ONLY, "WrongPrivacyMode");
        require(r.status == RaffleStatus.OPEN, "NotOpen");
        if (r.expiresAt != 0) {
            require(block.timestamp <= r.expiresAt, "RaffleExpired");
        }

        uint256 count = commitments.length;
        require(count > 0, "NoCommitments");
        require(slotIds.length == count, "SlotCommitmentMismatch");
        require(r.soldTickets + count <= r.totalSlots, "OverCapacity");

        uint256 current = _userTicketCount[id][msg.sender];
        require(current + count <= r.maxTicketsPerAddress, "MaxTicketsPerAddress");

        uint256 expected = r.ticketPriceWei * count;
        require(msg.value == expected, "BadPayment");

        for (uint256 i = 0; i < count; i++) {
            uint256 slotId = slotIds[i];
            require(slotId > 0 && slotId <= r.totalSlots, "BadSlotId");
            require(!_slotTaken[id][slotId], "SlotTaken");

            bytes32 c = commitments[i];
            require(c != bytes32(0), "BadCommitment");
            require(!_commitmentUsed[id][c], "CommitmentUsed");

            _slotTaken[id][slotId] = true;
            _commitmentUsed[id][c] = true;
            _ticketCommitments[id].push(c);

            emit SlotTaken(id, slotId, msg.sender);
        }

        _userTicketCount[id][msg.sender] = current + count;
        _userPaid[id][msg.sender] += msg.value;
        r.soldTickets += count;

        emit TicketsPurchased(id, msg.sender, count, msg.value);

        if (r.soldTickets == r.totalSlots) {
            r.status = RaffleStatus.DRAWING;
            emit RaffleReadyForDraw(id);
        }
    }

    /// @notice Check if a slotId is taken for a slots-only raffle.
    function isSlotTaken(
        string calldata raffleId,
        uint256 slotId
    ) external view returns (bool) {
        bytes32 id = keccak256(bytes(raffleId));
        return _slotTaken[id][slotId];
    }

    /// @notice Batch slot availability checks (true means taken).
    function getSlotStatusBatch(
        string calldata raffleId,
        uint256[] calldata slotIds
    ) external view returns (bool[] memory) {
        bytes32 id = keccak256(bytes(raffleId));
        bool[] memory out = new bool[](slotIds.length);
        for (uint256 i = 0; i < slotIds.length; i++) {
            out[i] = _slotTaken[id][slotIds[i]];
        }
        return out;
    }

    /// @notice Return all commitments for a raffle (public).
    function getCommitments(
        string calldata raffleId
    ) external view returns (bytes32[] memory) {
        bytes32 id = keccak256(bytes(raffleId));
        return _ticketCommitments[id];
    }

    /// @notice Return count of commitments for a raffle.
    function getCommitmentsCount(
        string calldata raffleId
    ) external view returns (uint256) {
        bytes32 id = keccak256(bytes(raffleId));
        return _ticketCommitments[id].length;
    }

    // =============================================================
    // External: full-privacy commitments
    // =============================================================

    /// @notice Commit a tickets Merkle root for FULL privacy raffles.
    /// @dev For SLOTS_ONLY, this can be used to pin the final root for auditability.
    function commitTicketsRoot(
        string calldata raffleId,
        bytes32 ticketsRoot,
        uint256 soldTickets
    ) external onlyOrganizer(keccak256(bytes(raffleId))) {
        bytes32 id = keccak256(bytes(raffleId));
        Raffle storage r = _raffles[id];
        require(bytes(r.raffleId).length != 0, "RaffleNotFound");
        require(r.status == RaffleStatus.OPEN || r.status == RaffleStatus.DRAWING, "BadStatus");
        require(ticketsRoot != bytes32(0), "BadRoot");

        if (r.privacy == PrivacyMode.FULL) {
            require(soldTickets > 0, "SoldTicketsZero");
            require(soldTickets <= r.totalSlots, "SoldTicketsTooHigh");
            if (r.soldTickets == 0) {
                r.soldTickets = soldTickets;
            } else {
                require(r.soldTickets == soldTickets, "SoldTicketsMismatch");
            }
            if (r.soldTickets == r.totalSlots && r.status == RaffleStatus.OPEN) {
                r.status = RaffleStatus.DRAWING;
                emit RaffleReadyForDraw(id);
            }
        } else {
            require(soldTickets == 0, "SoldTicketsNotUsed");
        }

        r.ticketsRoot = ticketsRoot;
        emit TicketsRootCommitted(id, ticketsRoot, r.soldTickets);
    }

    /// @notice Manually mark a raffle ready for draw (e.g., after expiry).
    function markReadyForDraw(string calldata raffleId) external onlyOrganizer(keccak256(bytes(raffleId))) {
        bytes32 id = keccak256(bytes(raffleId));
        Raffle storage r = _raffles[id];
        require(bytes(r.raffleId).length != 0, "RaffleNotFound");
        require(r.status == RaffleStatus.OPEN, "BadStatus");
        require(r.soldTickets > 0, "NoTickets");
        if (r.expiresAt != 0) {
            require(block.timestamp >= r.expiresAt, "NotExpired");
        }

        r.status = RaffleStatus.DRAWING;
        emit RaffleReadyForDraw(id);
    }

    // =============================================================
    // iExec integration
    // =============================================================

    /// @notice Register an iExec callId for a raffle draw.
    /// @dev The callId is the iExec task ID used for the callback.
    function registerDrawCall(string calldata raffleId, bytes32 callId) external onlyOrganizer(keccak256(bytes(raffleId))) {
        bytes32 id = keccak256(bytes(raffleId));
        Raffle storage r = _raffles[id];
        require(bytes(r.raffleId).length != 0, "RaffleNotFound");
        require(r.status == RaffleStatus.DRAWING, "NotDrawing");
        require(callId != bytes32(0), "BadCallId");

        bytes32 existing = drawCallByRaffle[id];
        require(existing == bytes32(0), "CallAlreadyRegistered");

        drawCallByRaffle[id] = callId;
        raffleByCall[callId] = id;

        emit DrawCallRegistered(id, callId);
    }

    /// @notice iExec result callback (called by iExec hub when task is validated).
    /// @dev callback must be abi.encode(raffleIdHash, winner, winnerIndex, ticketsRoot).
    function receiveResult(bytes32 callId, bytes calldata callback) external {
        require(msg.sender == iexecHub, "NotIexecHub");
        require(!callConsumed[callId], "CallConsumed");

        bytes32 id = raffleByCall[callId];
        require(id != bytes32(0), "UnknownCall");

        (bytes32 raffleIdHash, address winner, uint256 winnerIndex, bytes32 ticketsRoot) =
            abi.decode(callback, (bytes32, address, uint256, bytes32));

        require(raffleIdHash == id, "RaffleMismatch");

        Raffle storage r = _raffles[id];
        require(r.status == RaffleStatus.DRAWING, "NotDrawing");

        if (r.ticketsRoot == bytes32(0)) {
            r.ticketsRoot = ticketsRoot;
        } else {
            require(r.ticketsRoot == ticketsRoot, "TicketsRootMismatch");
        }

        r.winner = winner;
        r.winnerIndex = winnerIndex;
        r.status = RaffleStatus.DRAWN;

        callConsumed[callId] = true;
        delete raffleByCall[callId];
        delete drawCallByRaffle[id];

        emit RaffleDrawn(id, winner, winnerIndex);

        if (r.autoClaim && !r.claimed) {
            r.claimed = true;
            _mintPrize(id, r, winner);
        }
    }

    // =============================================================
    // Prize claim + treasury
    // =============================================================

    function claim(string calldata raffleId) external {
        bytes32 id = keccak256(bytes(raffleId));
        Raffle storage r = _raffles[id];
        require(bytes(r.raffleId).length != 0, "RaffleNotFound");
        require(r.status == RaffleStatus.DRAWN, "NotDrawn");
        require(!r.claimed, "AlreadyClaimed");
        require(msg.sender == r.winner, "NotWinner");

        r.claimed = true;
        _mintPrize(id, r, msg.sender);
    }

    function withdrawProceeds(address to, uint256 amount) external onlyOwner {
        require(to != address(0), "InvalidRecipient");
        require(amount <= address(this).balance, "InsufficientBalance");
        (bool ok, ) = to.call{value: amount}("");
        require(ok, "TransferFailed");
        emit ProceedsWithdrawn(to, amount);
    }

    // =============================================================
    // Views
    // =============================================================

    function getRaffle(
        string calldata raffleId
    )
        external
        view
        returns (
            string memory outRaffleId,
            address organizer,
            uint256 totalSlots,
            uint256 soldTickets,
            uint256 maxTicketsPerAddress,
            uint256 ticketPriceWei,
            PrivacyMode privacy,
            RaffleStatus status,
            address collection,
            uint256 prizeAmount,
            PrizeTokenType prizeType,
            bool autoClaim,
            uint64 createdAt,
            uint64 expiresAt,
            address winner,
            uint256 winnerIndex,
            bytes32 ticketsRoot,
            bool claimed
        )
    {
        bytes32 id = keccak256(bytes(raffleId));
        Raffle storage r = _raffles[id];
        require(bytes(r.raffleId).length != 0, "RaffleNotFound");
        return (
            r.raffleId,
            r.organizer,
            r.totalSlots,
            r.soldTickets,
            r.maxTicketsPerAddress,
            r.ticketPriceWei,
            r.privacy,
            r.status,
            r.collection,
            r.prizeAmount,
            r.prizeType,
            r.autoClaim,
            r.createdAt,
            r.expiresAt,
            r.winner,
            r.winnerIndex,
            r.ticketsRoot,
            r.claimed
        );
    }

    function getTicketCommitmentsCount(
        string calldata raffleId
    ) external view returns (uint256) {
        bytes32 id = keccak256(bytes(raffleId));
        return _ticketCommitments[id].length;
    }

    function getTicketCommitmentsInRange(
        string calldata raffleId,
        uint256 start,
        uint256 end
    ) external view returns (bytes32[] memory) {
        bytes32 id = keccak256(bytes(raffleId));
        require(end >= start, "BadRange");
        uint256 len = _ticketCommitments[id].length;
        require(end < len, "RangeOutOfBounds");

        uint256 count = end - start + 1;
        bytes32[] memory out = new bytes32[](count);
        for (uint256 i = 0; i < count; i++) {
            out[i] = _ticketCommitments[id][start + i];
        }
        return out;
    }

    function getUserTickets(
        string calldata raffleId,
        address user
    ) external view returns (uint256 ticketCount, uint256 paidAmount) {
        bytes32 id = keccak256(bytes(raffleId));
        ticketCount = _userTicketCount[id][user];
        paidAmount = _userPaid[id][user];
    }

    // =============================================================
    // Internal helpers
    // =============================================================

    function _mintPrize(bytes32 id, Raffle storage r, address to) internal {
        require(r.collection != address(0), "NoCollection");

        if (r.prizeType == PrizeTokenType.NONE) {
            r.prizeType = PrizeTokenType.ERC721;
        }
        if (r.prizeAmount == 0) {
            r.prizeAmount = 1;
        }

        if (r.prizeType == PrizeTokenType.ERC721) {
            uint256 amountToMint = r.prizeAmount;
            for (uint256 i = 0; i < amountToMint; i++) {
                uint256 mintedId = ICollectionMint(r.collection).mintTo(
                    to,
                    r.metadataUri
                );
                emit PrizeMinted(id, to, mintedId, r.metadataUri);
            }
        } else if (r.prizeType == PrizeTokenType.ERC1155) {
            revert("ERC1155PrizeNotImplemented");
        } else if (r.prizeType == PrizeTokenType.ERC404) {
            revert("ERC404PrizeNotImplemented");
        } else {
            revert("UnknownPrizeType");
        }
    }
}
