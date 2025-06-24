-- Initialize complete database structure

-- Create migrations table first (if it doesn't exist)
CREATE TABLE IF NOT EXISTS migrations (
  id integer PRIMARY KEY,
  name varchar(100) UNIQUE NOT NULL,
  hash varchar(40) NOT NULL,
  executed_at timestamp DEFAULT current_timestamp
);

-- Create simplified presets table
CREATE TABLE IF NOT EXISTS presets (
  id SERIAL PRIMARY KEY,
  preset_name VARCHAR(100) UNIQUE NOT NULL,
  content TEXT NOT NULL,
  content_hash VARCHAR(64) NOT NULL,
  size_kb INTEGER NOT NULL,
  document_count INTEGER DEFAULT 0,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for presets
CREATE INDEX IF NOT EXISTS idx_presets_preset_name ON presets(preset_name);
CREATE INDEX IF NOT EXISTS idx_presets_updated_at ON presets(updated_at);

-- Create distillation_jobs table
CREATE TABLE IF NOT EXISTS distillation_jobs (
  id SERIAL PRIMARY KEY,
  preset_name VARCHAR(100) NOT NULL,
  batch_id VARCHAR(100),
  status VARCHAR(20) NOT NULL CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  model_used VARCHAR(100) NOT NULL,
  total_files INTEGER NOT NULL,
  processed_files INTEGER DEFAULT 0,
  successful_files INTEGER DEFAULT 0,
  minimize_applied BOOLEAN DEFAULT FALSE,
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  error_message TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for distillation_jobs
CREATE INDEX IF NOT EXISTS idx_distillation_jobs_preset_name ON distillation_jobs(preset_name);
CREATE INDEX IF NOT EXISTS idx_distillation_jobs_status ON distillation_jobs(status);
CREATE INDEX IF NOT EXISTS idx_distillation_jobs_batch_id ON distillation_jobs(batch_id);

-- Create distillation_results table
CREATE TABLE IF NOT EXISTS distillation_results (
  id SERIAL PRIMARY KEY,
  job_id INTEGER REFERENCES distillation_jobs(id) ON DELETE CASCADE,
  file_path VARCHAR(500) NOT NULL,
  original_content TEXT NOT NULL,
  distilled_content TEXT,
  prompt_used TEXT NOT NULL,
  success BOOLEAN DEFAULT FALSE,
  error_message TEXT,
  input_tokens INTEGER,
  output_tokens INTEGER,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for distillation_results
CREATE INDEX IF NOT EXISTS idx_distillation_results_job_id ON distillation_results(job_id);
CREATE INDEX IF NOT EXISTS idx_distillation_results_success ON distillation_results(success);

-- Create update trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Add update triggers
DROP TRIGGER IF EXISTS update_presets_updated_at ON presets;
CREATE TRIGGER update_presets_updated_at 
  BEFORE UPDATE ON presets
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_distillation_jobs_updated_at ON distillation_jobs;
CREATE TRIGGER update_distillation_jobs_updated_at 
  BEFORE UPDATE ON distillation_jobs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Create distillation job summary view
CREATE OR REPLACE VIEW distillation_job_summary AS
SELECT 
  dj.id,
  dj.status,
  dj.model_used,
  dj.total_files,
  dj.processed_files,
  dj.successful_files,
  dj.started_at,
  dj.completed_at,
  dj.created_at,
  dj.preset_name,
  CASE 
    WHEN dj.completed_at IS NOT NULL AND dj.started_at IS NOT NULL 
    THEN EXTRACT(EPOCH FROM (dj.completed_at - dj.started_at))
    ELSE NULL 
  END AS duration_seconds,
  (SELECT COUNT(*) FROM distillation_results WHERE job_id = dj.id AND success = TRUE) AS successful_results,
  (SELECT COUNT(*) FROM distillation_results WHERE job_id = dj.id AND success = FALSE) AS failed_results
FROM distillation_jobs dj
ORDER BY dj.created_at DESC;