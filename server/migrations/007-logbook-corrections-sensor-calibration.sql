/**
 * Migration 007: Logbook Corrections + Sensor Calibration Registry
 *
 * Phase 1 #3: Logbook correction workflow (visible audit trail)
 * Phase 2 #5: Sensor calibration tracking registry
 *
 * LOGBOOK CORRECTIONS
 * -------------------
 * Maritime logbooks (deck, engine, radio) are legal documents.
 * Flag state regulations require:
 *   - Original entries NEVER deleted
 *   - Corrections recorded as new entries that reference the original
 *   - Reason for correction documented
 *   - Both original and correction visible to PSC officers
 *   - Correction author and timestamp immutable
 *
 * The existing logbook uses separate tables (deck_log_daily, deck_log_events,
 * engine_log_daily, engine_log_events, etc.). Rather than ALTER each table,
 * we create a unified log_entries table that stores corrections referencing
 * entries from any of the source tables, plus an immutable audit trail.
 *
 * SENSOR CALIBRATION
 * ------------------
 * Maritime sensors (vibration, temperature, pressure, flow) drift over time.
 * Calibration tracking is needed for PdM credibility — predictions from
 * an uncalibrated sensor are meaningless.
 */

-- ============================================================================
-- PART 1: Unified Log Entries + Correction Audit Trail
-- ============================================================================

CREATE TABLE IF NOT EXISTS log_entries (
  id                  VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id              VARCHAR NOT NULL,
  vessel_id           VARCHAR NOT NULL,
  log_type            TEXT NOT NULL,
  entry_date          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  watch_period        TEXT,
  data                JSONB,
  author_id           VARCHAR,
  author_name         TEXT,
  author_rank         TEXT,
  correction_of       VARCHAR REFERENCES log_entries(id),
  correction_reason   TEXT,
  is_corrected        BOOLEAN NOT NULL DEFAULT false,
  corrected_by_id     VARCHAR,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_log_entries_org_vessel
  ON log_entries (org_id, vessel_id, entry_date DESC);

CREATE INDEX IF NOT EXISTS idx_log_entries_correction_of
  ON log_entries (correction_of)
  WHERE correction_of IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_log_entries_corrected
  ON log_entries (org_id, is_corrected)
  WHERE is_corrected = true;

-- Immutable logbook audit log (append-only — no UPDATE or DELETE allowed)
CREATE TABLE IF NOT EXISTS logbook_audit_log (
  id              VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          VARCHAR NOT NULL,
  vessel_id       VARCHAR NOT NULL,
  log_entry_id    VARCHAR NOT NULL,
  action          TEXT NOT NULL,
  performed_by    VARCHAR NOT NULL,
  performed_by_name TEXT,
  performed_by_rank TEXT,
  details         JSONB,
  ip_address      TEXT,
  user_agent      TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_logbook_audit_entry
  ON logbook_audit_log (log_entry_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_logbook_audit_vessel
  ON logbook_audit_log (org_id, vessel_id, created_at DESC);

-- Prevent updates and deletes on the audit log
CREATE OR REPLACE FUNCTION prevent_audit_modification()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Logbook audit log is immutable. Updates and deletes are not permitted.';
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_prevent_audit_update ON logbook_audit_log;
CREATE TRIGGER trg_prevent_audit_update
  BEFORE UPDATE OR DELETE ON logbook_audit_log
  FOR EACH ROW
  EXECUTE FUNCTION prevent_audit_modification();

-- Prevent deletion of log entries (only correction allowed)
CREATE OR REPLACE FUNCTION prevent_log_entry_delete()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Log entries cannot be deleted. Use the correction workflow instead.';
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_prevent_log_delete ON log_entries;
CREATE TRIGGER trg_prevent_log_delete
  BEFORE DELETE ON log_entries
  FOR EACH ROW
  EXECUTE FUNCTION prevent_log_entry_delete();


-- ============================================================================
-- PART 2: Sensor Calibration Registry
-- ============================================================================

CREATE TABLE IF NOT EXISTS sensor_calibrations (
  id                  VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id              VARCHAR NOT NULL REFERENCES organizations(id),
  vessel_id           VARCHAR NOT NULL REFERENCES vessels(id),
  equipment_id        VARCHAR REFERENCES equipment(id),

  sensor_tag          TEXT NOT NULL,
  sensor_type         TEXT NOT NULL,
  sensor_location     TEXT,
  manufacturer        TEXT,
  model               TEXT,
  serial_number       TEXT,

  calibration_interval_days INTEGER NOT NULL DEFAULT 365,
  last_calibration_date     DATE,
  next_calibration_due      DATE,
  calibration_standard      TEXT,

  calibration_status        TEXT NOT NULL DEFAULT 'unknown',
  drift_percentage          REAL,
  accuracy_class            TEXT,
  reference_instrument      TEXT,

  measurement_range_min     REAL,
  measurement_range_max     REAL,
  measurement_unit          TEXT,
  alarm_low                 REAL,
  alarm_high                REAL,
  trip_low                  REAL,
  trip_high                 REAL,

  installed_date            DATE,
  decommissioned_date       DATE,
  notes                     TEXT,
  certificate_url           TEXT,

  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sensor_cal_org_vessel
  ON sensor_calibrations (org_id, vessel_id);
CREATE INDEX IF NOT EXISTS idx_sensor_cal_equipment
  ON sensor_calibrations (equipment_id)
  WHERE equipment_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_sensor_cal_due
  ON sensor_calibrations (org_id, next_calibration_due)
  WHERE calibration_status IN ('due', 'overdue');
CREATE INDEX IF NOT EXISTS idx_sensor_cal_tag
  ON sensor_calibrations (org_id, sensor_tag);

-- Calibration history (each calibration event)
CREATE TABLE IF NOT EXISTS sensor_calibration_events (
  id                  VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id              VARCHAR NOT NULL,
  calibration_id      VARCHAR NOT NULL REFERENCES sensor_calibrations(id) ON DELETE CASCADE,
  calibration_date    DATE NOT NULL,
  performed_by        TEXT,
  performed_by_rank   TEXT,

  status              TEXT NOT NULL,
  drift_before        REAL,
  drift_after         REAL,
  reference_value     REAL,
  measured_value      REAL,
  adjusted_to         REAL,

  certificate_number  TEXT,
  certificate_url     TEXT,
  notes               TEXT,
  method              TEXT,

  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sensor_cal_events
  ON sensor_calibration_events (calibration_id, calibration_date DESC);

-- Comments
COMMENT ON TABLE logbook_audit_log IS 'Immutable audit trail for all logbook operations. Cannot be updated or deleted. PSC officers reference this to verify logbook integrity.';
COMMENT ON TABLE sensor_calibrations IS 'Sensor calibration registry. Tracks calibration schedules, drift, accuracy, and operational limits for all sensors feeding telemetry data. Essential for PdM credibility.';
COMMENT ON TABLE log_entries IS 'Unified log entries table for the correction workflow. Corrections reference original entries — originals are never modified or deleted.';
COMMENT ON COLUMN log_entries.correction_of IS 'FK to original entry being corrected. NULL for original entries. Corrections are new rows that reference the original — originals are never modified.';
COMMENT ON COLUMN log_entries.is_corrected IS 'Set to true when a correction exists for this entry. The original entry remains visible alongside the correction for PSC audit.';
