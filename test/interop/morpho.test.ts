import { describe, it, expect, beforeEach } from 'vitest'
import { SuperContract, SuperWallet as Wallet, getSuperContract } from 'superchain-starter'
import { encodeFunctionData } from 'viem'
import { ethers } from 'ethers'
import { config } from './config'
import { MORPHO_ABI, MORPHO_BYTECODE } from './contracts'

describe('Morpho Interop Tests', () => {
    const PRIVATE_KEY = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80' as const
    const wallet = new Wallet(PRIVATE_KEY)
    let morpho: SuperContract
    let walletAddress: string

    // Deploy the contract once before all tests
    beforeEach(async () => {
        // Get wallet address
        walletAddress = wallet.getAddress()
        console.log('Wallet address:', walletAddress)

        // Create contract instance
        morpho = getSuperContract(
            config,
            wallet,
            MORPHO_ABI,
            MORPHO_BYTECODE,
            [walletAddress] // Pass wallet address as newOwner
        )

        console.log('Expected deployment address:', morpho.address)
    })

    it('should deploy Morpho contract', async () => {
        try {
            // Deploy the contract
            await morpho.deploy(901)
            
            // Check if contract is deployed
            const provider = new ethers.JsonRpcProvider('http://127.0.0.1:9545')
            const code = await provider.getCode(morpho.address)
            console.log('Contract code length:', code.length)
            console.log('Is contract deployed?', code !== '0x')

            const address = morpho.address
            expect(address).toBeDefined()
            expect(address).toMatch(/^0x[a-fA-F0-9]{40}$/)
        } catch (error) {
            console.log('Deployment error:', error)
            throw error
        }
    })

    it('should enable an IRM', async () => {
        // Create a mock IRM address
        const mockIrm = '0x' + '1'.repeat(40)
        
        // Enable the IRM
        await morpho.sendTx(901, 'enableIrm', [mockIrm])
        
        // Check if IRM is enabled
        const isEnabled = await morpho.call(901, 'isIrmEnabled', [mockIrm])
        expect(isEnabled).toBe(true)
    })

    // TODO: Add more tests for basic interactions
    // - Market creation
    // - Supply
    // - Borrow
    // etc.
}) 