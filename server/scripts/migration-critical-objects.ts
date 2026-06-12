// Critical schema objects the application assumes exist post-migration. Asserted
// after every apply so a deploy that silently skipped a migration fails loudly
// rather than corrupting dashboards / breaking the telemetry ON CONFLICT path.
export const REQUIRED_INDEXES: ReadonlyArray<{ name: string; from: string }> = [
  { name: "uq_equipment_telemetry_natural", from: "0024 telemetry dedup" },
  { name: "idx_work_orders_org_vessel_status", from: "0021 hot-path indexes" },
  { name: "idx_alert_notifications_org_equipment_type", from: "0021 hot-path indexes" },
  { name: "idx_maintenance_schedules_equipment_date", from: "0021 hot-path indexes" },
  { name: "uq_users_org_email_lower", from: "0047 email normalization" },
  { name: "uq_work_orders_org_wo_number", from: "0039 identity uniques" },
  // Belt for the org-scoped telemetry access path: 0038's partitioned
  // rebuild keys the PK on (org_id, ts, id), which serves every observed
  // org_id predicate - assert it survives future rebuilds.
  { name: "equipment_telemetry_pkey", from: "0038 partitioning (org-scoped PK)" },
];

// deleteRule matches pg_constraint.confdeltype: "c" = CASCADE, "n" = SET NULL,
// "a" = NO ACTION. refTable (when set) additionally asserts the FK points at
// that table - used to prove model_id was retargeted off ml_models_legacy.
export const REQUIRED_FKS: ReadonlyArray<{
  table: string;
  column: string;
  deleteRule: "c" | "n" | "a";
  refTable?: string;
  from: string;
}> = [
  { table: "purchase_order_items", column: "po_id", deleteRule: "c", from: "0023 FK cascade" },
  { table: "purchase_request_items", column: "pr_id", deleteRule: "c", from: "0023 FK cascade" },
  {
    table: "anomaly_detections",
    column: "org_id",
    deleteRule: "a",
    refTable: "organizations",
    from: "0040 ML FK integrity",
  },
  {
    table: "anomaly_detections",
    column: "equipment_id",
    deleteRule: "c",
    refTable: "equipment",
    from: "0040 ML FK integrity",
  },
  {
    table: "anomaly_detections",
    column: "model_id",
    deleteRule: "n",
    refTable: "ml_models",
    from: "0040 ML FK integrity",
  },
  {
    table: "failure_predictions",
    column: "org_id",
    deleteRule: "a",
    refTable: "organizations",
    from: "0040 ML FK integrity",
  },
  {
    table: "failure_predictions",
    column: "equipment_id",
    deleteRule: "c",
    refTable: "equipment",
    from: "0040 ML FK integrity",
  },
  {
    table: "failure_predictions",
    column: "model_id",
    deleteRule: "n",
    refTable: "ml_models",
    from: "0040 ML FK integrity",
  },
  // Representatives for the catalog-driven org FK sweep - one early-domain
  // table, one mid-list, one late-list, so a partially applied 0046 trips
  // the assertion regardless of where it stopped.
  {
    table: "crew_alerts",
    column: "org_id",
    deleteRule: "a",
    refTable: "organizations",
    from: "0046 org FK backfill",
  },
  {
    table: "agent_conversations",
    column: "org_id",
    deleteRule: "a",
    refTable: "organizations",
    from: "0046 org FK backfill",
  },
  {
    table: "report_schedules",
    column: "org_id",
    deleteRule: "a",
    refTable: "organizations",
    from: "0046 org FK backfill",
  },
];

// Columns the application assumes exist post-migration. Asserted after every
// apply so a deploy that silently skipped a migration fails loudly.
export const REQUIRED_COLUMNS: ReadonlyArray<{ table: string; column: string; from: string }> = [
  { table: "roles", column: "hub_admin", from: "0033 role hub access" },
  { table: "roles", column: "hub_access", from: "0033 role hub access" },
  { table: "system_settings", column: "openai_api_key_encrypted", from: "0043 secure settings" },
  { table: "pdm_alerts", column: "created_at", from: "0049 column hygiene" },
];
