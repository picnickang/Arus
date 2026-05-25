-- Reverse migration for 0019_event_outbox.sql
-- Drops the transactional outbox table and its indexes. Any in-flight
-- (pending) events in the table will be lost — operators should drain
-- the outbox (status='published') before running this down-migration
-- in production. Idempotent.

DROP INDEX IF EXISTS "idx_event_outbox_org_event";
DROP INDEX IF EXISTS "idx_event_outbox_pending";
DROP INDEX IF EXISTS "uniq_event_outbox_event_id";
DROP TABLE IF EXISTS "event_outbox";
