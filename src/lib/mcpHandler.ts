import { z } from 'zod'
import { createMcpHandler } from 'mcp-handler'
import { ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js'
import { env } from '$env/dynamic/private'
import { ContentDbService } from '$lib/server/contentDb'
import { listSectionsHandler } from '$lib/handlers/listSectionsHandler'
import { getDocumentationHandler } from '$lib/handlers/getDocumentationHandler'

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
		verboseLogs: false,
		redisUrl: env.REDIS_URL ? env.REDIS_URL : 'redis://127.0.0.1:6379'
	}
)
