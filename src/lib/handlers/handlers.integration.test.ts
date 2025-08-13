import { describe, it, expect, vi, beforeEach } from 'vitest'
import { listSectionsHandler } from './listSectionsHandler'
import { getDocumentationHandler } from './getDocumentationHandler'
import { ContentDbService } from '$lib/server/contentDb'
import { mockAstroContent } from '$lib/test-fixtures/mockAstroContent'

// Mock ContentDbService
vi.mock('$lib/server/contentDb', () => ({
	ContentDbService: {
		getDocumentationSections: vi.fn(),
		searchContent: vi.fn()
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

describe('MCP Handler Integration', () => {
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

		// Setup default mock implementation for searchContent
		const mockSearchContent = vi.mocked(ContentDbService.searchContent)
		mockSearchContent.mockImplementation(async (searchQuery) => {
			// Find matching content from mock data
			const lowerQuery = searchQuery.toLowerCase()

			// Try exact title match first
			let match = mockAstroContent.find((item) => {
				const title = (item.metadata?.title as string) || ''
				return title.toLowerCase() === lowerQuery
			})

			// Try partial title match
			if (!match) {
				match = mockAstroContent.find((item) => {
					const title = (item.metadata?.title as string) || ''
					return title.toLowerCase().includes(lowerQuery)
				})
			}

			// Try path match
			if (!match) {
				match = mockAstroContent.find((item) => item.path.toLowerCase().includes(lowerQuery))
			}

			return match || null
		})
	})

	it('should list sections and successfully fetch each one using both handlers', async () => {
		// First, call the listSectionsHandler
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

		// Then, test fetching by title using getDocumentationHandler
		const routingResult = await getDocumentationHandler({ section: 'Routing' })
		expect(routingResult.content[0].text).toContain(
			'file-based routing to generate your build URLs'
		)
		expect(routingResult.content[0].text).not.toContain('❌')

		// Test fetching by path using getDocumentationHandler
		const pathResult = await getDocumentationHandler({
			section: 'src/content/docs/en/guides/routing.mdx'
		})
		expect(pathResult.content[0].text).toContain('file-based routing to generate your build URLs')
		expect(pathResult.content[0].text).not.toContain('❌')
	})

	it('should work end-to-end with listing sections and fetching multiple sections', async () => {
		// First list sections
		const listResult = await listSectionsHandler()
		expect(listResult.content[0].text).toContain('Available Astro documentation sections')

		// Then fetch multiple sections at once
		const multipleResult = await getDocumentationHandler({
			section: ['Routing', 'Components', 'Styling']
		})

		expect(multipleResult.content).toBeDefined()
		expect(multipleResult.content[0].type).toBe('text')
		expect(multipleResult.content[0].text).toContain('Routing')
		expect(multipleResult.content[0].text).toContain('Components')
		expect(multipleResult.content[0].text).toContain('Styling')
		expect(multipleResult.content[0].text).toContain('---') // Should have separators
		expect(multipleResult.content[0].text).not.toContain('❌')
	})
})
