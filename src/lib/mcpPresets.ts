/**
 * Preset configurations for MCP resources
 * These define the documentation sets available as both prompts and resources
 */

export interface PresetConfig {
	id: string
	title: string
	description: string
	patterns: string[]
}

export const PRESET_CONFIGS: PresetConfig[] = [
	{
		id: 'astro-full',
		title: 'Complete Astro Documentation',
		description: 'Complete Astro documentation covering all sections',
		patterns: ['src/content/docs/en/%']
	},
	{
		id: 'astro-distilled',
		title: 'Astro Distilled Documentation',
		description: 'AI-condensed Astro documentation focused on code examples and key concepts',
		patterns: ['src/content/docs/en/%']
	}
]
