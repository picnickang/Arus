import { db } from "../../db-config";
import { sql } from "drizzle-orm";

interface ComplianceFindingFilters {
  vesselId?: string | undefined;
  sourceType?: string | undefined;
  severity?: string | undefined;
  status?: string | undefined;
  ruleCode?: string | undefined;
  startDate?: string | Date | undefined;
  endDate?: string | Date | undefined;
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

export class DbComplianceStorage {
  async getComplianceFindings(orgId: string, filters?: ComplianceFindingFilters) {
    const result = await db.execute(
      sql`SELECT * FROM compliance_findings WHERE org_id = ${orgId} ${filters?.vesselId ? sql`AND vessel_id = ${filters.vesselId}` : sql``} ${filters?.sourceType ? sql`AND source_type = ${filters.sourceType}` : sql``} ${filters?.severity ? sql`AND severity = ${filters.severity}` : sql``} ${filters?.status ? sql`AND status = ${filters.status}` : sql``} ${filters?.ruleCode ? sql`AND rule_code = ${filters.ruleCode}` : sql``} ${filters?.startDate ? sql`AND found_at >= ${filters.startDate}::timestamp` : sql``} ${filters?.endDate ? sql`AND found_at <= ${filters.endDate}::timestamp` : sql``} ORDER BY found_at DESC`
    );
    return result.rows;
  }

  async getComplianceFindingById(id: string, orgId: string) {
    const result = await db.execute(
      sql`SELECT * FROM compliance_findings WHERE id = ${id} AND org_id = ${orgId}`
    );
    return result.rows[0];
  }

  async createComplianceFinding(data: CreateComplianceFinding) {
    const result = await db.execute(
      sql`INSERT INTO compliance_findings (org_id, vessel_id, source_type, severity, status, rule_code, title, description, found_at) VALUES (${data.orgId}, ${data.vesselId}, ${data.sourceType}, ${data.severity}, ${data.status || "open"}, ${data.ruleCode}, ${data.title}, ${data.description}, NOW()) RETURNING *`
    );
    return result.rows[0];
  }

  async acknowledgeComplianceFinding(id: string, _details: unknown, orgId: string) {
    const result = await db.execute(
      sql`UPDATE compliance_findings SET status = 'acknowledged' WHERE id = ${id} AND org_id = ${orgId} RETURNING *`
    );
    return result.rows[0];
  }

  async resolveComplianceFinding(id: string, _details: unknown, orgId: string) {
    const result = await db.execute(
      sql`UPDATE compliance_findings SET status = 'resolved', resolved_at = NOW() WHERE id = ${id} AND org_id = ${orgId} RETURNING *`
    );
    return result.rows[0];
  }

  async suppressComplianceFinding(id: string, _details: unknown, orgId: string) {
    const result = await db.execute(
      sql`UPDATE compliance_findings SET status = 'suppressed' WHERE id = ${id} AND org_id = ${orgId} RETURNING *`
    );
    return result.rows[0];
  }

  async deleteComplianceFinding(id: string, orgId: string) {
    // LR-3.5 / AUD-1: was a raw DELETE that destroyed compliance
    // evidence with no audit trail and broke regulator-grade
    // reproducibility (flag-cluster history disappears). We now
    // soft-archive: status='archived' + archived_at=NOW(). The
    // record stays queryable for audit and CSV/PDF exports filter
    // it out by default. The DELETE-on-DELETE semantics callers
    // expect are preserved at the API level (the row no longer
    // appears in the default-filtered finding list), but the
    // audit chain is intact.
    // The schema has no dedicated `archived_at` column; `updated_at`
    // already auto-stamps on UPDATE and records the archival time.
    await db.execute(sql`
      UPDATE compliance_findings
         SET status = 'archived',
             updated_at = NOW()
       WHERE id = ${id}
         AND org_id = ${orgId}
    `);
  }

  async getComplianceRules(orgId: string, filters?: ComplianceRuleFilters) {
    const result = await db.execute(
      sql`SELECT * FROM compliance_rules WHERE org_id = ${orgId} ${filters?.sourceType ? sql`AND source_type = ${filters.sourceType}` : sql``} ${filters?.category ? sql`AND category = ${filters.category}` : sql``} ${filters?.enabled !== undefined ? sql`AND enabled = ${filters.enabled}` : sql``} ORDER BY rule_name ASC`
    );
    return result.rows;
  }

  async getComplianceRuleById(id: string, orgId: string) {
    const result = await db.execute(
      sql`SELECT * FROM compliance_rules WHERE id = ${id} AND org_id = ${orgId}`
    );
    return result.rows[0];
  }

  async createComplianceRule(data: CreateComplianceRule) {
    const result = await db.execute(
      sql`INSERT INTO compliance_rules (org_id, source_type, category, rule_name, rule_code, description, severity, enabled) VALUES (${data.orgId}, ${data.sourceType}, ${data.category}, ${data.ruleName}, ${data.ruleCode}, ${data.description}, ${data.severity}, ${data.enabled ?? true}) RETURNING *`
    );
    return result.rows[0];
  }

  async updateComplianceRule(id: string, updates: UpdateComplianceRule, orgId: string) {
    const result = await db.execute(
      sql`UPDATE compliance_rules SET rule_name = COALESCE(${updates.ruleName}, rule_name), description = COALESCE(${updates.description}, description), severity = COALESCE(${updates.severity}, severity), enabled = COALESCE(${updates.enabled}, enabled) WHERE id = ${id} AND org_id = ${orgId} RETURNING *`
    );
    return result.rows[0];
  }

  async deleteComplianceRule(id: string, orgId: string) {
    await db.execute(sql`DELETE FROM compliance_rules WHERE id = ${id} AND org_id = ${orgId}`);
  }
}

export const dbComplianceStorage = new DbComplianceStorage();
