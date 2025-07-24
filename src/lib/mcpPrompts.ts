import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { ContentDistilledDbService } from '$lib/server/contentDistilledDb'
import { SVELTE_5_PROMPT } from '$lib/utils/prompts'

/**
 * Register template-based prompts for documentation injection
 * These prompts automatically fetch and inject relevant documentation content
 * based on predefined path patterns for different Svelte/SvelteKit sections
 */
export function registerTemplatePrompts(server: McpServer): void {
	// Core Svelte functionality (sections 1-4)
	server.prompt('svelte-core', {}, async () => {
		const patterns = [
			'%/apps/svelte.dev/content/docs/svelte/01-introduction/%',
			'%/apps/svelte.dev/content/docs/svelte/02-runes/%',
			'%/apps/svelte.dev/content/docs/svelte/03-template-syntax/%',
			'%/apps/svelte.dev/content/docs/svelte/04-styling/%'
		]

		const content = await ContentDistilledDbService.getContentByPathPatterns(patterns)
		const promptText = `${SVELTE_5_PROMPT}\n\nCore Svelte 5 Documentation:\n\n${content}`

		return {
			messages: [
				{
					role: 'user',
					content: {
						type: 'text',
						text: promptText
					}
				}
			]
		}
	})

	// Advanced Svelte features (sections 5-6)
	server.prompt('svelte-advanced', {}, async () => {
		const patterns = [
			'%/apps/svelte.dev/content/docs/svelte/05-special-elements/%',
			'%/apps/svelte.dev/content/docs/svelte/06-runtime/%',
			'%/apps/svelte.dev/content/docs/svelte/07-misc/%'
		]

		const content = await ContentDistilledDbService.getContentByPathPatterns(patterns)
		const promptText = `${SVELTE_5_PROMPT}\n\nAdvanced Svelte 5 Documentation:\n\n${content}`

		return {
			messages: [
				{
					role: 'user',
					content: {
						type: 'text',
						text: promptText
					}
				}
			]
		}
	})

	// Complete Svelte documentation (sections 1-7)
	server.prompt('svelte-complete', {}, async () => {
		const patterns = [
			'%/apps/svelte.dev/content/docs/svelte/01-introduction/%',
			'%/apps/svelte.dev/content/docs/svelte/02-runes/%',
			'%/apps/svelte.dev/content/docs/svelte/03-template-syntax/%',
			'%/apps/svelte.dev/content/docs/svelte/04-styling/%',
			'%/apps/svelte.dev/content/docs/svelte/05-special-elements/%',
			'%/apps/svelte.dev/content/docs/svelte/06-runtime/%',
			'%/apps/svelte.dev/content/docs/svelte/07-misc/%'
		]

		const content = await ContentDistilledDbService.getContentByPathPatterns(patterns)
		const promptText = `${SVELTE_5_PROMPT}\n\nComplete Svelte 5 Documentation:\n\n${content}`

		return {
			messages: [
				{
					role: 'user',
					content: {
						type: 'text',
						text: promptText
					}
				}
			]
		}
	})

	// Core SvelteKit concepts
	server.prompt('sveltekit-core', {}, async () => {
		const patterns = [
			'%/apps/svelte.dev/content/docs/kit/10-getting-started/%',
			'%/apps/svelte.dev/content/docs/kit/20-core-concepts/%'
		]

		const content = await ContentDistilledDbService.getContentByPathPatterns(patterns)
		const promptText = `${SVELTE_5_PROMPT}\n\nCore SvelteKit Documentation:\n\n${content}`

		return {
			messages: [
				{
					role: 'user',
					content: {
						type: 'text',
						text: promptText
					}
				}
			]
		}
	})

	// Production SvelteKit features
	server.prompt('sveltekit-production', {}, async () => {
		const patterns = [
			'%/apps/svelte.dev/content/docs/kit/25-build-and-deploy/%',
			'%/apps/svelte.dev/content/docs/kit/30-advanced/%',
			'%/apps/svelte.dev/content/docs/kit/40-best-practices/%'
		]

		const content = await ContentDistilledDbService.getContentByPathPatterns(patterns)
		const promptText = `${SVELTE_5_PROMPT}\n\nProduction SvelteKit Documentation:\n\n${content}`

		return {
			messages: [
				{
					role: 'user',
					content: {
						type: 'text',
						text: promptText
					}
				}
			]
		}
	})

	// Complete SvelteKit documentation
	server.prompt('sveltekit-complete', {}, async () => {
		const patterns = [
			'%/apps/svelte.dev/content/docs/kit/10-getting-started/%',
			'%/apps/svelte.dev/content/docs/kit/20-core-concepts/%',
			'%/apps/svelte.dev/content/docs/kit/25-build-and-deploy/%',
			'%/apps/svelte.dev/content/docs/kit/30-advanced/%',
			'%/apps/svelte.dev/content/docs/kit/40-best-practices/%'
		]

		const content = await ContentDistilledDbService.getContentByPathPatterns(patterns)
		const promptText = `${SVELTE_5_PROMPT}\n\nComplete SvelteKit Documentation:\n\n${content}`

		return {
			messages: [
				{
					role: 'user',
					content: {
						type: 'text',
						text: promptText
					}
				}
			]
		}
	})
}
