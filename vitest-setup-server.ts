import { vi } from 'vitest'

// Suppress console output during tests to avoid "error" counts from intentional error logs
const originalConsole = {
	log: console.log,
	warn: console.warn,
	error: console.error
}

// Replace console methods with no-op functions during tests
console.log = vi.fn()
console.warn = vi.fn()
console.error = vi.fn()

// Restore original console methods if needed for debugging
export const restoreConsole = () => {
	console.log = originalConsole.log
	console.warn = originalConsole.warn
	console.error = originalConsole.error
}
