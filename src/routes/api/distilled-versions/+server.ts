import { json } from '@sveltejs/kit'
import { readdir } from 'fs/promises'
import type { RequestHandler } from './$types'

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

		// Read the outputs directory
		const files = await readdir('outputs')

		// Filter files matching the pattern and exclude the latest
		const pattern = new RegExp(`^${presetKey}-\\d{4}-\\d{2}-\\d{2}\\.md$`)
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
