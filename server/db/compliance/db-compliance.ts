import { db, isLocalMode } from "../../db-config";
import { sql, type SQL } from "drizzle-orm";

interface ComplianceFindingFilters {
  vesselId?: string | undefined;
  sourceType?: string | undefined;
  severity?: string | undefined;
  status?: string | undefined;
  ruleCode?: string | undefined;
  startDate?: string | Date | undefined;
  endDate?: string | Date | undefined;
  // LR-3.5 / AUD-1 (Task #208): archived rows are excluded by default;
  // auditors / compliance UI pass `includeArchived=true` to see them.
  includeArchived?: boolean | undefined;
}

interface CreateComplianceFinding {
  orgId: string;
  vesselId?: string;
  sourceType: string;
  severity: string;
  status?: string;
  ruleCode?: string;
  title: string;
  description?: string;
}

interface ComplianceRuleFilters {
  sourceType?: string | undefined;
  category?: string | undefined;
  enabled?: boolean | undefined;
}

interface CreateComplianceRule {
  orgId: string;
  sourceType: string;
  category: string;
  ruleName: string;
  ruleCode: string;
  description?: string;
  severity: string;
  enabled?: boolean;
}

interface UpdateComplianceRule {
  ruleName?: string;
  description?: string;
  severity?: string;
  enabled?: boolean;
}

type RawSqlRow = Record<string, unknown>;
type RawQueryResult = { rows: RawSqlRow[] };
type RawQueryRunner = {
  execute?: (query: SQL) => Promise<RawQueryResult>;
  run?: (query: SQL) => Promise<RawQueryResult>;
};

const nowSql = isLocalMode ? sql`(unixepoch() * 1000)` : sql`NOW()`;

async function executeRaw(query: SQL): Promise<RawQueryResult> {
  const runner = db as RawQueryRunner;
  if (runner.execute) {
    return runner.execute(query);
  }
  if (runner.run) {
    return runner.run(query);
  }
  throw new Error("No raw SQL runner available for compliance storage");
}

export class DbComplianceStorage {
  async getComplianceFindings(orgId: string, filters?: ComplianceFindingFilters) {
    // LR-3.5 / AUD-1 (Task #208): exclude archived rows unless the
    // caller explicitly opts in via `includeArchived=true`. We filter
    // on `archived_at IS NULL` because `status` is also used for the
    // open/acknowledged/resolved/suppressed lifecycle and we want
    // the soft-archive marker to be independent of those.
    const archivedFilter = filters?.includeArchived ? sql`` : sql`AND archived_at IS NULL`;
    const result = await executeRaw(
      sql`SELECT * FROM compliance_findings WHERE org_id = ${orgId} ${archivedFilter} ${filters?.vesselId ? sql`AND vessel_id = ${filters.vesselId}` : sql``} ${filters?.sourceType ? sql`AND source_type = ${filters.sourceType}` : sql``} ${filters?.severity ? sql`AND severity = ${filters.severity}` : sql``} ${filters?.status ? sql`AND status = ${filters.status}` : sql``} ${filters?.ruleCode ? sql`AND rule_code = ${filters.ruleCode}` : sql``} ${filters?.startDate ? sql`AND found_at >= ${filters.startDate}` : sql``} ${filters?.endDate ? sql`AND found_at <= ${filters.endDate}` : sql``} ORDER BY found_at DESC`
    );
    return result.rows;
  }

  async getComplianceFindingById(
    id: string,
    orgId: string,
    options?: { includeArchived?: boolean }
  ) {
    const archivedFilter = options?.includeArchived ? sql`` : sql`AND archived_at IS NULL`;
    const result = await executeRaw(
      sql`SELECT * FROM compliance_findings WHERE id = ${id} AND org_id = ${orgId} ${archivedFilter}`
    );
    return result.rows[0];
  }

  async createComplianceFinding(data: CreateComplianceFinding) {
    const result = await executeRaw(
      sql`INSERT INTO compliance_findings (org_id, vessel_id, source_type, severity, status, rule_code, title, description, found_at) VALUES (${data.orgId}, ${data.vesselId}, ${data.sourceType}, ${data.severity}, ${data.status || "open"}, ${data.ruleCode}, ${data.title}, ${data.description}, ${nowSql}) RETURNING *`
    );
    return result.rows[0];
  }

  async acknowledgeComplianceFinding(id: string, _details: unknown, orgId: string) {
    const result = await executeRaw(
      sql`UPDATE compliance_findings SET status = 'acknowledged' WHERE id = ${id} AND org_id = ${orgId} RETURNING *`
    );
    return result.rows[0];
  }

  async resolveComplianceFinding(id: string, _details: unknown, orgId: string) {
    const result = await executeRaw(
      sql`UPDATE compliance_findings SET status = 'resolved', resolved_at = ${nowSql} WHERE id = ${id} AND org_id = ${orgId} RETURNING *`
    );
    return result.rows[0];
  }

  async suppressComplianceFinding(id: string, _details: unknown, orgId: string) {
    const result = await executeRaw(
      sql`UPDATE compliance_findings SET status = 'suppressed' WHERE id = ${id} AND org_id = ${orgId} RETURNING *`
    );
    return result.rows[0];
  }

  async deleteComplianceFinding(id: string, orgId: string, archivedBy?: string) {
    // LR-3.5 / AUD-1 (Task #208): never hard-delete a compliance
    // finding — auditors must be able to reason about every record
    // that ever existed. Soft-archive sets:
    //   - status='archived' (lifecycle marker, preserved for back-
    //     compat with consumers that filter on status)
    //   - archived_at=NOW() (the soft-archive evidence column)
    //   - archived_by=<actor> (who archived it, for the audit view)
    // Reads exclude `archived_at IS NOT NULL` rows by default;
    // pass `includeArchived=true` to surface them.
    await executeRaw(sql`
      UPDATE compliance_findings
         SET status = 'archived',
             archived_at = ${nowSql},
             archived_by = ${archivedBy ?? null},
             updated_at = ${nowSql}
       WHERE id = ${id}
         AND org_id = ${orgId}
    `);
  }

  async getComplianceRules(orgId: string, filters?: ComplianceRuleFilters) {
    const result = await executeRaw(
      sql`SELECT * FROM compliance_rules WHERE org_id = ${orgId} ${filters?.sourceType ? sql`AND source_type = ${filters.sourceType}` : sql``} ${filters?.category ? sql`AND category = ${filters.category}` : sql``} ${filters?.enabled !== undefined ? sql`AND enabled = ${filters.enabled}` : sql``} ORDER BY rule_name ASC`
    );
    return result.rows;
  }

  async getComplianceRuleById(id: string, orgId: string) {
    const result = await executeRaw(
      sql`SELECT * FROM compliance_rules WHERE id = ${id} AND org_id = ${orgId}`
    );
    return result.rows[0];
  }

  async createComplianceRule(data: CreateComplianceRule) {
    const result = await executeRaw(
      sql`INSERT INTO compliance_rules (org_id, source_type, category, rule_name, rule_code, description, severity, enabled) VALUES (${data.orgId}, ${data.sourceType}, ${data.category}, ${data.ruleName}, ${data.ruleCode}, ${data.description}, ${data.severity}, ${data.enabled ?? true}) RETURNING *`
    );
    return result.rows[0];
  }

  async updateComplianceRule(id: string, updates: UpdateComplianceRule, orgId: string) {
    const result = await executeRaw(
      sql`UPDATE compliance_rules SET rule_name = COALESCE(${updates.ruleName}, rule_name), description = COALESCE(${updates.description}, description), severity = COALESCE(${updates.severity}, severity), enabled = COALESCE(${updates.enabled}, enabled) WHERE id = ${id} AND org_id = ${orgId} RETURNING *`
    );
    return result.rows[0];
  }

  async deleteComplianceRule(id: string, orgId: string) {
    await executeRaw(sql`DELETE FROM compliance_rules WHERE id = ${id} AND org_id = ${orgId}`);
  }
}

export const dbComplianceStorage = new DbComplianceStorage();
