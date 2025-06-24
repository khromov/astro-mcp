import { json, error } from '@sveltejs/kit'
import type { RequestHandler } from './$types'
import { PresetDbService } from '$lib/server/presetDb'

// Valid basenames for distilled content
const VALID_DISTILLED_BASENAMES = [
	'svelte-complete-distilled',
	'svelte-distilled',
	'sveltekit-distilled'
]

export const GET: RequestHandler = async ({ url }) => {
	try {
		// Get the preset key from the URL query parameter
		const presetKey = url.searchParams.get('preset') || 'svelte-complete-distilled'

		// Validate the preset key
		if (!VALID_DISTILLED_BASENAMES.includes(presetKey)) {
			return json([])
		}

		// Since we no longer have versions, just return an empty array
		// The frontend will handle this gracefully
		return json([])
	} catch (e) {
		console.error('Database error reading distilled versions:', e)
		throw error(500, 'Failed to retrieve distilled versions from database')
	}
}
