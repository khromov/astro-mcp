import { describe, it, expect, vi, beforeEach } from 'vitest'
import { listSectionsHandler } from './listSectionsHandler'
import { ContentDbService } from '$lib/server/contentDb'
import type { DbContent } from '$lib/types/db'

// Mock ContentDbService
vi.mock('$lib/server/contentDb', () => ({
	ContentDbService: {
		getContentByFilter: vi.fn()
	}
}))

// Mock path utils
vi.mock('$lib/utils/pathUtils', () => ({
	cleanDocumentationPath: vi.fn((path: string) => {
		const prefix = 'apps/svelte.dev/content/'
		if (path.startsWith(prefix)) {
			return path.substring(prefix.length)
		}
		return path
	}),
	extractTitleFromPath: vi.fn((filePath: string) => {
		const filename = filePath.split('/').pop() || filePath
		return filename.replace('.md', '').replace(/^\d+-/, '')
	})
}))

// Mock data for testing
const mockSvelteContent: DbContent[] = [
	{
		id: 1,
		owner: 'sveltejs',
		repo_name: 'svelte.dev',
		path: 'apps/svelte.dev/content/docs/svelte/01-introduction.md',
		filename: '01-introduction.md',
		content:
			'# Introduction\n\nSvelte is a radical new approach to building user interfaces. Unlike traditional frameworks, Svelte compiles your components at build time instead of running in the browser. This means your applications start faster and have smaller bundle sizes. Svelte makes building interactive UIs a breeze with its simple and powerful reactivity system.',
		size_bytes: 400,
		metadata: { title: 'Introduction' },
		is_processed: true,
		processed_at: new Date(),
		created_at: new Date(),
		updated_at: new Date()
	},
	{
		id: 2,
		owner: 'sveltejs',
		repo_name: 'svelte.dev',
		path: 'apps/svelte.dev/content/docs/svelte/02-runes.md',
		filename: '02-runes.md',
		content:
			'# $state\n\nThe $state rune is used to create reactive state in Svelte 5. It replaces the traditional variable declarations and automatically tracks changes to your data. When you use $state, Svelte will re-render your component whenever the state changes, providing a seamless reactive experience.',
		size_bytes: 300,
		metadata: { title: '$state' },
		is_processed: true,
		processed_at: new Date(),
		created_at: new Date(),
		updated_at: new Date()
	},
	{
		id: 3,
		owner: 'sveltejs',
		repo_name: 'svelte.dev',
		path: 'apps/svelte.dev/content/docs/svelte/03-derived.md',
		filename: '03-derived.md',
		content:
			'# $derived\n\nThe $derived rune is used to create derived state that automatically updates when its dependencies change. This is perfect for computed values that depend on other reactive state. Derived state is lazily evaluated and cached for performance.',
		size_bytes: 280,
		metadata: { title: '$derived' },
		is_processed: true,
		processed_at: new Date(),
		created_at: new Date(),
		updated_at: new Date()
	},
	{
		id: 4,
		owner: 'sveltejs',
		repo_name: 'svelte.dev',
		path: 'apps/svelte.dev/content/docs/svelte/04-effect.md',
		filename: '04-effect.md',
		content:
			'# $effect\n\nThe $effect rune is used for side effects in Svelte 5. It runs whenever its dependencies change and is perfect for DOM manipulations, API calls, or other side effects. Effects are automatically cleaned up when the component is destroyed.',
		size_bytes: 270,
		metadata: { title: '$effect' },
		is_processed: true,
		processed_at: new Date(),
		created_at: new Date(),
		updated_at: new Date()
	},
	{
		id: 5,
		owner: 'sveltejs',
		repo_name: 'svelte.dev',
		path: 'apps/svelte.dev/content/docs/kit/01-routing.md',
		filename: '01-routing.md',
		content:
			'# Routing\n\nSvelteKit routing is filesystem-based, meaning that your routes are defined by the structure of your src/routes directory. Each .svelte file in this directory corresponds to a route in your application. This approach makes it easy to understand and maintain your application structure.',
		size_bytes: 350,
		metadata: { title: 'Routing' },
		is_processed: true,
		processed_at: new Date(),
		created_at: new Date(),
		updated_at: new Date()
	}
]

describe('listSectionsHandler', () => {
	beforeEach(() => {
		// Reset mocks before each test
		vi.clearAllMocks()

		// Setup default mock implementation
		const mockGetContentByFilter = vi.mocked(ContentDbService.getContentByFilter)
		mockGetContentByFilter.mockResolvedValue(mockSvelteContent)
	})

	it('should list sections and return structured content', async () => {
		const listResult = await listSectionsHandler()

		expect(listResult.content).toBeDefined()
		expect(listResult.content[0].type).toBe('text')
		expect(listResult.content[0].text).toContain('Available documentation sections')

		// Should contain our mock sections
		expect(listResult.content[0].text).toContain('Introduction')
		expect(listResult.content[0].text).toContain('$state')
		expect(listResult.content[0].text).toContain('$derived')
		expect(listResult.content[0].text).toContain('$effect')
		expect(listResult.content[0].text).toContain('Routing')
	})

	it('should properly clean paths and categorize sections correctly', async () => {
		const listResult = await listSectionsHandler()
		const outputText = listResult.content[0].text

		// Test path cleaning - should NOT contain the full database path prefix
		expect(outputText).not.toContain('apps/svelte.dev/content/docs/svelte/')
		expect(outputText).not.toContain('apps/svelte.dev/content/docs/kit/')

		// Test path cleaning - should contain the cleaned paths
		expect(outputText).toContain('docs/svelte/01-introduction.md')
		expect(outputText).toContain('docs/svelte/02-runes.md')
		expect(outputText).toContain('docs/kit/01-routing.md')

		// Test categorization - should have both section headers
		expect(outputText).toContain('# Svelte')
		expect(outputText).toContain('# SvelteKit')

		// Test that Svelte sections are under the Svelte header
		const svelteHeaderIndex = outputText.indexOf('# Svelte')
		const svelteKitHeaderIndex = outputText.indexOf('# SvelteKit')
		const introductionIndex = outputText.indexOf(
			'title: Introduction, path: docs/svelte/01-introduction.md'
		)
		const stateIndex = outputText.indexOf('title: $state, path: docs/svelte/02-runes.md')

		expect(svelteHeaderIndex).toBeGreaterThan(-1)
		expect(svelteKitHeaderIndex).toBeGreaterThan(-1)
		expect(introductionIndex).toBeGreaterThan(svelteHeaderIndex)
		expect(stateIndex).toBeGreaterThan(svelteHeaderIndex)
		expect(introductionIndex).toBeLessThan(svelteKitHeaderIndex)

		// Test that SvelteKit sections are under the SvelteKit header
		const routingIndex = outputText.indexOf('title: Routing, path: docs/kit/01-routing.md')
		expect(routingIndex).toBeGreaterThan(svelteKitHeaderIndex)

		// Test exact output format
		expect(outputText).toMatch(/\* title: Introduction, path: docs\/svelte\/01-introduction\.md/)
		expect(outputText).toMatch(/\* title: \$state, path: docs\/svelte\/02-runes\.md/)
		expect(outputText).toMatch(/\* title: Routing, path: docs\/kit\/01-routing\.md/)
	})

	it('should handle empty sections gracefully when filtering is broken', async () => {
		// This test specifically checks for the bug scenario
		// If filtering logic is broken, we should get empty sections instead of proper categorization
		const listResult = await listSectionsHandler()
		const outputText = listResult.content[0].text

		// If the filtering was broken, these sections would be missing entirely
		// This test ensures that we actually have sections in both categories
		const hasSvelteSection =
			outputText.includes('# Svelte') && outputText.match(/# Svelte\n[\s\S]*?\* title:/)
		const hasSvelteKitSection =
			outputText.includes('# SvelteKit') && outputText.match(/# SvelteKit\n[\s\S]*?\* title:/)

		expect(hasSvelteSection).toBeTruthy()
		expect(hasSvelteKitSection).toBeTruthy()

		// Should have at least one item in each section
		const svelteMatches = outputText.match(/# Svelte\n([\s\S]*?)(?=# SvelteKit|$)/)
		const svelteKitMatches = outputText.match(/# SvelteKit\n([\s\S]*)$/)

		expect(svelteMatches?.[1]).toContain('* title:')
		expect(svelteKitMatches?.[1]).toContain('* title:')
	})

	it('should handle errors gracefully', async () => {
		// Mock database error
		const mockGetContentByFilter = vi.mocked(ContentDbService.getContentByFilter)
		mockGetContentByFilter.mockRejectedValue(new Error('Database error'))

		const result = await listSectionsHandler()

		expect(result.content[0].type).toBe('text')
		expect(result.content[0].text).toContain('❌ Error listing sections')
		expect(result.content[0].text).toContain('Database error')
	})
})
