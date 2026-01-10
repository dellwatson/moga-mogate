// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract Collection is ERC721URIStorage, Ownable {
    mapping(address => bool) public operators;
    mapping(address => bool) public minters;

    uint256 private _nextTokenId;

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

    function setOperator(address operator, bool allowed) external onlyOwner {
        operators[operator] = allowed;
    }

    function setMinter(address minter, bool allowed) external onlyOwnerOrOperator {
        minters[minter] = allowed;
    }

    function mintTo(address to, string calldata uri) external onlyMinter returns (uint256 tokenId) {
        tokenId = ++_nextTokenId;
        _safeMint(to, tokenId);
        _setTokenURI(tokenId, uri);
    }

    function mintWithTokenId(
        address to,
        uint256 tokenId,
        string calldata uri
    ) external onlyMinter returns (uint256) {
        _safeMint(to, tokenId);
        _setTokenURI(tokenId, uri);
        return tokenId;
    }

    function burn(uint256 tokenId) external {
        address owner = ownerOf(tokenId);
        require(
            msg.sender == owner ||
                isApprovedForAll(owner, msg.sender) ||
                getApproved(tokenId) == msg.sender,
            "Not owner/approved"
        );
        _burn(tokenId);
    }
}
