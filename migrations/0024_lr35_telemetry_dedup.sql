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

-- Existing rows in equipment_telemetry may already contain duplicate
-- (org_id, equipment_id, sensor_type, ts) tuples from before the
-- application started sending ON CONFLICT DO NOTHING. Without a
-- dedup pass the CREATE UNIQUE INDEX below would fail on those
-- pre-existing dupes. Keep the lowest `id` per natural key (stable
-- + deterministic) and drop the rest. This is a one-shot cleanup
-- and is idempotent: after the unique index exists no further
-- duplicates can land.
DELETE FROM equipment_telemetry t
  USING equipment_telemetry s
 WHERE t.org_id = s.org_id
   AND t.equipment_id = s.equipment_id
   AND t.sensor_type = s.sensor_type
   AND t.ts = s.ts
   AND t.id > s.id;

CREATE UNIQUE INDEX IF NOT EXISTS uq_equipment_telemetry_natural
  ON equipment_telemetry (org_id, equipment_id, sensor_type, ts);
