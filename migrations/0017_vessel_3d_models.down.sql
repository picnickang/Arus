-- Reverse migration for 0017_vessel_3d_models.sql
-- Drops the per-vessel 3D-model asset registry. The application-owned
-- filesystem objects pointed to by `stored_path` are NOT touched —
-- the operator must clean those up separately if required.
-- Idempotent.

DROP INDEX IF EXISTS "idx_vessel_3d_models_vessel";
DROP INDEX IF EXISTS "idx_vessel_3d_models_org";
DROP TABLE IF EXISTS "vessel_3d_models";
