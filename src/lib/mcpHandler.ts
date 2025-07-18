import { z } from 'zod'
import { createMcpHandler } from '@vercel/mcp-adapter'
import { ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js'
import { env } from '$env/dynamic/private'
import { ContentDbService } from '$lib/server/contentDb'
import type { DbContent } from '$lib/types/db'
import { log, logAlways, logErrorAlways } from '$lib/log'
import { compile } from 'svelte/compiler'

interface DocumentSection {
	filePath: string
	title: string
	content: string
}

/**
 * Helper function to clean up file paths by removing the "apps/svelte.dev/content/" prefix
 */
function cleanPath(path: string): string {
	const prefix = 'apps/svelte.dev/content/'
	if (path.startsWith(prefix)) {
		return path.substring(prefix.length)
	}
	return path
}

function getTitleFromMetadata(
	metadata: Record<string, unknown> | undefined,
	fallbackPath: string
): string {
	if (metadata?.title && typeof metadata.title === 'string') {
		return metadata.title
	}
	return extractTitleFromPath(fallbackPath)
}

export const listSectionsHandler = async () => {
	logAlways('Listing sections from database')

	try {
		const allContent = await ContentDbService.getContentByFilter({
			owner: 'sveltejs',
			repo_name: 'svelte.dev',
			path_pattern: 'apps/svelte.dev/content/docs/%'
		})

		const sections: DocumentSection[] = []

		for (const item of allContent) {
			if (item.content.length < 100) {
				log(`Filtered out section: "${item.path}" (${item.content.length} chars)`)
				continue
			}

			const title = getTitleFromMetadata(item.metadata, item.path)

			const cleanedPath = cleanPath(item.path)

			sections.push({
				filePath: cleanedPath,
				title,
				content: `## ${cleanedPath}\n\n${item.content}`
			})
		}

		sections.sort((a, b) => a.filePath.localeCompare(b.filePath))

		// Group by Svelte vs SvelteKit using cleaned paths (without leading slash)
		const svelteSections = sections.filter((s) => s.filePath.includes('docs/svelte/'))
		const svelteKitSections = sections.filter((s) => s.filePath.includes('docs/kit/'))

		let output = ''

		if (svelteSections.length > 0) {
			output += '# Svelte\n'
			output +=
				svelteSections
					.map((section) => `* title: ${section.title}, path: ${section.filePath}`)
					.join('\n') + '\n\n'
		}

		if (svelteKitSections.length > 0) {
			output += '# SvelteKit\n'
			output += svelteKitSections
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
		logErrorAlways('Error listing sections:', error)
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
		// Handle array of sections - including JSON string arrays
		let sections: string[]
		if (Array.isArray(section)) {
			sections = section
		} else if (
			typeof section === 'string' &&
			section.trim().startsWith('[') &&
			section.trim().endsWith(']')
		) {
			// Try to parse JSON string array
			try {
				const parsed = JSON.parse(section)
				sections = Array.isArray(parsed) ? parsed : [section]
			} catch {
				sections = [section]
			}
		} else {
			sections = [section]
		}

		const results: string[] = []
		const notFound: string[] = []

		for (const sectionName of sections) {
			log({ section: sectionName })

			// Remove trailing comma if present
			const cleanSection = sectionName.replace(/,\s*$/, '')

			const matchedContent = await searchSectionInDb(cleanSection)

			if (matchedContent) {
				const cleanedPath = cleanPath(matchedContent.path)

				const formattedContent = `## ${cleanedPath}\n\n${matchedContent.content}`
				const framework = matchedContent.path.includes('/docs/svelte/') ? 'Svelte' : 'SvelteKit'

				const title = getTitleFromMetadata(matchedContent.metadata, matchedContent.path)
				results.push(`📖 ${framework} documentation (${title}):\n\n${formattedContent}`)
			} else {
				notFound.push(cleanSection)
			}
		}

		if (results.length === 0) {
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
		logErrorAlways('Error fetching documentation:', error)
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

async function searchSectionInDb(query: string): Promise<DbContent | null> {
	const lowerQuery = query.toLowerCase()

	const allContent = await ContentDbService.getContentByFilter({
		owner: 'sveltejs',
		repo_name: 'svelte.dev',
		path_pattern: 'apps/svelte.dev/content/docs/%'
	})

	// First try exact title match
	let match = allContent.find((item) => {
		const title = getTitleFromMetadata(item.metadata, item.path)
		return title.toLowerCase() === lowerQuery
	})
	if (match) return match

	// Then try partial title match
	match = allContent.find((item) => {
		const title = getTitleFromMetadata(item.metadata, item.path)
		return title.toLowerCase().includes(lowerQuery)
	})
	if (match) return match

	// Finally try file path match for backward compatibility
	match = allContent.find((item) => item.path.toLowerCase().includes(lowerQuery))
	if (match) return match

	return null
}

function extractTitleFromPath(filePath: string): string {
	const filename = filePath.split('/').pop() || filePath
	return filename.replace('.md', '').replace(/^\d+-/, '')
}

export const handler = createMcpHandler(
	(server) => {
		server.tool(
			'list_sections',
			'Lists all available Svelte 5 and SvelteKit documentation sections in a structured format. Returns sections as a list of "* title: [section_title], path: [file_path]" - you can use either the title or path when querying a specific section via the get_documentation tool. Always run list_sections first for any query related to Svelte development to discover available content.',
			{},
			async () => listSectionsHandler()
		)

		server.tool(
			'get_documentation',
			'Retrieves full documentation content for Svelte 5 or SvelteKit sections. Supports flexible search by title (e.g., "$state", "routing") or file path (e.g., "docs/svelte/state.md"). Can accept a single section name or an array of sections. Before running this, make sure to analyze the users query, as well as the output from list_sections (which should be called first). Then ask for ALL relevant sections the user might require. For example, if the user asks to build anything interactive, you will need to fetch all relevant runes, and so on.',
			{
				section: z
					.union([z.string(), z.array(z.string())])
					.describe(
						'The section name(s) to retrieve. Can search by title (e.g., "$state", "load functions") or file path (e.g., "docs/svelte/state.md"). Supports single string and array of strings'
					)
			},
			async ({ section }) => getDocumentationHandler({ section })
		)

		server.prompt('svelte-developer', () => {
			return {
				messages: [
					{
						role: 'user',
						content: {
							type: 'text',
							text: "You are a 10x svelte developer leading maintainer of the svelte project, you know everything about it and if you don't please use the mcp tool"
						}
					}
				]
			}
		})

		server.resource(
			'svelte_doc',
			// @ts-expect-error vercel is dumb
			new ResourceTemplate('svelte-llm://{+slug}', {
				list: async () => {
					const documents = await ContentDbService.getContentByFilter({
						owner: 'sveltejs',
						repo_name: 'svelte.dev',
						path_pattern: 'apps/svelte.dev/content/docs/%'
					})
					console.error(documents[0])
					return {
						resources: documents.map((doc) => {
							return {
								name: doc.filename,
								uri: `svelte-llm://${doc.path}`
							}
						})
					}
				},
				complete: {
					slug: async (query) => {
						const documents = await ContentDbService.getContentByFilter({
							owner: 'sveltejs',
							repo_name: 'svelte.dev',
							path_pattern: `apps/svelte.dev/content/docs/${query}%`
						})
						console.error(documents[0], query)
						return documents.map((doc) => doc.filename)
					}
				}
			}),
			// @ts-expect-error vercel is dumb
			async (uri, { slug }) => {
				const document = await ContentDbService.getContentByPath('sveltejs', 'svelte.dev', slug)
				if (!document) {
					throw new Error(`Document not found for slug: ${slug}`)
				}
				return {
					contents: [
						{
							uri: uri.toString(),
							type: 'text',
							text: document?.content
						}
					]
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
