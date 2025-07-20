import { z } from 'zod'
import { createMcpHandler } from 'mcp-handler'
import { ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js'
import { env } from '$env/dynamic/private'
import { ContentDbService } from '$lib/server/contentDb'
import type { DbContent } from '$lib/types/db'
import { listSectionsHandler } from '$lib/handlers/listSectionsHandler'
import { getDocumentationHandler } from '$lib/handlers/getDocumentationHandler'
import { logAlways, logErrorAlways } from '$lib/log'
import {
	cleanDocumentationPath,
	extractTitleFromPath,
	removeFrontmatter
} from '$lib/utils/pathUtils'

// Helper function to search for sections in the database
async function searchSectionInDb(query: string): Promise<DbContent | null> {
	try {
		// Use the searchContent method with default parameters
		const result = await ContentDbService.searchContent(query)
		return result
	} catch (error) {
		logErrorAlways(`Error searching for section "${query}":`, error)
		return null
	}
}

// Helper function to get title from metadata or path
function getTitleFromMetadata(
	metadata: Record<string, unknown> | undefined,
	fallbackPath: string
): string {
	if (metadata?.title && typeof metadata.title === 'string') {
		return metadata.title
	}
	return extractTitleFromPath(fallbackPath)
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
			new ResourceTemplate('svelte-llm://{+slug}', {
				list: async () => {
					const documents = await ContentDbService.getContentByFilter({
						owner: 'sveltejs',
						repo_name: 'svelte.dev',
						path_pattern: 'apps/svelte.dev/content/docs/%'
					})

					logAlways(`Found ${documents.length} documents for resource listing`)

					return {
						resources: documents.map((doc) => {
							const title = getTitleFromMetadata(doc.metadata, doc.path)
							const cleanPath = cleanDocumentationPath(doc.path)

							return {
								// Use title and clean path for better display
								name: `${title} (${cleanPath})`,
								uri: `svelte-llm://${doc.path}`,
								// Add description from metadata if available
								description: doc.metadata?.description as string | undefined
							}
						})
					}
				},
				complete: {
					slug: async (query) => {
						// Use the new searchAllContent method to get all matching results
						const searchResults = await ContentDbService.searchAllContent(query)

						const paths = searchResults.map((doc) => doc.path)
						logAlways(`Found ${paths.length} documents matching query: ${query}`)

						return paths
					}
				}
			}),
			async (uri, { slug }) => {
				//TODO: What is right here?
				// If array for some reason, use the first element
				const slugString = Array.isArray(slug) ? slug[0] : slug

				logAlways(`Resource requested with slug: ${slugString}`)

				// First try intelligent search (by title or partial path)
				let document = await searchSectionInDb(slugString)

				// If not found, try exact path match
				if (!document) {
					document = await ContentDbService.getContentByPath('sveltejs', 'svelte.dev', slugString)
				}

				// If still not found, try with the full path pattern
				if (!document && !slugString.startsWith('apps/svelte.dev/content/')) {
					const fullPath = `apps/svelte.dev/content/docs/${slugString}`
					document = await ContentDbService.getContentByPath('sveltejs', 'svelte.dev', fullPath)
				}

				if (!document) {
					throw new Error(
						`Document not found for slug: ${slugString}. Try using a document title (e.g., "$state") or a valid path.`
					)
				}

				const title = getTitleFromMetadata(document.metadata, document.path)
				const cleanPath = cleanDocumentationPath(document.path)

				// Remove frontmatter from the content before returning it
				const contentWithoutFrontmatter = removeFrontmatter(document.content)

				logAlways(`Returning document: ${title} (${cleanPath})`)

				return {
					contents: [
						{
							uri: uri.toString(),
							type: 'text',
							text: contentWithoutFrontmatter,
							// Include metadata in the response
							metadata: {
								title,
								path: cleanPath,
								originalPath: document.path
							}
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
		verboseLogs: false,
		redisUrl: env.REDIS_URL ? env.REDIS_URL : 'redis://127.0.0.1:6379'
	}
)
