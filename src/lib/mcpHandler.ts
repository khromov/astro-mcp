import { z } from 'zod'
import { createMcpHandler } from '@vercel/mcp-adapter'
import { env } from '$env/dynamic/private'
import { listSectionsHandler } from '$lib/handlers/listSectionsHandler'
import { getDocumentationHandler } from '$lib/handlers/getDocumentationHandler'
import { dev } from '$app/environment'

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
	},
	{},
	{
		maxDuration: 3600,
		basePath: '/mcp',
		verboseLogs: false,
		redisUrl: env.REDIS_URL ? env.REDIS_URL : 'redis://127.0.0.1:6379'
	}
)
