-- Drop the presets table as content is now generated on-demand from the content table
DROP TABLE IF EXISTS presets CASCADE;

-- Also drop the trigger that was associated with the presets table
DROP TRIGGER IF EXISTS update_presets_updated_at ON presets;
