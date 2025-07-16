import { ContentSyncService } from '$lib/server/contentSync'
import { presets, getDefaultRepository } from '$lib/presets'
import { fetchRepositoryTarball, processMarkdownFromTarball } from '$lib/fetchMarkdown'
import { log, logAlways, logErrorAlways } from '$lib/log'

// Maximum age of cached content in milliseconds (24 hours)
export const MAX_CACHE_AGE_MS = 24 * 60 * 60 * 1000

function sortFilesWithinGroup(files: string[]): string[] {
	return files.sort((a, b) => {
		const aPath = a.split('\n')[0].replace('## ', '')
		const bPath = b.split('\n')[0].replace('## ', '')

		// Check if one path is a parent of the other
		if (bPath.startsWith(aPath.replace('/index.md', '/'))) return -1
		if (aPath.startsWith(bPath.replace('/index.md', '/'))) return 1

		// If not parent/child relationship, sort by path
		return aPath.localeCompare(bPath)
	})
}

/**
 * Get preset content generated on-demand from the content table
 * Falls back to GitHub fetch if content table is empty
 */
export async function getPresetContent(presetKey: string): Promise<string | null> {
	try {
		const preset = presets[presetKey]
		if (!preset) {
			log(`Preset not found: ${presetKey}`)
			return null
		}

		// Try to get files from the content table first
		let filesWithPaths = await ContentSyncService.getPresetContentFromDb(presetKey)
		
		// If no content in database, fetch from GitHub and sync
		if (!filesWithPaths || filesWithPaths.length === 0) {
			logAlways(`No content in database for preset ${presetKey}, fetching from GitHub...`)
			
			// Sync the repository first
			const { owner, repo } = getDefaultRepository()
			await ContentSyncService.syncRepository(owner, repo)
			
			// Try again from database
			filesWithPaths = await ContentSyncService.getPresetContentFromDb(presetKey)
			
			if (!filesWithPaths || filesWithPaths.length === 0) {
				log(`Still no content found for preset: ${presetKey} after sync`)
				return null
			}
		}

		// Format files with headers
		const files = filesWithPaths.map((f) => `## ${f.path}\n\n${f.content}`)
		
		// Sort files
		const sortedFiles = sortFilesWithinGroup(files)
		const content = sortedFiles.join('\n\n')

		logAlways(`Generated content for ${presetKey} on-demand (${filesWithPaths.length} files)`)

		return content
	} catch (error) {
		logErrorAlways(`Error generating preset content for ${presetKey}:`, error)
		return null
	}
}

/**
 * Get content size in KB calculated on-demand
 */
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

/**
 * Check if preset content is stale based on repository content staleness
 */
export async function isPresetStale(presetKey: string): Promise<boolean> {
	try {
		// Check if the repository content is stale
		const { owner, repo } = getDefaultRepository()
		return await ContentSyncService.isRepositoryContentStale(owner, repo)
	} catch (error) {
		logErrorAlways(`Error checking preset staleness for ${presetKey}:`, error)
		return true // On error, assume stale
	}
}

/**
 * Check if preset exists (has matching content in database)
 */
export async function presetExists(presetKey: string): Promise<boolean> {
	try {
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

/**
 * Get preset metadata calculated on-demand
 */
export async function getPresetMetadata(presetKey: string): Promise<{
	size_kb: number
	document_count: number
	updated_at: Date
	is_stale: boolean
} | null> {
	try {
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
		const filesWithPaths = await ContentSyncService.getPresetContentFromDb(presetKey)
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
