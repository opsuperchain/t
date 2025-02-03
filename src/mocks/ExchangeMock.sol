// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.19;

import {IERC20} from "../interfaces/IERC20.sol";
import {SafeTransferLib} from "../libraries/SafeTransferLib.sol";

contract ExchangeMock {
    using SafeTransferLib for IERC20;

    // Exchange rate in basis points (1 basis point = 0.01%)
    // 10000 = 1:1 exchange rate
    uint256 public exchangeRate;
    IERC20 public immutable token0;
    IERC20 public immutable token1;

    constructor(address _token0, address _token1, uint256 _exchangeRate) {
        token0 = IERC20(_token0);
        token1 = IERC20(_token1);
        exchangeRate = _exchangeRate;
    }

    function setExchangeRate(uint256 _exchangeRate) external {
        exchangeRate = _exchangeRate;
    }

    // Swap token0 for token1
    function swapToken0ForToken1(uint256 amountIn) external returns (uint256 amountOut) {
        amountOut = (amountIn * exchangeRate) / 10000;
        token0.safeTransferFrom(msg.sender, address(this), amountIn);
        token1.safeTransfer(msg.sender, amountOut);
    }

    // Swap token1 for token0
    function swapToken1ForToken0(uint256 amountIn) external returns (uint256 amountOut) {
        amountOut = (amountIn * 10000) / exchangeRate;
        token1.safeTransferFrom(msg.sender, address(this), amountIn);
        token0.safeTransfer(msg.sender, amountOut);
    }
}
