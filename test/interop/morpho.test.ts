import { describe, it, expect, beforeEach } from 'vitest'
import { SuperContract, SuperWallet as Wallet, getSuperContract } from 'superchain-starter'
import { ethers } from 'ethers'
import { config } from './config'
import { MORPHO_ABI, MORPHO_BYTECODE } from './contracts'
import ERC20MockArtifact from '../../out/ERC20Mock.sol/ERC20Mock.json'
import XChainERC20MockArtifact from '../../out/XChainERC20Mock.sol/XChainERC20Mock.json'
import FlashXChainBorrowerMockArtifact from '../../out/FlashXChainBorrowerMock.sol/FlashXChainBorrowerMock.json'
import IrmMockArtifact from '../../out/IrmMock.sol/IrmMock.json'
const toHexString = (char: string, length: number = 40): `0x${string}` => 
    `0x${char.repeat(length)}` as `0x${string}`
import { setTimeout } from 'timers/promises'

describe('Morpho Interop Tests', () => {
    const PRIVATE_KEY = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80' as const
    const wallet = new Wallet(PRIVATE_KEY)
    let morpho: SuperContract
    let token: SuperContract
    let xChainToken: SuperContract
    let flashBorrower: SuperContract
    let irm: SuperContract
    let walletAddress: string
    const mockOracle = toHexString('2')

    // Deploy the contract once before all tests
    beforeEach(async () => {
        // Get wallet address
        walletAddress = wallet.getAddress()
        console.log('Wallet address:', walletAddress)

        // Create contract instances
        morpho = getSuperContract(
            config,
            wallet,
            MORPHO_ABI,
            MORPHO_BYTECODE,
            [walletAddress] // Pass wallet address as newOwner
        )


        token = getSuperContract(
            config,
            wallet,
            ERC20MockArtifact.abi,
            ERC20MockArtifact.bytecode.object as `0x${string}`,
            []
        )

        xChainToken = getSuperContract(
            config,
            wallet,
            XChainERC20MockArtifact.abi,
            XChainERC20MockArtifact.bytecode.object as `0x${string}`,
            []
        )

        irm = getSuperContract(
            config,
            wallet,
            IrmMockArtifact.abi,
            IrmMockArtifact.bytecode.object as `0x${string}`,
            []
        )

        // Deploy Morpho first since we need its address for FlashBorrower
        await morpho.deploy(901)
        await morpho.deploy(902)
        await token.deploy(901)
        await xChainToken.deploy(901)
        await xChainToken.deploy(902)
        await irm.deploy(901)
        await irm.deploy(902)

        flashBorrower = getSuperContract(
            config,
            wallet,
            FlashXChainBorrowerMockArtifact.abi,
            FlashXChainBorrowerMockArtifact.bytecode.object as `0x${string}`,
            [morpho.address]
        )
        await flashBorrower.deploy(901)
        await flashBorrower.deploy(902)

        // Enable IRM and LLTV for market creation
        await morpho.sendTx(901, 'enableIrm', [irm.address])
        await morpho.sendTx(901, 'enableLltv', [ethers.parseEther('0.8')])

        // Create market params
        const marketParams = {
            loanToken: token.address,
            collateralToken: token.address, // Using same token as collateral
            oracle: mockOracle,
            irm: irm.address,
            lltv: ethers.parseEther('0.8')
        }

        // Create market
        await morpho.sendTx(901, 'createMarket', [marketParams])
    }, 60000)

    it('should supply tokens and do a xchain flash loan', async () => {
        // Mint tokens for the bridge on chain 901
        const amount = 1000n
        await xChainToken.sendTx(901, 'mint', [morpho.address, amount])
        const bridgePreBalance = await xChainToken.call(901, 'balanceOf', [morpho.address])
        expect(bridgePreBalance).toBe(amount)
        const flashXChainBorrowerPreBalance = await xChainToken.call(901, 'balanceOf', [flashBorrower.address])
        expect(flashXChainBorrowerPreBalance).toBe(0n)

        const abiCoder = new ethers.AbiCoder()
        const flashLoanData = abiCoder.encode(['address'], [xChainToken.address])
        const FEE = 10000000000000000n 
        await flashBorrower.sendTx(901, 'flashLoan', [xChainToken.address, 902n, amount, flashLoanData], FEE)

        await waitForTrue(async () => {
            const bridgePostBalance = await xChainToken.call(901, 'balanceOf', [morpho.address])
            const flashXChainBorrowerPostBalance = await xChainToken.call(901, 'balanceOf', [flashBorrower.address])
            return bridgePostBalance === amount && flashXChainBorrowerPostBalance === 0n
        }, 30000, 1000, 'Bridge balance did not update to expected value')
    }, 60000)

    // TODO: Add more tests for basic interactions
    // - Market creation
    // - Supply
    // - Borrow
    // etc.
}) 

async function waitForTrue(
    callback: () => Promise<boolean>,
    timeout: number = 10000,
    interval: number = 1000,
    timeoutMessage: string = "Condition not met within timeout period"
): Promise<void> {
    return new Promise(async (resolve, reject) => {
        const startTime = Date.now();
        
        while (Date.now() - startTime < timeout) {
            try {
                if (await callback()) {
                    resolve();
                    return;
                }
            } catch (error) {
                reject(error);
                return;
            }
            await setTimeout(interval);
        }
        
        reject(new Error(timeoutMessage));
    });
}

