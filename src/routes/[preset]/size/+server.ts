import type { RequestHandler } from './$types'
import { error } from '@sveltejs/kit'
import { presets } from '$lib/presets'
import { getPresetSizeKb } from '$lib/presetCache'
import { PresetDbService } from '$lib/server/presetDb'
import { logAlways, logErrorAlways } from '$lib/log'

export const GET: RequestHandler = async ({ params }) => {
	const presetKey = params.preset

	// Check if it's a valid preset
	const isRegularPreset = presetKey in presets
	const isDistilledPreset = presets[presetKey]?.distilled

	// If it's not a regular preset, it's invalid
	if (!isRegularPreset) {
		error(400, `Invalid preset: "${presetKey}"`)
	}

	try {
		let sizeKb: number | null = null

		if (isDistilledPreset) {
			// Get size from distillations table
			const distillation = await PresetDbService.getLatestDistillation(presetKey)
			if (distillation) {
				sizeKb = distillation.size_kb
			}
		} else {
			// Calculate size on-demand from content table
			sizeKb = await getPresetSizeKb(presetKey)
		}

		if (sizeKb !== null) {
			return new Response(JSON.stringify({ sizeKb }), {
				headers: {
					'Content-Type': 'application/json'
				}
			})
		}

		// If content doesn't exist yet
		logAlways(`No content found for preset "${presetKey}"`)

		return new Response(JSON.stringify({ sizeKb: 0, status: 'not_generated' }), {
			headers: {
				'Content-Type': 'application/json'
			}
		})
	} catch (e) {
		logErrorAlways(`Error calculating size for preset "${presetKey}":`, e)
		error(500, `Failed to get size for preset "${presetKey}"`)
	}
}
