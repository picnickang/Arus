-- 0026 crew profile photo
-- Adds a nullable object-storage path for crew member profile photos.
-- The value is a normalized `/objects/...` entity path, written only by
-- the dedicated POST/DELETE /api/crew/:id/photo routes (never by the
-- generic crew CRUD endpoints).
ALTER TABLE crew ADD COLUMN IF NOT EXISTS photo_path text;
