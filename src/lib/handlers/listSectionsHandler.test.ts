import { describe, it, expect, vi, beforeEach } from 'vitest'
import { listSectionsHandler } from './listSectionsHandler'
import { ContentDbService } from '$lib/server/contentDb'
import { mockAstroContent } from '$lib/test-fixtures/mockAstroContent'

// Mock ContentDbService
vi.mock('$lib/server/contentDb', () => ({
	ContentDbService: {
		getDocumentationSections: vi.fn()
	}
}))

// Mock path utils
vi.mock('$lib/utils/pathUtils', () => ({
	cleanDocumentationPath: vi.fn((path: string) => {
		const prefix = 'src/content/docs/en/'
		if (path.startsWith(prefix)) {
			return path.substring(prefix.length)
		}
		return path
	}),
	extractTitleFromPath: vi.fn((filePath: string) => {
		const filename = filePath.split('/').pop() || filePath
		return filename.replace('.mdx', '').replace('.md', '').replace(/^\d+-/, '')
	})
}))

describe('listSectionsHandler', () => {
	beforeEach(() => {
		// Reset mocks before each test
		vi.clearAllMocks()

		// Setup default mock implementation for getDocumentationSections
		const mockGetDocumentationSections = vi.mocked(ContentDbService.getDocumentationSections)
		mockGetDocumentationSections.mockResolvedValue(
			mockAstroContent.map((item) => ({
				path: item.path,
				metadata: item.metadata,
				content: item.content
			}))
		)
	})

	it('should list sections and return structured content', async () => {
		const listResult = await listSectionsHandler()

		expect(listResult.content).toBeDefined()
		expect(listResult.content[0].type).toBe('text')
		expect(listResult.content[0].text).toContain('Available Astro documentation sections')

		// Should contain our mock sections
		expect(listResult.content[0].text).toContain('Getting Started')
		expect(listResult.content[0].text).toContain('Routing')
		expect(listResult.content[0].text).toContain('Components')
		expect(listResult.content[0].text).toContain('Styling')
		expect(listResult.content[0].text).toContain('API Reference')
	})

	it('should properly clean paths and format sections correctly', async () => {
		const listResult = await listSectionsHandler()
		const outputText = listResult.content[0].text

		// Test path cleaning - should NOT contain the full database path prefix
		expect(outputText).not.toContain('src/content/docs/en/')

		// Test path cleaning - should contain the cleaned paths
		expect(outputText).toContain('getting-started.mdx')
		expect(outputText).toContain('guides/routing.mdx')
		expect(outputText).toContain('guides/components.mdx')

		// Test that we have the Astro Documentation header
		expect(outputText).toContain('# Astro Documentation')

		// Test exact output format
		expect(outputText).toMatch(/\* title: Getting Started, path: getting-started\.mdx/)
		expect(outputText).toMatch(/\* title: Routing, path: guides\/routing\.mdx/)
		expect(outputText).toMatch(/\* title: Components, path: guides\/components\.mdx/)
		expect(outputText).toMatch(/\* title: API Reference, path: reference\/api-reference\.mdx/)
	})

	it('should handle sections and return proper format', async () => {
		// This test ensures that we actually have sections and proper formatting
		const listResult = await listSectionsHandler()
		const outputText = listResult.content[0].text

		// Should have the Astro Documentation header
		const hasAstroDocumentation = outputText.includes('# Astro Documentation')
		expect(hasAstroDocumentation).toBeTruthy()

		// Should have at least one section listed
		const hasSections = outputText.match(/\* title:/)
		expect(hasSections).toBeTruthy()

		// Should have multiple sections
		const sectionMatches = outputText.match(/\* title:/g)
		expect(sectionMatches?.length).toBeGreaterThan(1)
	})

	it('should handle errors gracefully', async () => {
		// Mock database error
		const mockGetDocumentationSections = vi.mocked(ContentDbService.getDocumentationSections)
		mockGetDocumentationSections.mockRejectedValue(new Error('Database error'))

		const result = await listSectionsHandler()

		expect(result.content[0].type).toBe('text')
		expect(result.content[0].text).toContain('❌ Error listing sections')
		expect(result.content[0].text).toContain('Database error')
	})
})
