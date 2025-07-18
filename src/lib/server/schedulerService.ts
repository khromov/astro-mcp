import { Cron, scheduledJobs } from 'croner'
import { dev } from '$app/environment'
import { ContentSyncService } from '$lib/server/contentSync'
import { getDefaultRepository } from '$lib/presets'
import { CacheDbService } from '$lib/server/cacheDb'
import { log, logAlways, logErrorAlways } from '$lib/log'

/**
 * Background scheduler service using Croner for content sync
 */
export class SchedulerService {
	private static instance: SchedulerService | null = null
	private jobs: Map<string, Cron> = new Map()
	private isInitialized = false
	private cacheService: CacheDbService

	private constructor() {
		this.cacheService = new CacheDbService()
	}

	static getInstance(): SchedulerService {
		if (!SchedulerService.instance) {
			SchedulerService.instance = new SchedulerService()
		}
		return SchedulerService.instance
	}

	/**
	 * Clean up any orphaned jobs from Croner's global registry
	 */
	private cleanupOrphanedJobs(): void {
		if (scheduledJobs && Array.isArray(scheduledJobs)) {
			const jobNames = ['content-sync', 'cache-cleanup']
			for (let i = scheduledJobs.length - 1; i >= 0; i--) {
				const job = scheduledJobs[i]
				if (job && job.options && job.options.name && jobNames.includes(job.options.name)) {
					job.stop()
					logAlways(`Cleaned up orphaned job: ${job.options.name}`)
				}
			}
		}
	}

	/**
	 * Initialize and start all scheduled jobs
	 */
	async init(): Promise<void> {
		// Clean up any orphaned jobs from previous runs (e.g., hot module reloading)
		this.cleanupOrphanedJobs()

		if (this.isInitialized) {
			logAlways('SchedulerService already initialized, reinitializing...')
			// Stop all existing jobs before reinitializing
			await this.stop()
		}

		logAlways('Initializing SchedulerService...')

		// Content sync: update every 12 hours (at 2:00 AM and 2:00 PM)
		const contentSyncSchedule = process.env.CONTENT_SYNC_SCHEDULE || '0 2,14 * * *'

		// In development, run every 30 minutes for testing
		const devSchedule = '*/30 * * * *'

		this.scheduleContentSync(dev ? devSchedule : contentSyncSchedule)

		// Schedule cache cleanup every minute
		this.scheduleCacheCleanup()

		this.isInitialized = true
		logAlways(`SchedulerService initialized with ${this.jobs.size} jobs`)
	}

	/**
	 * Schedule content synchronization from GitHub
	 */
	private scheduleContentSync(schedule: string): void {
		// Stop existing job if it exists
		const existingJob = this.jobs.get('content-sync')
		if (existingJob) {
			existingJob.stop()
			logAlways('Stopped existing content-sync job')
		}

		const job = new Cron(
			schedule,
			{
				// Don't use name to avoid conflicts during hot module reloading
				timezone: 'UTC',
				catch: (err) => {
					logErrorAlways('Error in content sync job:', err)
				}
			},
			() => {
				this.syncContent()
			}
		)

		this.jobs.set('content-sync', job)
		logAlways(`Scheduled content sync: ${schedule}`)
	}

	/**
	 * Sync content from GitHub repository to the master content table
	 */
	private async syncContent(): Promise<void> {
		logAlways('Starting content sync job...')

		try {
			// Get the default repository
			const { owner, repo } = getDefaultRepository()

			// Check if content is stale before syncing
			const isStale = await ContentSyncService.isRepositoryContentStale(owner, repo)

			if (!isStale) {
				logAlways(`Repository ${owner}/${repo} content is fresh, skipping sync`)
				return
			}

			// Sync the repository to the master content table
			logAlways(`Syncing ${owner}/${repo} repository to master content table...`)
			await ContentSyncService.syncRepository(owner, repo)
			logAlways('Repository sync completed successfully')
		} catch (error) {
			logErrorAlways('Failed to sync content:', error)
		}

		logAlways('Content sync job completed')
	}

	/**
	 * Get status of all jobs
	 */
	getJobStatus(): Record<string, { running: boolean; nextRun: Date | null }> {
		const status: Record<string, { running: boolean; nextRun: Date | null }> = {}

		for (const [name, job] of this.jobs) {
			status[name] = {
				running: job.isRunning(),
				nextRun: job.nextRun()
			}
		}

		return status
	}

	/**
	 * Stop all jobs
	 */
	async stop(): Promise<void> {
		logAlways('Stopping SchedulerService...')

		// Stop all jobs and remove from Croner's global registry
		for (const [name, job] of this.jobs) {
			job.stop()
			logAlways(`Stopped job: ${name}`)
		}

		// Clear any remaining jobs from Croner's global scheduledJobs array
		// This handles cases where hot module reloading might leave orphaned jobs
		if (scheduledJobs && Array.isArray(scheduledJobs)) {
			const jobNames = ['content-sync', 'cache-cleanup']
			for (let i = scheduledJobs.length - 1; i >= 0; i--) {
				const job = scheduledJobs[i]
				if (job && job.options && job.options.name && jobNames.includes(job.options.name)) {
					job.stop()
					logAlways(`Removed orphaned job from global registry: ${job.options.name}`)
				}
			}
		}

		this.jobs.clear()
		this.isInitialized = false
		logAlways('SchedulerService stopped')
	}

	/**
	 * Schedule cache cleanup job
	 */
	private scheduleCacheCleanup(): void {
		// Stop existing job if it exists
		const existingJob = this.jobs.get('cache-cleanup')
		if (existingJob) {
			existingJob.stop()
			logAlways('Stopped existing cache-cleanup job')
		}

		// Run every minute
		const job = new Cron(
			'* * * * *',
			{
				// Don't use name to avoid conflicts during hot module reloading
				timezone: 'UTC',
				catch: (err) => {
					logErrorAlways('Error in cache cleanup job:', err)
				}
			},
			() => {
				this.cleanupExpiredCache()
			}
		)

		this.jobs.set('cache-cleanup', job)
		logAlways('Scheduled cache cleanup: every minute')
	}

	/**
	 * Clean up expired cache entries
	 */
	private async cleanupExpiredCache(): Promise<void> {
		log('Starting cache cleanup job...')
		try {
			const deletedCount = await this.cacheService.deleteExpired()
			if (deletedCount > 0) {
				logAlways(`Cleaned up ${deletedCount} expired cache entries`)
			}
		} catch (error) {
			logErrorAlways('Failed to clean up expired cache entries:', error)
		}
	}

	/**
	 * Trigger immediate content sync (for testing/manual triggers)
	 */
	async triggerContentSync(): Promise<void> {
		logAlways('Manually triggering content sync...')
		await this.syncContent()
	}

	/**
	 * Trigger immediate cache cleanup (for testing/manual triggers)
	 */
	async triggerCacheCleanup(): Promise<void> {
		logAlways('Manually triggering cache cleanup...')
		await this.cleanupExpiredCache()
	}
}

// Export singleton instance
export const schedulerService = SchedulerService.getInstance()
