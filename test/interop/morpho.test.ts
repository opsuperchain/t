import { describe, it, expect, beforeEach } from 'vitest'
import { SuperContract, SuperWallet as Wallet, getSuperContract } from 'superchain-starter'
import { encodeFunctionData } from 'viem'
import { ethers } from 'ethers'
import { config } from './config'
import { MORPHO_ABI, MORPHO_BYTECODE } from './contracts'
import ERC20MockArtifact from '../../out/ERC20Mock.sol/ERC20Mock.json'
import FlashBorrowerMockArtifact from '../../out/FlashBorrowerMock.sol/FlashBorrowerMock.json'
import IrmMockArtifact from '../../out/IrmMock.sol/IrmMock.json'

const toHexString = (char: string, length: number = 40): `0x${string}` => 
    `0x${char.repeat(length)}` as `0x${string}`

describe('Morpho Interop Tests', () => {
    const PRIVATE_KEY = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80' as const
    const wallet = new Wallet(PRIVATE_KEY)
    let morpho: SuperContract
    let token: SuperContract
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

        irm = getSuperContract(
            config,
            wallet,
            IrmMockArtifact.abi,
            IrmMockArtifact.bytecode.object as `0x${string}`,
            []
        )

        // Deploy Morpho first since we need its address for FlashBorrower
        await morpho.deploy(901)
        await token.deploy(901)
        await irm.deploy(901)

        flashBorrower = getSuperContract(
            config,
            wallet,
            FlashBorrowerMockArtifact.abi,
            FlashBorrowerMockArtifact.bytecode.object as `0x${string}`,
            [morpho.address]
        )
        await flashBorrower.deploy(901)

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
    }, 30000)

    it('should supply tokens and do a flash loan', async () => {
        const amount = ethers.parseEther('100')
        
        // Set balance and approve
        await token.sendTx(901, 'setBalance', [walletAddress, amount])
        await token.sendTx(901, 'approve', [morpho.address, amount])

        // Supply tokens using the same market params
        const marketParams = {
            loanToken: token.address,
            collateralToken: token.address,
            oracle: mockOracle,
            irm: irm.address,
            lltv: ethers.parseEther('0.8')
        }

        await morpho.sendTx(901, 'supply', [marketParams, amount, 0n, walletAddress, '0x'])

        // Do flash loan
        const flashLoanAmount = ethers.parseEther('50')
        const abiCoder = new ethers.AbiCoder()
        const flashLoanData = abiCoder.encode(['address'], [token.address])
        await flashBorrower.sendTx(901, 'flashLoan', [token.address, flashLoanAmount, flashLoanData])

        // Verify flash loan succeeded by checking token balance is unchanged
        const balance = await token.call(901, 'balanceOf', [walletAddress])
        expect(balance).toBe(0n) // All tokens were supplied to Morpho
    }, 30000)

    // TODO: Add more tests for basic interactions
    // - Market creation
    // - Supply
    // - Borrow
    // etc.
}) 