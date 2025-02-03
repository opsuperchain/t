// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import {SuperchainERC20} from "./SuperchainERC20.sol";

contract XChainERC20Mock is SuperchainERC20 {
    string private _name;
    string private _symbol;
    uint8 private _decimals;

    constructor(string memory name_, string memory symbol_, uint8 decimals_) {
        _name = name_;
        _symbol = symbol_;
        _decimals = decimals_;
    }

    function name() public view override returns (string memory) {
        return _name;
    }

    function symbol() public view override returns (string memory) {
        return _symbol;
    }

    function decimals() public view override returns (uint8) {
        return _decimals;
    }

    function mint(address to_, uint256 amount_) external {
        _mint(to_, amount_);
    }

    function burn(address from_, uint256 amount_) external {
        _burn(from_, amount_);
    }
}
