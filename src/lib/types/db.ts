export interface QueryConfig {
	debug?: boolean
}

// Database table types
// Note: DbPreset type has been removed as presets are now generated on-demand from the content table

export interface DbDistillation {
	id: number
	preset_name: 'svelte-distilled' | 'sveltekit-distilled' | 'svelte-complete-distilled'
	version: string // 'latest' or '2024-01-15'
	content: string
	size_kb: number
	document_count: number
	distillation_job_id: number | null
	created_at: Date
}

export interface DbDistillationJob {
	id: number
	preset_name: string
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

export interface DbContent {
	id: number
	// Repository information
	owner: string // Repository owner (e.g., 'sveltejs')
	repo_name: string // Repository name (e.g., 'svelte')

	// File information
	path: string // Full file path
	filename: string // Just the filename

	// Content
	content: string // The actual file content

	// Metadata
	size_bytes: number // Size of the content in bytes
	is_processed: boolean // Whether content has been processed
	processed_at: Date | null // When content was processed
	metadata: Record<string, any> // Additional metadata (frontmatter, etc.)

	// Timestamps
	created_at: Date
	updated_at: Date
}

// Input types for creating/updating records
// Note: CreatePresetInput and UpdatePresetInput have been removed

export interface CreateDistillationInput {
	preset_name: 'svelte-distilled' | 'sveltekit-distilled' | 'svelte-complete-distilled'
	version: string
	content: string
	size_kb: number
	document_count: number
	distillation_job_id?: number
}

export interface CreateDistillationJobInput {
	preset_name: string
	batch_id?: string
	status: 'pending' | 'processing' | 'completed' | 'failed'
	model_used: string
	total_files: number
	minimize_applied?: boolean
	metadata?: Record<string, any>
}

export interface CreateDistillationResultInput {
	job_id: number
	file_path: string
	original_content: string
	distilled_content?: string
	prompt_used: string
	success: boolean
	error_message?: string
	input_tokens?: number
	output_tokens?: number
}

export interface CreateContentInput {
	owner: string
	repo_name: string
	path: string
	filename: string
	content: string
	size_bytes: number
	metadata?: Record<string, any>
}

export interface UpdateContentInput {
	content: string
	size_bytes: number
	is_processed?: boolean
	processed_at?: Date
	metadata?: Record<string, any>
}

export interface ContentFilter {
	owner?: string
	repo_name?: string
	is_processed?: boolean
	path_pattern?: string // For glob pattern matching
}

export interface ContentStats {
	total_files: number
	total_size_bytes: number
	by_repo: Record<string, { files: number; size_bytes: number }>
	last_updated: Date
}

// Helper type for the combined repo string
export type RepoString = `${string}/${string}` // e.g., 'sveltejs/svelte'
