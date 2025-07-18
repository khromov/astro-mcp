import type { RequestHandler } from './$types'
import { json } from '@sveltejs/kit'
import { schedulerService } from '$lib/server/schedulerService'
import { logErrorAlways } from '$lib/log'

/**
 * API endpoint to get the status of the background scheduler
 */
export const GET: RequestHandler = async ({ url }) => {
	try {
		const status = schedulerService.getJobStatus()

		return json({
			success: true,
			jobs: status,
			timestamp: new Date().toISOString()
		})
	} catch (error) {
		logErrorAlways('Error getting scheduler status:', error)
		return json(
			{
				success: false,
				error: 'Failed to get scheduler status'
			},
			{ status: 500 }
		)
	}
}
