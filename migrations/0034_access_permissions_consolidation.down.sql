-- Rollback 0034 Access & Permissions consolidation.
-- Note: the super-admin bootstrap (step 3) and the admin hub_access default
-- (step 2) are data backfills and are intentionally NOT reverted here — there
-- is no safe, lossless way to know which rows were changed by this migration
-- versus by an operator afterwards. Only the new table is dropped.
DROP TABLE IF EXISTS user_dashboard_preferences;
