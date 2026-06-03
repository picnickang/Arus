-- Crew document file attachment
--
-- Adds a nullable file_path column to crew_documents so an uploaded scan of
-- the document (PDF / photo) can be stored as a normalized /objects/... object
-- storage path, mirroring the crew.photo_path pattern. Idempotent.

ALTER TABLE crew_documents ADD COLUMN IF NOT EXISTS file_path varchar(1024);
