import { query } from '$lib/server/db'
import type {
	DbPreset,
	DbDocument,
	DbPresetVersion,
	DbDistillationJob,
	DbDistillationResult,
	DbCacheStats,
	CreatePresetInput,
	CreateDocumentInput,
	CreatePresetVersionInput,
	CreateDistillationJobInput,
	CreateDistillationResultInput,
	PresetSummary
} from '$lib/types/db'
import { createHash } from 'crypto'
import { dev } from '$app/environment'

export class PresetDbService {
	/**
	 * Generate SHA256 hash of content
	 */
	private static generateHash(content: string): string {
		return createHash('sha256').update(content).digest('hex')
	}

	/**
	 * Sync preset configuration to database
	 */
	static async syncPreset(preset: CreatePresetInput): Promise<DbPreset> {
		// First, try to find existing preset
		const existingResult = await query('SELECT * FROM presets WHERE key = $1', [preset.key])

		if (existingResult && existingResult.rows.length > 0) {
			// Update existing preset
			const updateResult = await query(
				`UPDATE presets SET 
					title = $2,
					description = $3,
					owner = $4,
					repo = $5,
					glob = $6,
					ignore_patterns = $7,
					prompt = $8,
					minimize_options = $9,
					is_distilled = $10,
					distilled_filename_base = $11
				WHERE key = $1
				RETURNING *`,
				[
					preset.key,
					preset.title,
					preset.description || null,
					preset.owner,
					preset.repo,
					JSON.stringify(preset.glob),
					preset.ignore_patterns ? JSON.stringify(preset.ignore_patterns) : null,
					preset.prompt || null,
					preset.minimize_options ? JSON.stringify(preset.minimize_options) : null,
					preset.is_distilled || false,
					preset.distilled_filename_base || null
				]
			)

			if (dev) {
				console.log(`Updated preset ${preset.key} in database`)
			}

			return updateResult!.rows[0] as DbPreset
		} else {
			// Insert new preset
			const insertResult = await query(
				`INSERT INTO presets (
					key, title, description, owner, repo, glob, 
					ignore_patterns, prompt, minimize_options, 
					is_distilled, distilled_filename_base
				) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
				RETURNING *`,
				[
					preset.key,
					preset.title,
					preset.description || null,
					preset.owner,
					preset.repo,
					JSON.stringify(preset.glob),
					preset.ignore_patterns ? JSON.stringify(preset.ignore_patterns) : null,
					preset.prompt || null,
					preset.minimize_options ? JSON.stringify(preset.minimize_options) : null,
					preset.is_distilled || false,
					preset.distilled_filename_base || null
				]
			)

			if (dev) {
				console.log(`Created new preset ${preset.key} in database`)
			}

			return insertResult!.rows[0] as DbPreset
		}
	}

	/**
	 * Get preset by key
	 */
	static async getPresetByKey(key: string): Promise<DbPreset | null> {
		const result = await query('SELECT * FROM presets WHERE key = $1', [key])
		return result && result.rows.length > 0 ? (result.rows[0] as DbPreset) : null
	}

	/**
	 * Sync documents for a preset
	 */
	static async syncDocuments(
		presetId: number,
		documents: Array<{ path: string; content: string }>
	): Promise<void> {
		// Start a transaction
		await query('BEGIN')

		try {
			// Get existing documents
			const existingDocs = await query(
				'SELECT file_path, content_hash FROM documents WHERE preset_id = $1',
				[presetId]
			)

			const existingMap = new Map(
				existingDocs?.rows.map((row) => [row.file_path, row.content_hash]) || []
			)

			const processedPaths = new Set<string>()

			// Process each document
			for (const doc of documents) {
				const contentHash = this.generateHash(doc.content)
				const fileSizeBytes = new TextEncoder().encode(doc.content).length
				processedPaths.add(doc.path)

				const existingHash = existingMap.get(doc.path)

				if (!existingHash) {
					// Insert new document
					await query(
						`INSERT INTO documents (preset_id, file_path, content, content_hash, file_size_bytes)
						VALUES ($1, $2, $3, $4, $5)`,
						[presetId, doc.path, doc.content, contentHash, fileSizeBytes]
					)
				} else if (existingHash !== contentHash) {
					// Update existing document if content changed
					await query(
						`UPDATE documents 
						SET content = $2, content_hash = $3, file_size_bytes = $4, updated_at = CURRENT_TIMESTAMP
						WHERE preset_id = $1 AND file_path = $5`,
						[presetId, doc.content, contentHash, fileSizeBytes, doc.path]
					)
				}
			}

			// Delete documents that no longer exist
			const pathsToDelete = Array.from(existingMap.keys()).filter(
				(path) => !processedPaths.has(path)
			)

			if (pathsToDelete.length > 0) {
				await query(`DELETE FROM documents WHERE preset_id = $1 AND file_path = ANY($2)`, [
					presetId,
					pathsToDelete
				])
			}

			await query('COMMIT')

			if (dev) {
				console.log(`Synced ${documents.length} documents for preset ${presetId}`)
			}
		} catch (error) {
			await query('ROLLBACK')
			throw error
		}
	}

	/**
	 * Create or update preset version
	 */
	static async createPresetVersion(input: CreatePresetVersionInput): Promise<DbPresetVersion> {
		// First, check if this version already exists
		const existingResult = await query(
			'SELECT * FROM preset_versions WHERE preset_id = $1 AND version = $2',
			[input.preset_id, input.version]
		)

		if (existingResult && existingResult.rows.length > 0) {
			// Update existing version
			const updateResult = await query(
				`UPDATE preset_versions SET 
					content = $3,
					content_hash = $4,
					size_kb = $5,
					is_latest = $6,
					document_count = $7,
					metadata = $8,
					generated_at = $9
				WHERE preset_id = $1 AND version = $2
				RETURNING *`,
				[
					input.preset_id,
					input.version,
					input.content,
					input.content_hash,
					input.size_kb,
					input.is_latest,
					input.document_count,
					input.metadata ? JSON.stringify(input.metadata) : '{}',
					input.generated_at
				]
			)

			return updateResult!.rows[0] as DbPresetVersion
		} else {
			// Insert new version
			const insertResult = await query(
				`INSERT INTO preset_versions (
					preset_id, version, content, content_hash, size_kb, 
					is_latest, document_count, metadata, generated_at
				) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
				RETURNING *`,
				[
					input.preset_id,
					input.version,
					input.content,
					input.content_hash,
					input.size_kb,
					input.is_latest,
					input.document_count,
					input.metadata ? JSON.stringify(input.metadata) : '{}',
					input.generated_at
				]
			)

			return insertResult!.rows[0] as DbPresetVersion
		}
	}

	/**
	 * Get latest version for a preset
	 */
	static async getLatestVersion(presetId: number): Promise<DbPresetVersion | null> {
		const result = await query(
			'SELECT * FROM preset_versions WHERE preset_id = $1 AND is_latest = TRUE',
			[presetId]
		)
		return result && result.rows.length > 0 ? (result.rows[0] as DbPresetVersion) : null
	}

	/**
	 * Get all versions for a preset by preset ID
	 */
	static async getVersionsForPreset(presetId: number): Promise<DbPresetVersion[]> {
		const result = await query(
			'SELECT * FROM preset_versions WHERE preset_id = $1 ORDER BY created_at DESC',
			[presetId]
		)
		return result ? (result.rows as DbPresetVersion[]) : []
	}

	/**
	 * Get all versions for a preset by preset key
	 */
	static async getAllVersionsForPreset(presetKey: string): Promise<DbPresetVersion[]> {
		const result = await query(
			`SELECT pv.* FROM preset_versions pv
			 JOIN presets p ON p.id = pv.preset_id
			 WHERE p.key = $1
			 ORDER BY pv.created_at DESC`,
			[presetKey]
		)
		return result ? (result.rows as DbPresetVersion[]) : []
	}

	/**
	 * Get specific version for a preset by key and version
	 */
	static async getPresetVersion(presetKey: string, version: string): Promise<DbPresetVersion | null> {
		const result = await query(
			`SELECT pv.* FROM preset_versions pv
			 JOIN presets p ON p.id = pv.preset_id
			 WHERE p.key = $1 AND pv.version = $2`,
			[presetKey, version]
		)
		return result && result.rows.length > 0 ? (result.rows[0] as DbPresetVersion) : null
	}

	/**
	 * Update cache statistics
	 */
	static async updateCacheStats(
		presetId: number,
		hit: boolean,
		accessed: boolean = true
	): Promise<void> {
		// Check if stats exist
		const existing = await query('SELECT id FROM cache_stats WHERE preset_id = $1', [presetId])

		if (existing && existing.rows.length > 0) {
			// Update existing stats
			const updates = []
			const values = [presetId]
			let paramCount = 1

			if (hit) {
				updates.push(`cache_hits = cache_hits + 1`)
			} else {
				updates.push(`cache_misses = cache_misses + 1`)
			}

			if (accessed) {
				updates.push(`last_accessed_at = CURRENT_TIMESTAMP`)
			}

			await query(`UPDATE cache_stats SET ${updates.join(', ')} WHERE preset_id = $1`, values)
		} else {
			// Insert new stats
			await query(
				`INSERT INTO cache_stats (preset_id, cache_hits, cache_misses, last_accessed_at)
				VALUES ($1, $2, $3, $4)`,
				[presetId, hit ? 1 : 0, hit ? 0 : 1, accessed ? new Date() : null]
			)
		}
	}

	/**
	 * Create distillation job
	 */
	static async createDistillationJob(
		input: CreateDistillationJobInput
	): Promise<DbDistillationJob> {
		const result = await query(
			`INSERT INTO distillation_jobs (
				preset_id, batch_id, status, model_used, total_files, 
				minimize_applied, metadata, started_at
			) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
			RETURNING *`,
			[
				input.preset_id,
				input.batch_id || null,
				input.status,
				input.model_used,
				input.total_files,
				input.minimize_applied || false,
				input.metadata ? JSON.stringify(input.metadata) : '{}',
				input.status === 'processing' ? new Date() : null
			]
		)

		return result!.rows[0] as DbDistillationJob
	}

	/**
	 * Update distillation job
	 */
	static async updateDistillationJob(
		jobId: number,
		updates: Partial<DbDistillationJob>
	): Promise<DbDistillationJob> {
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

		return result!.rows[0] as DbDistillationJob
	}

	/**
	 * Create distillation result
	 */
	static async createDistillationResult(input: CreateDistillationResultInput): Promise<void> {
		await query(
			`INSERT INTO distillation_results (
				job_id, document_id, file_path, original_content, distilled_content,
				prompt_used, success, error_message, input_tokens, output_tokens
			) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
			[
				input.job_id,
				input.document_id || null,
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
	}

	/**
	 * Get preset summary
	 */
	static async getPresetSummary(presetKey: string): Promise<PresetSummary | null> {
		const result = await query('SELECT * FROM preset_summary WHERE key = $1', [presetKey])
		return result && result.rows.length > 0 ? (result.rows[0] as PresetSummary) : null
	}

	/**
	 * Get all preset summaries
	 */
	static async getAllPresetSummaries(): Promise<PresetSummary[]> {
		const result = await query('SELECT * FROM preset_summary ORDER BY key')
		return result ? (result.rows as PresetSummary[]) : []
	}
}
