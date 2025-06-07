import { z } from 'zod'
import { createMcpHandler } from '@vercel/mcp-adapter'
import { env } from '$env/dynamic/private'
import { presets } from '$lib/presets'
import { fetchAndProcessMarkdown } from '$lib/fetchMarkdown'

interface DocumentSection {
	filePath: string
	title: string
	content: string
}

function parseDocumentSections(doc: string): DocumentSection[] {
	const sections: DocumentSection[] = []
	const parts = doc.split('\n\n## ')

	for (let i = 0; i < parts.length; i++) {
		const part = i === 0 ? parts[i] : '## ' + parts[i]
		const lines = part.split('\n')
		const firstLine = lines[0].replace('## ', '').trim()

		if (firstLine.startsWith('docs/')) {
			const filePath = firstLine
			const content = part
			const title = extractFrontmatterTitle(content) || extractTitleFromPath(filePath)

			sections.push({
				filePath,
				title,
				content
			})
		}
	}

	return sections
}

function extractFrontmatterTitle(content: string): string | null {
	const lines = content.split('\n')
	let inFrontmatter = false
	let foundStart = false

	for (const line of lines) {
		if (line.trim() === '---') {
			if (!foundStart) {
				foundStart = true
				inFrontmatter = true
			} else if (inFrontmatter) {
				break
			}
		} else if (inFrontmatter && line.startsWith('title:')) {
			const title = line.replace('title:', '').trim()
			return title || null
		}
	}

	return null
}

function extractTitleFromPath(filePath: string): string {
	const filename = filePath.split('/').pop() || filePath
	return filename.replace('.md', '').replace(/^\d+-/, '')
}

function findSectionByTitleOrPath(
	sections: DocumentSection[],
	query: string
): DocumentSection | null {
	const lowerQuery = query.toLowerCase().replace(/,\s*$/, '')

	// First try exact title match
	let match = sections.find((section) => section.title.toLowerCase() === lowerQuery)
	if (match) return match

	// Then try partial title match
	match = sections.find((section) => section.title.toLowerCase().includes(lowerQuery))
	if (match) return match

	// Finally try file path match for backward compatibility
	match = sections.find((section) => section.filePath.toLowerCase().includes(lowerQuery))
	if (match) return match

	return null
}

export const handler = createMcpHandler(
	(server) => {
		server.tool(
			'list_sections',
			'Lists all available documentation sections from Svelte 5 and SvelteKit presets. Start by running this tool to see available sections, then call the get_documentation tool for each relevant section.',
			{},
			async () => {
				console.log('Listing sections from Svelte and SvelteKit full presets')

				try {
					// Get sections from both full presets
					const svelteDoc = await fetchAndProcessMarkdown(presets['svelte'], 'svelte')
					const svelteKitDoc = await fetchAndProcessMarkdown(presets['sveltekit'], 'sveltekit')

					const svelteSections = parseDocumentSections(svelteDoc)
					const svelteKitSections = parseDocumentSections(svelteKitDoc)

					// Format with single headers per framework
					let output = ''

					if (svelteSections.length > 0) {
						output += '# Svelte\n'
						output += svelteSections.map((section) => `* title: ${section.title}, path: ${section.filePath}`).join('\n') + '\n\n'
					}

					if (svelteKitSections.length > 0) {
						output += '# SvelteKit\n'
						output += svelteKitSections.map((section) => `* title: ${section.title}, path: ${section.filePath}`).join('\n')
					}

					return {
						content: [
							{
								type: 'text',
								text: `📋 Available documentation sections:\n\n${output}\n\nUse get_documentation with a section name to retrieve specific content.`
							}
						]
					}
				} catch (error) {
					console.error('Error listing sections:', error)
					return {
						content: [
							{
								type: 'text',
								text: `❌ Error listing sections: ${error instanceof Error ? error.message : String(error)}`
							}
						]
					}
				}
			}
		)

		server.tool(
			'get_documentation',
			'Retrieves documentation for a specific section from Svelte or SvelteKit full presets. Feel free to call this multiple times if you need documentation for multiple sections.',
			{
				section: z.string().describe('The section name to retrieve documentation for')
			},
			async ({ section }) => {
				console.log({ section })

				try {
					// Get documentation from both full presets
					const svelteDoc = await fetchAndProcessMarkdown(presets['svelte'], 'svelte')
					const svelteKitDoc = await fetchAndProcessMarkdown(presets['sveltekit'], 'sveltekit')

					// Parse sections with titles
					const svelteSections = parseDocumentSections(svelteDoc)
					const svelteKitSections = parseDocumentSections(svelteKitDoc)

					// Search in Svelte documentation first
					const svelteMatch = findSectionByTitleOrPath(svelteSections, section)

					if (svelteMatch) {
						return {
							content: [
								{
									type: 'text',
									text: `📖 Svelte documentation (${svelteMatch.title}):\n\n${svelteMatch.content}`
								}
							]
						}
					}

					// Search in SvelteKit documentation if not found in Svelte
					const svelteKitMatch = findSectionByTitleOrPath(svelteKitSections, section)

					if (svelteKitMatch) {
						return {
							content: [
								{
									type: 'text',
									text: `📖 SvelteKit documentation (${svelteKitMatch.title}):\n\n${svelteKitMatch.content}`
								}
							]
						}
					}

					// If not found in either
					return {
						content: [
							{
								type: 'text',
								text: `❌ Section "${section}" not found in Svelte or SvelteKit documentation. Use list_sections to see all available sections.`
							}
						]
					}
				} catch (error) {
					console.error('Error fetching documentation:', error)
					return {
						content: [
							{
								type: 'text',
								text: `❌ Error fetching documentation for section "${section}": ${error instanceof Error ? error.message : String(error)}`
							}
						]
					}
				}
			}
		)
	},
	{},
	{
		maxDuration: 3600,
		basePath: '/mcp',
		verboseLogs: true,
		redisUrl: env.REDIS_URL ? env.REDIS_URL : 'redis://127.0.0.1:6379'
	}
)
