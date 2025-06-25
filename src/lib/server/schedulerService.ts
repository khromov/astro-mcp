import { Cron } from 'croner'
import { dev } from '$app/environment'
import { presets } from '$lib/presets'
import { fetchAndProcessMultiplePresetsWithDb } from '$lib/fetchMarkdown'
import { isPresetStale } from '$lib/presetCache'
import { CacheDbService } from '$lib/server/cacheDb'
import { logAlways, logErrorAlways } from '$lib/log'

/**
 * Background scheduler service using Croner for preset updates
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
	 * Initialize and start all scheduled jobs
	 */
	async init(): Promise<void> {
		if (this.isInitialized) {
			logAlways('SchedulerService already initialized')
			return
		}

		logAlways('Initializing SchedulerService...')

		// Regular presets: update every 12 hours (at 2:00 AM and 2:00 PM)
		const regularPresetSchedule = process.env.REGULAR_PRESET_SCHEDULE || '0 2,14 * * *'

		// In development, run every 30 minutes for testing
		const devSchedule = '*/30 * * * *'

		this.scheduleRegularPresetUpdates(dev ? devSchedule : regularPresetSchedule)

		// Schedule cache cleanup every minute
		this.scheduleCacheCleanup()

		this.isInitialized = true
		logAlways(`SchedulerService initialized with ${this.jobs.size} jobs`)
	}

	/**
	 * Schedule updates for regular (non-distilled) presets
	 */
	private scheduleRegularPresetUpdates(schedule: string): void {
		const job = new Cron(
			schedule,
			{
				name: 'regular-preset-updates',
				timezone: 'UTC',
				catch: (err) => {
					logErrorAlways('Error in regular preset update job:', err)
				}
			},
			() => {
				this.updateRegularPresets()
			}
		)

		this.jobs.set('regular-presets', job)
		logAlways(`Scheduled regular preset updates: ${schedule}`)
	}

	/**
	 * Update all regular presets that are stale using batch processing
	 */
	private async updateRegularPresets(): Promise<void> {
		logAlways('Starting regular preset update job...')

		// Filter regular (non-distilled) presets
		const regularPresets = Object.entries(presets)
			.filter(([_, preset]) => !preset.distilled)
			.map(([key, config]) => ({ key, config }))

		// Check which presets are stale
		const stalePresets: Array<{ key: string; config: (typeof presets)[keyof typeof presets] }> = []

		for (const { key, config } of regularPresets) {
			try {
				const isStale = await isPresetStale(key)
				if (isStale) {
					stalePresets.push({ key, config })
					logAlways(`Preset ${key} is stale and will be updated`)
				} else {
					logAlways(`Preset ${key} is still fresh, skipping`)
				}
			} catch (error) {
				logErrorAlways(`Failed to check staleness for preset ${key}:`, error)
			}
		}

		if (stalePresets.length === 0) {
			logAlways('No stale presets found, skipping update')
			return
		}

		logAlways(`Found ${stalePresets.length} stale presets to update`)

		// Process stale presets using batch processing
		try {
			const results = await fetchAndProcessMultiplePresetsWithDb(stalePresets)

			logAlways(`Successfully updated ${results.size} presets`)
			for (const [key, _] of results) {
				logAlways(`  - ${key}`)
			}
		} catch (error) {
			logErrorAlways('Failed to update presets in batch:', error)
		}

		logAlways('Regular preset update job completed')
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

		for (const [name, job] of this.jobs) {
			job.stop()
			logAlways(`Stopped job: ${name}`)
		}

		this.jobs.clear()
		this.isInitialized = false
		logAlways('SchedulerService stopped')
	}

	/**
	 * Schedule cache cleanup job
	 */
	private scheduleCacheCleanup(): void {
		// Run every minute
		const job = new Cron(
			'* * * * *',
			{
				name: 'cache-cleanup',
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
	 * Trigger immediate update of regular presets (for testing/manual triggers)
	 */
	async triggerRegularPresetUpdate(): Promise<void> {
		logAlways('Manually triggering regular preset update...')
		await this.updateRegularPresets()
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
