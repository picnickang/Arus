-- Task 235: per-user supervisor assignment surfaced in Crew Management.
-- Idempotent: safe to re-run; co-exists with a dev column created by hand.
-- Soft reference (no FK) so deletes never cascade-orphan a managed user;
-- existence is validated at the application layer.
ALTER TABLE users ADD COLUMN IF NOT EXISTS supervisor_user_id varchar;
CREATE INDEX IF NOT EXISTS idx_users_supervisor_user_id ON users (supervisor_user_id);
