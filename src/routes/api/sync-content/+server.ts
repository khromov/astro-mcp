import { json, error } from '@sveltejs/kit'
import type { RequestHandler } from './$types'
import { env } from '$env/dynamic/private'
import { ContentSyncService } from '$lib/server/contentSync'
import { logAlways, logErrorAlways } from '$lib/log'

/**
 * API endpoint to sync content from the sveltejs/svelte.dev repository to the database
 *
 * Usage:
 * - GET /api/sync-content?secret_key=YOUR_KEY - Sync the sveltejs/svelte.dev repository
 * 
 * Note: This endpoint always performs cleanup and always returns stats in the response.
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

	try {
		logAlways('Starting content sync for sveltejs/svelte.dev repository')
		
		// Use ContentSyncService.syncRepository with cleanup and stats enabled
		const result = await ContentSyncService.syncRepository({
			performCleanup: true,
			returnStats: true
		})

		return json({
			success: true,
			message: 'Successfully synced sveltejs/svelte.dev repository',
			...result // This includes stats, sync_details, cleanup_details, and timestamp
		})
	} catch (e) {
		logErrorAlways('Content sync failed:', e)
		throw error(500, `Sync failed: ${e instanceof Error ? e.message : String(e)}`)
	}
}