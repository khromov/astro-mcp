-- Initialize complete database structure

-- Create simplified presets table
CREATE TABLE IF NOT EXISTS presets (
  id SERIAL PRIMARY KEY,
  preset_name VARCHAR(100) UNIQUE NOT NULL,
  content TEXT NOT NULL,
  size_kb INTEGER NOT NULL,
  document_count INTEGER DEFAULT 0,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for presets
CREATE INDEX IF NOT EXISTS idx_presets_preset_name ON presets(preset_name);
CREATE INDEX IF NOT EXISTS idx_presets_updated_at ON presets(updated_at);

-- Create distillation_jobs table (consolidated with token tracking)
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
  total_input_tokens INTEGER DEFAULT 0,
  total_output_tokens INTEGER DEFAULT 0,
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

-- Add versioning support for distilled presets

-- Create distillations table for versioned distilled content
CREATE TABLE IF NOT EXISTS distillations (
  id SERIAL PRIMARY KEY,
  preset_name VARCHAR(100) NOT NULL,
  version VARCHAR(50) NOT NULL, -- 'latest' or date like '2024-01-15'
  content TEXT NOT NULL,
  size_kb INTEGER NOT NULL,
  document_count INTEGER DEFAULT 0,
  distillation_job_id INTEGER REFERENCES distillation_jobs(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_distillations_preset_name ON distillations(preset_name);
CREATE INDEX IF NOT EXISTS idx_distillations_version ON distillations(version);
CREATE INDEX IF NOT EXISTS idx_distillations_preset_version ON distillations(preset_name, version);
CREATE INDEX IF NOT EXISTS idx_distillations_job_id ON distillations(distillation_job_id);

-- Add unique constraint for preset + version combination
CREATE UNIQUE INDEX IF NOT EXISTS idx_distillations_unique ON distillations(preset_name, version);
