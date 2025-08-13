import { ContentSyncService } from '$lib/server/contentSync'
import { DEFAULT_REPOSITORY, astroPresetsBase, generateLanguagePreset, type PresetConfig } from '$lib/presets'
import { log, logAlways, logErrorAlways } from '$lib/log'
import { cleanDocumentationPath } from '$lib/utils/pathUtils'
import { CacheDbService } from '$lib/server/cacheDb'
import { minimizeContent } from '$lib/fetchMarkdown'
import { ContentDbService } from '$lib/server/contentDb'
import { minimatch } from 'minimatch'
import { LanguageService } from '$lib/server/languageService'

// Maximum age of cached content in milliseconds (24 hours)
export const MAX_CACHE_AGE_MS = 24 * 60 * 60 * 1000

// Stateless helper to generate all presets
async function getAllPresets(): Promise<Record<string, PresetConfig>> {
	const languages = await LanguageService.getAvailableLanguages()
	const presets: Record<string, PresetConfig> = { ...astroPresetsBase }
	
	// Generate language-specific presets
	languages.forEach(({ code, name }) => {
		const presetKey = `astro-${code}`
		presets[presetKey] = generateLanguagePreset(astroPresetsBase['astro-distilled'], code, name)
	})
	
	return presets
}

let cacheService: CacheDbService | null = null

function getCacheService(): CacheDbService {
	if (!cacheService) {
		cacheService = new CacheDbService()
	}
	return cacheService
}

// Helper function to sort files within a group while preserving original order
function sortFilesWithinGroup(
	files: Array<{ path: string; content: string }>
): Array<{ path: string; content: string }> {
	return files.sort((a, b) => {
		const aPath = a.path
		const bPath = b.path

		// Check if one path is a parent of the other
		if (bPath.startsWith(aPath.replace('/index.md', '/'))) return -1
		if (aPath.startsWith(bPath.replace('/index.md', '/'))) return 1

		return aPath.localeCompare(bPath)
	})
}

export async function getPresetContent(presetKey: string): Promise<string | null> {
	try {
		const presets = await getAllPresets()
		const preset = presets[presetKey]
		if (!preset) {
			log(`Preset not found: ${presetKey}`)
			return null
		}

		// Check cache first
		const cache = getCacheService()
		const cacheKey = `preset:${presetKey}`

		try {
			const cachedData = await cache.get(cacheKey)
			if (cachedData) {
				const cachedContent = cachedData.toString('utf8')
				logAlways(`Using cached content for preset ${presetKey}`)
				return cachedContent
			}
		} catch (cacheError) {
			logErrorAlways(`Error reading cache for preset ${presetKey}:`, cacheError)
			// Continue with normal flow if cache read fails
		}

		// Try to get files from the content table first
		let filesWithPaths = await getPresetContentFromDb(presetKey)

		// If no content in database, fetch from GitHub and sync
		if (!filesWithPaths || filesWithPaths.length === 0) {
			logAlways(`No content in database for preset ${presetKey}, fetching from GitHub...`)

			// Sync the repository first
			await ContentSyncService.syncRepository()

			// Try again from database
			filesWithPaths = await getPresetContentFromDb(presetKey)

			if (!filesWithPaths || filesWithPaths.length === 0) {
				log(`Still no content found for preset: ${presetKey} after sync`)
				return null
			}
		}

		// Format files with headers and preserve the order from database
		// The files are already correctly ordered by glob pattern precedence
		// Use the unified path utility to clean paths
		const files = filesWithPaths.map((f) => {
			const cleanPath = cleanDocumentationPath(f.path)
			return `## ${cleanPath}\n\n${f.content}`
		})

		// DO NOT sort - files are already in correct glob pattern order from getPresetContentFromDb
		const content = files.join('\n\n')

		logAlways(`Generated content for ${presetKey} on-demand (${filesWithPaths.length} files)`)

		// Cache the generated content for 1 hour (60 minutes)
		try {
			const contentBuffer = Buffer.from(content, 'utf8')
			await cache.set(cacheKey, contentBuffer, 60) // 60 minutes TTL
			logAlways(`Cached content for preset ${presetKey} (expires in 1 hour)`)
		} catch (cacheError) {
			logErrorAlways(`Error caching content for preset ${presetKey}:`, cacheError)
			// Don't fail the request if caching fails
		}

		return content
	} catch (error) {
		logErrorAlways(`Error generating preset content for ${presetKey}:`, error)
		return null
	}
}

// Extracted helper function to get preset content from database
async function getPresetContentFromDb(
	presetKey: string
): Promise<Array<{ path: string; content: string }> | null> {
	const presets = await getAllPresets()
	const preset = presets[presetKey]
	if (!preset) {
		return null
	}

	try {
		const allContent = await ContentDbService.getAllContent()

		if (allContent.length === 0) {
			return null
		}

		log(`Checking ${allContent.length} files against glob patterns for preset ${presetKey}`)
		log(`Glob patterns: ${JSON.stringify(preset.glob)}`)
		log(`Ignore patterns: ${JSON.stringify(preset.ignore || [])}`)


		const orderedResults: Array<{ path: string; content: string }> = []

		// Process one glob pattern at a time
		for (const pattern of preset.glob) {
			log(`\nProcessing glob pattern: ${pattern}`)

			const matchingFiles: Array<{ path: string; content: string }> = []

			for (const dbContent of allContent) {
				const shouldIgnore = preset.ignore?.some((ignorePattern) => {
					const matches = minimatch(dbContent.path, ignorePattern)
					if (matches) {
						log(`  File ${dbContent.path} ignored by pattern: ${ignorePattern}`)
					}
					return matches
				})
				if (shouldIgnore) continue

				if (minimatch(dbContent.path, pattern)) {
					log(`  File ${dbContent.path} matched`)

					let processedContent = dbContent.content
					if (preset.minimize && Object.keys(preset.minimize).length > 0) {
						processedContent = minimizeContent(dbContent.content, preset.minimize)
					}

					matchingFiles.push({
						path: dbContent.path,
						content: processedContent
					})
				}
			}

			const sortedFiles = sortFilesWithinGroup(matchingFiles)

			log(`  Found ${sortedFiles.length} files for pattern: ${pattern}`)
			sortedFiles.forEach((file, i) => {
				log(`    ${i + 1}. ${file.path}`)
			})

			orderedResults.push(...sortedFiles)
		}

		logAlways(
			`Found ${orderedResults.length} files matching preset ${presetKey} from database in natural glob order`
		)

		log('\nFinal file order:')
		orderedResults.forEach((file, i) => {
			log(`  ${i + 1}. ${file.path}`)
		})

		return orderedResults
	} catch (error) {
		logErrorAlways(`Failed to get preset content from database for ${presetKey}:`, error)
		return null
	}
}

export async function getPresetSizeKb(presetKey: string): Promise<number | null> {
	try {
		const content = await getPresetContent(presetKey)
		if (!content) {
			return null
		}

		const sizeKb = Math.floor(new TextEncoder().encode(content).length / 1024)
		return sizeKb
	} catch (error) {
		logErrorAlways(`Error calculating preset size for ${presetKey}:`, error)
		return null
	}
}

export async function isPresetStale(presetKey: string): Promise<boolean> {
	try {
		// Check if the repository content is stale
		return await ContentSyncService.isRepositoryContentStale()
	} catch (error) {
		logErrorAlways(`Error checking preset staleness for ${presetKey}:`, error)
		return true // On error, assume stale
	}
}

export async function presetExists(presetKey: string): Promise<boolean> {
	try {
		const presets = await getAllPresets()
		const preset = presets[presetKey]
		if (!preset) {
			return false
		}

		// A preset "exists" if it's defined in presets.ts
		// The content will be generated on-demand
		return true
	} catch (error) {
		logErrorAlways(`Error checking preset existence for ${presetKey}:`, error)
		return false
	}
}

export async function getPresetMetadata(presetKey: string): Promise<{
	size_kb: number
	document_count: number
	updated_at: Date
	is_stale: boolean
} | null> {
	try {
		const presets = await getAllPresets()
		const preset = presets[presetKey]
		if (!preset) {
			return null
		}

		// Try to get files from content table or GitHub
		const content = await getPresetContent(presetKey)
		if (!content) {
			return null
		}

		// Get the files again to count them (this will use cached data)
		const filesWithPaths = await getPresetContentFromDb(presetKey)
		const documentCount = filesWithPaths?.length || 0

		const sizeKb = Math.floor(new TextEncoder().encode(content).length / 1024)
		const isStale = await isPresetStale(presetKey)

		return {
			size_kb: sizeKb,
			document_count: documentCount,
			updated_at: new Date(), // Since it's generated on-demand, it's always "now"
			is_stale: isStale
		}
	} catch (error) {
		logErrorAlways(`Error getting preset metadata for ${presetKey}:`, error)
		return null
	}
}

/**
 * Clear the cache for a specific preset
 */
export async function clearPresetCache(presetKey: string): Promise<boolean> {
	try {
		const cache = getCacheService()
		const cacheKey = `preset:${presetKey}`
		const success = await cache.delete(cacheKey)

		if (success) {
			logAlways(`Cleared cache for preset ${presetKey}`)
		}

		return success
	} catch (error) {
		logErrorAlways(`Error clearing cache for preset ${presetKey}:`, error)
		return false
	}
}

/**
 * Clear cache for all presets
 */
export async function clearAllPresetCaches(): Promise<number> {
	try {
		const cache = getCacheService()
		const presets = await getAllPresets()
		const allPresetKeys = Object.keys(presets)
		let clearedCount = 0

		for (const presetKey of allPresetKeys) {
			const cacheKey = `preset:${presetKey}`
			const success = await cache.delete(cacheKey)
			if (success) {
				clearedCount++
			}
		}

		logAlways(`Cleared cache for ${clearedCount} presets`)
		return clearedCount
	} catch (error) {
		logErrorAlways(`Error clearing all preset caches:`, error)
		return 0
	}
}
