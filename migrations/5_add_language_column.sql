-- Add language column to content table for efficient language filtering

-- Add the language column
ALTER TABLE content ADD COLUMN IF NOT EXISTS language VARCHAR(10);

-- Create an index for efficient language queries
CREATE INDEX IF NOT EXISTS idx_content_language ON content(language);