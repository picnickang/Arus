-- Task 241: 1:1 crew↔user link surfaced in Crew Roster (Access & Login).
-- Cloud-only (PostgreSQL). Idempotent: safe to re-run; co-exists with a dev
-- column/constraints created by hand.
--
-- Mirrors the drizzle schema in shared/schema/crew.ts:
--   userId: varchar("user_id").references(() => users.id, { onDelete: "set null" })
--   unique("uq_crew_user_id").on(userId)
-- onDelete SET NULL so deleting a user never cascade-removes the crew record;
-- the unique constraint enforces the 1:1 link.

ALTER TABLE crew ADD COLUMN IF NOT EXISTS user_id varchar;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'crew_user_id_users_id_fk'
  ) THEN
    ALTER TABLE crew
      ADD CONSTRAINT crew_user_id_users_id_fk
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'uq_crew_user_id'
  ) THEN
    ALTER TABLE crew ADD CONSTRAINT uq_crew_user_id UNIQUE (user_id);
  END IF;
END $$;

-- Best-effort one-time backfill: link existing crew to existing users by email
-- within the same org. Only unambiguous matches are linked — exactly one user
-- AND exactly one crew share that email in the org, neither side already linked.
-- Anything ambiguous is left for manual linking in the UI. Idempotent: the
-- `user_id IS NULL` filter means re-runs only touch still-unlinked crew.
UPDATE crew c
SET user_id = u.id
FROM users u
WHERE c.user_id IS NULL
  AND c.email IS NOT NULL
  AND c.email <> ''
  AND u.org_id = c.org_id
  AND lower(u.email) = lower(c.email)
  AND NOT EXISTS (SELECT 1 FROM crew linked WHERE linked.user_id = u.id)
  AND (
    SELECT count(*) FROM users um
    WHERE um.org_id = c.org_id AND lower(um.email) = lower(c.email)
  ) = 1
  AND (
    SELECT count(*) FROM crew cm
    WHERE cm.org_id = c.org_id AND lower(cm.email) = lower(c.email)
  ) = 1;
