-- Drop the distillation_results table as it's not used and consolidate with distillation_jobs

-- Add useful columns from distillation_results to distillation_jobs
ALTER TABLE distillation_jobs ADD COLUMN IF NOT EXISTS total_input_tokens INTEGER DEFAULT 0;
ALTER TABLE distillation_jobs ADD COLUMN IF NOT EXISTS total_output_tokens INTEGER DEFAULT 0;

-- Drop the distillation_results table
DROP TABLE IF EXISTS distillation_results CASCADE;
