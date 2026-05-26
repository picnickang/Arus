-- LR-3.5 / DB-2
--
-- Add a natural composite UNIQUE on equipment_telemetry so duplicate
-- readings replayed by the offline outbox, retried by the batch
-- writer, or re-imported from CSV cannot land twice. The PK is
-- (org_id, ts, id) — `id` is a random uuid so the PK alone permits
-- duplicate (org_id, equipment_id, sensor_type, ts) tuples.
--
-- Combined with the application-level ON CONFLICT DO NOTHING change
-- in `db-telemetry.ts`, double-writes now collapse silently rather
-- than corrupting dashboards or skewing PdM training data.
--
-- NULL `idempotency_key` rows remain allowed (UNIQUE with WHERE clause
-- is already covered by the existing idempotency partial index — this
-- constraint is the additional natural-key dedup the audit called for).

CREATE UNIQUE INDEX IF NOT EXISTS uq_equipment_telemetry_natural
  ON equipment_telemetry (org_id, equipment_id, sensor_type, ts);
