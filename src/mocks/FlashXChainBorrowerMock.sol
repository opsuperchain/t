// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity ^0.8.0;

import {IERC20} from "./interfaces/IERC20.sol";
import {IMorpho} from "../interfaces/IMorpho.sol";
import {IMorphoFlashLoanCallback} from "../interfaces/IMorphoCallbacks.sol";
import {ExchangeMock} from "./ExchangeMock.sol";

contract FlashXChainBorrowerMock is IMorphoFlashLoanCallback {
    IMorpho private immutable MORPHO;

    constructor(IMorpho newMorpho) {
        MORPHO = newMorpho;
    }

    function flashLoan(address token, uint256 destinationChain, uint256 assets, bytes calldata data) external payable {
        MORPHO.initiateCrosschainFlashLoan{value: msg.value}(token, destinationChain, assets, data);
    }

    function onMorphoFlashLoan(uint256 assets, bytes calldata data) external {
        // Decode the exchange addresses and token from the callback data
        (address sourceExchange, address destExchange, address token0, address token1) =
            abi.decode(data, (address, address, address, address));

        // Get exchange contracts
        ExchangeMock exchange1 = ExchangeMock(sourceExchange);
        ExchangeMock exchange2 = ExchangeMock(destExchange);

        // // Approve exchanges to spend our tokens
        IERC20(token0).approve(sourceExchange, assets);
        IERC20(token1).approve(destExchange, type(uint256).max);

        // Perform arbitrage:
        // 1. Swap token0 for token1 on first exchange
        uint256 token1Amount = exchange1.swapToken0ForToken1(assets);

        // // 2. Swap token1 back to token0 on second exchange
        exchange2.swapToken1ForToken0(token1Amount);

        // Ensure we made a profit
        require(IERC20(token0).balanceOf(address(this)) > assets, "No profit made");

        // Approve Morpho to take back the flash loaned amount
        IERC20(token0).approve(msg.sender, assets);
    }
}
