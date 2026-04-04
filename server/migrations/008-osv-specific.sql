/**
 * Migration 008: OSV-Specific Gap Fills for ARUS Sdn Bhd
 *
 * Transforms ARUS from "generic maritime platform" to
 * "offshore supply vessel AI analytics for Brunei O&G operations."
 *
 * Tables created:
 *   1. dp_systems         — DP class, thrusters, reference systems, redundancy
 *   2. dp_incidents       — DP events & incidents (IMCA reporting format)
 *   3. dp_daily_checks    — DP pre-operations checklist
 *   4. charter_parties    — Active charters with KPI targets
 *   5. charter_kpi_logs   — Daily/weekly KPI snapshots (availability, response, fuel)
 *   6. vetting_inspections — OVID/SIRE/CDI inspections
 *   7. vetting_findings   — Individual findings with remediation tracking
 *   8. offshore_operations — Cargo ops, SPM ops, DP watchkeeping logs
 *   9. efms_connections    — EFMS device configuration per vessel
 *
 * Also adds to existing tables:
 *   - vessels: dp_class, vetting_status, charter_status columns
 *   - vessel_certificates: amod_specific flag for Brunei requirements
 */

-- ============================================================================
-- 1. DYNAMIC POSITIONING (DP) SYSTEM TRACKING
-- ============================================================================

CREATE TABLE IF NOT EXISTS dp_systems (
  id              VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          VARCHAR NOT NULL REFERENCES organizations(id),
  vessel_id       VARCHAR NOT NULL REFERENCES vessels(id),

  dp_class        TEXT NOT NULL,
  -- 'DP1', 'DP2', 'DP3' (IMO classes) or 'DYNPOS-AUTR', 'DYNPOS-AUTRO' etc. (class notation)

  dp_controller_make   TEXT,
  dp_controller_model  TEXT,
  dp_software_version  TEXT,

  -- Thrusters configuration
  thrusters       JSONB DEFAULT '[]',
  -- Array of: { id, type: 'main'|'bow'|'stern'|'azimuth'|'retractable',
  --             make, model, powerKw, status: 'operational'|'degraded'|'failed' }

  -- Reference systems
  reference_systems JSONB DEFAULT '[]',
  -- Array of: { id, type: 'dgps'|'hpr'|'taut_wire'|'artemis'|'fanbeam'|'radar',
  --             make, model, status: 'active'|'standby'|'failed' }

  -- Power systems for redundancy
  power_config    JSONB,
  -- { generators: [{id, make, powerKw, bus}], busConfig: 'split'|'closed',
  --   worstCaseFailure: 'single_generator'|'bus_tie_breaker'|'thruster' }

  -- Last annual DP trial
  last_dp_trial_date    DATE,
  next_dp_trial_due     DATE,
  dp_fmea_date          DATE,
  -- FMEA: Failure Mode & Effects Analysis — required for DP2/DP3

  -- Current status
  dp_status       TEXT NOT NULL DEFAULT 'operational',
  -- 'operational', 'degraded', 'inoperable', 'maintenance'

  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dp_systems_vessel
  ON dp_systems (org_id, vessel_id);

-- DP incidents (IMCA M 182 format)
CREATE TABLE IF NOT EXISTS dp_incidents (
  id              VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          VARCHAR NOT NULL REFERENCES organizations(id),
  vessel_id       VARCHAR NOT NULL REFERENCES vessels(id),
  dp_system_id    VARCHAR REFERENCES dp_systems(id),

  incident_date   TIMESTAMPTZ NOT NULL,
  incident_type   TEXT NOT NULL,
  -- 'position_loss', 'heading_loss', 'drive_off', 'drift_off',
  -- 'near_miss', 'equipment_failure', 'reference_loss', 'power_failure'
  severity        TEXT NOT NULL DEFAULT 'minor',
  -- 'critical', 'major', 'minor', 'observation'

  -- IMCA fields
  water_depth_m       REAL,
  weather_conditions  TEXT,
  wind_speed_kts      REAL,
  wave_height_m       REAL,
  current_kts         REAL,
  operation_type      TEXT,
  -- 'anchor_handling', 'supply', 'standby', 'construction_support', 'dive_support'

  description         TEXT NOT NULL,
  root_cause          TEXT,
  corrective_action   TEXT,
  reported_to_client  BOOLEAN DEFAULT false,
  reported_to_imca    BOOLEAN DEFAULT false,

  -- Position data at time of incident
  latitude            REAL,
  longitude           REAL,
  excursion_m         REAL,
  -- How far vessel moved from intended position

  reported_by         VARCHAR,
  closed_by           VARCHAR,
  closed_date         DATE,
  status              TEXT NOT NULL DEFAULT 'open',
  -- 'open', 'investigating', 'closed'

  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dp_incidents_vessel
  ON dp_incidents (org_id, vessel_id, incident_date DESC);

-- DP daily pre-operations checklist
CREATE TABLE IF NOT EXISTS dp_daily_checks (
  id              VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          VARCHAR NOT NULL REFERENCES organizations(id),
  vessel_id       VARCHAR NOT NULL REFERENCES vessels(id),
  check_date      DATE NOT NULL,
  watch_period    TEXT,
  -- 'morning', 'afternoon', 'night'

  -- Standard DP checks
  checklist       JSONB NOT NULL,
  -- Array of: { item, category: 'power'|'thrusters'|'references'|'sensors'|'comms',
  --             status: 'pass'|'fail'|'na', notes }

  overall_status  TEXT NOT NULL,
  -- 'ready', 'degraded', 'not_ready'
  dpo_name        TEXT NOT NULL,
  dpo_rank        TEXT,
  master_countersigned BOOLEAN DEFAULT false,
  master_name     TEXT,

  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_dp_checks_unique
  ON dp_daily_checks (org_id, vessel_id, check_date, watch_period);


-- ============================================================================
-- 2. CHARTER PARTY COMPLIANCE TRACKING
-- ============================================================================

CREATE TABLE IF NOT EXISTS charter_parties (
  id              VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          VARCHAR NOT NULL REFERENCES organizations(id),
  vessel_id       VARCHAR NOT NULL REFERENCES vessels(id),

  -- Charter identity
  charter_ref     TEXT NOT NULL,
  charterer_name  TEXT NOT NULL,
  -- e.g., 'Brunei Shell Petroleum', 'JISCO', 'Petro Laut'
  charter_type    TEXT NOT NULL DEFAULT 'time_charter',
  -- 'time_charter', 'voyage_charter', 'bareboat', 'spot'

  -- Period
  commencement_date DATE NOT NULL,
  expiry_date       DATE,
  -- Null for open-ended / rolling charters

  -- Financial
  daily_rate        REAL,
  currency          TEXT DEFAULT 'USD',
  fuel_account      TEXT DEFAULT 'charterer',
  -- 'owner', 'charterer'

  -- KPI targets (contractual)
  target_availability_pct   REAL DEFAULT 95.0,
  -- Minimum vessel availability percentage
  target_response_hours     REAL,
  -- Maximum callout response time in hours
  target_fuel_consumption   REAL,
  -- Maximum daily fuel consumption (MT/day) at cruising speed
  target_dp_uptime_pct      REAL DEFAULT 99.0,
  -- Minimum DP system availability for DP-class charters

  -- Status
  status          TEXT NOT NULL DEFAULT 'active',
  -- 'draft', 'active', 'suspended', 'completed', 'terminated'

  -- Documents
  contract_url    TEXT,
  notes           TEXT,

  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_charter_vessel
  ON charter_parties (org_id, vessel_id, status);
CREATE INDEX IF NOT EXISTS idx_charter_charterer
  ON charter_parties (org_id, charterer_name);

-- Charter KPI snapshots (daily/weekly actuals vs targets)
CREATE TABLE IF NOT EXISTS charter_kpi_logs (
  id              VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          VARCHAR NOT NULL REFERENCES organizations(id),
  vessel_id       VARCHAR NOT NULL REFERENCES vessels(id),
  charter_id      VARCHAR NOT NULL REFERENCES charter_parties(id),

  period_start    DATE NOT NULL,
  period_end      DATE NOT NULL,
  period_type     TEXT NOT NULL DEFAULT 'daily',
  -- 'daily', 'weekly', 'monthly'

  -- Actuals
  availability_pct        REAL,
  -- Actual availability (hours available / total hours)
  off_hire_hours          REAL DEFAULT 0,
  off_hire_reason         TEXT,
  response_time_hours     REAL,
  fuel_consumption_mt     REAL,
  dp_uptime_pct           REAL,
  distance_nm             REAL,
  running_hours           REAL,

  -- Computed compliance
  availability_compliant  BOOLEAN,
  fuel_compliant          BOOLEAN,
  dp_compliant            BOOLEAN,

  notes           TEXT,
  source          TEXT DEFAULT 'manual',
  -- 'manual', 'telemetry', 'noon_report'

  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_charter_kpi_period
  ON charter_kpi_logs (charter_id, period_start DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_charter_kpi_unique
  ON charter_kpi_logs (charter_id, period_start, period_type);


-- ============================================================================
-- 3. OVID / SIRE / CDI VETTING INSPECTIONS
-- ============================================================================

CREATE TABLE IF NOT EXISTS vetting_inspections (
  id              VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          VARCHAR NOT NULL REFERENCES organizations(id),
  vessel_id       VARCHAR NOT NULL REFERENCES vessels(id),

  -- Inspection identity
  inspection_type TEXT NOT NULL,
  -- 'ovid', 'sire', 'cdi', 'rightship', 'client_vetting', 'internal'
  inspection_ref  TEXT,
  -- OVID/SIRE report reference number

  -- Who
  inspector_name    TEXT,
  inspector_company TEXT,
  -- e.g., 'OCIMF Inspector', 'BSP Marine Assurance', 'Internal DPA'
  requesting_client TEXT,
  -- Which client requested this vetting

  -- When / where
  inspection_date   DATE NOT NULL,
  port              TEXT,
  country           TEXT,

  -- Results
  total_findings    INTEGER DEFAULT 0,
  critical_findings INTEGER DEFAULT 0,
  major_findings    INTEGER DEFAULT 0,
  observations      INTEGER DEFAULT 0,
  overall_rating    TEXT,
  -- 'acceptable', 'acceptable_with_conditions', 'unacceptable'

  -- Status
  status            TEXT NOT NULL DEFAULT 'scheduled',
  -- 'scheduled', 'in_progress', 'completed', 'findings_open', 'closed_out'
  all_findings_closed BOOLEAN DEFAULT false,
  closed_out_date     DATE,

  -- Documents
  report_url        TEXT,
  notes             TEXT,

  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vetting_vessel
  ON vetting_inspections (org_id, vessel_id, inspection_date DESC);
CREATE INDEX IF NOT EXISTS idx_vetting_status
  ON vetting_inspections (org_id, status);

-- Individual vetting findings
CREATE TABLE IF NOT EXISTS vetting_findings (
  id              VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          VARCHAR NOT NULL REFERENCES organizations(id),
  inspection_id   VARCHAR NOT NULL REFERENCES vetting_inspections(id) ON DELETE CASCADE,

  -- Finding details
  finding_number  INTEGER NOT NULL,
  chapter         TEXT,
  -- OVID/SIRE chapter: 'navigation', 'safety', 'pollution_prevention',
  -- 'structural', 'cargo_operations', 'mooring', 'engine_room',
  -- 'crew_management', 'general_appearance'
  question_ref    TEXT,
  -- OVID question reference e.g. "NAV-1.2"

  severity        TEXT NOT NULL,
  -- 'critical', 'major', 'minor', 'observation'
  description     TEXT NOT NULL,
  root_cause      TEXT,

  -- Remediation
  corrective_action     TEXT,
  responsible_person    TEXT,
  target_close_date     DATE,
  actual_close_date     DATE,
  evidence_url          TEXT,
  -- Photo/document proving remediation

  status          TEXT NOT NULL DEFAULT 'open',
  -- 'open', 'in_progress', 'closed', 'verified'
  verified_by     TEXT,
  verified_date   DATE,

  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vetting_findings_inspection
  ON vetting_findings (inspection_id, severity);
CREATE INDEX IF NOT EXISTS idx_vetting_findings_open
  ON vetting_findings (org_id, status)
  WHERE status IN ('open', 'in_progress');


-- ============================================================================
-- 4. OFFSHORE OPERATIONS LOGGING
-- ============================================================================

CREATE TABLE IF NOT EXISTS offshore_operations (
  id              VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          VARCHAR NOT NULL REFERENCES organizations(id),
  vessel_id       VARCHAR NOT NULL REFERENCES vessels(id),

  -- Operation identity
  operation_type  TEXT NOT NULL,
  -- 'cargo_transfer', 'anchor_handling', 'towing', 'spm_operations',
  -- 'dive_support', 'rov_operations', 'standby_duty', 'personnel_transfer',
  -- 'bunkering', 'dp_operations'
  operation_ref   TEXT,

  -- Timing
  start_time      TIMESTAMPTZ NOT NULL,
  end_time        TIMESTAMPTZ,
  duration_hours  REAL,

  -- Location
  location_name   TEXT,
  -- e.g., 'BSP Platform Charlie', 'SPM Buoy #2', 'Kuala Belait Anchorage'
  latitude        REAL,
  longitude       REAL,
  water_depth_m   REAL,

  -- Weather at start
  wind_speed_kts  REAL,
  wind_direction  TEXT,
  wave_height_m   REAL,
  visibility_nm   REAL,
  sea_state       TEXT,
  -- 'calm', 'slight', 'moderate', 'rough', 'very_rough'

  -- Cargo details (for cargo/supply operations)
  cargo_details   JSONB,
  -- { items: [{description, quantity, unit, weight_mt}], totalWeight_mt, deckArea_m2 }

  -- Fuel consumed during operation
  fuel_consumed_mt REAL,

  -- Personnel
  officer_in_charge TEXT,
  officer_rank      TEXT,

  -- Safety
  toolbox_talk_done BOOLEAN DEFAULT false,
  jsa_completed     BOOLEAN DEFAULT false,
  -- JSA: Job Safety Analysis
  permit_to_work    TEXT,
  incidents         TEXT,

  -- Client witness (for charter compliance)
  client_representative TEXT,
  client_signed_off     BOOLEAN DEFAULT false,

  status          TEXT NOT NULL DEFAULT 'in_progress',
  -- 'planned', 'in_progress', 'completed', 'aborted'
  notes           TEXT,

  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_offshore_ops_vessel
  ON offshore_operations (org_id, vessel_id, start_time DESC);
CREATE INDEX IF NOT EXISTS idx_offshore_ops_type
  ON offshore_operations (org_id, operation_type, start_time DESC);


-- ============================================================================
-- 5. EFMS (Electronic Fuel Monitoring System) CONNECTION CONFIG
-- ============================================================================

CREATE TABLE IF NOT EXISTS efms_connections (
  id              VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          VARCHAR NOT NULL REFERENCES organizations(id),
  vessel_id       VARCHAR NOT NULL REFERENCES vessels(id),

  -- Connection details
  efms_make       TEXT,
  efms_model      TEXT,
  protocol        TEXT NOT NULL DEFAULT 'modbus_tcp',
  -- 'modbus_tcp', 'modbus_rtu', 'nmea0183', 'canbus', 'csv_polling'
  host            TEXT,
  -- IP address for TCP or serial port for RTU
  port            INTEGER,
  -- TCP port (502 for Modbus) or baud rate for serial
  slave_id        INTEGER DEFAULT 1,
  -- Modbus slave ID

  -- Register mapping (Modbus)
  register_map    JSONB DEFAULT '{}',
  -- {
  --   "fuel_flow_rate":  { register: 40001, type: "float32", unit: "l/h", scaling: 1.0 },
  --   "fuel_consumed":   { register: 40003, type: "float32", unit: "litres", scaling: 1.0 },
  --   "density":         { register: 40005, type: "float32", unit: "kg/m3", scaling: 1.0 },
  --   "temperature":     { register: 40007, type: "float32", unit: "°C", scaling: 1.0 },
  --   "engine_rpm":      { register: 40009, type: "uint16", unit: "rpm", scaling: 1.0 }
  -- }

  -- Polling
  poll_interval_ms INTEGER DEFAULT 5000,
  -- How often to read from EFMS (default 5 seconds)

  -- Equipment link
  equipment_id    VARCHAR REFERENCES equipment(id),
  -- Links to the main engine or generator this EFMS monitors

  -- Status
  status          TEXT NOT NULL DEFAULT 'configured',
  -- 'configured', 'connected', 'polling', 'error', 'disabled'
  last_reading_at TIMESTAMPTZ,
  error_message   TEXT,

  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_efms_vessel
  ON efms_connections (org_id, vessel_id, equipment_id);


-- ============================================================================
-- 6. VESSEL TABLE EXTENSIONS
-- ============================================================================

ALTER TABLE vessels
  ADD COLUMN IF NOT EXISTS dp_class          TEXT,
  -- 'DP1', 'DP2', 'DP3', 'none'
  ADD COLUMN IF NOT EXISTS vetting_status    TEXT DEFAULT 'not_vetted',
  -- 'valid', 'expired', 'not_vetted', 'conditional'
  ADD COLUMN IF NOT EXISTS last_vetting_date DATE,
  ADD COLUMN IF NOT EXISTS charter_status    TEXT DEFAULT 'available',
  -- 'on_charter', 'available', 'in_yard', 'laid_up'
  ADD COLUMN IF NOT EXISTS current_charter_id VARCHAR;

-- AMOD-specific certificate flag
ALTER TABLE vessel_certificates
  ADD COLUMN IF NOT EXISTS is_amod_required  BOOLEAN DEFAULT false,
  -- True for certificates specifically required by Brunei AMOD
  ADD COLUMN IF NOT EXISTS local_authority   TEXT;
  -- 'AMOD', 'MPA_Singapore', etc. — for non-IMO local requirements


-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE dp_systems IS 'DP (Dynamic Positioning) system configuration per vessel. Tracks thrusters, reference systems, power redundancy, and FMEA status. Required for vessels operating near offshore platforms.';
COMMENT ON TABLE charter_parties IS 'Active charter party agreements with KPI targets. Tracks availability, response time, fuel consumption, and DP uptime against contractual minimums.';
COMMENT ON TABLE vetting_inspections IS 'OVID/SIRE/CDI vetting inspections. Oil & gas clients (BSP, JISCO) require valid vetting before chartering.';
COMMENT ON TABLE offshore_operations IS 'Operational logs for offshore activities: cargo transfer, anchor handling, SPM operations, DP watchkeeping. Includes weather, safety checks, and client sign-off.';
COMMENT ON TABLE efms_connections IS 'EFMS (Electronic Fuel Monitoring System) device configuration. Maps Modbus registers to telemetry channels for fuel consumption monitoring.';
