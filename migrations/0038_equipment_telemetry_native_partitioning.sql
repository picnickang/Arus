-- ============================================================================
-- 0038 — equipment_telemetry → native monthly RANGE (ts) partitioning
-- ============================================================================
--
-- WHY
--   equipment_telemetry is the hottest, fastest-growing table in the
--   system. Native declarative partitioning (monthly on ts) keeps indexes
--   shallow, lets retention drop whole expired months as DDL instead of
--   row-deleting millions of rows, and works on every supported Postgres
--   (vanilla 16, Neon) — TimescaleDB is not available on those targets.
--
-- DESIGN
--   * Partition key `ts` is part of the PK (org_id, ts, id) and of the
--     ON CONFLICT target uq_equipment_telemetry_natural
--     (org_id, equipment_id, sensor_type, ts) — both survive partitioning
--     unchanged. Verified writers: server/db/telemetry/db-telemetry.ts
--     createTelemetryReading / createTelemetryReadingsBulk.
--   * idx_equipment_telemetry_idempotency (partial UNIQUE on
--     idempotency_key) is intentionally NOT recreated: a unique index on
--     a partitioned table must include the partition key, and no live
--     code path writes or reads equipment_telemetry.idempotency_key
--     (frame dedup rides the natural key; raw-archive payload_hash
--     covers payload replay). The column itself is kept.
--   * Monthly children equipment_telemetry_yYYYYmMM cover min(ts)..now()+3
--     months; equipment_telemetry_default (DEFAULT) is the safety net for
--     out-of-range timestamps. The daily
--     telemetry-partition-maintenance-daily job keeps 3 months of headroom.
--   * RLS (ENABLE + FORCE + tenant_isolation_equipment_telemetry) is
--     recreated to mirror 0018 — policies do not follow a rename.
--   * The old table is RETAINED as equipment_telemetry_old for instant
--     manual rollback. Drop it after a soak period:
--       DROP TABLE equipment_telemetry_old;
--
-- OPERATIONS
--   The copy is a single INSERT…SELECT inside this migration's
--   transaction. For large production tables run this via
--   `npm run db:migrate:deploy` in a maintenance window, NOT via
--   MIGRATE_ON_BOOT (a deploy health-check killing the pod mid-copy is
--   safe — transactional — but restarts the work). For very large tables
--   (≳50M rows) prefer a manual online batch-copy + name swap.
--
--   Fresh databases: `db:push` bootstraps the plain table, then this
--   ledger runs (0024 creates the natural index, 0038 rebuilds
--   partitioned, copying zero rows). Never run `db:push` interactively
--   against a migrated database and accept destructive suggestions —
--   child partitions and *_old are invisible to drizzle's diff.
--
-- Idempotent: skips when equipment_telemetry is already partitioned.
-- ============================================================================

DO $part$
DECLARE
  kind        "char";
  first_month date;
  last_month  date;
  m           date;
  part_name   text;
  idx         record;
  copied      bigint;
BEGIN
  SELECT c.relkind INTO kind
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
   WHERE n.nspname = current_schema() AND c.relname = 'equipment_telemetry';

  IF kind IS NULL THEN
    RAISE NOTICE '0038: equipment_telemetry missing — skipping (created by a later bootstrap)';
    RETURN;
  END IF;
  IF kind = 'p' THEN
    RAISE NOTICE '0038: equipment_telemetry already partitioned — skipping';
    RETURN;
  END IF;

  ------------------------------------------------------------------
  -- 1. Park the old table. Index names are schema-global and would
  --    collide with the parent's recreated ones, so rename them too
  --    (covers both the legacy shape and a fresh db:push shape).
  ------------------------------------------------------------------
  ALTER TABLE equipment_telemetry RENAME TO equipment_telemetry_old;
  FOR idx IN
    SELECT indexname FROM pg_indexes
    WHERE schemaname = current_schema() AND tablename = 'equipment_telemetry_old'
  LOOP
    EXECUTE format('ALTER INDEX %I RENAME TO %I',
                   idx.indexname, left(idx.indexname || '_old', 63));
  END LOOP;

  ------------------------------------------------------------------
  -- 2. Partitioned parent. Columns/defaults mirror
  --    shared/schema/telemetry.ts; FK constraint names mirror the
  --    drizzle snapshot so db:push sees no diff.
  ------------------------------------------------------------------
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
  ) PARTITION BY RANGE (ts);

  ------------------------------------------------------------------
  -- 3. The ON CONFLICT target, same name as 0024 so the post-apply
  --    assertCriticalObjects check and both bulk writers keep working.
  --    Created before the copy so the copy can conflict-skip dupes.
  ------------------------------------------------------------------
  CREATE UNIQUE INDEX uq_equipment_telemetry_natural
    ON equipment_telemetry (org_id, equipment_id, sensor_type, ts);

  ------------------------------------------------------------------
  -- 4. Monthly partitions covering existing data through now()+3
  --    months, plus the DEFAULT safety net.
  ------------------------------------------------------------------
  SELECT date_trunc('month', COALESCE(min(ts), now()))::date
    INTO first_month FROM equipment_telemetry_old;
  last_month := (date_trunc('month', now()) + interval '3 months')::date;

  m := first_month;
  WHILE m <= last_month LOOP
    part_name := format('equipment_telemetry_y%sm%s', to_char(m, 'YYYY'), to_char(m, 'MM'));
    EXECUTE format(
      'CREATE TABLE IF NOT EXISTS %I PARTITION OF equipment_telemetry
         FOR VALUES FROM (%L) TO (%L)',
      part_name, m, (m + interval '1 month')::date
    );
    m := (m + interval '1 month')::date;
  END LOOP;
  CREATE TABLE IF NOT EXISTS equipment_telemetry_default
    PARTITION OF equipment_telemetry DEFAULT;

  ------------------------------------------------------------------
  -- 5. Copy. Conflict-skip on the natural key tolerates duplicates the
  --    pre-0024 era may have accumulated.
  ------------------------------------------------------------------
  INSERT INTO equipment_telemetry
        (id, org_id, ts, equipment_id, sensor_type, value, unit, threshold, status, idempotency_key)
  SELECT id, org_id, ts, equipment_id, sensor_type, value, unit, threshold, status, idempotency_key
    FROM equipment_telemetry_old
  ON CONFLICT (org_id, equipment_id, sensor_type, ts) DO NOTHING;
  GET DIAGNOSTICS copied = ROW_COUNT;

  ------------------------------------------------------------------
  -- 6. Secondary indexes after the copy (the copy runs index-light).
  --    Same set the drizzle schema documents.
  ------------------------------------------------------------------
  CREATE INDEX idx_equipment_telemetry_equipment_ts
    ON equipment_telemetry (equipment_id, ts DESC);
  CREATE INDEX idx_equipment_telemetry_sensor_ts
    ON equipment_telemetry (sensor_type, ts DESC);
  CREATE INDEX idx_equipment_telemetry_status_ts
    ON equipment_telemetry (status, ts DESC);
  CREATE INDEX idx_equipment_telemetry_id
    ON equipment_telemetry (id);

  ------------------------------------------------------------------
  -- 7. RLS — mirror 0018 exactly. The parent-level policy governs all
  --    partitions; app queries always go through the parent.
  ------------------------------------------------------------------
  ALTER TABLE equipment_telemetry ENABLE ROW LEVEL SECURITY;
  ALTER TABLE equipment_telemetry FORCE ROW LEVEL SECURITY;
  CREATE POLICY tenant_isolation_equipment_telemetry ON equipment_telemetry
    USING (org_id = current_setting('app.current_org_id', true))
    WITH CHECK (org_id = current_setting('app.current_org_id', true));

  RAISE NOTICE '0038: partitioned equipment_telemetry (% rows copied, months % .. %); equipment_telemetry_old retained for rollback',
    copied, first_month, last_month;
END
$part$ LANGUAGE plpgsql;
