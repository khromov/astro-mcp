import { z } from 'zod'
import { createMcpHandler } from '@vercel/mcp-adapter'
import { env } from '$env/dynamic/private'
import { presets } from '$lib/presets'
import { fetchAndProcessMarkdown } from '$lib/fetchMarkdown'

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

					// Helper function to extract file path headings
					const extractFileHeadings = (doc: string) => {
						return doc
							.split('\n\n## ')
							.map((section) => {
								const lines = section.split('\n')
								const firstLine = lines[0].replace('## ', '').trim()

								// Only return file path headings
								if (firstLine.startsWith('docs/')) {
									return firstLine
								}

								return null
							})
							.filter(Boolean)
					}

					const svelteSections = extractFileHeadings(svelteDoc)
					const svelteKitSections = extractFileHeadings(svelteKitDoc)

					// Format with single headers per framework
					let output = ''
					
					if (svelteSections.length > 0) {
						output += '# Svelte\n'
						output += svelteSections.join('\n') + '\n\n'
					}
					
					if (svelteKitSections.length > 0) {
						output += '# SvelteKit\n'
						output += svelteKitSections.join('\n')
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

					// Helper function to find section by file path
					const findSectionByFilePath = (doc: string, searchPath: string) => {
						return doc.split('\n\n## ').find((sectionText) => {
							const lines = sectionText.split('\n')
							const firstLine = lines[0].replace('## ', '').trim()

							// Look for exact or partial match in file path
							if (firstLine.startsWith('docs/')) {
								return firstLine.toLowerCase().includes(searchPath.toLowerCase())
							}

							return false
						})
					}

					// Search in Svelte documentation first
					const svelteMatch = findSectionByFilePath(svelteDoc, section)

					if (svelteMatch) {
						// Return the content with the file path heading
						let content = svelteMatch
						if (!svelteMatch.startsWith('## ')) {
							content = `## ${svelteMatch}`
						}

						return {
							content: [
								{
									type: 'text',
									text: `📖 Svelte documentation file (${section}):\n\n${content}`
								}
							]
						}
					}

					// Search in SvelteKit documentation if not found in Svelte
					const svelteKitMatch = findSectionByFilePath(svelteKitDoc, section)

					if (svelteKitMatch) {
						// Return the content with the file path heading
						let content = svelteKitMatch
						if (!svelteKitMatch.startsWith('## ')) {
							content = `## ${svelteKitMatch}`
						}

						return {
							content: [
								{
									type: 'text',
									text: `📖 SvelteKit documentation file (${section}):\n\n${content}`
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