-- ============================================================================
-- 0018  Push B1 — Postgres Row-Level Security for tenant isolation
-- ============================================================================
-- Adds RLS to every tenant-scoped table and creates per-tenant tables for
-- the lifecycle/quota endpoints introduced in Push B1.
--
-- DESIGN
--   * Policies key on `current_setting('app.current_org_id', true)`. The
--     `, true` makes the call return NULL instead of erroring when the
--     session variable is unset, so unset == "no rows" (fail-closed)
--     rather than "all rows" (fail-open).
--   * `FORCE ROW LEVEL SECURITY` ensures policies apply even to the
--     table owner role. Without this, RLS is silently bypassed when the
--     app connects as the DB owner — which is the default in Replit /
--     Neon and is the failure mode the audit specifically called out.
--   * Migration is idempotent: every CREATE POLICY is guarded by a
--     `pg_policies` lookup so re-running is safe. Tables that don't
--     exist yet are skipped (they'll be created by a future migration
--     and picked up the next time this migration is regenerated).
--
-- NOTE
--   When adding a new tenant-scoped table, append it to
--   `server/tenancy/tenant-tables.ts` AND extend the `TENANT_TABLES`
--   array below. The two lists must stay in lockstep.
-- ============================================================================

DO $rls$
DECLARE
  t           text;
  policy_name text;
  has_table   boolean;
  has_col     boolean;
  TENANT_TABLES text[] := ARRAY[
    'work_order_worklogs','work_order_checklists','work_order_parts',
    'work_order_completions','purchase_order_items','purchase_orders',
    'purchase_requests','vendor_quotes','service_orders','part_substitutions',
    'reservations','inventory_movements','stock','inventory_parts','parts',
    -- `storage_config` removed: the Pg table (shared/schema/admin.ts)
    -- has no `org_id` column and the runtime service
    -- (server/storage-config.ts) is a no-op stub. Including it caused
    -- the fail-closed guard below to abort the migration. Keep this
    -- list in lockstep with `server/tenancy/tenant-tables.ts`.
    'suppliers','maintenance_costs','maintenance_records',
    'maintenance_checklist_items','maintenance_windows','maintenance_templates',
    'maintenance_schedules','work_orders','prediction_outcomes',
    'anomaly_detections','component_degradation','failure_history',
    'failure_predictions','model_performance_validations','prediction_feedback',
    'vibration_features','rul_models','vibration_analysis','pdm_baseline',
    'pdm_alerts','real_time_predictions','model_deployments','llm_budget_configs',
    'retraining_triggers','digital_twins','model_registry','ml_models',
    'equipment_features','fleet_baselines','twin_events','twin_scenarios',
    'twin_residuals','asset_twin_state','asset_twins','vessel_3d_models',
    'telemetry_aggregates','telemetry_rollups','raw_telemetry',
    'equipment_telemetry','discovered_signals','sensor_states',
    -- `sensor_types` removed: global lookup table with no `org_id`.
    'sensor_configurations','sensor_thresholds','sensor_mapping',
    'operating_condition_alerts','operating_parameters','part_failure_history',
    'downtime_events','equipment_decommission_events','performance_metrics',
    'equipment_lifecycle','pdm_score_logs','edge_heartbeats','devices',
    'equipment','crew_rest_day','crew_rest_sheet','crew_documents',
    'crew_certification','crew_assignment','shift_template','crew_leave',
    'crew_skill','skills','crew','drydock_window','port_call',
    'stormgeo_weather_data','stormgeo_voyages','vessels','engine_log_events',
    'engine_log_daily','deck_log_events','deck_log_daily',
    'certificate_revocations','certificates','compliance_bundles',
    -- `compliance_audit_log` removed: no `org_id` column today; needs
    -- a backfill migration before it can be re-listed.
    'data_privacy_requests','retention_policies',
    'alert_comments','alert_suppressions','alert_notifications',
    'alert_configurations','actionable_insights','insight_reports',
    'insight_snapshots','llm_cost_tracking','rag_feedback',
    -- `rag_messages`, `kb_doc_versions` removed: no `org_id` today
    -- (children of rag_conversations / kb_docs respectively). Add an
    -- `org_id` column + backfill from the parent before re-listing.
    'rag_conversations','kb_docs','rag_search_queries',
    'knowledge_base_items','content_sources','user_preferences',
    'context_snapshots','briefing_packages','agent_interactions',
    'agent_sessions','dtc_faults','scheduler_runs','schedule_optimizations',
    'optimization_results','resource_constraints','optimizer_configurations',
    'scheduling_settings','generated_reports','report_schedules','cost_savings',
    -- `permission_grants` removed: no `org_id` column today.
    'labor_rates','expenses','user_role_assignments',
    'roles','sso_configs','admin_system_settings','admin_audit_events',
    'email_settings','metrics_history','tenant_quotas','tenant_usage',
    'user_sessions','users'
  ];
BEGIN
  FOREACH t IN ARRAY TENANT_TABLES LOOP
    -- Skip tables that don't exist yet (older deployments missing newer
    -- feature tables). A missing table is not a security regression —
    -- it just means there's nothing to protect.
    EXECUTE format(
      'SELECT EXISTS (SELECT 1 FROM information_schema.tables
         WHERE table_schema = current_schema() AND table_name = %L)', t
    ) INTO has_table;
    IF NOT has_table THEN
      CONTINUE;
    END IF;

    -- Require an `org_id` column. If a listed table exists but lacks
    -- `org_id`, raise — silently skipping would leave that table
    -- unprotected which is exactly the failure mode this migration
    -- exists to prevent. Either rename the column or drop the table
    -- from the registry.
    EXECUTE format(
      'SELECT EXISTS (SELECT 1 FROM information_schema.columns
         WHERE table_schema = current_schema() AND table_name = %L
         AND column_name = ''org_id'')', t
    ) INTO has_col;
    IF NOT has_col THEN
      RAISE EXCEPTION
        '0018_rls_policies: table % is registered as tenant-scoped but has no org_id column; refusing to leave it unprotected', t;
    END IF;

    -- Enable + force RLS.
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);

    -- One catch-all policy per table. Splitting per-verb (SELECT /
    -- INSERT / UPDATE / DELETE) adds complexity without changing the
    -- security model: the predicate is identical in all four cases.
    policy_name := 'tenant_isolation_' || t;
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = current_schema() AND tablename = t
        AND policyname = policy_name
    ) THEN
      EXECUTE format(
        'CREATE POLICY %I ON %I
           USING (org_id = current_setting(''app.current_org_id'', true))
           WITH CHECK (org_id = current_setting(''app.current_org_id'', true))',
        policy_name, t
      );
    END IF;
  END LOOP;
END
$rls$ LANGUAGE plpgsql;

-- ============================================================================
-- Tenant lifecycle + quota tables (Push B1 steps 5 + 6).
-- ============================================================================

-- Suspension state for the `organizations` table. We add it as a nullable
-- column rather than a separate table so existing org reads keep working.
ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS suspended_at timestamptz,
  ADD COLUMN IF NOT EXISTS suspension_reason text;

CREATE TABLE IF NOT EXISTS tenant_quotas (
  org_id text PRIMARY KEY REFERENCES organizations(id) ON DELETE CASCADE,
  max_storage_bytes bigint NOT NULL DEFAULT 10737418240,        -- 10 GiB
  max_equipment_count integer NOT NULL DEFAULT 5000,
  max_telemetry_rows_per_day bigint NOT NULL DEFAULT 10000000,  -- 10M rows/day
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS tenant_usage (
  org_id text NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  metric text NOT NULL,                  -- 'storage_bytes' | 'equipment_count' | 'telemetry_rows_today'
  window_start date NOT NULL,            -- daily window for telemetry; epoch for instantaneous counters
  value bigint NOT NULL DEFAULT 0,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (org_id, metric, window_start)
);

CREATE INDEX IF NOT EXISTS idx_tenant_usage_recorded
  ON tenant_usage (org_id, recorded_at DESC);
