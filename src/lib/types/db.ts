export interface QueryConfig {
	debug?: boolean
}

// Enum for distillable preset names
export enum DistillablePreset {
	SVELTE_DISTILLED = 'svelte-distilled',
	SVELTEKIT_DISTILLED = 'sveltekit-distilled',
	SVELTE_COMPLETE_DISTILLED = 'svelte-complete-distilled'
}

// Database table types

export interface DbDistillation {
	id: number
	preset_name: DistillablePreset
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
	total_input_tokens: number
	total_output_tokens: number
	started_at: Date | null
	completed_at: Date | null
	error_message: string | null
	metadata: Record<string, unknown> // JSONB
	created_at: Date
	updated_at: Date
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
	metadata: Record<string, unknown> // Additional metadata (frontmatter, etc.)

	// Timestamps
	created_at: Date
	updated_at: Date
}

// Input types for creating/updating records

export interface CreateDistillationInput {
	preset_name: DistillablePreset
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
	metadata?: Record<string, unknown>
}

export interface CreateContentInput {
	owner: string
	repo_name: string
	path: string
	filename: string
	content: string
	size_bytes: number
	metadata?: Record<string, unknown>
}

export interface UpdateContentInput {
	content: string
	size_bytes: number
	is_processed?: boolean
	processed_at?: Date
	metadata?: Record<string, unknown>
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
