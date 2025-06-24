-- Create cache_stats table to track cache performance
CREATE TABLE cache_stats (
  id SERIAL PRIMARY KEY,
  preset_id INTEGER REFERENCES presets(id) ON DELETE CASCADE,
  cache_hits INTEGER DEFAULT 0,
  cache_misses INTEGER DEFAULT 0,
  last_accessed_at TIMESTAMP,
  last_updated_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create unique index for preset_id
CREATE UNIQUE INDEX idx_cache_stats_preset_id ON cache_stats(preset_id);

-- Create view for preset summary with latest version info
CREATE OR REPLACE VIEW preset_summary AS
SELECT 
  p.id,
  p.key,
  p.title,
  p.description,
  p.is_distilled,
  pv.version AS latest_version,
  pv.size_kb AS latest_size_kb,
  pv.document_count AS latest_document_count,
  pv.generated_at AS latest_generated_at,
  cs.cache_hits,
  cs.cache_misses,
  cs.last_accessed_at,
  (SELECT COUNT(*) FROM documents WHERE preset_id = p.id) AS total_documents,
  (SELECT COUNT(*) FROM distillation_jobs WHERE preset_id = p.id) AS total_distillation_jobs
FROM presets p
LEFT JOIN preset_versions pv ON p.id = pv.preset_id AND pv.is_latest = TRUE
LEFT JOIN cache_stats cs ON p.id = cs.preset_id;

-- Create view for distillation job summary
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
  p.key AS preset_key,
  p.title AS preset_title,
  CASE 
    WHEN dj.completed_at IS NOT NULL AND dj.started_at IS NOT NULL 
    THEN EXTRACT(EPOCH FROM (dj.completed_at - dj.started_at))
    ELSE NULL 
  END AS duration_seconds,
  (SELECT COUNT(*) FROM distillation_results WHERE job_id = dj.id AND success = TRUE) AS successful_results,
  (SELECT COUNT(*) FROM distillation_results WHERE job_id = dj.id AND success = FALSE) AS failed_results
FROM distillation_jobs dj
JOIN presets p ON dj.preset_id = p.id
ORDER BY dj.created_at DESC;