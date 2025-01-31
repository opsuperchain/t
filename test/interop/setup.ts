import { beforeAll } from 'vitest'
import { spawn } from 'child_process'
import { setTimeout } from 'timers/promises'

// Start supersim before tests
beforeAll(async () => {
    // Start supersim in the background
    const supersim = spawn('yarn', ['host-supersim'], {
        stdio: 'inherit',
        shell: true
    })

    // Wait for supersim to start
    await setTimeout(5000)

    // Clean up after tests
    return () => {
        supersim.kill()
    }
}) 