import type { RequestHandler } from './$types'
import { error } from '@sveltejs/kit'
import { presets } from '$lib/presets'
import { getPresetFilePath, getFileSizeKb } from '$lib/fileCache'
import { dev } from '$app/environment'

export const GET: RequestHandler = async ({ params }) => {
	const preset = params.preset

	if (!(preset in presets)) {
		error(400, `Invalid preset: "${preset}"`)
	}

	try {
		// For all presets, we now check the file size from the outputs directory
		const filePath = getPresetFilePath(preset)
		const sizeKb = await getFileSizeKb(filePath)

		if (sizeKb !== null) {
			return new Response(JSON.stringify({ sizeKb }), {
				headers: {
					'Content-Type': 'application/json'
				}
			})
		}

		// If file doesn't exist yet, return a placeholder size
		if (dev) {
			console.log(`File not found for preset "${preset}": ${filePath}`)
		}

		return new Response(JSON.stringify({ sizeKb: 0, status: 'not_generated' }), {
			headers: {
				'Content-Type': 'application/json'
			}
		})
	} catch (e) {
		console.error(`Error calculating size for preset "${preset}":`, e)
		error(500, `Failed to calculate size for preset "${preset}"`)
	}
}
