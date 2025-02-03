import { describe, it, expect, beforeEach } from 'vitest'
import { SuperContract, SuperWallet as Wallet, getSuperContract } from 'superchain-starter'
import { ethers } from 'ethers'
import { config } from './config'
import { MORPHO_ABI, MORPHO_BYTECODE } from './contracts'
import XChainERC20MockArtifact from '../../out/XChainERC20Mock.sol/XChainERC20Mock.json'
import FlashXChainBorrowerMockArtifact from '../../out/FlashXChainBorrowerMock.sol/FlashXChainBorrowerMock.json'
import ExchangeMockArtifact from '../../out/ExchangeMock.sol/ExchangeMock.json'
import IrmMockArtifact from '../../out/IrmMock.sol/IrmMock.json'
const toHexString = (char: string, length: number = 40): `0x${string}` => 
    `0x${char.repeat(length)}` as `0x${string}`
import { setTimeout } from 'timers/promises'

describe('Morpho Interop Tests', () => {
    const PRIVATE_KEY = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80' as const
    const wallet = new Wallet(PRIVATE_KEY)
    let morpho: SuperContract
    let token0: SuperContract
    let token1: SuperContract
    let exchange1: SuperContract
    let exchange2: SuperContract
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
            [walletAddress]
        )

        token0 = getSuperContract(
            config,
            wallet,
            XChainERC20MockArtifact.abi,
            XChainERC20MockArtifact.bytecode.object as `0x${string}`,
            ["XChainToken0", "X0", 18]
        )

        token1 = getSuperContract(
            config,
            wallet,
            XChainERC20MockArtifact.abi,
            XChainERC20MockArtifact.bytecode.object as `0x${string}`,
            ["XChainToken1", "X1", 18]
        )

        irm = getSuperContract(
            config,
            wallet,
            IrmMockArtifact.abi,
            IrmMockArtifact.bytecode.object as `0x${string}`,
            []
        )

        // Deploy base contracts
        await morpho.deploy(901)
        await morpho.deploy(902)
        await token0.deploy(901)
        await token0.deploy(902)
        await token1.deploy(901)
        await token1.deploy(902)
        await irm.deploy(901)
        await irm.deploy(902)

        // Create and deploy exchanges with different rates
        exchange1 = getSuperContract(
            config,
            wallet,
            ExchangeMockArtifact.abi,
            ExchangeMockArtifact.bytecode.object as `0x${string}`,
            [token0.address, token1.address, 10000] // 1:1 rate
        )

        exchange2 = getSuperContract(
            config,
            wallet,
            ExchangeMockArtifact.abi,
            ExchangeMockArtifact.bytecode.object as `0x${string}`,
            [token0.address, token1.address, 9000] // .9:1 rate
        )

        await exchange1.deploy(902)
        await exchange2.deploy(902)

        // Deploy flash borrower
        flashBorrower = getSuperContract(
            config,
            wallet,
            FlashXChainBorrowerMockArtifact.abi,
            FlashXChainBorrowerMockArtifact.bytecode.object as `0x${string}`,
            [morpho.address]
        )
        await flashBorrower.deploy(901)
        await flashBorrower.deploy(902)

        // Setup exchange liquidity
        const INITIAL_LIQUIDITY = ethers.parseEther('1000')
        
        // Mint and approve tokens for exchanges
        await token0.sendTx(902, 'mint', [exchange1.address, INITIAL_LIQUIDITY])
        await token1.sendTx(902, 'mint', [exchange1.address, INITIAL_LIQUIDITY])
        await token0.sendTx(902, 'mint', [exchange2.address, INITIAL_LIQUIDITY])
        await token1.sendTx(902, 'mint', [exchange2.address, INITIAL_LIQUIDITY])

        // Enable IRM and LLTV for market creation
        await morpho.sendTx(901, 'enableIrm', [irm.address])
        await morpho.sendTx(901, 'enableLltv', [ethers.parseEther('0.8')])

        // Create market params
        const marketParams = {
            loanToken: token0.address,
            collateralToken: token0.address,
            oracle: mockOracle,
            irm: irm.address,
            lltv: ethers.parseEther('0.8')
        }

        // Create market
        await morpho.sendTx(901, 'createMarket', [marketParams])
    }, 60000)

    it('should perform cross-chain arbitrage using flash loan', async () => {
        const FLASH_LOAN_AMOUNT = ethers.parseEther('100')
        
        // Mint tokens for Morpho to enable flash loans
        await token0.sendTx(901, 'mint', [morpho.address, FLASH_LOAN_AMOUNT])
        const morphoInitialBalance = await token0.call(901, 'balanceOf', [morpho.address])
        
        // Get initial balances
        const borrowerInitialBalance = await token0.call(902, 'balanceOf', [flashBorrower.address])
        expect(borrowerInitialBalance).toBe(0n)

        // Encode flash loan data with exchange addresses and tokens
        const abiCoder = new ethers.AbiCoder()
        const flashLoanData = abiCoder.encode(
            ['address', 'address', 'address', 'address'],
            [exchange1.address, exchange2.address, token0.address, token1.address]
        )

        // Execute flash loan with arbitrage
        const FEE = ethers.parseEther('0.0001')
        await flashBorrower.sendTx(
            901,
            'flashLoan',
            [token0.address, 902n, FLASH_LOAN_AMOUNT, flashLoanData],
            FEE
        )

        // Wait for the cross-chain transaction to complete
        await waitForTrue(async () => {
            const borrowerFinalBalance = await token0.call(902, 'balanceOf', [flashBorrower.address])
            // Should have made a profit
            return borrowerFinalBalance > borrowerInitialBalance
        }, 30000, 1000, 'Arbitrage did not complete successfully')

        // Verify borrower made a profit off arbitrage
        const borrowerFinalBalance = await token0.call(902, 'balanceOf', [flashBorrower.address])
        console.log('Profit made:', ethers.formatEther(borrowerFinalBalance))
        expect(borrowerFinalBalance).toBeGreaterThan(0n)

        // Wait for cross-chain transaction of sending tokens back to Morpho on source chain
        await waitForTrue(async () => {
            // Verify Morpho's balance is unchanged
            const morphoFinalBalance = await token0.call(901, 'balanceOf', [morpho.address])
            return morphoFinalBalance === morphoInitialBalance
        }, 30000, 1000, 'Morpho\'s balance is not unchanged')
    }, 60000)
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

