/**
 * Compliance Rules Engine Core
 * 
 * Main engine class for running compliance checks.
 */

import { db } from "../../db-config";
import { sql } from "drizzle-orm";
import { vesselService } from "../../repositories";
import type { ComplianceFinding } from "@shared/schema";
import { emailNotificationService } from "../email-notification-service";
import type { RuleContext, RuleEvaluator } from "./types.js";
import { DEFAULT_DECK_RULES, DEFAULT_ENGINE_RULES } from "./default-rules.js";
import {
  evaluateDeckMissingWatch,
  evaluateDeckMissingHourly,
  evaluateDeckUnsigned,
  evaluateDeckMissingPosition,
} from "./deck-evaluators.js";
import {
  evaluateEngineMissingWatch,
  evaluateEngineOvertemp,
  evaluateEngineOverload,
  evaluateLowFuel,
  evaluateEngineUnsigned,
  evaluateEngineMissingHourly,
  evaluateBilgeHigh,
} from "./engine-evaluators.js";

async function getComplianceRules(orgId: string, filters?: any): Promise<any[]> {
  const result = await db.execute(sql`SELECT * FROM compliance_rules WHERE org_id = ${orgId} ${filters?.sourceType ? sql`AND source_type = ${filters.sourceType}` : sql``} ${filters?.category ? sql`AND category = ${filters.category}` : sql``} ${filters?.enabled !== undefined ? sql`AND enabled = ${filters.enabled}` : sql``} ORDER BY rule_name ASC`);
  return result.rows;
}

async function getComplianceFindings(orgId: string, filters?: any): Promise<any[]> {
  const result = await db.execute(sql`SELECT * FROM compliance_findings WHERE org_id = ${orgId} ${filters?.vesselId ? sql`AND vessel_id = ${filters.vesselId}` : sql``} ${filters?.sourceType ? sql`AND source_type = ${filters.sourceType}` : sql``} ${filters?.severity ? sql`AND severity = ${filters.severity}` : sql``} ${filters?.status ? sql`AND status = ${filters.status}` : sql``} ${filters?.ruleCode ? sql`AND rule_code = ${filters.ruleCode}` : sql``} ${filters?.startDate ? sql`AND found_at >= ${filters.startDate}::timestamp` : sql``} ${filters?.endDate ? sql`AND found_at <= ${filters.endDate}::timestamp` : sql``} ORDER BY found_at DESC`);
  return result.rows;
}

async function createComplianceFinding(data: any): Promise<any> {
  const result = await db.execute(sql`INSERT INTO compliance_findings (org_id, vessel_id, source_type, severity, status, rule_code, title, description, found_at) VALUES (${data.orgId}, ${data.vesselId}, ${data.sourceType}, ${data.severity}, ${data.status || 'open'}, ${data.ruleCode}, ${data.title}, ${data.description}, NOW()) RETURNING *`);
  return result.rows[0];
}

async function createComplianceRule(data: any): Promise<any> {
  const result = await db.execute(sql`INSERT INTO compliance_rules (org_id, source_type, category, rule_name, rule_code, description, severity, enabled) VALUES (${data.orgId}, ${data.sourceType}, ${data.category}, ${data.ruleName}, ${data.ruleCode}, ${data.description}, ${data.severity}, ${data.enabled ?? true}) RETURNING *`);
  return result.rows[0];
}

async function resolveComplianceFindingInDb(id: string, _data: any, orgId: string): Promise<any> {
  const result = await db.execute(sql`UPDATE compliance_findings SET status = 'resolved', resolved_at = NOW() WHERE id = ${id} AND org_id = ${orgId} RETURNING *`);
  return result.rows[0];
}

async function acknowledgeComplianceFindingInDb(id: string, _data: any, orgId: string): Promise<any> {
  const result = await db.execute(sql`UPDATE compliance_findings SET status = 'acknowledged' WHERE id = ${id} AND org_id = ${orgId} RETURNING *`);
  return result.rows[0];
}

async function suppressComplianceFindingInDb(id: string, _data: any, orgId: string): Promise<any> {
  const result = await db.execute(sql`UPDATE compliance_findings SET status = 'suppressed' WHERE id = ${id} AND org_id = ${orgId} RETURNING *`);
  return result.rows[0];
}

export class ComplianceRulesEngine {
  private ruleEvaluators: Map<string, RuleEvaluator> = new Map();

  constructor() {
    this.registerBuiltInRules();
  }

  private registerBuiltInRules() {
    this.ruleEvaluators.set("DLB_MISSING_WATCH", evaluateDeckMissingWatch);
    this.ruleEvaluators.set("DLB_MISSING_HOURLY", evaluateDeckMissingHourly);
    this.ruleEvaluators.set("DLB_UNSIGNED", evaluateDeckUnsigned);
    this.ruleEvaluators.set("DLB_MISSING_POSITION", evaluateDeckMissingPosition);
    this.ruleEvaluators.set("ER_MISSING_WATCH", evaluateEngineMissingWatch);
    this.ruleEvaluators.set("ER_ME_OVERTEMP", evaluateEngineOvertemp);
    this.ruleEvaluators.set("ER_ME_OVERLOAD", evaluateEngineOverload);
    this.ruleEvaluators.set("ER_LOW_FUEL", evaluateLowFuel);
    this.ruleEvaluators.set("ER_UNSIGNED", evaluateEngineUnsigned);
    this.ruleEvaluators.set("ER_MISSING_HOURLY", evaluateEngineMissingHourly);
    this.ruleEvaluators.set("ER_BILGE_HIGH", evaluateBilgeHigh);
  }

  async seedDefaultRules(orgId: string): Promise<void> {
    const existingRules = await getComplianceRules(orgId);

    if (existingRules.length > 0) {
      console.log(`[ComplianceRulesEngine] Rules already exist for org ${orgId}, skipping seed`);
      return;
    }

    const allRules = [...DEFAULT_DECK_RULES, ...DEFAULT_ENGINE_RULES];

    for (const rule of allRules) {
      await createComplianceRule({
        ...rule,
        orgId,
      });
    }

    console.log(`[ComplianceRulesEngine] Seeded ${allRules.length} default rules for org ${orgId}`);
  }

  async runComplianceCheck(ctx: RuleContext): Promise<{
    newFindings: ComplianceFinding[];
    autoResolved: ComplianceFinding[];
    stillOpen: ComplianceFinding[];
  }> {
    const { orgId, vesselId, logDate, logType } = ctx;
    const sourceType = logType === "deck" ? "logbook_deck" : "logbook_engine";

    const rules = await getComplianceRules(orgId, {
      sourceType,
      enabled: true,
    });

    const newFindings: ComplianceFinding[] = [];
    const autoResolved: ComplianceFinding[] = [];
    const stillOpen: ComplianceFinding[] = [];

    for (const rule of rules) {
      const evaluator = this.ruleEvaluators.get(rule.ruleCode);
      if (!evaluator) {
        console.warn(`[ComplianceRulesEngine] No evaluator for rule ${rule.ruleCode}`);
        continue;
      }

      try {
        const existingFindings = await getComplianceFindings(orgId, {
          vesselId,
          ruleCode: rule.ruleCode,
          status: "open",
        });
        const existingForDate = existingFindings.filter((f) => f.logDate === logDate);

        const result = await evaluator(ctx, (rule.ruleConfig as Record<string, unknown>) ?? {});

        if (result.skipped) {
          console.log(
            `[ComplianceRulesEngine] Rule ${rule.ruleCode} skipped: ${result.skipReason || "no log data"}`
          );
          stillOpen.push(...existingFindings);
          continue;
        }

        if (result.triggered && result.finding) {
          if (existingForDate.length === 0) {
            const inserted = await createComplianceFinding({
              ...result.finding,
              orgId,
              vesselId,
              logDate,
            });
            newFindings.push(inserted);

            if (rule.notifyOnTrigger) {
              try {
                const vessel = await vesselService.getVessel(vesselId);
                const vesselName = vessel?.name || vesselId;
                await emailNotificationService.sendComplianceNotification(inserted, vesselName, orgId);
              } catch (notifyError) {
                console.error(
                  `[ComplianceRulesEngine] Failed to send notification for finding ${inserted.id}:`,
                  notifyError
                );
              }
            }
          } else {
            stillOpen.push(...existingForDate);
          }
        } else {
          for (const finding of existingForDate) {
            const resolved = await resolveComplianceFindingInDb(
              finding.id,
              {
                resolvedByUserId: "system",
                resolvedByUserName: "Compliance Engine",
                resolutionNotes: "Automatically resolved - condition no longer detected",
              },
              orgId
            );
            if (resolved) {
              autoResolved.push(resolved);
            }
          }
        }
      } catch (error) {
        console.error(`[ComplianceRulesEngine] Error evaluating rule ${rule.ruleCode}:`, error);
      }
    }

    return { newFindings, autoResolved, stillOpen };
  }

  async resolveFinding(
    findingId: string,
    orgId: string,
    resolvedByUserId: string,
    resolvedByUserName: string,
    resolutionNotes?: string
  ): Promise<ComplianceFinding | null> {
    const finding = await resolveComplianceFindingInDb(
      findingId,
      {
        resolvedByUserId,
        resolvedByUserName,
        resolutionNotes,
      },
      orgId
    );
    return finding || null;
  }

  async acknowledgeFinding(
    findingId: string,
    orgId: string,
    acknowledgedByUserId: string,
    acknowledgedByUserName: string
  ): Promise<ComplianceFinding | null> {
    const finding = await acknowledgeComplianceFindingInDb(
      findingId,
      {
        acknowledgedByUserId,
        acknowledgedByUserName,
      },
      orgId
    );
    return finding || null;
  }

  async suppressFinding(
    findingId: string,
    orgId: string,
    suppressedUntil: Date,
    suppressedReason: string
  ): Promise<ComplianceFinding | null> {
    const finding = await suppressComplianceFindingInDb(
      findingId,
      {
        suppressedUntil,
        suppressedReason,
      },
      orgId
    );
    return finding || null;
  }
}

export const complianceRulesEngine = new ComplianceRulesEngine();
