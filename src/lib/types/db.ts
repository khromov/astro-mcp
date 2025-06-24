export interface QueryConfig {
	debug?: boolean
}

// Database table types
export interface DbPreset {
	id: number
	preset_name: string
	content: string
	content_hash: string
	size_kb: number
	document_count: number
	updated_at: Date
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

// View types
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
	preset_name: string
	duration_seconds: number | null
	successful_results: number
	failed_results: number
}

// Input types for creating/updating records
export interface CreatePresetInput {
	preset_name: string
	content: string
	content_hash: string
	size_kb: number
	document_count: number
}

export interface UpdatePresetInput {
	content: string
	content_hash: string
	size_kb: number
	document_count: number
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
