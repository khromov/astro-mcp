import { fetchRepositoryTarball, processMarkdownFromTarball } from '$lib/fetchMarkdown'
import { ContentDbService } from '$lib/server/contentDb'
import type { CreateContentInput } from '$lib/types/db'
import { presets } from '$lib/presets'
import { logAlways, logErrorAlways } from '$lib/log'

/**
 * Sync content from GitHub repositories to the content table
 * This can be used to populate the content table initially or update it periodically
 */
export class ContentSyncService {
	/**
	 * Sync all repositories used in presets to the content table
	 */
	static async syncAllRepositories(): Promise<void> {
		// Get unique repositories from presets
		const repositories = new Set<string>()
		
		for (const preset of Object.values(presets)) {
			repositories.add(`${preset.owner}/${preset.repo}`)
		}

		logAlways(`Found ${repositories.size} unique repositories to sync`)

		for (const repo of repositories) {
			const [owner, repoName] = repo.split('/')
			await ContentSyncService.syncRepository(owner, repoName)
		}
	}

	/**
	 * Sync a specific repository to the content table
	 */
	static async syncRepository(owner: string, repoName: string): Promise<void> {
		const repoString = ContentDbService.getRepoString(owner, repoName)
		logAlways(`Starting sync for repository: ${repoString}`)

		try {
			// Fetch the repository tarball
			const tarballBuffer = await fetchRepositoryTarball(owner, repoName)

			// Process all markdown files from the tarball
			// Using a broad glob pattern to get all markdown files
			const filesWithPaths = (await processMarkdownFromTarball(
				tarballBuffer,
				{
					owner,
					repo: repoName,
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

			// Prepare content for batch insertion
			const contentInputs: CreateContentInput[] = []

			for (const file of filesWithPaths) {
				const filename = ContentDbService.extractFilename(file.path)
				const sizeBytes = new TextEncoder().encode(file.content).length

				// Extract frontmatter metadata
				const metadata = ContentDbService.extractFrontmatter(file.content)

				// Check if content has changed
				const hasChanged = await ContentDbService.hasContentChanged(owner, repoName, file.path, file.content)

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
				}
			}

			if (contentInputs.length === 0) {
				logAlways(`No changes detected for ${repoString}`)
				return
			}

			// Batch upsert the content
			logAlways(`Upserting ${contentInputs.length} changed files for ${repoString}`)
			await ContentDbService.batchUpsertContent(contentInputs)

			// Mark all successfully synced content as processed
			for (const input of contentInputs) {
				await ContentDbService.markContentAsProcessed(owner, repoName, input.path, input.metadata)
			}

			logAlways(`Successfully synced ${contentInputs.length} files for ${repoString}`)
		} catch (error) {
			logErrorAlways(`Failed to sync repository ${repoString}:`, error)
			throw error
		}
	}

	/**
	 * Get content from the database matching preset glob patterns
	 * This replaces the Git fetching when content table is populated
	 */
	static async getPresetContentFromDb(
		presetKey: string
	): Promise<Array<{ path: string; content: string }> | null> {
		const preset = presets[presetKey]
		if (!preset) {
			return null
		}

		try {
			// Get all content for the repository
			const allContent = await ContentDbService.getContentByRepo(preset.owner, preset.repo)

			if (allContent.length === 0) {
				return null // No content in database yet
			}

			// Filter content based on glob patterns
			const { minimatch } = await import('minimatch')
			const matchedContent: Array<{ path: string; content: string }> = []

			for (const content of allContent) {
				// Check if file should be ignored
				const shouldIgnore = preset.ignore?.some((pattern) => minimatch(content.path, pattern))
				if (shouldIgnore) continue

				// Check if file matches any glob pattern
				const matches = preset.glob.some((pattern) => minimatch(content.path, pattern))
				if (matches) {
					matchedContent.push({
						path: content.path,
						content: content.content
					})
				}
			}

			logAlways(`Found ${matchedContent.length} files matching preset ${presetKey} from database`)
			return matchedContent
		} catch (error) {
			logErrorAlways(`Failed to get preset content from database for ${presetKey}:`, error)
			return null
		}
	}

	/**
	 * Get content statistics for monitoring
	 */
	static async getContentStats() {
		return ContentDbService.getContentStats()
	}

	/**
	 * Clean up old or unused content
	 */
	static async cleanupUnusedContent(): Promise<number> {
		// Get all repositories used in presets
		const usedRepos = new Set<string>()
		for (const preset of Object.values(presets)) {
			usedRepos.add(ContentDbService.getRepoString(preset.owner, preset.repo))
		}

		// Get all repositories in the database
		const stats = await ContentDbService.getContentStats()
		const dbRepos = Object.keys(stats.by_repo)

		// Find repositories not used in any preset
		const unusedRepos = dbRepos.filter(repo => !usedRepos.has(repo))

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