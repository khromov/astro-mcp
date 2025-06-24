import type { RequestHandler } from './$types'
import { error } from '@sveltejs/kit'
import { presets } from '$lib/presets'
import { getPresetFilePath, getFileSizeKb, isFileStale } from '$lib/fileCache'
import { dev } from '$app/environment'
import { fetchAndProcessMarkdownWithDb } from '$lib/fetchMarkdown'
import { existsSync } from 'fs'
import { readFile } from 'fs/promises'

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

/**
 * Get the size of a file in KB
 */
async function getVirtualPresetSizeKb(filePath: string): Promise<number> {
	try {
		if (existsSync(filePath)) {
			const content = await readFile(filePath, 'utf-8')
			return Math.floor(new TextEncoder().encode(content).length / 1024)
		}
		return 0
	} catch (e) {
		console.error(`Error getting file size for ${filePath}:`, e)
		return 0
	}
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
		// Handle virtual distilled presets
		if (isVirtualPreset) {
			const latestFilePath = `outputs/${presetKey}-latest.md`
			const sizeKb = await getVirtualPresetSizeKb(latestFilePath)

			return new Response(JSON.stringify({ sizeKb }), {
				headers: {
					'Content-Type': 'application/json'
				}
			})
		}

		// For regular distilled presets
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
