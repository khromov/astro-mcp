import { z } from 'zod'
import type { RequestHandler } from './$types'
import { createMcpHandler } from '@vercel/mcp-adapter'
import { env } from '$env/dynamic/private'
import { presets } from '$lib/presets'
import { fetchAndProcessMarkdown } from '$lib/fetchMarkdown'

const handler = createMcpHandler(
	(server) => {
		server.tool(
			'get_documentation',
			'Retrieves documentation for a specific preset or lists available presets',
			{ 
				preset: z.string().optional().describe('The preset name to retrieve documentation for. If not provided, lists available presets.'),
				section: z.string().optional().describe('Optional: specific section/file to search for within the documentation')
			},
			async ({ preset, section }) => {
				console.log({ preset, section })
				
				// If no preset provided, list available presets
				if (!preset) {
					const presetList = Object.entries(presets)
						.map(([key, config]) => `- **${key}**: ${config.title}${config.description ? ` - ${config.description}` : ''}`)
						.join('\n')
					
					return {
						content: [{ 
							type: 'text', 
							text: `📚 Available documentation presets:\n\n${presetList}\n\nUse get_documentation with a preset name to retrieve specific documentation.`
						}]
					}
				}
				
				// Check if preset exists
				const presetConfig = presets[preset.toLowerCase()]
				if (!presetConfig) {
					const availablePresets = Object.keys(presets).join(', ')
					return {
						content: [{ 
							type: 'text', 
							text: `❌ Preset "${preset}" not found. Available presets: ${availablePresets}`
						}]
					}
				}
				
				try {
					// Fetch the documentation
					const documentation = await fetchAndProcessMarkdown(presetConfig, preset.toLowerCase())
					
					// If section is specified, try to find and return only that section
					if (section) {
						const sections = documentation.split('\n\n## ')
						const matchingSection = sections.find(s => 
							s.toLowerCase().includes(section.toLowerCase())
						)
						
						if (matchingSection) {
							const sectionContent = matchingSection.startsWith('## ') ? matchingSection : `## ${matchingSection}`
							return {
								content: [{ 
									type: 'text', 
									text: `📖 Documentation section for "${preset}" (${section}):\n\n${sectionContent}`
								}]
							}
						} else {
							return {
								content: [{ 
									type: 'text', 
									text: `❌ Section "${section}" not found in preset "${preset}". Try without specifying a section to see all available content.`
								}]
							}
						}
					}
					
					// Return full documentation if no section specified
					const truncated = documentation.length > 50000 
					const content = truncated ? documentation.substring(0, 50000) + '\n\n... (truncated)' : documentation
					
					return {
						content: [{ 
							type: 'text', 
							text: `📖 Documentation for "${preset}" (${presetConfig.title}):\n\n${content}`
						}]
					}
				} catch (error) {
					console.error('Error fetching documentation:', error)
					return {
						content: [{ 
							type: 'text', 
							text: `❌ Error fetching documentation for preset "${preset}": ${error.message}`
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
