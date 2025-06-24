import { json, error } from '@sveltejs/kit'
import type { RequestHandler } from './$types'
import { PresetDbService } from '$lib/server/presetDb'
import { env } from '$env/dynamic/private'

// Valid basenames for distilled content
const VALID_DISTILLED_BASENAMES = [
	'svelte-complete-distilled',
	'svelte-distilled',
	'sveltekit-distilled'
]

/**
 * Transform database preset version to distilled version format
 */
function transformDbVersionToDistilledVersion(dbVersion: any, presetKey: string) {
	// Handle date format - version could be 'latest' or '2024-01-15'
	const date =
		dbVersion.version === 'latest'
			? new Date(dbVersion.generated_at).toISOString().split('T')[0]
			: dbVersion.version

	// Generate filename from preset key and date
	const filename = `${presetKey}-${date}.md`

	return {
		filename,
		date,
		path: `/api/preset-content/${presetKey}/${dbVersion.version}`,
		sizeKb: dbVersion.size_kb
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

		// Get all versions from database
		const dbVersions = await PresetDbService.getAllVersionsForPreset(presetKey)

		if (dbVersions.length === 0) {
			return json([])
		}

		// Transform database versions to distilled version format
		const versions = dbVersions
			.filter((v) => v.version !== 'latest') // Exclude 'latest' version
			.map((dbVersion) => transformDbVersionToDistilledVersion(dbVersion, presetKey))
			.sort((a, b) => b.date.localeCompare(a.date)) // Sort newest first

		return json(versions)
	} catch (e) {
		console.error('Database error reading distilled versions:', e)
		throw error(500, 'Failed to retrieve distilled versions from database')
	}
}
