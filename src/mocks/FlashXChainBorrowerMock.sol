// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity ^0.8.0;

import {IERC20} from "./interfaces/IERC20.sol";
import {IXChainMorpho} from "../XChainMorpho.sol";
import {IMorphoFlashLoanCallback} from "../interfaces/IMorphoCallbacks.sol";

contract FlashXChainBorrowerMock is IMorphoFlashLoanCallback {
    IXChainMorpho private immutable MORPHO;

    constructor(IXChainMorpho newMorpho) {
        MORPHO = newMorpho;
    }

    function flashLoan(address token, uint256 destinationChain, uint256 assets, bytes calldata data) external payable {
        MORPHO.initiateCrosschainFlashLoan{value: msg.value}(token, destinationChain, assets, data);
    }

    function onMorphoFlashLoan(uint256 assets, bytes calldata data) external {
        require(msg.sender == address(MORPHO));
        address token = abi.decode(data, (address));
        IERC20(token).approve(address(MORPHO), assets);
    }
}
