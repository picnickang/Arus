import { db } from "../../db-config";
import { sql } from "drizzle-orm";

export class DbComplianceStorage {
  async getComplianceFindings(orgId: string, filters?: any) {
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

  async createComplianceFinding(data: any) {
    const result = await db.execute(
      sql`INSERT INTO compliance_findings (org_id, vessel_id, source_type, severity, status, rule_code, title, description, found_at) VALUES (${data.orgId}, ${data.vesselId}, ${data.sourceType}, ${data.severity}, ${data.status || "open"}, ${data.ruleCode}, ${data.title}, ${data.description}, NOW()) RETURNING *`
    );
    return result.rows[0];
  }

  async acknowledgeComplianceFinding(id: string, _details: any, orgId: string) {
    const result = await db.execute(
      sql`UPDATE compliance_findings SET status = 'acknowledged' WHERE id = ${id} AND org_id = ${orgId} RETURNING *`
    );
    return result.rows[0];
  }

  async resolveComplianceFinding(id: string, _details: any, orgId: string) {
    const result = await db.execute(
      sql`UPDATE compliance_findings SET status = 'resolved', resolved_at = NOW() WHERE id = ${id} AND org_id = ${orgId} RETURNING *`
    );
    return result.rows[0];
  }

  async suppressComplianceFinding(id: string, _details: any, orgId: string) {
    const result = await db.execute(
      sql`UPDATE compliance_findings SET status = 'suppressed' WHERE id = ${id} AND org_id = ${orgId} RETURNING *`
    );
    return result.rows[0];
  }

  async deleteComplianceFinding(id: string, orgId: string) {
    await db.execute(sql`DELETE FROM compliance_findings WHERE id = ${id} AND org_id = ${orgId}`);
  }

  async getComplianceRules(orgId: string, filters?: any) {
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

  async createComplianceRule(data: any) {
    const result = await db.execute(
      sql`INSERT INTO compliance_rules (org_id, source_type, category, rule_name, rule_code, description, severity, enabled) VALUES (${data.orgId}, ${data.sourceType}, ${data.category}, ${data.ruleName}, ${data.ruleCode}, ${data.description}, ${data.severity}, ${data.enabled ?? true}) RETURNING *`
    );
    return result.rows[0];
  }

  async updateComplianceRule(id: string, updates: any, orgId: string) {
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
