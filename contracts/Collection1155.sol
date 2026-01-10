// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract Collection1155 is ERC1155, Ownable {
    mapping(address => bool) public operators;
    mapping(address => bool) public minters;

    // Optional per-token URIs (override base URI if set)
    mapping(uint256 => string) private _tokenURIs;

    modifier onlyOwnerOrOperator() {
        require(owner() == msg.sender || operators[msg.sender], "Not owner/operator");
        _;
    }

    modifier onlyMinter() {
        require(minters[msg.sender], "Not minter");
        _;
    }

    constructor(string memory baseURI)
        ERC1155(baseURI)
        Ownable(msg.sender)
    {}

    function setOperator(address operator, bool allowed) external onlyOwner {
        operators[operator] = allowed;
    }

    function setMinter(address minter, bool allowed) external onlyOwnerOrOperator {
        minters[minter] = allowed;
    }

    function setTokenURI(uint256 id, string calldata newuri) external onlyOwnerOrOperator {
        _tokenURIs[id] = newuri;
        emit URI(newuri, id);
    }

    function uri(uint256 id) public view override returns (string memory) {
        string memory tokenURI = _tokenURIs[id];
        if (bytes(tokenURI).length > 0) {
            return tokenURI;
        }
        return super.uri(id);
    }

    function mintTo(
        address to,
        uint256 id,
        uint256 amount,
        bytes calldata data,
        string calldata newuri
    ) external onlyMinter {
        if (bytes(newuri).length > 0) {
            _tokenURIs[id] = newuri;
            emit URI(newuri, id);
        }
        _mint(to, id, amount, data);
    }

    function mintBatchTo(
        address to,
        uint256[] calldata ids,
        uint256[] calldata amounts,
        bytes calldata data
    ) external onlyMinter {
        _mintBatch(to, ids, amounts, data);
    }

    function burn(
        address from,
        uint256 id,
        uint256 amount
    ) external {
        require(from == msg.sender || isApprovedForAll(from, msg.sender), "Not owner/approved");
        _burn(from, id, amount);
    }
}
