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
	// Split only on headers that start with "docs/"
	const parts = doc.split(/\n\n## (docs\/[^\n]+)/g)

	for (let i = 1; i < parts.length; i += 2) {
		const filePath = parts[i] // The captured group (docs/...)
		const content = '## ' + filePath + '\n' + (parts[i + 1] || '') // The content after the header
		const title = extractFrontmatterTitle(content) || extractTitleFromPath(filePath)

		sections.push({
			filePath,
			title,
			content
		})
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

export const listSectionsHandler = async () => {
	console.log('Listing sections from Svelte and SvelteKit full presets')

	try {
		// Get sections from both full presets
		const svelteDoc = await fetchAndProcessMarkdown(presets['svelte'], 'svelte')
		const svelteKitDoc = await fetchAndProcessMarkdown(presets['sveltekit'], 'sveltekit')

		const svelteSections = parseDocumentSections(svelteDoc)
		const svelteKitSections = parseDocumentSections(svelteKitDoc)

		// Filter out sections with less than 100 characters
		const filteredSvelteSections = svelteSections.filter((section) => {
			const isValid = section.content.length >= 100
			if (!isValid) {
				console.log(
					`Filtered out Svelte section: "${section.title}" (${section.content.length} chars)`
				)
			}
			return isValid
		})

		const filteredSvelteKitSections = svelteKitSections.filter((section) => {
			const isValid = section.content.length >= 100
			if (!isValid) {
				console.log(
					`Filtered out SvelteKit section: "${section.title}" (${section.content.length} chars)`
				)
			}
			return isValid
		})

		// Format with single headers per framework
		let output = ''

		if (filteredSvelteSections.length > 0) {
			output += '# Svelte\n'
			output +=
				filteredSvelteSections
					.map((section) => `* title: ${section.title}, path: ${section.filePath}`)
					.join('\n') + '\n\n'
		}

		if (filteredSvelteKitSections.length > 0) {
			output += '# SvelteKit\n'
			output += filteredSvelteKitSections
				.map((section) => `* title: ${section.title}, path: ${section.filePath}`)
				.join('\n')
		}

		return {
			content: [
				{
					type: 'text' as const,
					text: `📋 Available documentation sections:\n\n${output}\n\nUse get_documentation with a section name to retrieve specific content for a section.`
				}
			]
		}
	} catch (error) {
		console.error('Error listing sections:', error)
		return {
			content: [
				{
					type: 'text' as const,
					text: `❌ Error listing sections: ${error instanceof Error ? error.message : String(error)}`
				}
			]
		}
	}
}

export const getDocumentationHandler = async ({ section }: { section: string | string[] }) => {
	try {
		// Get documentation from both full presets
		const svelteDoc = await fetchAndProcessMarkdown(presets['svelte'], 'svelte')
		const svelteKitDoc = await fetchAndProcessMarkdown(presets['sveltekit'], 'sveltekit')

		// Parse sections with titles
		const svelteSections = parseDocumentSections(svelteDoc)
		const svelteKitSections = parseDocumentSections(svelteKitDoc)

		// Handle array of sections
		const sections = Array.isArray(section) ? section : [section]
		const results: string[] = []
		const notFound: string[] = []

		for (const sectionName of sections) {
			console.log({ section: sectionName })

			// Search in Svelte documentation first
			const svelteMatch = findSectionByTitleOrPath(svelteSections, sectionName)

			if (svelteMatch) {
				results.push(`📖 Svelte documentation (${svelteMatch.title}):\n\n${svelteMatch.content}`)
				continue
			}

			// Search in SvelteKit documentation if not found in Svelte
			const svelteKitMatch = findSectionByTitleOrPath(svelteKitSections, sectionName)

			if (svelteKitMatch) {
				results.push(`📖 SvelteKit documentation (${svelteKitMatch.title}):\n\n${svelteKitMatch.content}`)
				continue
			}

			// If not found in either
			notFound.push(sectionName)
		}

		if (results.length === 0) {
			// No sections found
			const sectionList = Array.isArray(section) ? section.join(', ') : section
			return {
				content: [
					{
						type: 'text' as const,
						text: `❌ Section(s) "${sectionList}" not found in Svelte or SvelteKit documentation. Use list_sections to see all available sections.`
					}
				]
			}
		}

		// Build response text
		let responseText = results.join('\n\n---\n\n')
		
		if (notFound.length > 0) {
			responseText += `\n\n---\n\n❌ The following sections were not found: ${notFound.join(', ')}`
		}

		return {
			content: [
				{
					type: 'text' as const,
					text: responseText
				}
			]
		}
	} catch (error) {
		console.error('Error fetching documentation:', error)
		const sectionList = Array.isArray(section) ? section.join(', ') : section
		return {
			content: [
				{
					type: 'text' as const,
					text: `❌ Error fetching documentation for section(s) "${sectionList}": ${error instanceof Error ? error.message : String(error)}`
				}
			]
		}
	}
}

export const handler = createMcpHandler(
	(server) => {
		server.tool(
			'list_sections',
			'Lists all available documentation sections from Svelte 5 and SvelteKit presets. Start by running this tool to see available sections, then call the get_documentation tool for each relevant section.',
			{},
			async () => listSectionsHandler()
		)

		server.tool(
			'get_documentation',
			'Retrieves documentation for one or more sections from Svelte or SvelteKit full presets. You can pass a single section name or an array of section names to get multiple sections at once.',
			{
				section: z.union([
					z.string(),
					z.array(z.string())
				]).describe('The section name(s) to retrieve documentation for. Can be a single string or an array of strings.')
			},
			async ({ section }) => getDocumentationHandler({ section })
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
