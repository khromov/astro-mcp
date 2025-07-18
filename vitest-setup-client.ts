import '@testing-library/jest-dom/vitest'
import { vi } from 'vitest'

// required for svelte5 + jsdom as jsdom does not support matchMedia
Object.defineProperty(window, 'matchMedia', {
	writable: true,
	enumerable: true,
	value: vi.fn().mockImplementation((query) => ({
		matches: false,
		media: query,
		onchange: null,
		addEventListener: vi.fn(),
		removeEventListener: vi.fn(),
		dispatchEvent: vi.fn()
	}))
})

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

// add more mocks here if you need them
