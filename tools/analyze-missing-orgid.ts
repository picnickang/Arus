/**
 * Analyze tables without org_id and categorize them
 * Determines which tables are exempt (system/global) vs need org_id added
 */

import fs from "fs";
import path from "path";

interface TableAnalysis {
  tableName: string;
  category: "EXEMPT" | "NEEDS_ORGID" | "REVIEW_NEEDED";
  reason: string;
  priority: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  recommendation: string;
}

const tablesWithoutOrgId = [
  "admin_sessions",
  "alert_comments",
  "alert_suppressions",
  "compliance_audit_log",
  "crew_assignment",
  "crew_cert",
  "crew_leave",
  "crew_rest_day",
  "crew_rest_sheet",
  "crew_skill",
  "db_schema_version",
  "device_registry",
  "digital_twins",
  "drydock_window",
  "dtc_definitions",
  "edge_heartbeats",
  "equipment_lifecycle",
  "idempotency_log",
  "industry_benchmarks",
  "maintenance_checklist_completions",
  "maintenance_checklist_items",
  "maintenance_costs",
  "mqtt_devices",
  "ops_db_staged",
  "organizations",
  "performance_metrics",
  "port_call",
  "purchase_order_items",
  "raw_telemetry",
  "replay_incoming",
  "request_idempotency",
  "sensor_types",
  "sheet_lock",
  "sheet_version",
  "shift_template",
  "storage_config",
  "sync_journal",
  "sync_outbox",
  "system_settings",
  "telemetry_retention_policies",
  "transport_settings",
];

function analyzeTable(tableName: string): TableAnalysis {
  // System/infrastructure tables (EXEMPT)
  const systemTables = [
    "organizations",
    "db_schema_version",
    "system_settings",
    "storage_config",
    "transport_settings",
    "idempotency_log",
    "request_idempotency",
    "sync_journal",
    "sync_outbox",
    "ops_db_staged",
    "replay_incoming",
    "sheet_lock",
    "sheet_version",
  ];

  // Shared reference data (EXEMPT or LOW priority)
  const sharedReferenceTables = [
    "dtc_definitions",
    "sensor_types",
    "industry_benchmarks",
    "telemetry_retention_policies",
  ];

  // Business data tables (NEEDS org_id)
  const businessDataTables = [
    "crew_assignment",
    "crew_cert",
    "crew_leave",
    "crew_rest_day",
    "crew_rest_sheet",
    "crew_skill",
    "drydock_window",
    "equipment_lifecycle",
    "maintenance_checklist_completions",
    "maintenance_checklist_items",
    "maintenance_costs",
    "performance_metrics",
    "port_call",
    "purchase_order_items",
    "shift_template",
    "alert_comments",
    "alert_suppressions",
  ];

  // Device/telemetry tables (needs review)
  const deviceTables = [
    "device_registry",
    "mqtt_devices",
    "edge_heartbeats",
    "digital_twins",
    "raw_telemetry",
  ];

  // Audit/compliance tables (needs review)
  const auditTables = ["compliance_audit_log", "admin_sessions"];

  if (systemTables.includes(tableName)) {
    return {
      tableName,
      category: "EXEMPT",
      reason: "System/infrastructure table - global to all organizations",
      priority: "LOW",
      recommendation: "No action needed. Table is correctly global.",
    };
  }

  if (sharedReferenceTables.includes(tableName)) {
    return {
      tableName,
      category: "EXEMPT",
      reason: "Shared reference data - same across all organizations",
      priority: "LOW",
      recommendation:
        "Consider if this data should be org-specific in future, but currently global is acceptable.",
    };
  }

  if (businessDataTables.includes(tableName)) {
    return {
      tableName,
      category: "NEEDS_ORGID",
      reason: "Business data that should be isolated per organization",
      priority: "HIGH",
      recommendation:
        "Add org_id column with NOT NULL constraint and foreign key to organizations table. Migrate existing data to default organization.",
    };
  }

  if (deviceTables.includes(tableName)) {
    return {
      tableName,
      category: "REVIEW_NEEDED",
      reason: "Device/telemetry data - depends on device ownership model",
      priority: "MEDIUM",
      recommendation:
        "Review if devices are org-specific or shared. If org-specific, add org_id. If shared infrastructure, may remain global.",
    };
  }

  if (auditTables.includes(tableName)) {
    return {
      tableName,
      category: "REVIEW_NEEDED",
      reason: "Audit/session data - depends on security model",
      priority: "CRITICAL",
      recommendation:
        tableName === "admin_sessions"
          ? "CRITICAL: Add org_id to prevent cross-org session hijacking. Admin sessions must be org-scoped."
          : "Review if audit logs should be org-scoped or global for compliance.",
    };
  }

  // Default case
  return {
    tableName,
    category: "REVIEW_NEEDED",
    reason: "Needs manual classification",
    priority: "MEDIUM",
    recommendation: "Review table usage and determine if data should be org-specific or global.",
  };
}

function generateReport() {
  const analyses = tablesWithoutOrgId.map(analyzeTable);

  const exempt = analyses.filter((a) => a.category === "EXEMPT");
  const needsOrgId = analyses.filter((a) => a.category === "NEEDS_ORGID");
  const needsReview = analyses.filter((a) => a.category === "REVIEW_NEEDED");

  const critical = analyses.filter((a) => a.priority === "CRITICAL");
  const high = analyses.filter((a) => a.priority === "HIGH");
  const medium = analyses.filter((a) => a.priority === "MEDIUM");
  const low = analyses.filter((a) => a.priority === "LOW");

  let report = `# Tables Without org_id - Analysis Report\n\n`;
  report += `**Generated:** ${new Date().toISOString()}\n\n`;
  report += `## Summary\n\n`;
  report += `- **Total tables without org_id:** ${tablesWithoutOrgId.length}\n`;
  report += `- **Exempt (System/Global):** ${exempt.length}\n`;
  report += `- **Needs org_id:** ${needsOrgId.length}\n`;
  report += `- **Needs Review:** ${needsReview.length}\n\n`;

  report += `### Priority Breakdown\n\n`;
  report += `- 🚨 **CRITICAL:** ${critical.length}\n`;
  report += `- ⚠️ **HIGH:** ${high.length}\n`;
  report += `- ℹ️ **MEDIUM:** ${medium.length}\n`;
  report += `- ✅ **LOW:** ${low.length}\n\n`;

  report += `---\n\n`;

  // Critical priority section
  if (critical.length > 0) {
    report += `## 🚨 CRITICAL Priority\n\n`;
    report += `These tables pose security risks and must be addressed immediately.\n\n`;
    critical.forEach((a) => {
      report += `### ${a.tableName}\n`;
      report += `- **Category:** ${a.category}\n`;
      report += `- **Reason:** ${a.reason}\n`;
      report += `- **Recommendation:** ${a.recommendation}\n\n`;
    });
    report += `---\n\n`;
  }

  // High priority section
  if (high.length > 0) {
    report += `## ⚠️ HIGH Priority\n\n`;
    report += `Business data tables that should be multi-tenant isolated.\n\n`;
    high.forEach((a) => {
      report += `### ${a.tableName}\n`;
      report += `- **Category:** ${a.category}\n`;
      report += `- **Reason:** ${a.reason}\n`;
      report += `- **Recommendation:** ${a.recommendation}\n\n`;
    });
    report += `---\n\n`;
  }

  // Medium priority section
  if (medium.length > 0) {
    report += `## ℹ️ MEDIUM Priority - Needs Review\n\n`;
    report += `Tables requiring architectural decision on tenant isolation.\n\n`;
    medium.forEach((a) => {
      report += `### ${a.tableName}\n`;
      report += `- **Category:** ${a.category}\n`;
      report += `- **Reason:** ${a.reason}\n`;
      report += `- **Recommendation:** ${a.recommendation}\n\n`;
    });
    report += `---\n\n`;
  }

  // Exempt tables section
  report += `## ✅ Exempt Tables (No Action Needed)\n\n`;
  report += `These tables are correctly global and do not require org_id.\n\n`;
  exempt.forEach((a) => {
    report += `### ${a.tableName}\n`;
    report += `- **Reason:** ${a.reason}\n`;
    report += `- **Recommendation:** ${a.recommendation}\n\n`;
  });

  report += `---\n\n`;

  // Migration guidance
  report += `## Migration Guidance\n\n`;
  report += `### For tables that need org_id:\n\n`;
  report += `1. **Schema Update**\n`;
  report += `   \`\`\`typescript\n`;
  report += `   // In shared/schema.ts\n`;
  report += `   orgId: varchar("org_id").notNull().references(() => organizations.id),\n`;
  report += `   \`\`\`\n\n`;
  report += `2. **Index Addition**\n`;
  report += `   \`\`\`typescript\n`;
  report += `   // Add composite indexes for performance\n`;
  report += `   (table) => ({\n`;
  report += `     orgIdIndex: index("idx_tablename_org_id").on(table.orgId),\n`;
  report += `     orgQueryIndex: index("idx_tablename_org_query").on(table.orgId, table.frequentlyQueriedColumn)\n`;
  report += `   })\n`;
  report += `   \`\`\`\n\n`;
  report += `3. **Data Migration**\n`;
  report += `   - Run \`npm run db:push\` to sync schema\n`;
  report += `   - If data loss warning appears, review carefully\n`;
  report += `   - Use \`npm run db:push --force\` if migration is safe\n`;
  report += `   - Existing data will need org_id populated (default to 'default-org-id' or migrate appropriately)\n\n`;
  report += `4. **Code Updates**\n`;
  report += `   - Update all queries to filter by orgId\n`;
  report += `   - Update insert statements to include orgId\n`;
  report += `   - Add org-scoped indexes to routes if not present\n\n`;

  report += `---\n\n`;
  report += `## Next Steps\n\n`;
  report += `1. **Immediate (Week 1):**\n`;
  report += `   - Address CRITICAL priority items (${critical.length} tables)\n`;
  report += `   - Plan HIGH priority migrations (${high.length} tables)\n\n`;
  report += `2. **Short-term (This Sprint):**\n`;
  report += `   - Review MEDIUM priority tables and make architectural decisions\n`;
  report += `   - Begin migrating HIGH priority tables\n\n`;
  report += `3. **Long-term (Next Quarter):**\n`;
  report += `   - Complete all multi-tenant migrations\n`;
  report += `   - Document exempt tables in schema comments\n`;
  report += `   - Re-run audit to verify improvements\n\n`;

  return report;
}

// Generate and save report
const report = generateReport();
const outputPath = path.join(process.cwd(), "reports", "MISSING_ORGID_ANALYSIS.md");
fs.writeFileSync(outputPath, report);

console.log("✅ Analysis complete: reports/MISSING_ORGID_ANALYSIS.md");
console.log("\n📊 Summary:");

const analyses = tablesWithoutOrgId.map(analyzeTable);
console.log(`   Total tables: ${tablesWithoutOrgId.length}`);
console.log(`   Exempt: ${analyses.filter((a) => a.category === "EXEMPT").length}`);
console.log(`   Needs org_id: ${analyses.filter((a) => a.category === "NEEDS_ORGID").length}`);
console.log(`   Needs review: ${analyses.filter((a) => a.category === "REVIEW_NEEDED").length}`);
console.log(`\n🚨 Priority breakdown:`);
console.log(`   CRITICAL: ${analyses.filter((a) => a.priority === "CRITICAL").length}`);
console.log(`   HIGH: ${analyses.filter((a) => a.priority === "HIGH").length}`);
console.log(`   MEDIUM: ${analyses.filter((a) => a.priority === "MEDIUM").length}`);
console.log(`   LOW: ${analyses.filter((a) => a.priority === "LOW").length}`);
