import type { RequestHandler } from './$types'
import { error } from '@sveltejs/kit'
import { presets } from '$lib/presets'
import { getPresetSizeKb, isPresetStale } from '$lib/presetCache'
import { dev } from '$app/environment'
import { fetchAndProcessMarkdownWithDb } from '$lib/fetchMarkdown'
import { env } from '$env/dynamic/private'

// Virtual distilled presets that aren't in the presets object
const VIRTUAL_DISTILLED_PRESETS = ['svelte-distilled', 'sveltekit-distilled']

/**
 * Trigger a background update for a preset without awaiting the result
 */
function triggerBackgroundUpdate(presetKey: string): void {
	const preset = presets[presetKey]
	if (!preset) return

	// Don't update distilled presets, they have their own update mechanism
	if (preset.distilled) return

	// Fire and forget - don't await this promise
	fetchAndProcessMarkdownWithDb(preset, presetKey)
		.then(() => {
			if (dev) console.log(`Background update completed for ${presetKey}`)
		})
		.catch((err) => {
			console.error(`Background update failed for ${presetKey}:`, err)
		})
}

export const GET: RequestHandler = async ({ params }) => {
	const presetKey = params.preset

	// Handle both regular presets and virtual distilled presets
	const isVirtualPreset = VIRTUAL_DISTILLED_PRESETS.includes(presetKey)
	const isRegularPreset = presetKey in presets

	// If it's neither a virtual nor a regular preset, it's invalid
	if (!isVirtualPreset && !isRegularPreset) {
		error(400, `Invalid preset: "${presetKey}"`)
	}

	try {
		// Get size from database
		const sizeKb = await getPresetSizeKb(presetKey)

		if (sizeKb !== null) {
			// Check if content is stale and trigger background update if needed
			const isStale = await isPresetStale(presetKey)
			if (isStale && !presets[presetKey]?.distilled) {
				if (dev) console.log(`Preset ${presetKey} is stale, triggering background update`)
				triggerBackgroundUpdate(presetKey)
			}

			return new Response(JSON.stringify({ sizeKb }), {
				headers: {
					'Content-Type': 'application/json'
				}
			})
		}

		// If content doesn't exist yet in database
		if (dev) {
			console.log(`No content found in database for preset "${presetKey}"`)
		}

		return new Response(JSON.stringify({ sizeKb: 0, status: 'not_generated' }), {
			headers: {
				'Content-Type': 'application/json'
			}
		})
	} catch (e) {
		console.error(`Database error calculating size for preset "${presetKey}":`, e)
		error(500, `Failed to get size from database for preset "${presetKey}"`)
	}
}
