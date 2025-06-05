import { z } from 'zod'
import type { RequestHandler } from './$types'
import { createMcpHandler } from '@vercel/mcp-adapter'
import { env } from '$env/dynamic/private'
import { presets } from '$lib/presets'
import { fetchAndProcessMarkdown } from '$lib/fetchMarkdown'

const handler = createMcpHandler(
	(server) => {
		server.tool(
			'list_sections',
			'Lists all available documentation sections from Svelte (Full) and SvelteKit (Full) presets',
			{},
			async () => {
				console.log('Listing sections from Svelte and SvelteKit full presets')
				
				try {
					// Get sections from both full presets
					const svelteDoc = await fetchAndProcessMarkdown(presets['svelte'], 'svelte')
					const svelteKitDoc = await fetchAndProcessMarkdown(presets['sveltekit'], 'sveltekit')
					
					// Helper function to extract titles from frontmatter
					const extractSectionTitles = (doc: string, framework: string) => {
						return doc.split('\n\n## ').map(section => {
							const lines = section.split('\n')
							const firstLine = lines[0].replace('## ', '').trim()
							
							// Skip file path headings
							if (firstLine.startsWith('docs/')) {
								return null
							}
							
							// Look for frontmatter title
							const frontmatterMatch = section.match(/---\s*\n([\s\S]*?)\n---/)
							if (frontmatterMatch) {
								const frontmatter = frontmatterMatch[1]
								const titleMatch = frontmatter.match(/title:\s*(.+)/)
								if (titleMatch) {
									const title = titleMatch[1].trim().replace(/^['"]|['"]$/g, '')
									return `**${framework}**: ${title}`
								}
							}
							
							// Fallback to first heading that's not a file path
							const headingMatch = section.match(/^#+ (.+)/m)
							if (headingMatch && !headingMatch[1].startsWith('docs/')) {
								return `**${framework}**: ${headingMatch[1].trim()}`
							}
							
							return null
						}).filter(Boolean)
					}
					
					const svelteSections = extractSectionTitles(svelteDoc, 'Svelte')
					const svelteKitSections = extractSectionTitles(svelteKitDoc, 'SvelteKit')
					
					const allSections = [...svelteSections, ...svelteKitSections]
					
					return {
						content: [{ 
							type: 'text', 
							text: `📋 Available documentation sections:\n\n${allSections.join('\n')}\n\nUse get_documentation with a section name to retrieve specific content.`
						}]
					}
				} catch (error) {
					console.error('Error listing sections:', error)
					return {
						content: [{ 
							type: 'text', 
							text: `❌ Error listing sections: ${error.message}`
						}]
					}
				}
			}
		)

		server.tool(
			'get_documentation',
			'Retrieves documentation for a specific section from Svelte or SvelteKit full presets',
			{ 
				section: z.string().describe('The section name to retrieve documentation for')
			},
			async ({ section }) => {
				console.log({ section })
				
				try {
					// Get documentation from both full presets
					const svelteDoc = await fetchAndProcessMarkdown(presets['svelte'], 'svelte')
					const svelteKitDoc = await fetchAndProcessMarkdown(presets['sveltekit'], 'sveltekit')
					
					// Helper function to find section by title or content
					const findSection = (doc: string, searchTerm: string) => {
						return doc.split('\n\n## ').find(sectionText => {
							const lines = sectionText.split('\n')
							const firstLine = lines[0].replace('## ', '').trim()
							
							// Skip file path headings
							if (firstLine.startsWith('docs/')) {
								// Look for frontmatter title
								const frontmatterMatch = sectionText.match(/---\s*\n([\s\S]*?)\n---/)
								if (frontmatterMatch) {
									const frontmatter = frontmatterMatch[1]
									const titleMatch = frontmatter.match(/title:\s*(.+)/)
									if (titleMatch) {
										const title = titleMatch[1].trim().replace(/^['"]|['"]$/g, '')
										return title.toLowerCase().includes(searchTerm.toLowerCase())
									}
								}
								
								// Also search in the content itself
								return sectionText.toLowerCase().includes(searchTerm.toLowerCase())
							}
							
							// For non-file-path headings, search in the heading and content
							return sectionText.toLowerCase().includes(searchTerm.toLowerCase())
						})
					}
					
					// Search in Svelte documentation first
					const svelteMatch = findSection(svelteDoc, section)
					
					if (svelteMatch) {
						// Clean up the content - remove file path headings
						let cleanContent = svelteMatch
						if (!svelteMatch.startsWith('## ')) {
							cleanContent = `## ${svelteMatch}`
						}
						
						// Remove the docs/ heading if present
						cleanContent = cleanContent.replace(/^## docs\/[^\n]+\n\n/, '')
						
						return {
							content: [{ 
								type: 'text', 
								text: `📖 Svelte documentation section (${section}):\n\n${cleanContent}`
							}]
						}
					}
					
					// Search in SvelteKit documentation if not found in Svelte
					const svelteKitMatch = findSection(svelteKitDoc, section)
					
					if (svelteKitMatch) {
						// Clean up the content - remove file path headings
						let cleanContent = svelteKitMatch
						if (!svelteKitMatch.startsWith('## ')) {
							cleanContent = `## ${svelteKitMatch}`
						}
						
						// Remove the docs/ heading if present
						cleanContent = cleanContent.replace(/^## docs\/[^\n]+\n\n/, '')
						
						return {
							content: [{ 
								type: 'text', 
								text: `📖 SvelteKit documentation section (${section}):\n\n${cleanContent}`
							}]
						}
					}
					
					// If not found in either
					return {
						content: [{ 
							type: 'text', 
							text: `❌ Section "${section}" not found in Svelte or SvelteKit documentation. Use list_sections to see all available sections.`
						}]
					}
				} catch (error) {
					console.error('Error fetching documentation:', error)
					return {
						content: [{ 
							type: 'text', 
							text: `❌ Error fetching documentation for section "${section}": ${error.message}`
						}]
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

export const GET: RequestHandler = async ({ request }) => {
	return handler(request)
}

export const POST: RequestHandler = async ({ request }) => {
	return handler(request)
}

export const DELETE: RequestHandler = async ({ request }) => {
	return handler(request)
}
