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
	languageCode?: string // Language code for filtering
	isLanguageVariant?: boolean // Flag to identify language variants
}

// Generate language-specific preset configurations
export function generateLanguagePreset(
	basePreset: PresetConfig,
	languageCode: string,
	languageName: string
): PresetConfig {
	const isEnglish = languageCode === 'en'

	// For language-specific presets, we still use glob patterns but they're more efficient
	// because the database already has the language column indexed
	return {
		...basePreset,
		title: isEnglish ? 'Astro (English)' : `Astro (${languageName})`,
		description: isEnglish
			? 'Complete Astro documentation in English'
			: `Complete Astro documentation in ${languageName}`,
		glob: [
			`**/src/content/docs/${languageCode}/**/*.md`,
			`**/src/content/docs/${languageCode}/**/*.mdx`
		],
		languageCode,
		isLanguageVariant: true,
		distilled: false,
		distilledFilenameBase: undefined
	}
}

// Base Astro presets (without language variants)
export const astroPresetsBase: Record<string, PresetConfig> = {
	'astro-distilled': {
		title: '🔮 Astro (LLM Distilled - English)',
		description:
			'AI-condensed version of the English Astro docs focused on code examples and key concepts',
		glob: ['**/src/content/docs/en/**/*.md', '**/src/content/docs/en/**/*.mdx'], // English-only
		languageCode: 'en', // Explicitly set language code for distilled preset
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

// This will be populated dynamically with language variants
export let astroPresets: Record<string, PresetConfig> = { ...astroPresetsBase }

// Function to dynamically add language-specific presets
export function setDynamicLanguagePresets(languages: Array<{ code: string; name: string }>) {
	// Reset to base presets
	astroPresets = { ...astroPresetsBase }

	// Generate language-specific presets
	languages.forEach(({ code, name }) => {
		const presetKey = `astro-${code}`
		astroPresets[presetKey] = generateLanguagePreset(astroPresetsBase['astro-distilled'], code, name)
	})
}

// For backward compatibility, combine all presets
export const getPresets = () => astroPresets

export function transformAndSortPresets(presetsObject: Record<string, PresetConfig>) {
	return Object.entries(presetsObject)
		.map(([key, value]) => ({
			key: key.toLowerCase(),
			...value
		}))
		.sort((a, b) => {
			// Sort order: distilled first, then base preset, then English, then other languages
			if (a.distilled && !b.distilled) return -1
			if (!a.distilled && b.distilled) return 1
			if (!a.isLanguageVariant && b.isLanguageVariant) return -1
			if (a.isLanguageVariant && !b.isLanguageVariant) return 1
			if (a.languageCode === 'en' && b.languageCode !== 'en') return -1
			if (a.languageCode !== 'en' && b.languageCode === 'en') return 1
			return a.key.localeCompare(b.key)
		})
}

export const DEFAULT_REPOSITORY = {
	owner: 'withastro',
	repo: 'docs'
} as const
