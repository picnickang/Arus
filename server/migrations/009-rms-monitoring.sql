-- Migration 009: RMS Monitoring - Alert configs, bunkering events, alert log
-- Supports: threshold alerting, geofence monitoring, bunkering detection

-- RMS alert configurations per vessel
CREATE TABLE IF NOT EXISTS rms_alert_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id VARCHAR(100) NOT NULL,
  vessel_id VARCHAR(100) NOT NULL REFERENCES vessels(id) ON DELETE CASCADE,
  alert_type VARCHAR(50) NOT NULL, -- 'fuel_threshold', 'daily_consumption', 'geofence', 'bunkering'
  name VARCHAR(200) NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT true,
  config JSONB NOT NULL DEFAULT '{}',
  -- fuel_threshold config: { engineKey, thresholdKgPerH, direction: 'above'|'below' }
  -- daily_consumption config: { maxDailyMt }
  -- geofence config: { centerLat, centerLon, radiusNm, triggerOn: 'enter'|'exit'|'both' }
  -- bunkering config: { notifyOnStart, notifyOnEnd, minVolumeLitres }
  notify_email BOOLEAN NOT NULL DEFAULT true,
  notify_in_app BOOLEAN NOT NULL DEFAULT true,
  cooldown_minutes INTEGER NOT NULL DEFAULT 60,
  last_triggered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rms_alert_configs_vessel ON rms_alert_configs(vessel_id);
CREATE INDEX IF NOT EXISTS idx_rms_alert_configs_org ON rms_alert_configs(org_id);

-- Detected bunkering events
CREATE TABLE IF NOT EXISTS rms_bunkering_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id VARCHAR(100) NOT NULL,
  vessel_id VARCHAR(100) NOT NULL REFERENCES vessels(id) ON DELETE CASCADE,
  started_at TIMESTAMPTZ NOT NULL,
  ended_at TIMESTAMPTZ,
  status VARCHAR(20) NOT NULL DEFAULT 'in_progress', -- 'in_progress', 'completed', 'cancelled'
  volume_kg NUMERIC(12,2),
  volume_litres NUMERIC(12,2),
  avg_flow_kg_per_h NUMERIC(10,2),
  peak_flow_kg_per_h NUMERIC(10,2),
  fuel_type VARCHAR(20) DEFAULT 'fo', -- 'fo', 'do'
  density_at_15c NUMERIC(8,4),
  temperature_c NUMERIC(6,2),
  supplier VARCHAR(200),
  port VARCHAR(200),
  notes TEXT,
  source VARCHAR(20) NOT NULL DEFAULT 'auto', -- 'auto' (detected), 'manual'
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rms_bunkering_vessel ON rms_bunkering_events(vessel_id);
CREATE INDEX IF NOT EXISTS idx_rms_bunkering_org ON rms_bunkering_events(org_id);
CREATE INDEX IF NOT EXISTS idx_rms_bunkering_started ON rms_bunkering_events(started_at DESC);

-- Triggered alert log
CREATE TABLE IF NOT EXISTS rms_alert_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id VARCHAR(100) NOT NULL,
  vessel_id VARCHAR(100) NOT NULL REFERENCES vessels(id) ON DELETE CASCADE,
  alert_config_id UUID REFERENCES rms_alert_configs(id) ON DELETE SET NULL,
  alert_type VARCHAR(50) NOT NULL,
  severity VARCHAR(20) NOT NULL DEFAULT 'warning', -- 'info', 'warning', 'critical'
  title VARCHAR(300) NOT NULL,
  message TEXT,
  data JSONB DEFAULT '{}',
  acknowledged BOOLEAN NOT NULL DEFAULT false,
  acknowledged_by VARCHAR(200),
  acknowledged_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rms_alert_log_vessel ON rms_alert_log(vessel_id);
CREATE INDEX IF NOT EXISTS idx_rms_alert_log_org ON rms_alert_log(org_id);
CREATE INDEX IF NOT EXISTS idx_rms_alert_log_created ON rms_alert_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_rms_alert_log_unack ON rms_alert_log(org_id, acknowledged) WHERE acknowledged = false;
