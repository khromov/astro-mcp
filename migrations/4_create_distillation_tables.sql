-- Create distillation_jobs table to track distillation processes
CREATE TABLE distillation_jobs (
  id SERIAL PRIMARY KEY,
  preset_id INTEGER REFERENCES presets(id) ON DELETE CASCADE,
  batch_id VARCHAR(100), -- Anthropic batch ID
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

-- Create indexes
CREATE INDEX idx_distillation_jobs_preset_id ON distillation_jobs(preset_id);
CREATE INDEX idx_distillation_jobs_status ON distillation_jobs(status);
CREATE INDEX idx_distillation_jobs_batch_id ON distillation_jobs(batch_id);

-- Add update trigger
CREATE TRIGGER update_distillation_jobs_updated_at BEFORE UPDATE ON distillation_jobs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Create distillation_results table to store individual file distillation results
CREATE TABLE distillation_results (
  id SERIAL PRIMARY KEY,
  job_id INTEGER REFERENCES distillation_jobs(id) ON DELETE CASCADE,
  document_id INTEGER REFERENCES documents(id) ON DELETE CASCADE,
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

-- Create indexes
CREATE INDEX idx_distillation_results_job_id ON distillation_results(job_id);
CREATE INDEX idx_distillation_results_document_id ON distillation_results(document_id);
CREATE INDEX idx_distillation_results_success ON distillation_results(success);