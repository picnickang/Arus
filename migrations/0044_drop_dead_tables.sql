-- 0044 — Drop dead tables (zero writers AND zero readers, re-verified)
--
--   telemetry_rollups    — never written, never read anywhere.
--   telemetry_aggregates — never written; its only readers (the ML
--                          anomaly/failure-prediction helpers) therefore
--                          always hit their empty-result fallbacks. Those
--                          readers now aggregate equipment_telemetry
--                          hourly on the fly (same shape, same <10-row
--                          fallback), so where telemetry exists the ML
--                          baselines finally compute real numbers.
--   inventory_parts      — @deprecated ("rollback window") duplicate of
--                          parts+stock; zero runtime usage (the client
--                          identifier of the same name is an unrelated
--                          local variable).
--
-- Deliberately KEPT after usage re-verification (an earlier sweep
-- misreported these as dead):
--   idempotency_log — live dedup store for STCW imports
--                     (server/domains/stcw-rest/routes/import.ts).
--   twin_events     — live event log for digital-twin replay
--                     (server/domains/pdm-platform/digital-twin/replay/).
--   raw_telemetry   — write-less but read by the ML export endpoint
--                     (export-complete.ts); removal needs an API decision.
--   ml_models_legacy — 0040's down-migration restores FKs to it.

DROP TABLE IF EXISTS telemetry_rollups;
DROP TABLE IF EXISTS telemetry_aggregates;
DROP TABLE IF EXISTS inventory_parts;
