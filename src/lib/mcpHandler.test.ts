import { describe, it, expect, vi, beforeEach } from 'vitest'
import { listSectionsHandler, getDocumentationHandler } from './mcpHandler'
import { ContentDbService } from '$lib/server/contentDb'
import type { DbContent } from '$lib/types/db'

// Mock environment variables
vi.mock('$env/dynamic/private', () => ({
	env: {
		GITHUB_TOKEN: 'test-token',
		REDIS_URL: undefined
	}
}))

// Mock ContentDbService
vi.mock('$lib/server/contentDb', () => ({
	ContentDbService: {
		getContentByFilter: vi.fn()
	}
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

describe('MCP Handler Integration', () => {
	beforeEach(() => {
		// Reset mocks before each test
		vi.clearAllMocks()

		// Setup default mock implementation
		const mockGetContentByFilter = vi.mocked(ContentDbService.getContentByFilter)
		mockGetContentByFilter.mockResolvedValue(mockSvelteContent)
	})
	it('should list sections and successfully fetch each one using real MCP functions', async () => {
		// Call the real listSectionsHandler
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

		// Test fetching by title
		const stateResult = await getDocumentationHandler({ section: '$state' })
		expect(stateResult.content[0].text).toContain(
			'$state rune is used to create reactive state in Svelte 5'
		)
		expect(stateResult.content[0].text).not.toContain('❌')

		// Test fetching by path
		const pathResult = await getDocumentationHandler({
			section: 'apps/svelte.dev/content/docs/svelte/02-runes.md'
		})
		expect(pathResult.content[0].text).toContain(
			'$state rune is used to create reactive state in Svelte 5'
		)
		expect(pathResult.content[0].text).not.toContain('❌')
	}, 15000)

	it('should handle trailing commas in search queries using real MCP functions', async () => {
		// Test with trailing comma
		const resultWithComma = await getDocumentationHandler({ section: '$state,' })
		expect(resultWithComma.content[0].text).toContain(
			'$state rune is used to create reactive state in Svelte 5'
		)
		expect(resultWithComma.content[0].text).not.toContain('❌')

		// Test with trailing comma and whitespace
		const resultWithCommaSpace = await getDocumentationHandler({ section: '$state, ' })
		expect(resultWithCommaSpace.content[0].text).toContain(
			'$state rune is used to create reactive state in Svelte 5'
		)
		expect(resultWithCommaSpace.content[0].text).not.toContain('❌')
	}, 15000)

	it('should search by both title and path using real MCP functions', async () => {
		// Search by title
		const resultByTitle = await getDocumentationHandler({ section: '$derived' })
		expect(resultByTitle.content[0].text).toContain(
			'$derived rune is used to create derived state that automatically updates'
		)
		expect(resultByTitle.content[0].text).not.toContain('❌')

		// Search by path
		const resultByPath = await getDocumentationHandler({
			section: 'apps/svelte.dev/content/docs/svelte/03-derived.md'
		})
		expect(resultByPath.content[0].text).toContain(
			'$derived rune is used to create derived state that automatically updates'
		)
		expect(resultByPath.content[0].text).not.toContain('❌')
	}, 15000)

	it('should return error for non-existent sections using real MCP functions', async () => {
		const result = await getDocumentationHandler({ section: 'non-existent-section-12345' })
		expect(result.content[0].text).toContain('not found')
	}, 15000)

	it('should handle array of section names', async () => {
		// Test with multiple valid sections
		const result = await getDocumentationHandler({
			section: ['$state', '$derived', '$effect']
		})

		expect(result.content).toBeDefined()
		expect(result.content[0].type).toBe('text')
		expect(result.content[0].text).toContain('$state')
		expect(result.content[0].text).toContain('$derived')
		expect(result.content[0].text).toContain('$effect')
		expect(result.content[0].text).toContain('---') // Should have separators
		expect(result.content[0].text).not.toContain('❌')
	}, 15000)

	it('should handle mixed valid and invalid sections in array', async () => {
		// Test with mix of valid and invalid sections
		const result = await getDocumentationHandler({
			section: ['$state', 'non-existent-section', '$derived']
		})

		expect(result.content).toBeDefined()
		expect(result.content[0].type).toBe('text')
		expect(result.content[0].text).toContain('$state')
		expect(result.content[0].text).toContain('$derived')
		expect(result.content[0].text).toContain('not found')
		expect(result.content[0].text).toContain('non-existent-section')
	}, 15000)

	it('should handle JSON string arrays from Claude', async () => {
		// Test with JSON string array (like Claude sends)
		const result = await getDocumentationHandler({
			section: '["$state", "$derived"]'
		})

		expect(result.content).toBeDefined()
		expect(result.content[0].type).toBe('text')
		expect(result.content[0].text).toContain('$state')
		expect(result.content[0].text).toContain('$derived')
		expect(result.content[0].text).toContain('---') // Should have separators
		expect(result.content[0].text).not.toContain('❌')
	}, 15000)
})
