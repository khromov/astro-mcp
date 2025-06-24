-- Create presets table to store all preset configurations
CREATE TABLE presets (
  id SERIAL PRIMARY KEY,
  key VARCHAR(100) UNIQUE NOT NULL, -- e.g., 'svelte-complete-distilled'
  title VARCHAR(255) NOT NULL,
  description TEXT,
  owner VARCHAR(100) NOT NULL, -- GitHub owner
  repo VARCHAR(100) NOT NULL, -- GitHub repo
  glob JSONB NOT NULL DEFAULT '[]'::jsonb, -- Array of glob patterns
  ignore_patterns JSONB DEFAULT '[]'::jsonb, -- Array of ignore patterns
  prompt TEXT,
  minimize_options JSONB, -- Minimization configuration
  is_distilled BOOLEAN DEFAULT FALSE,
  distilled_filename_base VARCHAR(100),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create index for faster lookups
CREATE INDEX idx_presets_key ON presets(key);
CREATE INDEX idx_presets_is_distilled ON presets(is_distilled);

-- Add trigger to update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_presets_updated_at BEFORE UPDATE ON presets
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();