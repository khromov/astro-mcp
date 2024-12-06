import type { GlobPattern } from 'glob'
import type { MinimizeOptions } from './fetchMarkdown'

export type PresetConfig = {
	/** The pretty title of the preset */
	title: string
	/** Optional description of the preset */
	description?: string
	/** The owner of the GitHub repository */
	owner: string
	/** The name of the GitHub repository */
	repo: string
	/** List of glob patterns for including files */
	glob: GlobPattern[]
	/** List of glob patterns for excluding files */
	ignore?: GlobPattern[]
	/** Optional prompt to provide additional context or instructions to language models */
	prompt?: string
	/** Minimization options for the content */
	minimize?: MinimizeOptions
}

const SVELTE_5_PROMPT =
	'Always use Svelte 5 runes and Svelte 5 syntax. Runes do not need to be imported, they are globals. $state() runes are always declared using `let`, never with `const`. When passing a function to $derived, you must always use $derived.by(() => ...).'


export const combinedPresets: Record<string, PresetConfig> = {
	'svelte-complete-medium': {
		title: '⭐️ Svelte + SvelteKit (Recommended - Medium preset)',
		description:
			'Complete Svelte + SvelteKit docs excluding certain advanced sections, legacy, notes and migration docs',
		owner: 'sveltejs',
		repo: 'svelte.dev',
		glob: [
			// Svelte
			'**/apps/svelte.dev/content/docs/svelte/**/*.md',
			// SvelteKit
			'**/apps/svelte.dev/content/docs/kit/**/*.md'
		],
		ignore: [
			// Svelte ignores
			'**/apps/svelte.dev/content/docs/svelte/07-misc/04-custom-elements.md',
			'**/apps/svelte.dev/content/docs/svelte/07-misc/06-v4-migration-guide.md',
			'**/apps/svelte.dev/content/docs/svelte/07-misc/07-v5-migration-guide.md',
			'**/apps/svelte.dev/content/docs/svelte/07-misc/99-faq.md',
			'**/apps/svelte.dev/content/docs/svelte/07-misc/xx-reactivity-indepth.md',
			'**/apps/svelte.dev/content/docs/svelte/98-reference/21-svelte-legacy.md',
			'**/apps/svelte.dev/content/docs/svelte/99-legacy/**/*.md',
			'**/apps/svelte.dev/content/docs/svelte/98-reference/30-runtime-errors.md',
			'**/apps/svelte.dev/content/docs/svelte/98-reference/30-runtime-warnings.md',
			'**/apps/svelte.dev/content/docs/svelte/98-reference/30-compiler-errors.md',
			'**/apps/svelte.dev/content/docs/svelte/98-reference/30-compiler-warnings.md',
			'**/xx-*.md',
			// SvelteKit ignores
			'**/apps/svelte.dev/content/docs/kit/25-build-and-deploy/*adapter-*.md',
			'**/apps/svelte.dev/content/docs/kit/25-build-and-deploy/99-writing-adapters.md',
			'**/apps/svelte.dev/content/docs/kit/30-advanced/70-packaging.md',
			'**/apps/svelte.dev/content/docs/kit/40-best-practices/05-performance.md',
			'**/apps/svelte.dev/content/docs/kit/40-best-practices/10-accessibility.md', // May the a11y gods have mercy on our souls
			'**/apps/svelte.dev/content/docs/kit/60-appendix/**/*.md',
			'**/xx-*.md'
		],
		prompt: SVELTE_5_PROMPT,
		minimize: {
			removeLegacy: true,
			removePlaygroundLinks: true,
			removeNoteBlocks: true,
			removeDetailsBlocks: true,
			removeHtmlComments: true,
			normalizeWhitespace: true
		}
	},
	'svelte-complete': {
		title: 'Svelte + SvelteKit (Large preset)',
		description: 'Complete Svelte + SvelteKit docs excluding legacy, notes and migration docs',
		owner: 'sveltejs',
		repo: 'svelte.dev',
		glob: [
			'**/apps/svelte.dev/content/docs/svelte/**/*.md',
			'**/apps/svelte.dev/content/docs/kit/**/*.md'
		],
		ignore: [],
		prompt: SVELTE_5_PROMPT,
		minimize: {
			removeLegacy: true,
			removePlaygroundLinks: true,
			removeNoteBlocks: true,
			removeDetailsBlocks: true,
			removeHtmlComments: true,
			normalizeWhitespace: true
		}
	},
	'svelte-complete-tiny': {
		title: 'Svelte + SvelteKit (Tiny preset)',
		description: 'Tutorial content only',
		owner: 'sveltejs',
		repo: 'svelte.dev',
		glob: [
			'**/apps/svelte.dev/content/tutorial/**/*.md',
			'**/apps/svelte.dev/content/docs/svelte/02-runes/**/*.md'
		],
		ignore: [],
		prompt: SVELTE_5_PROMPT,
		minimize: {
			removeLegacy: true,
			removePlaygroundLinks: true,
			removeNoteBlocks: true,
			removeDetailsBlocks: true,
			removeHtmlComments: true,
			normalizeWhitespace: true
		}
	},
};

export const sveltePresets: Record<string, PresetConfig> = {
	svelte: {
		title: 'Svelte (Full)',
		description: 'Complete documentation including legacy and reference',
		owner: 'sveltejs',
		repo: 'svelte.dev',
		glob: ['**/apps/svelte.dev/content/docs/svelte/**/*.md'],
		ignore: [],
		prompt: SVELTE_5_PROMPT,
		minimize: {}
	},
}

export const svelteKitPresets: Record<string, PresetConfig> = {
	sveltekit: {
		title: 'SvelteKit (Full)',
		description: 'Complete documentation including legacy and reference',
		owner: 'sveltejs',
		repo: 'svelte.dev',
		prompt: SVELTE_5_PROMPT,
		glob: ['**/apps/svelte.dev/content/docs/kit/**/*.md'],
		minimize: {}
	},
}

export const otherPresets: Record<string, PresetConfig> = {
	'svelte-cli': {
		title: 'Svelte CLI - npx sv',
		owner: 'sveltejs',
		repo: 'svelte.dev',
		glob: ['**/apps/svelte.dev/content/docs/cli/**/*.md'],
		ignore: [],
		minimize: {}
	}
}

export const presets = {
	...combinedPresets,
	...sveltePresets,
	...svelteKitPresets,
	...otherPresets
};

export function transformAndSortPresets(presetsObject) {
	return Object.entries(presetsObject)
	  .map(([key, value]) => ({
		key: key.toLowerCase(),
		...value
	  }))
	  .sort();
  }