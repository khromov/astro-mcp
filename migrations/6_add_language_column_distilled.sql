-- Add language column to content_distilled table for consistency with content table

-- Add the language column
ALTER TABLE content_distilled ADD COLUMN IF NOT EXISTS language VARCHAR(10);

-- Create an index for efficient language queries
CREATE INDEX IF NOT EXISTS idx_content_distilled_language ON content_distilled(language);