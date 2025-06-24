import { Cron } from 'croner'
import { dev } from '$app/environment'
import { presets } from '$lib/presets'
import { fetchAndProcessMarkdownWithDb } from '$lib/fetchMarkdown'
import { isPresetStale } from '$lib/presetCache'

/**
 * Background scheduler service using Croner for preset updates
 */
export class SchedulerService {
	private static instance: SchedulerService | null = null
	private jobs: Map<string, Cron> = new Map()
	private isInitialized = false

	private constructor() {}

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
			console.log('SchedulerService already initialized')
			return
		}

		console.log('Initializing SchedulerService...')

		// Regular presets: update every 12 hours (at 2:00 AM and 2:00 PM)
		const regularPresetSchedule = process.env.REGULAR_PRESET_SCHEDULE || '0 2,14 * * *'

		// In development, run every 30 minutes for testing
		const devSchedule = '*/30 * * * *'

		this.scheduleRegularPresetUpdates(dev ? devSchedule : regularPresetSchedule)

		this.isInitialized = true
		console.log(`SchedulerService initialized with ${this.jobs.size} jobs`)
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
					console.error('Error in regular preset update job:', err)
				}
			},
			() => {
				this.updateRegularPresets()
			}
		)

		this.jobs.set('regular-presets', job)
		console.log(`Scheduled regular preset updates: ${schedule}`)
	}

	/**
	 * Update all regular presets that are stale
	 */
	private async updateRegularPresets(): Promise<void> {
		console.log('Starting regular preset update job...')

		const regularPresets = Object.entries(presets).filter(([_, preset]) => !preset.distilled)

		for (const [presetKey, preset] of regularPresets) {
			try {
				const isStale = await isPresetStale(presetKey)

				if (isStale) {
					console.log(`Updating stale preset: ${presetKey}`)
					await fetchAndProcessMarkdownWithDb(preset, presetKey)
					console.log(`Successfully updated preset: ${presetKey}`)
				} else {
					console.log(`Preset ${presetKey} is still fresh, skipping`)
				}
			} catch (error) {
				console.error(`Failed to update preset ${presetKey}:`, error)
			}
		}

		console.log('Regular preset update job completed')
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
		console.log('Stopping SchedulerService...')

		for (const [name, job] of this.jobs) {
			job.stop()
			console.log(`Stopped job: ${name}`)
		}

		this.jobs.clear()
		this.isInitialized = false
		console.log('SchedulerService stopped')
	}

	/**
	 * Trigger immediate update of regular presets (for testing/manual triggers)
	 */
	async triggerRegularPresetUpdate(): Promise<void> {
		console.log('Manually triggering regular preset update...')
		await this.updateRegularPresets()
	}
}

// Export singleton instance
export const schedulerService = SchedulerService.getInstance()
