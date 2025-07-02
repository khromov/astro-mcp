CREATE TABLE IF NOT EXISTS content (
  id SERIAL PRIMARY KEY,
  
  -- Repository information
  owner VARCHAR(100) NOT NULL, -- Repository owner (e.g., 'sveltejs')
  repo_name VARCHAR(100) NOT NULL, -- Repository name (e.g., 'svelte')
  
  -- File information
  path TEXT NOT NULL, -- Full file path (e.g., 'apps/svelte.dev/content/docs/svelte/01-introduction/01-overview.md')
  filename VARCHAR(255) NOT NULL, -- Just the filename (e.g., '01-overview.md')
  
  -- Content
  content TEXT NOT NULL, -- The actual file content
  
  -- Metadata
  size_bytes INTEGER NOT NULL, -- Size of the content in bytes
  is_processed BOOLEAN DEFAULT FALSE, -- Whether this content has been processed
  processed_at TIMESTAMP, -- When the content was processed
  metadata JSONB DEFAULT '{}'::jsonb, -- Additional metadata (frontmatter, etc.)
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  -- Unique constraint to prevent duplicate files
  CONSTRAINT unique_owner_repo_path UNIQUE (owner, repo_name, path)
);

-- Create indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_content_owner ON content(owner);
CREATE INDEX IF NOT EXISTS idx_content_repo_name ON content(repo_name);
CREATE INDEX IF NOT EXISTS idx_content_owner_repo ON content(owner, repo_name);
CREATE INDEX IF NOT EXISTS idx_content_path ON content(path);
CREATE INDEX IF NOT EXISTS idx_content_filename ON content(filename);
CREATE INDEX IF NOT EXISTS idx_content_is_processed ON content(is_processed);
CREATE INDEX IF NOT EXISTS idx_content_updated_at ON content(updated_at);

-- Add trigger to update updated_at
DROP TRIGGER IF EXISTS update_content_updated_at ON content;
CREATE TRIGGER update_content_updated_at 
  BEFORE UPDATE ON content
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();