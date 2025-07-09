// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/**
 * @title BasicToken
 * @dev Simple ERC20 token with an initial supply minted to the deployer.
 */
contract BasicToken is ERC20 {
    /**
     * @param name_   Token name
     * @param symbol_ Token symbol (ticker)
     * @param initialSupply Initial supply (in wei, considering 18 decimals)
     */
    constructor(string memory name_, string memory symbol_, uint256 initialSupply) ERC20(name_, symbol_) {
        _mint(msg.sender, initialSupply);
    }
} 