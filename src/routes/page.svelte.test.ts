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
	'astro-full': Promise.resolve({ key: 'astro-full', sizeKb: 120 }),
	'astro-distilled': Promise.resolve({ key: 'astro-distilled', sizeKb: 30 })
}

// Mock distilled versions data for tests
const mockDistilledVersions = {
	'astro-full': Promise.resolve({ key: 'astro-full', versions: [] }),
	'astro-distilled': Promise.resolve({
		key: 'astro-distilled',
		versions: [
			{
				filename: 'astro-distilled-2024-01-15.md',
				date: '2024-01-15',
				path: '/api/preset-content/astro-distilled/2024-01-15',
				sizeKb: 30
			}
		]
	})
}

// Complete mock data object that matches the new PageData type
const mockPageData = {
	presetSizes: mockPresetSizes,
	distilledVersions: mockDistilledVersions
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
		render(Page, { data: mockPageData })
		expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
			'Astro documentation for AI assistants'
		)
	})

	test('should render MCP section', () => {
		render(Page, { data: mockPageData })
		expect(screen.getByText('MCP Server Integration')).toBeInTheDocument()
	})

	test('should render preset sections', () => {
		render(Page, { data: mockPageData })
		expect(screen.getByText('Astro Documentation')).toBeInTheDocument()
	})

	test('should handle distilled versions loading gracefully', async () => {
		// Mock the fetch to return some mock distilled versions
		mockFetch.mockResolvedValueOnce({
			ok: true,
			json: () =>
				Promise.resolve([
					{
						filename: 'astro-distilled-2024-01-15.md',
						date: '2024-01-15',
						path: '/api/preset-content/astro-distilled/2024-01-15',
						sizeKb: 150
					}
				])
		})

		render(Page, { data: mockPageData })

		// The component should render without throwing errors
		expect(screen.getByText('Astro Documentation')).toBeInTheDocument()
	})

	test('should handle failed distilled versions API calls gracefully', async () => {
		// Create mock data with failed promises
		const mockPageDataWithFailures = {
			presetSizes: mockPresetSizes,
			distilledVersions: {
				...mockDistilledVersions,
				'astro-distilled': Promise.reject(new Error('API Error'))
			}
		}

		render(Page, { data: mockPageDataWithFailures })

		// The component should still render even if API calls fail
		expect(screen.getByText('Astro Documentation')).toBeInTheDocument()
	})
})
