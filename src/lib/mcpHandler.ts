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
import { SVELTE_DEVELOPER_PROMPT } from '$lib/utils/prompts'

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

		// Create tool for task-based development assistance
		server.tool(
			'svelte_developer_assist',
			'Get expert Svelte 5 and SvelteKit development assistance. This provides comprehensive guidance including best practices, TypeScript usage, and proper documentation references. Optionally provide a specific task for focused assistance.',
			{
				task: z.string().optional().describe('Optional specific task or requirement to focus on')
			},
			async ({ task }) => {
				// First, provide the comprehensive prompt
				let responseText = SVELTE_DEVELOPER_PROMPT

				if (task) {
					responseText += `\n\n## Current Task:\n${task}\n\n## Task-Specific Approach:\n`
					responseText += `1. Run list_sections to see all available documentation\n`
					responseText += `2. Based on "${task.substring(0, 50)}...", fetch these types of docs:\n`
					responseText += `   - Component-related: runes, props, events, lifecycle\n`
					responseText += `   - Routing-related: routing, load functions, layouts\n`
					responseText += `   - State-related: stores, context, reactive statements\n`
					responseText += `   - Form-related: actions, progressive enhancement\n`
					responseText += `3. Design solution architecture:\n`
					responseText += `   - Component structure and composition\n`
					responseText += `   - State management approach\n`
					responseText += `   - TypeScript types and interfaces\n`
					responseText += `   - Error handling strategy\n`
					responseText += `4. Implement with:\n`
					responseText += `   - Complete, working code\n`
					responseText += `   - Proper types and error boundaries\n`
					responseText += `   - Performance optimizations\n`
					responseText += `   - Accessibility considerations\n`
					responseText += `5. Explain implementation choices and alternatives`
				} else {
					responseText += `\n\n## Your Approach:\n`
					responseText += `When helping with Svelte/SvelteKit:\n`
					responseText += `1. Use list_sections to discover documentation\n`
					responseText += `2. Analyze requirements and fetch relevant docs with get_documentation\n`
					responseText += `3. Provide complete, working solutions with TypeScript\n`
					responseText += `4. Explain architectural decisions and trade-offs\n`
					responseText += `5. Suggest optimizations and best practices`
				}

				return {
					content: [
						{
							type: 'text' as const,
							text: responseText
						}
					]
				}
			}
		)

		// Simple prompt without arguments (compatible with all MCP clients)
		server.prompt('svelte-developer', () => {
			return {
				messages: [
					{
						role: 'user',
						content: {
							type: 'text',
							text:
								SVELTE_DEVELOPER_PROMPT +
								`

## Your Approach:
When helping with Svelte/SvelteKit:
1. Use list_sections to discover documentation
2. Analyze requirements and fetch relevant docs with get_documentation
3. Provide complete, working solutions with TypeScript
4. Explain architectural decisions and trade-offs
5. Suggest optimizations and best practices

For task-specific assistance, use the svelte_developer_assist tool with a task parameter.`
						}
					}
				]
			}
		})

		server.resource(
			'svelte-doc',
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
								// Use cleaned path in URI for consistency
								uri: `svelte-llm://${cleanPath}`,
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

						// Return cleaned paths for consistency
						const paths = searchResults.map((doc) => cleanDocumentationPath(doc.path))
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

				// If not found, try exact path match with cleaned path
				if (!document) {
					// Try to find by cleaned path - need to search all content and match cleaned paths
					const allDocs = await ContentDbService.getContentByFilter({
						owner: 'sveltejs',
						repo_name: 'svelte.dev',
						path_pattern: 'apps/svelte.dev/content/docs/%'
					})

					document = allDocs.find((doc) => cleanDocumentationPath(doc.path) === slugString) || null
				}

				// If still not found, try with the full path pattern (for backward compatibility)
				if (!document && !slugString.startsWith('apps/svelte.dev/content/')) {
					const fullPath = `apps/svelte.dev/content/docs/${slugString}`
					document = await ContentDbService.getContentByPath('sveltejs', 'svelte.dev', fullPath)
				}

				// If still not found, try direct database path match (for backward compatibility)
				if (!document) {
					document = await ContentDbService.getContentByPath('sveltejs', 'svelte.dev', slugString)
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
