import {
	fetchRepositoryTarball,
	processMarkdownFromTarball,
	minimizeContent
} from '$lib/fetchMarkdown'
import { ContentDbService } from '$lib/server/contentDb'
import type { CreateContentInput } from '$lib/types/db'
import { presets, DEFAULT_REPOSITORY } from '$lib/presets'
import { logAlways, logErrorAlways, log } from '$lib/log'

/**
 * Sort files within a group using the same logic as the original sortFilesWithinGroup
 */
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

export class ContentSyncService {
	// Maximum age of content in milliseconds (24 hours)
	static readonly MAX_CONTENT_AGE_MS = 24 * 60 * 60 * 1000

	/**
	 * Sync the sveltejs/svelte.dev repository to the content table
	 * Handles deletions properly to maintain data consistency
	 */
	static async syncRepository(
		options: {
			performCleanup?: boolean
			returnStats?: boolean
		} = {}
	): Promise<{
		success: boolean
		stats: {
			total_files: number
			total_size_bytes: number
			by_repo: Record<string, { files: number; size_bytes: number }>
			last_updated: Date
		}
		sync_details: {
			owner: string
			repo_name: string
			upserted_files: number
			deleted_files: number
			unchanged_files: number
		}
		cleanup_details: {
			deleted_count: number
		}
		timestamp: string
	}> {
		const { performCleanup = true, returnStats = true } = options
		const { owner, repo: repoName } = DEFAULT_REPOSITORY
		const repoString = ContentDbService.getRepoString(owner, repoName)

		logAlways(`Starting sync for repository: ${repoString}`)

		let upsertedFiles = 0
		let deletedFiles = 0
		let unchangedFiles = 0
		let cleanupDeletedCount = 0

		try {
			logAlways(`Step 1: Syncing repository ${repoString}`)

			const tarballBuffer = await fetchRepositoryTarball(owner, repoName)

			const filesWithPaths = (await processMarkdownFromTarball(
				tarballBuffer,
				{
					glob: ['**/*.md', '**/*.mdx'],
					ignore: [],
					title: `Sync ${repoString}`,
					distilled: false
				},
				true
			)) as Array<{
				path: string
				content: string
			}>

			logAlways(`Found ${filesWithPaths.length} markdown files in ${repoString}`)

			const existingFiles = await ContentDbService.getContentByRepo(owner, repoName)
			const existingPaths = new Set(existingFiles.map((file) => file.path))

			const foundPaths = new Set(filesWithPaths.map((file) => file.path))

			const contentInputs: CreateContentInput[] = []

			for (const file of filesWithPaths) {
				const filename = ContentDbService.extractFilename(file.path)
				const sizeBytes = new TextEncoder().encode(file.content).length

				const metadata = ContentDbService.extractFrontmatter(file.content)

				const hasChanged = await ContentDbService.hasContentChanged(
					owner,
					repoName,
					file.path,
					file.content
				)

				if (hasChanged) {
					contentInputs.push({
						owner,
						repo_name: repoName,
						path: file.path,
						filename,
						content: file.content,
						size_bytes: sizeBytes,
						metadata
					})
				} else {
					unchangedFiles++
				}
			}

			if (contentInputs.length > 0) {
				logAlways(`Upserting ${contentInputs.length} changed files for ${repoString}`)
				await ContentDbService.batchUpsertContent(contentInputs)

				for (const input of contentInputs) {
					await ContentDbService.markContentAsProcessed(owner, repoName, input.path, input.metadata)
				}
				upsertedFiles = contentInputs.length
			} else {
				logAlways(`No file content changes detected for ${repoString}`)
			}

			// Handle deletions - find files in DB that are no longer in the repository
			const deletedPaths = Array.from(existingPaths).filter((path) => !foundPaths.has(path))

			if (deletedPaths.length > 0) {
				logAlways(`Deleting ${deletedPaths.length} files that no longer exist in ${repoString}`)

				for (const deletedPath of deletedPaths) {
					logAlways(`  Deleting: ${deletedPath}`)
					await ContentDbService.deleteContent(owner, repoName, deletedPath)
				}
				deletedFiles = deletedPaths.length
			} else {
				logAlways(`No deleted files detected for ${repoString}`)
			}

			if (performCleanup) {
				logAlways(`Step 2: Performing cleanup of unused content`)
				cleanupDeletedCount = await ContentSyncService.cleanupUnusedContent()
			} else {
				logAlways(`Step 2: Skipping cleanup (performCleanup = false)`)
			}

			let stats
			if (returnStats) {
				logAlways(`Step 3: Collecting final statistics`)
				stats = await ContentSyncService.getContentStats()
			} else {
				logAlways(`Step 3: Skipping stats collection (returnStats = false)`)
				// Return minimal stats structure
				stats = {
					total_files: 0,
					total_size_bytes: 0,
					by_repo: {},
					last_updated: new Date()
				}
			}

			logAlways(
				`Sync completed successfully: ${upsertedFiles} upserted, ${deletedFiles} deleted, ${unchangedFiles} unchanged${performCleanup ? `, ${cleanupDeletedCount} cleaned up` : ''}`
			)

			return {
				success: true,
				stats,
				sync_details: {
					owner,
					repo_name: repoName,
					upserted_files: upsertedFiles,
					deleted_files: deletedFiles,
					unchanged_files: unchangedFiles
				},
				cleanup_details: {
					deleted_count: cleanupDeletedCount
				},
				timestamp: new Date().toISOString()
			}
		} catch (error) {
			logErrorAlways(`Failed to sync repository ${repoString}:`, error)
			throw error
		}
	}

	static async isRepositoryContentStale(): Promise<boolean> {
		try {
			const { owner, repo: repoName } = DEFAULT_REPOSITORY
			const stats = await ContentDbService.getContentStats()
			const repoKey = ContentDbService.getRepoString(owner, repoName)

			if (!stats.by_repo[repoKey]) {
				return true // No content for this repo, consider stale
			}

			const lastUpdated = new Date(stats.last_updated)
			const contentAge = Date.now() - lastUpdated.getTime()

			const isStale = contentAge > ContentSyncService.MAX_CONTENT_AGE_MS

			if (isStale) {
				logAlways(
					`Repository ${repoKey} content is stale (age: ${Math.floor(contentAge / 1000 / 60)} minutes)`
				)
			}

			return isStale
		} catch (error) {
			const { owner, repo: repoName } = DEFAULT_REPOSITORY
			logErrorAlways(`Error checking repository staleness for ${owner}/${repoName}:`, error)
			return true // On error, assume stale
		}
	}

	/**
	 * Get content from the database matching preset glob patterns
	 * This replaces the Git fetching when content table is populated
	 * FIXED: Now processes one glob pattern at a time to maintain natural order
	 * AND applies proper sorting within each glob group
	 */
	static async getPresetContentFromDb(
		presetKey: string
	): Promise<Array<{ path: string; content: string }> | null> {
		const preset = presets[presetKey]
		if (!preset) {
			return null
		}

		try {
			const { owner, repo } = DEFAULT_REPOSITORY

			const allContent = await ContentDbService.getContentByRepo(owner, repo)

			if (allContent.length === 0) {
				return null
			}

			log(`Checking ${allContent.length} files against glob patterns for preset ${presetKey}`)
			log(`Glob patterns: ${JSON.stringify(preset.glob)}`)
			log(`Ignore patterns: ${JSON.stringify(preset.ignore || [])}`)

			const { minimatch } = await import('minimatch')

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

	static async getContentStats() {
		return ContentDbService.getContentStats()
	}

	/**
	 * Clean up old or unused content
	 * Since we now use only one repository, this won't do much
	 */
	static async cleanupUnusedContent(): Promise<number> {
		const { owner, repo } = DEFAULT_REPOSITORY
		const defaultRepoString = ContentDbService.getRepoString(owner, repo)

		const stats = await ContentDbService.getContentStats()
		const dbRepos = Object.keys(stats.by_repo)

		// Find repositories that aren't the default repository
		const unusedRepos = dbRepos.filter((repo) => repo !== defaultRepoString)

		let deletedCount = 0
		for (const repo of unusedRepos) {
			const { owner, repo_name } = ContentDbService.splitRepoString(repo as `${string}/${string}`)
			const count = await ContentDbService.deleteRepoContent(owner, repo_name)
			deletedCount += count
			logAlways(`Deleted ${count} files from unused repository: ${repo}`)
		}

		return deletedCount
	}
}
