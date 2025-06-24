import { query } from '$lib/server/db'
import type {
	DbPreset,
	DbDistillation,
	DbDistillationJob,
	DbDistillationResult,
	CreatePresetInput,
	UpdatePresetInput,
	CreateDistillationInput,
	CreateDistillationJobInput,
	CreateDistillationResultInput
} from '$lib/types/db'
import { createHash } from 'crypto'
import { dev } from '$app/environment'

export class PresetDbService {
	/**
	 * Generate SHA256 hash of content
	 */
	static generateHash(content: string): string {
		return createHash('sha256').update(content).digest('hex')
	}

	/**
	 * Create or update preset content
	 */
	static async upsertPreset(input: CreatePresetInput): Promise<DbPreset> {
		try {
			// First, try to find existing preset
			const existingResult = await query('SELECT * FROM presets WHERE preset_name = $1', [
				input.preset_name
			])

			if (existingResult.rows.length > 0) {
				// Update existing preset
				const updateResult = await query(
					`UPDATE presets SET 
						content = $2,
						content_hash = $3,
						size_kb = $4,
						document_count = $5,
						updated_at = CURRENT_TIMESTAMP
					WHERE preset_name = $1
					RETURNING *`,
					[
						input.preset_name,
						input.content,
						input.content_hash,
						input.size_kb,
						input.document_count
					]
				)

				if (dev) {
					console.log(`Updated preset ${input.preset_name} in database`)
				}

				return updateResult.rows[0] as DbPreset
			} else {
				// Insert new preset
				const insertResult = await query(
					`INSERT INTO presets (
						preset_name, content, content_hash, size_kb, document_count
					) VALUES ($1, $2, $3, $4, $5)
					RETURNING *`,
					[
						input.preset_name,
						input.content,
						input.content_hash,
						input.size_kb,
						input.document_count
					]
				)

				if (dev) {
					console.log(`Created new preset ${input.preset_name} in database`)
				}

				return insertResult.rows[0] as DbPreset
			}
		} catch (error) {
			console.error(`Failed to upsert preset ${input.preset_name}:`, error)
			throw new Error(
				`Failed to upsert preset: ${error instanceof Error ? error.message : String(error)}`
			)
		}
	}

	/**
	 * Get preset by name
	 */
	static async getPresetByName(presetName: string): Promise<DbPreset | null> {
		try {
			const result = await query('SELECT * FROM presets WHERE preset_name = $1', [presetName])
			return result.rows.length > 0 ? (result.rows[0] as DbPreset) : null
		} catch (error) {
			console.error(`Failed to get preset ${presetName}:`, error)
			throw new Error(
				`Failed to get preset: ${error instanceof Error ? error.message : String(error)}`
			)
		}
	}

	/**
	 * Get all presets
	 */
	static async getAllPresets(): Promise<DbPreset[]> {
		try {
			const result = await query('SELECT * FROM presets ORDER BY preset_name')
			return result.rows as DbPreset[]
		} catch (error) {
			console.error('Failed to get all presets:', error)
			throw new Error(
				`Failed to get all presets: ${error instanceof Error ? error.message : String(error)}`
			)
		}
	}

	/**
	 * Delete preset by name
	 */
	static async deletePreset(presetName: string): Promise<boolean> {
		try {
			const result = await query('DELETE FROM presets WHERE preset_name = $1', [presetName])
			return result.rowCount > 0
		} catch (error) {
			console.error(`Failed to delete preset ${presetName}:`, error)
			throw new Error(
				`Failed to delete preset: ${error instanceof Error ? error.message : String(error)}`
			)
		}
	}

	// Distillation methods

	/**
	 * Create distillation version
	 */
	static async createDistillation(input: CreateDistillationInput): Promise<DbDistillation> {
		try {
			// Check if version already exists
			const existingResult = await query(
				'SELECT * FROM distillations WHERE preset_name = $1 AND version = $2',
				[input.preset_name, input.version]
			)

			if (existingResult.rows.length > 0) {
				// Update existing version
				const updateResult = await query(
					`UPDATE distillations SET 
						content = $3,
						content_hash = $4,
						size_kb = $5,
						document_count = $6,
						distillation_job_id = $7
					WHERE preset_name = $1 AND version = $2
					RETURNING *`,
					[
						input.preset_name,
						input.version,
						input.content,
						input.content_hash,
						input.size_kb,
						input.document_count,
						input.distillation_job_id || null
					]
				)

				if (dev) {
					console.log(`Updated distillation ${input.preset_name} version ${input.version}`)
				}

				return updateResult.rows[0] as DbDistillation
			} else {
				// Insert new version
				const insertResult = await query(
					`INSERT INTO distillations (
						preset_name, version, content, content_hash, size_kb, document_count, distillation_job_id
					) VALUES ($1, $2, $3, $4, $5, $6, $7)
					RETURNING *`,
					[
						input.preset_name,
						input.version,
						input.content,
						input.content_hash,
						input.size_kb,
						input.document_count,
						input.distillation_job_id || null
					]
				)

				if (dev) {
					console.log(`Created distillation ${input.preset_name} version ${input.version}`)
				}

				return insertResult.rows[0] as DbDistillation
			}
		} catch (error) {
			console.error(`Failed to create distillation for ${input.preset_name}:`, error)
			throw new Error(
				`Failed to create distillation: ${error instanceof Error ? error.message : String(error)}`
			)
		}
	}

	/**
	 * Get distillation by preset name and version
	 */
	static async getDistillationByVersion(
		presetName: string,
		version: string
	): Promise<DbDistillation | null> {
		try {
			const result = await query(
				'SELECT * FROM distillations WHERE preset_name = $1 AND version = $2',
				[presetName, version]
			)
			return result.rows.length > 0 ? (result.rows[0] as DbDistillation) : null
		} catch (error) {
			console.error(`Failed to get distillation ${presetName} version ${version}:`, error)
			throw new Error(
				`Failed to get distillation: ${error instanceof Error ? error.message : String(error)}`
			)
		}
	}

	/**
	 * Get latest distillation for a preset
	 */
	static async getLatestDistillation(presetName: string): Promise<DbDistillation | null> {
		try {
			const result = await query(
				'SELECT * FROM distillations WHERE preset_name = $1 AND version = $2',
				[presetName, 'latest']
			)
			return result.rows.length > 0 ? (result.rows[0] as DbDistillation) : null
		} catch (error) {
			console.error(`Failed to get latest distillation for ${presetName}:`, error)
			throw new Error(
				`Failed to get latest distillation: ${error instanceof Error ? error.message : String(error)}`
			)
		}
	}

	/**
	 * Get all distillation versions for a preset
	 */
	static async getAllDistillationsForPreset(presetName: string): Promise<DbDistillation[]> {
		try {
			const result = await query(
				'SELECT * FROM distillations WHERE preset_name = $1 ORDER BY created_at DESC',
				[presetName]
			)
			return result.rows as DbDistillation[]
		} catch (error) {
			console.error(`Failed to get all distillations for ${presetName}:`, error)
			throw new Error(
				`Failed to get all distillations: ${error instanceof Error ? error.message : String(error)}`
			)
		}
	}

	/**
	 * Create distillation job
	 */
	static async createDistillationJob(
		input: CreateDistillationJobInput
	): Promise<DbDistillationJob> {
		try {
			const result = await query(
				`INSERT INTO distillation_jobs (
					preset_name, batch_id, status, model_used, total_files, 
					minimize_applied, metadata, started_at
				) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
				RETURNING *`,
				[
					input.preset_name,
					input.batch_id || null,
					input.status,
					input.model_used,
					input.total_files,
					input.minimize_applied || false,
					input.metadata ? JSON.stringify(input.metadata) : '{}',
					input.status === 'processing' ? new Date() : null
				]
			)

			return result.rows[0] as DbDistillationJob
		} catch (error) {
			console.error('Failed to create distillation job:', error)
			throw new Error(
				`Failed to create distillation job: ${error instanceof Error ? error.message : String(error)}`
			)
		}
	}

	/**
	 * Update distillation job
	 */
	static async updateDistillationJob(
		jobId: number,
		updates: Partial<DbDistillationJob>
	): Promise<DbDistillationJob> {
		try {
			const allowedFields = [
				'batch_id',
				'status',
				'processed_files',
				'successful_files',
				'completed_at',
				'error_message',
				'metadata'
			]

			const updateFields = []
			const values = []
			let paramCount = 1

			for (const [key, value] of Object.entries(updates)) {
				if (allowedFields.includes(key)) {
					updateFields.push(`${key} = $${paramCount}`)
					values.push(value)
					paramCount++
				}
			}

			values.push(jobId)

			const result = await query(
				`UPDATE distillation_jobs SET ${updateFields.join(', ')} WHERE id = $${paramCount} RETURNING *`,
				values
			)

			return result.rows[0] as DbDistillationJob
		} catch (error) {
			console.error(`Failed to update distillation job ${jobId}:`, error)
			throw new Error(
				`Failed to update distillation job: ${error instanceof Error ? error.message : String(error)}`
			)
		}
	}

	/**
	 * Create distillation result
	 */
	static async createDistillationResult(input: CreateDistillationResultInput): Promise<void> {
		try {
			await query(
				`INSERT INTO distillation_results (
					job_id, file_path, original_content, distilled_content,
					prompt_used, success, error_message, input_tokens, output_tokens
				) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
				[
					input.job_id,
					input.file_path,
					input.original_content,
					input.distilled_content || null,
					input.prompt_used,
					input.success,
					input.error_message || null,
					input.input_tokens || null,
					input.output_tokens || null
				]
			)
		} catch (error) {
			console.error('Failed to create distillation result:', error)
			throw new Error(
				`Failed to create distillation result: ${error instanceof Error ? error.message : String(error)}`
			)
		}
	}

	/**
	 * Get distillation jobs for a preset
	 */
	static async getDistillationJobsForPreset(presetName: string): Promise<DbDistillationJob[]> {
		try {
			const result = await query(
				'SELECT * FROM distillation_jobs WHERE preset_name = $1 ORDER BY created_at DESC',
				[presetName]
			)
			return result.rows as DbDistillationJob[]
		} catch (error) {
			console.error(`Failed to get distillation jobs for ${presetName}:`, error)
			throw new Error(
				`Failed to get distillation jobs: ${error instanceof Error ? error.message : String(error)}`
			)
		}
	}
}
