import type { RequestHandler } from './$types'
import { error } from '@sveltejs/kit'
import { presets } from '$lib/presets'
import { getPresetFilePath, getFileSizeKb, isFileStale } from '$lib/fileCache'
import { dev } from '$app/environment'
import { fetchAndProcessMarkdown } from '$lib/fetchMarkdown'

/**
 * Trigger a background update for a preset without awaiting the result
 */
function triggerBackgroundUpdate(presetKey: string): void {
	const preset = presets[presetKey]
	if (!preset) return

	// Don't update distilled presets, they have their own update mechanism
	if (preset.distilled) return

	// Fire and forget - don't await this promise
	fetchAndProcessMarkdown(preset, presetKey)
		.then(() => {
			if (dev) console.log(`Background update completed for ${presetKey}`)
		})
		.catch((err) => {
			console.error(`Background update failed for ${presetKey}:`, err)
		})
}

export const GET: RequestHandler = async ({ params }) => {
	const presetKey = params.preset

	if (!(presetKey in presets)) {
		error(400, `Invalid preset: "${presetKey}"`)
	}

	try {
		// For distilled presets, we still need special handling for versions
		if (presets[presetKey]?.distilled) {
			const baseFilename = presets[presetKey].distilledFilenameBase || 'svelte-complete-distilled'
			const latestFilePath = `outputs/${baseFilename}-latest.md`

			const sizeKb = await getFileSizeKb(latestFilePath)

			if (sizeKb !== null) {
				return new Response(JSON.stringify({ sizeKb }), {
					headers: {
						'Content-Type': 'application/json'
					}
				})
			}

			// If distilled file doesn't exist yet
			return new Response(JSON.stringify({ sizeKb: 0, status: 'not_generated' }), {
				headers: {
					'Content-Type': 'application/json'
				}
			})
		}

		// For regular presets, we use the outputs directory
		const filePath = getPresetFilePath(presetKey)
		const sizeKb = await getFileSizeKb(filePath)

		// Check if file exists and is stale
		if (sizeKb !== null) {
			// If file exists, check if it's stale and trigger background update if needed
			const isStale = await isFileStale(filePath)
			if (isStale) {
				if (dev) console.log(`File for ${presetKey} is stale, triggering background update`)
				triggerBackgroundUpdate(presetKey)
			}

			return new Response(JSON.stringify({ sizeKb }), {
				headers: {
					'Content-Type': 'application/json'
				}
			})
		}

		// If file doesn't exist yet, return a placeholder size
		if (dev) {
			console.log(`File not found for preset "${presetKey}": ${filePath}`)
		}

		return new Response(JSON.stringify({ sizeKb: 0, status: 'not_generated' }), {
			headers: {
				'Content-Type': 'application/json'
			}
		})
	} catch (e) {
		console.error(`Error calculating size for preset "${presetKey}":`, e)
		error(500, `Failed to calculate size for preset "${presetKey}"`)
	}
}
