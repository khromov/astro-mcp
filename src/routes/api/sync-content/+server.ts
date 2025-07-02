import { json, error } from '@sveltejs/kit'
import type { RequestHandler } from './$types'
import { env } from '$env/dynamic/private'
import { ContentSyncService } from '$lib/server/contentSync'
import { logAlways, logErrorAlways } from '$lib/log'

/**
 * API endpoint to sync content from GitHub to the database
 * 
 * Usage:
 * - GET /api/sync-content?secret_key=YOUR_KEY - Sync all repositories
 * - GET /api/sync-content?secret_key=YOUR_KEY&owner=sveltejs&repo=svelte - Sync specific repository
 * - GET /api/sync-content?secret_key=YOUR_KEY&stats=true - Get content statistics
 * - GET /api/sync-content?secret_key=YOUR_KEY&cleanup=true - Clean up unused content
 */
export const GET: RequestHandler = async ({ url }) => {
	// Check secret key
	const secretKey = url.searchParams.get('secret_key')
	const envSecretKey = env.CONTENT_SYNC_SECRET_KEY || env.DISTILL_SECRET_KEY

	if (!envSecretKey) {
		throw error(500, 'Server is not configured for content sync (CONTENT_SYNC_SECRET_KEY not set)')
	}

	if (secretKey !== envSecretKey) {
		throw error(403, 'Invalid secret key')
	}

	// Check for stats request
	if (url.searchParams.has('stats')) {
		try {
			const stats = await ContentSyncService.getContentStats()
			return json({
				success: true,
				stats,
				timestamp: new Date().toISOString()
			})
		} catch (e) {
			logErrorAlways('Failed to get content stats:', e)
			throw error(500, `Failed to get stats: ${e instanceof Error ? e.message : String(e)}`)
		}
	}

	// Check for cleanup request
	if (url.searchParams.has('cleanup')) {
		try {
			const deletedCount = await ContentSyncService.cleanupUnusedContent()
			return json({
				success: true,
				message: `Cleaned up ${deletedCount} unused content items`,
				deletedCount,
				timestamp: new Date().toISOString()
			})
		} catch (e) {
			logErrorAlways('Failed to cleanup content:', e)
			throw error(500, `Failed to cleanup: ${e instanceof Error ? e.message : String(e)}`)
		}
	}

	// Check for specific repository sync
	const owner = url.searchParams.get('owner')
	const repoName = url.searchParams.get('repo')
	
	try {
		if (owner && repoName) {
			// Sync specific repository
			logAlways(`Starting sync for repository: ${owner}/${repoName}`)
			await ContentSyncService.syncRepository(owner, repoName)

			return json({
				success: true,
				message: `Successfully synced repository: ${owner}/${repoName}`,
				owner,
				repo_name: repoName,
				timestamp: new Date().toISOString()
			})
		} else if (owner || repoName) {
			// Partial parameters provided
			throw error(400, 'Both owner and repo parameters are required for specific repository sync')
		} else {
			// Sync all repositories
			logAlways('Starting sync for all repositories')
			await ContentSyncService.syncAllRepositories()

			// Get stats after sync
			const stats = await ContentSyncService.getContentStats()

			return json({
				success: true,
				message: 'Successfully synced all repositories',
				stats,
				timestamp: new Date().toISOString()
			})
		}
	} catch (e) {
		logErrorAlways('Content sync failed:', e)
		throw error(500, `Sync failed: ${e instanceof Error ? e.message : String(e)}`)
	}
}