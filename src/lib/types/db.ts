import type { MinimizeOptions } from '$lib/fetchMarkdown'

export interface QueryConfig {
	debug?: boolean
}

// Database table types
export interface DbPreset {
	id: number
	key: string
	title: string
	description: string | null
	owner: string
	repo: string
	glob: string[] // JSONB array
	ignore_patterns: string[] | null // JSONB array
	prompt: string | null
	minimize_options: MinimizeOptions | null // JSONB
	is_distilled: boolean
	distilled_filename_base: string | null
	created_at: Date
	updated_at: Date
}

export interface DbDocument {
	id: number
	preset_id: number
	file_path: string
	content: string
	content_hash: string
	file_size_bytes: number
	metadata: Record<string, any> // JSONB
	created_at: Date
	updated_at: Date
}

export interface DbPresetVersion {
	id: number
	preset_id: number
	version: string // 'latest' or '2024-01-15'
	content: string
	content_hash: string
	size_kb: number
	is_latest: boolean
	document_count: number
	metadata: Record<string, any> // JSONB
	generated_at: Date
	created_at: Date
}

export interface DbDistillationJob {
	id: number
	preset_id: number
	batch_id: string | null
	status: 'pending' | 'processing' | 'completed' | 'failed'
	model_used: string
	total_files: number
	processed_files: number
	successful_files: number
	minimize_applied: boolean
	started_at: Date | null
	completed_at: Date | null
	error_message: string | null
	metadata: Record<string, any> // JSONB
	created_at: Date
	updated_at: Date
}

export interface DbDistillationResult {
	id: number
	job_id: number
	document_id: number | null
	file_path: string
	original_content: string
	distilled_content: string | null
	prompt_used: string
	success: boolean
	error_message: string | null
	input_tokens: number | null
	output_tokens: number | null
	created_at: Date
}

export interface DbCacheStats {
	id: number
	preset_id: number
	cache_hits: number
	cache_misses: number
	last_accessed_at: Date | null
	last_updated_at: Date | null
	created_at: Date
}

// View types
export interface PresetSummary {
	id: number
	key: string
	title: string
	description: string | null
	is_distilled: boolean
	latest_version: string | null
	latest_size_kb: number | null
	latest_document_count: number | null
	latest_generated_at: Date | null
	cache_hits: number | null
	cache_misses: number | null
	last_accessed_at: Date | null
	total_documents: number
	total_distillation_jobs: number
}

export interface DistillationJobSummary {
	id: number
	status: 'pending' | 'processing' | 'completed' | 'failed'
	model_used: string
	total_files: number
	processed_files: number
	successful_files: number
	started_at: Date | null
	completed_at: Date | null
	created_at: Date
	preset_key: string
	preset_title: string
	duration_seconds: number | null
	successful_results: number
	failed_results: number
}

// Input types for creating/updating records
export interface CreatePresetInput {
	key: string
	title: string
	description?: string
	owner: string
	repo: string
	glob: string[]
	ignore_patterns?: string[]
	prompt?: string
	minimize_options?: MinimizeOptions
	is_distilled?: boolean
	distilled_filename_base?: string
}

export interface CreateDocumentInput {
	preset_id: number
	file_path: string
	content: string
	content_hash: string
	file_size_bytes: number
	metadata?: Record<string, any>
}

export interface CreatePresetVersionInput {
	preset_id: number
	version: string
	content: string
	content_hash: string
	size_kb: number
	is_latest: boolean
	document_count: number
	metadata?: Record<string, any>
	generated_at: Date
}

export interface CreateDistillationJobInput {
	preset_id: number
	batch_id?: string
	status: 'pending' | 'processing' | 'completed' | 'failed'
	model_used: string
	total_files: number
	minimize_applied?: boolean
	metadata?: Record<string, any>
}

export interface CreateDistillationResultInput {
	job_id: number
	document_id?: number
	file_path: string
	original_content: string
	distilled_content?: string
	prompt_used: string
	success: boolean
	error_message?: string
	input_tokens?: number
	output_tokens?: number
}
