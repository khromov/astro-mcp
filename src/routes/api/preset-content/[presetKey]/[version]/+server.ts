import { error } from '@sveltejs/kit'
import type { RequestHandler } from './$types'
import { PresetDbService } from '$lib/server/presetDb'
import { env } from '$env/dynamic/private'
import { readFile } from 'fs/promises'
import { existsSync } from 'fs'

// Valid basenames for distilled content
const VALID_DISTILLED_BASENAMES = [
	'svelte-complete-distilled',
	'svelte-distilled',
	'sveltekit-distilled'
]

/**
 * Check if database features are enabled
 */
function isDatabaseEnabled(): boolean {
	return !!env.DB_URL
}

export const GET: RequestHandler = async ({ params }) => {
	const { presetKey, version } = params

	// Validate the preset key
	if (!VALID_DISTILLED_BASENAMES.includes(presetKey)) {
		throw error(404, 'Preset not found')
	}

	// Validate version format (should be date like 2024-01-15 or 'latest')
	const isValidVersion = version === 'latest' || /^\d{4}-\d{2}-\d{2}$/.test(version)
	if (!isValidVersion) {
		throw error(400, 'Invalid version format')
	}

	try {
		// Try database first if enabled
		if (isDatabaseEnabled()) {
			try {
				const dbVersion = await PresetDbService.getPresetVersion(presetKey, version)
				
				if (dbVersion && dbVersion.content) {
					return new Response(dbVersion.content, {
						headers: {
							'Content-Type': 'text/markdown; charset=utf-8',
							'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
							'Content-Disposition': `inline; filename="${presetKey}-${version}.md"`
						}
					})
				}
			} catch (dbError) {
				console.error(`Database query failed for ${presetKey}/${version}, falling back to file system:`, dbError)
				// Fall through to file-based approach
			}
		}

		// File-based fallback
		let filePath: string
		
		if (version === 'latest') {
			// For 'latest', try to find the most recent file
			filePath = `outputs/${presetKey}.md`
		} else {
			// For specific date versions
			filePath = `outputs/${presetKey}-${version}.md`
		}

		if (existsSync(filePath)) {
			const content = await readFile(filePath, 'utf-8')
			
			return new Response(content, {
				headers: {
					'Content-Type': 'text/markdown; charset=utf-8',
					'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
					'Content-Disposition': `inline; filename="${presetKey}-${version}.md"`
				}
			})
		}

		// Content not found in database or file system
		throw error(404, 'Content not found')
		
	} catch (e) {
		console.error(`Error serving preset content for ${presetKey}/${version}:`, e)
		if (e instanceof Error && 'status' in e) {
			throw e // Re-throw SvelteKit errors
		}
		throw error(500, 'Internal server error')
	}
}