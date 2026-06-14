-- 0048 — Status/severity CHECK constraints, wave 2
--
-- 0042 added IN-list CHECKs for the five highest-traffic columns. This
-- wave covers 23 more whose closed value sets were verified against
-- every writer (zod enums, const arrays, service literals, schema
-- defaults). Same posture as 0042: each CHECK is added NOT VALID (new
-- writes enforced immediately) and VALIDATEd only when a pre-count
-- shows the table clean, so a deploy never bricks on legacy tenant
-- data; leftovers are reported via NOTICE for manual cleanup +
-- VALIDATE.
--
-- Value-set evidence:
--   crew_tasks.status/priority        shared/schema/crew-tasks.ts:19-31 const enums
--   vessel_certificates.status        shared/schema/certificates.ts:41-47 const enum
--   crew.status                       schema comment + CREW_STATUSES
--                                     (client/src/features/crew/lib/crewManagementUtils.ts:57-62)
--   compliance_findings.severity      compliance/routes.ts:333 + default
--   compliance_findings.status        compliance-rules-engine literals + soft-archive
--   vessel_safety_alarms.severity/.status/.mode + safety_alarm_types.default_severity
--                                     shared/role-dashboard.ts:934-940 zod
--   edge_diagnostic_logs.severity/.status
--                                     shared/schema/iot-edge.ts insertEdgeDiagnosticLogSchema zod
--                                     (an earlier draft misattributed these to
--                                     transport_failovers, which has no such columns)
--   import_manifest.status            shared/schema/import-manifest.ts:40
--   agent_tasks.status/priority       server/domains/agent/domain/task-types.ts
--   agent_findings.status             finding-domain-types.ts
--   agent_briefings.status            briefing-generator-service.ts (generating/ready/failed)
--   agent_schedule_runs.status        scheduler-service.ts (running/completed/failed)
--   event_outbox.status               outbox-repository claim/markPublished/markFailed/dead
--   email_queue.status                email-worker.ts:218 dead_letter/expired/pending,
--                                     db-notifications.ts:156 failed, repository.ts:261 sent|failed
--   notification_queue.status         queue-processor.ts:41-86
--   deck_log_daily.status,
--   engine_log_daily.status           logbook db-storage literals (open/draft/signed/locked)
--
-- DOCUMENTED SKIPS (no closed set with code evidence — do not guess):
--   maintenance_schedules.status      only 'scheduled' writer + 'completed' filter;
--                                     generic passthrough update accepts anything
--   integration_configs.health_status 10+ ambient values from probes
--   sync_journal/sync_outbox/sync_protocol_version statuses
--                                     replication state machines, verify separately
--   agent_conversations/agent_tool_calls/agent_drafts/agent_suggestions/
--   agent_approvals.status            mixed writers across services, sets unverified
--   schedule_optimizations/scheduler_runs.status   optimizer internals
--   alert_thresholds/actionable_insights/operating_condition_alerts.severity,
--   alert_email_log.status            config-driven / free-ish sets

DO $$
DECLARE
  spec RECORD;
  quoted TEXT;
  bad_count INTEGER;
BEGIN
  FOR spec IN
    SELECT * FROM (VALUES
      ('crew_tasks', 'status', 'crew_tasks_status_valid',
       ARRAY['open','in_progress','blocked','done']),
      ('crew_tasks', 'priority', 'crew_tasks_priority_valid',
       ARRAY['low','medium','high','urgent']),
      ('vessel_certificates', 'status', 'vessel_certificates_status_valid',
       ARRAY['valid','expired','suspended','withdrawn','pending_renewal']),
      ('crew', 'status', 'crew_status_valid',
       ARRAY['active','onboard','on_leave','standby']),
      ('compliance_findings', 'severity', 'compliance_findings_severity_valid',
       ARRAY['info','warning','critical']),
      ('compliance_findings', 'status', 'compliance_findings_status_valid',
       ARRAY['open','acknowledged','resolved','suppressed','archived']),
      ('vessel_safety_alarms', 'severity', 'vessel_safety_alarms_severity_valid',
       ARRAY['info','warning','critical','emergency']),
      ('vessel_safety_alarms', 'status', 'vessel_safety_alarms_status_valid',
       ARRAY['active','cleared']),
      ('vessel_safety_alarms', 'mode', 'vessel_safety_alarms_mode_valid',
       ARRAY['real','drill','test']),
      ('safety_alarm_types', 'default_severity', 'safety_alarm_types_default_severity_valid',
       ARRAY['info','warning','critical','emergency']),
      ('edge_diagnostic_logs', 'severity', 'edge_diagnostic_logs_severity_valid',
       ARRAY['info','warning','error','critical']),
      ('edge_diagnostic_logs', 'status', 'edge_diagnostic_logs_status_valid',
       ARRAY['pending','in_progress','success','failed']),
      ('import_manifest', 'status', 'import_manifest_status_valid',
       ARRAY['running','committed','rolled_back','failed']),
      ('agent_tasks', 'status', 'agent_tasks_status_valid',
       ARRAY['open','in_progress','blocked','completed','failed','deferred']),
      ('agent_tasks', 'priority', 'agent_tasks_priority_valid',
       ARRAY['low','medium','high','critical']),
      ('agent_findings', 'status', 'agent_findings_status_valid',
       ARRAY['new','acknowledged','actioned','archived']),
      ('agent_briefings', 'status', 'agent_briefings_status_valid',
       ARRAY['generating','ready','failed']),
      ('agent_schedule_runs', 'status', 'agent_schedule_runs_status_valid',
       ARRAY['running','completed','failed']),
      ('event_outbox', 'status', 'event_outbox_status_valid',
       ARRAY['pending','dispatching','published','dead']),
      ('email_queue', 'status', 'email_queue_status_valid',
       ARRAY['pending','sent','failed','dead_letter','expired']),
      ('notification_queue', 'status', 'notification_queue_status_valid',
       ARRAY['pending','sent','failed']),
      ('deck_log_daily', 'status', 'deck_log_daily_status_valid',
       ARRAY['open','draft','signed','locked']),
      ('engine_log_daily', 'status', 'engine_log_daily_status_valid',
       ARRAY['open','draft','signed','locked'])
    ) AS t(tbl, col, con, vals)
  LOOP
    -- Skip tables/columns that don't exist on this deployment yet.
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
       WHERE table_schema = current_schema()
         AND table_name = spec.tbl AND column_name = spec.col
    ) THEN
      CONTINUE;
    END IF;

    SELECT string_agg(quote_literal(v), ', ') INTO quoted FROM unnest(spec.vals) AS v;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = spec.con) THEN
      EXECUTE format(
        'ALTER TABLE %I ADD CONSTRAINT %I CHECK (%I IN (%s)) NOT VALID',
        spec.tbl, spec.con, spec.col, quoted
      );
    END IF;

    EXECUTE format(
      'SELECT count(*) FROM %I WHERE %I IS NOT NULL AND %I NOT IN (%s)',
      spec.tbl, spec.col, spec.col, quoted
    ) INTO bad_count;

    IF bad_count = 0 THEN
      EXECUTE format('ALTER TABLE %I VALIDATE CONSTRAINT %I', spec.tbl, spec.con);
    ELSE
      RAISE NOTICE '0048: %.% left NOT VALID — % legacy row(s) outside the allowed set; clean up and run: ALTER TABLE % VALIDATE CONSTRAINT %',
        spec.tbl, spec.col, bad_count, spec.tbl, spec.con;
    END IF;
  END LOOP;
END $$;
