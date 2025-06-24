import { PresetDbService } from '$lib/server/presetDb'
import { dev } from '$app/environment'
import { env } from '$env/dynamic/private'

// Maximum age of cached content in milliseconds (24 hours)
export const MAX_CACHE_AGE_MS = 24 * 60 * 60 * 1000


/**
 * Get latest content for a preset from database
 */
export async function getPresetContent(presetKey: string): Promise<string | null> {
	
	try {
		const preset = await PresetDbService.getPresetByKey(presetKey)
		if (!preset) {
			if (dev) {
				console.log(`Preset not found in database: ${presetKey}`)
			}
			return null
		}

		const latestVersion = await PresetDbService.getLatestVersion(preset.id)
		if (!latestVersion || !latestVersion.content) {
			if (dev) {
				console.log(`No latest version found for preset: ${presetKey}`)
			}
			return null
		}

		// Update cache statistics
		await PresetDbService.updateCacheStats(preset.id, true) // cache hit
		
		if (dev) {
			console.log(`Retrieved content for ${presetKey} from database (${latestVersion.size_kb}KB)`)
		}

		return latestVersion.content
	} catch (error) {
		console.error(`Error getting preset content for ${presetKey}:`, error)
		return null
	}
}

/**
 * Get content size in KB from database
 */
export async function getPresetSizeKb(presetKey: string): Promise<number | null> {
	
	try {
		const preset = await PresetDbService.getPresetByKey(presetKey)
		if (!preset) {
			return null
		}

		const latestVersion = await PresetDbService.getLatestVersion(preset.id)
		if (!latestVersion) {
			return null
		}

		return latestVersion.size_kb
	} catch (error) {
		console.error(`Error getting preset size for ${presetKey}:`, error)
		return null
	}
}

/**
 * Check if preset content is stale based on database timestamps
 */
export async function isPresetStale(presetKey: string): Promise<boolean> {
	
	try {
		const preset = await PresetDbService.getPresetByKey(presetKey)
		if (!preset) {
			return true // No preset exists, consider stale
		}

		const latestVersion = await PresetDbService.getLatestVersion(preset.id)
		if (!latestVersion) {
			return true // No version exists, consider stale
		}

		// Check if content is older than MAX_CACHE_AGE_MS
		const contentAge = Date.now() - new Date(latestVersion.generated_at).getTime()
		const isStale = contentAge > MAX_CACHE_AGE_MS

		if (dev && isStale) {
			console.log(`Preset ${presetKey} is stale (age: ${Math.floor(contentAge / 1000 / 60)} minutes)`)
		}

		return isStale
	} catch (error) {
		console.error(`Error checking preset staleness for ${presetKey}:`, error)
		return true // On error, assume stale
	}
}

/**
 * Check if preset exists in database
 */
export async function presetExists(presetKey: string): Promise<boolean> {
	
	try {
		const preset = await PresetDbService.getPresetByKey(presetKey)
		return preset !== null
	} catch (error) {
		console.error(`Error checking preset existence for ${presetKey}:`, error)
		return false
	}
}

/**
 * Get preset metadata from database
 */
export async function getPresetMetadata(presetKey: string): Promise<{
	size_kb: number
	document_count: number
	generated_at: Date
	is_stale: boolean
} | null> {
	
	try {
		const preset = await PresetDbService.getPresetByKey(presetKey)
		if (!preset) {
			return null
		}

		const latestVersion = await PresetDbService.getLatestVersion(preset.id)
		if (!latestVersion) {
			return null
		}

		const isStale = await isPresetStale(presetKey)

		return {
			size_kb: latestVersion.size_kb,
			document_count: latestVersion.document_count,
			generated_at: latestVersion.generated_at,
			is_stale: isStale
		}
	} catch (error) {
		console.error(`Error getting preset metadata for ${presetKey}:`, error)
		return null
	}
}