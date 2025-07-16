import { fetchRepositoryTarball, processMarkdownFromTarball } from '$lib/fetchMarkdown'
import { ContentDbService } from '$lib/server/contentDb'
import type { CreateContentInput } from '$lib/types/db'
import { presets, getDefaultRepository } from '$lib/presets'
import { logAlways, logErrorAlways } from '$lib/log'

/**
 * Sync content from GitHub repositories to the content table
 * This can be used to populate the content table initially or update it periodically
 */
export class ContentSyncService {
	/**
	 * Sync all repositories used in presets to the content table
	 * Since we now use only one repository, this will sync sveltejs/svelte.dev
	 */
	static async syncAllRepositories(): Promise<void> {
		// We now use a single repository for all content
		const { owner, repo } = getDefaultRepository()
		
		logAlways(`Syncing repository: ${owner}/${repo}`)
		await ContentSyncService.syncRepository(owner, repo)
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
			// Use the default repository since we're standardizing on sveltejs/svelte.dev
			const { owner, repo } = getDefaultRepository()
			
			// Get all content for the repository
			const allContent = await ContentDbService.getContentByRepo(owner, repo)

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
	 * Since we now use only one repository, this won't do much
	 */
	static async cleanupUnusedContent(): Promise<number> {
		// Get the default repository
		const { owner, repo } = getDefaultRepository()
		const defaultRepoString = ContentDbService.getRepoString(owner, repo)

		// Get all repositories in the database
		const stats = await ContentDbService.getContentStats()
		const dbRepos = Object.keys(stats.by_repo)

		// Find repositories that aren't the default repository
		const unusedRepos = dbRepos.filter(repo => repo !== defaultRepoString)

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
