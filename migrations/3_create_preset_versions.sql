-- Create preset_versions table to store different versions of preset outputs
CREATE TABLE preset_versions (
  id SERIAL PRIMARY KEY,
  preset_id INTEGER REFERENCES presets(id) ON DELETE CASCADE,
  version VARCHAR(50) NOT NULL, -- 'latest' or date like '2024-01-15'
  content TEXT NOT NULL, -- Full combined content
  content_hash VARCHAR(64) NOT NULL,
  size_kb INTEGER NOT NULL,
  is_latest BOOLEAN DEFAULT FALSE,
  document_count INTEGER DEFAULT 0, -- Number of documents in this version
  metadata JSONB DEFAULT '{}'::jsonb, -- Additional metadata
  generated_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes
CREATE INDEX idx_preset_versions_preset_id ON preset_versions(preset_id);
CREATE INDEX idx_preset_versions_version ON preset_versions(version);
CREATE INDEX idx_preset_versions_is_latest ON preset_versions(is_latest);

-- Unique constraint for preset + version
CREATE UNIQUE INDEX idx_preset_versions_unique ON preset_versions(preset_id, version);

-- Function to ensure only one latest version per preset
CREATE OR REPLACE FUNCTION ensure_single_latest_version()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_latest = TRUE THEN
    UPDATE preset_versions 
    SET is_latest = FALSE 
    WHERE preset_id = NEW.preset_id 
      AND id != NEW.id 
      AND is_latest = TRUE;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER ensure_single_latest_trigger
  AFTER INSERT OR UPDATE ON preset_versions
  FOR EACH ROW
  EXECUTE FUNCTION ensure_single_latest_version();