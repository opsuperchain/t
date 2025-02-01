// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.19;

import {AsyncEnabled} from "lib/superchain-async/src/AsyncEnabled.sol";
import {ISuperchainTokenBridge} from "interop-lib/interfaces/ISuperchainTokenBridge.sol";
import {IL2ToL2CrossDomainMessenger} from "interop-lib/interfaces/IL2ToL2CrossDomainMessenger.sol";
import {IRemoteMorpho, Promise} from "./interfaces/IMorpho.sol";
import {EventsLib} from "./libraries/EventsLib.sol";
import {ErrorsLib} from "./libraries/ErrorsLib.sol";
import {IERC20} from "./interfaces/IERC20.sol";
import {SafeTransferLib} from "./libraries/SafeTransferLib.sol";
import {IMorphoFlashLoanCallback} from "./interfaces/IMorphoCallbacks.sol";

interface IXChainMorpho {
    function initiateCrosschainFlashLoan(address token, uint256 destinationChain, uint256 assets, bytes calldata data)
        external
        payable;
}

contract XChainMorpho is AsyncEnabled {
    using SafeTransferLib for IERC20;

    function initiateCrosschainFlashLoan(address token, uint256 destinationChain, uint256 assets, bytes calldata data)
        external
        payable
    {
        uint256 flashLoanFee = 0.0001 ether;
        require(msg.value >= flashLoanFee, "Insufficient fee");

        ISuperchainTokenBridge bridge = ISuperchainTokenBridge(0x4200000000000000000000000000000000000028);

        // Send tokens to Morpho on destination chain
        bridge.sendERC20(address(token), address(this), assets, destinationChain);

        IRemoteMorpho remote = IRemoteMorpho(getAsyncProxy(address(this), destinationChain));
        Promise initiateFlashLoanPromise = remote.await(destinationChain, msg.sender, token, assets, data);
        // send message to the destination chain to execute the flash loan
        initiateFlashLoanPromise.then(this.executeFlashLoanOnRemoteChain);
    }

    function await(uint256 destinationChain, address borrower, address token, uint256 assets, bytes memory data)
        external
        view
        async
        returns (uint256, address, address, uint256, bytes memory)
    {
        return (destinationChain, borrower, token, assets, data);
    }

    function executeFlashLoanOnRemoteChain(
        uint256 destinationChain,
        address borrower,
        address token,
        uint256 assets,
        bytes memory data
    ) external asyncCallback {
        IL2ToL2CrossDomainMessenger(0x4200000000000000000000000000000000000023).sendMessage(
            destinationChain,
            address(this),
            abi.encodeWithSelector(this.xChainFlashLoan.selector, block.chainid, borrower, token, assets, data)
        );
    }

    function xChainFlashLoan(uint256 sourceChain, address borrower, address token, uint256 assets, bytes calldata data)
        external
    {
        // TODO have this call the morpho parent contract
        require(assets != 0, ErrorsLib.ZERO_ASSETS);

        emit EventsLib.FlashLoan(borrower, token, assets);

        IERC20(token).safeTransfer(borrower, assets);

        IMorphoFlashLoanCallback(borrower).onMorphoFlashLoan(assets, data);

        IERC20(token).safeTransferFrom(borrower, address(this), assets);

        // Send tokens back to this contract on source chain
        ISuperchainTokenBridge bridge = ISuperchainTokenBridge(0x4200000000000000000000000000000000000028);
        bridge.sendERC20(
            address(token),
            address(this), // Send back to this contract on source chain
            assets,
            sourceChain
        );
    }
}
