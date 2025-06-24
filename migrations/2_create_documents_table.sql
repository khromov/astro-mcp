-- Create documents table to store individual documentation files
CREATE TABLE documents (
  id SERIAL PRIMARY KEY,
  preset_id INTEGER REFERENCES presets(id) ON DELETE CASCADE,
  file_path VARCHAR(500) NOT NULL, -- GitHub file path
  content TEXT NOT NULL, -- Raw markdown content
  content_hash VARCHAR(64) NOT NULL, -- SHA256 hash for change detection
  file_size_bytes INTEGER NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb, -- Additional metadata if needed
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for efficient queries
CREATE INDEX idx_documents_preset_id ON documents(preset_id);
CREATE INDEX idx_documents_file_path ON documents(file_path);
CREATE INDEX idx_documents_content_hash ON documents(content_hash);

-- Unique constraint to prevent duplicates
CREATE UNIQUE INDEX idx_documents_preset_file_unique ON documents(preset_id, file_path);

-- Add update trigger
CREATE TRIGGER update_documents_updated_at BEFORE UPDATE ON documents
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
