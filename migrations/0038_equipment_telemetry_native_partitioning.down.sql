-- 0038 down — restore equipment_telemetry to a plain (unpartitioned) table.
--
-- Best-effort reverse: copies all rows out of the partitioned parent into
-- a plain table with the original shape (PK, natural unique index,
-- secondary indexes, RLS), then drops the partitioned tree. If the
-- pre-0038 table was retained as equipment_telemetry_old it is left
-- untouched (it may be stale; the partitioned data is authoritative).

DO $part_down$
DECLARE
  kind "char";
BEGIN
  SELECT c.relkind INTO kind
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
   WHERE n.nspname = current_schema() AND c.relname = 'equipment_telemetry';

  IF kind IS DISTINCT FROM 'p' THEN
    RAISE NOTICE '0038 down: equipment_telemetry is not partitioned — skipping';
    RETURN;
  END IF;

  ALTER TABLE equipment_telemetry RENAME TO equipment_telemetry_part;
  -- Free the schema-global index names for recreation on the plain table.
  -- The PK is index-backed, so its name (equipment_telemetry_pkey) is
  -- schema-global too and must be freed before the plain table recreates it.
  ALTER TABLE equipment_telemetry_part
    RENAME CONSTRAINT equipment_telemetry_pkey TO equipment_telemetry_part_pkey;
  ALTER INDEX uq_equipment_telemetry_natural RENAME TO uq_equipment_telemetry_natural_part;
  ALTER INDEX IF EXISTS idx_equipment_telemetry_equipment_ts RENAME TO idx_eqts_part;
  ALTER INDEX IF EXISTS idx_equipment_telemetry_sensor_ts RENAME TO idx_snts_part;
  ALTER INDEX IF EXISTS idx_equipment_telemetry_status_ts RENAME TO idx_stts_part;
  ALTER INDEX IF EXISTS idx_equipment_telemetry_id RENAME TO idx_id_part;

  CREATE TABLE equipment_telemetry (
    id              varchar   NOT NULL DEFAULT gen_random_uuid(),
    org_id          varchar   NOT NULL,
    ts              timestamp NOT NULL DEFAULT now(),
    equipment_id    varchar   NOT NULL,
    sensor_type     text      NOT NULL,
    value           real      NOT NULL,
    unit            text,
    threshold       real,
    status          text      NOT NULL DEFAULT 'normal',
    idempotency_key varchar,
    CONSTRAINT equipment_telemetry_pkey PRIMARY KEY (org_id, ts, id),
    CONSTRAINT equipment_telemetry_org_id_organizations_id_fk
      FOREIGN KEY (org_id) REFERENCES organizations(id),
    CONSTRAINT equipment_telemetry_equipment_id_equipment_id_fk
      FOREIGN KEY (equipment_id) REFERENCES equipment(id)
  );

  CREATE UNIQUE INDEX uq_equipment_telemetry_natural
    ON equipment_telemetry (org_id, equipment_id, sensor_type, ts);

  INSERT INTO equipment_telemetry
        (id, org_id, ts, equipment_id, sensor_type, value, unit, threshold, status, idempotency_key)
  SELECT id, org_id, ts, equipment_id, sensor_type, value, unit, threshold, status, idempotency_key
    FROM equipment_telemetry_part
  ON CONFLICT (org_id, equipment_id, sensor_type, ts) DO NOTHING;

  CREATE INDEX idx_equipment_telemetry_equipment_ts
    ON equipment_telemetry (equipment_id, ts DESC);
  CREATE INDEX idx_equipment_telemetry_sensor_ts
    ON equipment_telemetry (sensor_type, ts DESC);
  CREATE INDEX idx_equipment_telemetry_status_ts
    ON equipment_telemetry (status, ts DESC);
  CREATE INDEX idx_equipment_telemetry_id
    ON equipment_telemetry (id);
  CREATE UNIQUE INDEX idx_equipment_telemetry_idempotency
    ON equipment_telemetry (idempotency_key) WHERE idempotency_key IS NOT NULL;

  ALTER TABLE equipment_telemetry ENABLE ROW LEVEL SECURITY;
  ALTER TABLE equipment_telemetry FORCE ROW LEVEL SECURITY;
  CREATE POLICY tenant_isolation_equipment_telemetry ON equipment_telemetry
    USING (org_id = current_setting('app.current_org_id', true))
    WITH CHECK (org_id = current_setting('app.current_org_id', true));

  DROP TABLE equipment_telemetry_part;

  RAISE NOTICE '0038 down: equipment_telemetry restored to a plain table';
END
$part_down$ LANGUAGE plpgsql;
