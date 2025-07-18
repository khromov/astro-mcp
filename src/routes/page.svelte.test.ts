import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { render, screen } from '@testing-library/svelte'
import Page from './+page.svelte'

// Mock the global fetch function
const mockFetch = vi.fn()

// Mock the logging functions to prevent noise in test output
vi.mock('$lib/log', () => ({
	logErrorAlways: vi.fn(),
	logAlways: vi.fn(),
	log: vi.fn()
}))

// Mock preset sizes data for tests
const mockPresetSizes = {
	'svelte-complete': Promise.resolve({ key: 'svelte-complete', sizeKb: 120 }),
	'svelte-small': Promise.resolve({ key: 'svelte-small', sizeKb: 50 }),
	'svelte-medium': Promise.resolve({ key: 'svelte-medium', sizeKb: 80 }),
	'sveltekit-complete': Promise.resolve({ key: 'sveltekit-complete', sizeKb: 100 }),
	'sveltekit-small': Promise.resolve({ key: 'sveltekit-small', sizeKb: 40 }),
	'sveltekit-medium': Promise.resolve({ key: 'sveltekit-medium', sizeKb: 70 }),
	'svelte-distilled': Promise.resolve({ key: 'svelte-distilled', sizeKb: 30 }),
	'sveltekit-distilled': Promise.resolve({ key: 'sveltekit-distilled', sizeKb: 25 }),
	'svelte-complete-distilled': Promise.resolve({ key: 'svelte-complete-distilled', sizeKb: 45 })
}

describe('/+page.svelte', () => {
	beforeEach(() => {
		// Mock fetch globally
		vi.stubGlobal('fetch', mockFetch)

		// Mock successful responses for distilled versions API by default
		mockFetch.mockResolvedValue({
			ok: true,
			json: () => Promise.resolve([]) // Return empty array for distilled versions
		})
	})

	afterEach(() => {
		vi.restoreAllMocks()
	})

	test('should render main heading', () => {
		render(Page, { data: { presetSizes: mockPresetSizes } })
		expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
			'Svelte & SvelteKit documentation for AI assistants'
		)
	})

	test('should render MCP section', () => {
		render(Page, { data: { presetSizes: mockPresetSizes } })
		expect(screen.getByText('MCP Server Integration')).toBeInTheDocument()
	})

	test('should render preset sections', () => {
		render(Page, { data: { presetSizes: mockPresetSizes } })
		expect(screen.getByText('Combined presets')).toBeInTheDocument()
		expect(screen.getByText('Svelte 5')).toBeInTheDocument()
		expect(screen.getByText('SvelteKit')).toBeInTheDocument()
	})

	test('should handle distilled versions loading gracefully', async () => {
		// Mock the fetch to return some mock distilled versions
		mockFetch.mockResolvedValueOnce({
			ok: true,
			json: () =>
				Promise.resolve([
					{
						filename: 'svelte-complete-distilled-2024-01-15.md',
						date: '2024-01-15',
						path: '/api/preset-content/svelte-complete-distilled/2024-01-15',
						sizeKb: 150
					}
				])
		})

		render(Page, { data: { presetSizes: mockPresetSizes } })

		// The component should render without throwing errors
		expect(screen.getByText('Combined presets')).toBeInTheDocument()
	})

	test('should handle failed distilled versions API calls gracefully', async () => {
		// Mock fetch to fail - errors will be logged but mocked so won't show in output
		mockFetch.mockRejectedValue(new Error('API Error'))

		render(Page, { data: { presetSizes: mockPresetSizes } })

		// The component should still render even if API calls fail
		expect(screen.getByText('Combined presets')).toBeInTheDocument()
		expect(screen.getByText('Svelte 5')).toBeInTheDocument()
		expect(screen.getByText('SvelteKit')).toBeInTheDocument()
	})
})
