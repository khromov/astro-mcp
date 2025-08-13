import type { MinimizeOptions } from './fetchMarkdown'
import { ASTRO_PROMPT } from '$lib/utils/prompts'

export type PresetConfig = {
	title: string
	description?: string
	glob: string[]
	ignore?: string[]
	prompt?: string
	minimize?: MinimizeOptions
	distilled?: boolean
	distilledFilenameBase?: string
}

// Main Astro presets
export const astroPresets: Record<string, PresetConfig> = {
	'astro-full': {
		title: 'Astro (Full)',
		description: 'Complete Astro documentation including all guides, reference, and tutorials',
		glob: ['**/src/content/docs/en/**/*.md', '**/src/content/docs/en/**/*.mdx'],
		ignore: [],
		prompt: ASTRO_PROMPT,
		minimize: {}
	},
	'astro-distilled': {
		title: '🔮 Astro (LLM Distilled)',
		description: 'AI-condensed version of the Astro docs focused on code examples and key concepts',
		glob: ['**/src/content/docs/en/**/*.md', '**/src/content/docs/en/**/*.mdx'],
		minimize: {
			normalizeWhitespace: false,
			removeLegacy: true,
			removePlaygroundLinks: true,
			removePrettierIgnore: true,
			removeNoteBlocks: false,
			removeDetailsBlocks: false,
			removeHtmlComments: true,
			removeDiffMarkers: true
		},
		prompt: ASTRO_PROMPT,
		distilled: true,
		distilledFilenameBase: 'astro-distilled'
	}
}

// Combine all presets
export const presets = {
	...astroPresets
}

export function transformAndSortPresets(presetsObject: Record<string, PresetConfig>) {
	return Object.entries(presetsObject)
		.map(([key, value]) => ({
			key: key.toLowerCase(),
			...value
		}))
		.sort()
}

export const DEFAULT_REPOSITORY = {
	owner: 'withastro',
	repo: 'docs'
} as const
