import { json } from '@sveltejs/kit'
import { readdir, stat } from 'fs/promises'
import { existsSync } from 'fs'
import type { RequestHandler } from './$types'

// Valid basenames for distilled content
const VALID_DISTILLED_BASENAMES = [
	'svelte-complete-distilled',
	'svelte-distilled',
	'sveltekit-distilled'
]

/**
 * Get file size in KB
 */
async function getFileSizeKb(filePath: string): Promise<number> {
	try {
		if (existsSync(filePath)) {
			const stats = await stat(filePath)
			return Math.floor(stats.size / 1024)
		}
		return 0
	} catch (e) {
		console.error(`Error getting file size for ${filePath}:`, e)
		return 0
	}
}

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

		// Get matching files
		const matchingFiles = files.filter((file) => pattern.test(file))

		// Process files to get their details including size
		const versionsPromises = matchingFiles.map(async (file) => {
			// Extract date from filename
			const match = file.match(/(\d{4}-\d{2}-\d{2})\.md$/)
			const date = match ? match[1] : 'unknown'

			// Get file size
			const filePath = `outputs/${file}`
			const sizeKb = await getFileSizeKb(filePath)

			return {
				filename: file,
				date,
				path: `/outputs/${file}`,
				sizeKb
			}
		})

		// Wait for all file size calculations
		const versions = await Promise.all(versionsPromises)

		// Sort newest first
		versions.sort((a, b) => b.date.localeCompare(a.date))

		return json(versions)
	} catch (e) {
		console.error('Error reading distilled versions:', e)
		return json([])
	}
}
