-- Rollback: crew document file attachment
ALTER TABLE crew_documents DROP COLUMN IF EXISTS file_path;
