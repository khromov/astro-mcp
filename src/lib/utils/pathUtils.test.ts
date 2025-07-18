import { describe, it, expect } from 'vitest'
import { cleanDocumentationPath, cleanTarballPath, extractTitleFromPath } from './pathUtils'

describe('pathUtils', () => {
	describe('cleanDocumentationPath', () => {
		it('should remove apps/svelte.dev/content/ prefix', () => {
			const input = 'apps/svelte.dev/content/docs/svelte/01-introduction.md'
			const expected = 'docs/svelte/01-introduction.md'
			expect(cleanDocumentationPath(input)).toBe(expected)
		})

		it('should handle paths without the prefix', () => {
			const input = 'docs/svelte/01-introduction.md'
			const expected = 'docs/svelte/01-introduction.md'
			expect(cleanDocumentationPath(input)).toBe(expected)
		})

		it('should handle empty string', () => {
			const input = ''
			const expected = ''
			expect(cleanDocumentationPath(input)).toBe(expected)
		})

		it('should handle partial prefix matches', () => {
			const input = 'apps/svelte.dev/content-extra/docs/svelte/01-introduction.md'
			const expected = 'apps/svelte.dev/content-extra/docs/svelte/01-introduction.md'
			expect(cleanDocumentationPath(input)).toBe(expected)
		})

		it('should handle paths with similar but different prefixes', () => {
			const input = 'apps/svelte.dev/contents/docs/svelte/01-introduction.md'
			const expected = 'apps/svelte.dev/contents/docs/svelte/01-introduction.md'
			expect(cleanDocumentationPath(input)).toBe(expected)
		})

		it('should handle SvelteKit documentation paths', () => {
			const input = 'apps/svelte.dev/content/docs/kit/01-routing.md'
			const expected = 'docs/kit/01-routing.md'
			expect(cleanDocumentationPath(input)).toBe(expected)
		})

		it('should handle tutorial paths', () => {
			const input = 'apps/svelte.dev/content/tutorial/01-introduction/01-hello-world.md'
			const expected = 'tutorial/01-introduction/01-hello-world.md'
			expect(cleanDocumentationPath(input)).toBe(expected)
		})
	})

	describe('cleanTarballPath', () => {
		it('should remove the first segment from tarball paths', () => {
			const input = 'svelte.dev-main/apps/svelte.dev/content/docs/svelte/01-introduction.md'
			const expected = 'apps/svelte.dev/content/docs/svelte/01-introduction.md'
			expect(cleanTarballPath(input)).toBe(expected)
		})

		it('should handle paths with different repo prefixes', () => {
			const input = 'svelte-12345/apps/svelte.dev/content/docs/kit/01-routing.md'
			const expected = 'apps/svelte.dev/content/docs/kit/01-routing.md'
			expect(cleanTarballPath(input)).toBe(expected)
		})

		it('should handle single segment paths', () => {
			const input = 'single-segment'
			const expected = ''
			expect(cleanTarballPath(input)).toBe(expected)
		})

		it('should handle empty string', () => {
			const input = ''
			const expected = ''
			expect(cleanTarballPath(input)).toBe(expected)
		})

		it('should handle paths with no segments', () => {
			const input = 'just-filename.md'
			const expected = ''
			expect(cleanTarballPath(input)).toBe(expected)
		})

		it('should handle complex nested paths', () => {
			const input = 'repo-name/very/deep/nested/path/to/file.md'
			const expected = 'very/deep/nested/path/to/file.md'
			expect(cleanTarballPath(input)).toBe(expected)
		})
	})

	describe('extractTitleFromPath', () => {
		it('should extract filename and remove .md extension and numbered prefix', () => {
			const input = 'docs/svelte/01-introduction.md'
			const expected = 'introduction'
			expect(extractTitleFromPath(input)).toBe(expected)
		})

		it('should remove numbered prefixes', () => {
			const input = 'docs/svelte/01-introduction.md'
			const expected = 'introduction'
			expect(extractTitleFromPath(input)).toBe(expected)
		})

		it('should handle files without numbered prefixes', () => {
			const input = 'docs/svelte/reactivity.md'
			const expected = 'reactivity'
			expect(extractTitleFromPath(input)).toBe(expected)
		})

		it('should handle files without .md extension', () => {
			const input = 'docs/svelte/01-introduction'
			const expected = 'introduction'
			expect(extractTitleFromPath(input)).toBe(expected)
		})

		it('should handle complex numbered prefixes', () => {
			const input = 'docs/svelte/99-advanced-topics.md'
			const expected = 'advanced-topics'
			expect(extractTitleFromPath(input)).toBe(expected)
		})

		it('should handle files with multiple numbered prefixes', () => {
			const input = 'docs/svelte/01-02-nested-numbering.md'
			const expected = '02-nested-numbering'
			expect(extractTitleFromPath(input)).toBe(expected)
		})

		it('should handle just a filename', () => {
			const input = '01-introduction.md'
			const expected = 'introduction'
			expect(extractTitleFromPath(input)).toBe(expected)
		})

		it('should handle empty string', () => {
			const input = ''
			const expected = ''
			expect(extractTitleFromPath(input)).toBe(expected)
		})

		it('should handle paths with no filename', () => {
			const input = 'docs/svelte/'
			const expected = ''
			expect(extractTitleFromPath(input)).toBe(expected)
		})

		it('should handle files with hyphens but no numbers', () => {
			const input = 'docs/svelte/state-management.md'
			const expected = 'state-management'
			expect(extractTitleFromPath(input)).toBe(expected)
		})

		it('should handle files with numbers in the middle', () => {
			const input = 'docs/svelte/svelte5-features.md'
			const expected = 'svelte5-features'
			expect(extractTitleFromPath(input)).toBe(expected)
		})

		it('should handle tutorial paths', () => {
			const input = 'tutorial/01-introduction/01-hello-world.md'
			const expected = 'hello-world'
			expect(extractTitleFromPath(input)).toBe(expected)
		})

		it('should handle SvelteKit paths', () => {
			const input = 'docs/kit/01-routing.md'
			const expected = 'routing'
			expect(extractTitleFromPath(input)).toBe(expected)
		})
	})

	describe('integration tests', () => {
		it('should work together for typical documentation workflow', () => {
			// Simulate a typical path from tarball to display
			const tarballPath = 'svelte.dev-main/apps/svelte.dev/content/docs/svelte/01-introduction.md'

			// Clean tarball path
			const cleanedFromTarball = cleanTarballPath(tarballPath)
			expect(cleanedFromTarball).toBe('apps/svelte.dev/content/docs/svelte/01-introduction.md')

			// This would be stored in DB and later cleaned for display
			const cleanedForDisplay = cleanDocumentationPath(cleanedFromTarball)
			expect(cleanedForDisplay).toBe('docs/svelte/01-introduction.md')

			// Extract title for metadata
			const title = extractTitleFromPath(cleanedFromTarball)
			expect(title).toBe('introduction')
		})

		it('should handle SvelteKit paths through full workflow', () => {
			const tarballPath = 'svelte.dev-main/apps/svelte.dev/content/docs/kit/01-routing.md'

			const cleanedFromTarball = cleanTarballPath(tarballPath)
			expect(cleanedFromTarball).toBe('apps/svelte.dev/content/docs/kit/01-routing.md')

			const cleanedForDisplay = cleanDocumentationPath(cleanedFromTarball)
			expect(cleanedForDisplay).toBe('docs/kit/01-routing.md')

			const title = extractTitleFromPath(cleanedFromTarball)
			expect(title).toBe('routing')
		})

		it('should handle tutorial paths through full workflow', () => {
			const tarballPath =
				'svelte.dev-main/apps/svelte.dev/content/tutorial/01-introduction/01-hello-world.md'

			const cleanedFromTarball = cleanTarballPath(tarballPath)
			expect(cleanedFromTarball).toBe(
				'apps/svelte.dev/content/tutorial/01-introduction/01-hello-world.md'
			)

			const cleanedForDisplay = cleanDocumentationPath(cleanedFromTarball)
			expect(cleanedForDisplay).toBe('tutorial/01-introduction/01-hello-world.md')

			const title = extractTitleFromPath(cleanedFromTarball)
			expect(title).toBe('hello-world')
		})
	})
})
