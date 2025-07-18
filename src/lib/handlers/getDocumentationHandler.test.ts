import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getDocumentationHandler } from './getDocumentationHandler'
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

describe('getDocumentationHandler', () => {
	beforeEach(() => {
		// Reset mocks before each test
		vi.clearAllMocks()

		// Setup default mock implementation
		const mockGetContentByFilter = vi.mocked(ContentDbService.getContentByFilter)
		mockGetContentByFilter.mockResolvedValue(mockSvelteContent)
	})

	it('should clean paths in documentation responses', async () => {
		const result = await getDocumentationHandler({ section: '$state' })
		const responseText = result.content[0].text

		// Should contain cleaned path in the header
		expect(responseText).toContain('## docs/svelte/02-runes.md')

		// Should NOT contain the full database path
		expect(responseText).not.toContain('## apps/svelte.dev/content/docs/svelte/02-runes.md')
	})

	it('should handle trailing commas in search queries', async () => {
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
	})

	it('should search by both title and path', async () => {
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
	})

	it('should return error for non-existent sections', async () => {
		const result = await getDocumentationHandler({ section: 'non-existent-section-12345' })
		expect(result.content[0].text).toContain('not found')
	})

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
	})

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
	})

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
	})

	it('should handle malformed JSON arrays gracefully', async () => {
		// Test with malformed JSON that should be treated as a single string
		const result = await getDocumentationHandler({
			section: '["$state", "$derived"'
		})

		expect(result.content).toBeDefined()
		expect(result.content[0].type).toBe('text')
		expect(result.content[0].text).toContain('not found')
	})

	it('should handle empty section arrays', async () => {
		const result = await getDocumentationHandler({
			section: []
		})

		expect(result.content).toBeDefined()
		expect(result.content[0].type).toBe('text')
		expect(result.content[0].text).toContain('not found')
	})

	it('should handle database errors gracefully', async () => {
		// Mock database error
		const mockGetContentByFilter = vi.mocked(ContentDbService.getContentByFilter)
		mockGetContentByFilter.mockRejectedValue(new Error('Database error'))

		const result = await getDocumentationHandler({ section: '$state' })

		expect(result.content[0].type).toBe('text')
		expect(result.content[0].text).toContain('❌ Error fetching documentation')
		expect(result.content[0].text).toContain('Database error')
	})
})
