import { error } from '@sveltejs/kit'
import type { RequestHandler } from './$types'
import { PresetDbService } from '$lib/server/presetDb'

// Valid basenames for distilled content
const VALID_DISTILLED_BASENAMES = [
	'svelte-complete-distilled',
	'svelte-distilled',
	'sveltekit-distilled'
]

export const GET: RequestHandler = async ({ params }) => {
	const { presetKey, version } = params

	// Validate the preset key
	if (!VALID_DISTILLED_BASENAMES.includes(presetKey)) {
		throw error(404, 'Preset not found')
	}

	// Since we no longer support versions, we only return content for 'latest'
	if (version !== 'latest') {
		throw error(404, 'Version not found - only "latest" is supported')
	}

	try {
		// Get content from database
		const preset = await PresetDbService.getPresetByName(presetKey)

		if (!preset || !preset.content) {
			throw error(404, 'Content not found in database')
		}

		return new Response(preset.content, {
			headers: {
				'Content-Type': 'text/markdown; charset=utf-8',
				'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
				'Content-Disposition': `inline; filename="${presetKey}-latest.md"`
			}
		})
	} catch (e) {
		console.error(`Database error serving preset content for ${presetKey}/${version}:`, e)
		if (e instanceof Error && 'status' in e) {
			throw e // Re-throw SvelteKit errors
		}
		throw error(500, 'Database error retrieving content')
	}
}
