-- Add content_distilled table for storing distilled/processed content
-- This table is similar to the content table but simplified for distilled content only

CREATE TABLE IF NOT EXISTS content_distilled (
  id SERIAL PRIMARY KEY,
  
  -- File information
  path TEXT NOT NULL, -- Full file path (e.g., 'apps/svelte.dev/content/docs/svelte/01-introduction/01-overview.md')
  filename VARCHAR(255) NOT NULL, -- Just the filename (e.g., '01-overview.md')
  
  -- Content
  content TEXT NOT NULL, -- The distilled file content
  
  -- Metadata
  size_bytes INTEGER NOT NULL, -- Size of the content in bytes
  metadata JSONB DEFAULT '{}'::jsonb, -- Additional metadata (frontmatter, etc.)
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  -- Unique constraint to prevent duplicate files (simplified from original)
  CONSTRAINT unique_path_distilled UNIQUE (path)
);

-- Create indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_content_distilled_path ON content_distilled(path);
CREATE INDEX IF NOT EXISTS idx_content_distilled_filename ON content_distilled(filename);
CREATE INDEX IF NOT EXISTS idx_content_distilled_updated_at ON content_distilled(updated_at);

-- Add trigger to update updated_at
DROP TRIGGER IF EXISTS update_content_distilled_updated_at ON content_distilled;
CREATE TRIGGER update_content_distilled_updated_at 
  BEFORE UPDATE ON content_distilled
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();