import { json } from '@sveltejs/kit'
import { readdir } from 'fs/promises'
import { presets } from '$lib/presets'
import type { RequestHandler } from './$types'

export const GET: RequestHandler = async () => {
	try {
		// Find the distilled preset to get the base filename
		const distilledPreset = Object.values(presets).find((preset) => preset.distilled)

		if (!distilledPreset || !distilledPreset.distilledFilenameBase) {
			return json([])
		}

		// Read the outputs directory
		const files = await readdir('outputs')

		// Filter files matching the pattern and exclude the latest
		const pattern = new RegExp(
			`^${distilledPreset.distilledFilenameBase}-\\d{4}-\\d{2}-\\d{2}\\.md$`
		)
		const versions = files
			.filter((file) => pattern.test(file))
			.map((file) => {
				// Extract date from filename
				const match = file.match(/(\d{4}-\d{2}-\d{2})\.md$/)
				return {
					filename: file,
					date: match ? match[1] : 'unknown',
					path: `/outputs/${file}`
				}
			})
			.sort((a, b) => b.date.localeCompare(a.date)) // Sort newest first

		return json(versions)
	} catch (e) {
		console.error('Error reading distilled versions:', e)
		return json([])
	}
}
