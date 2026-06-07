/**
 * Compliance Rules Engine Core
 *
 * Main engine class for running compliance checks.
 */

import { db } from "../../db-config";
import { and, asc, desc, eq, gte, lte } from "drizzle-orm";
import { vesselService } from "../../repositories";
import {
  complianceFindings,
  complianceRules,
  type ComplianceFinding,
  type ComplianceRule,
  type InsertComplianceFinding,
} from "@shared/schema-runtime";
import { emailNotificationService } from "../email-notification-service";
import type { RuleContext, RuleEvaluator } from "./types.js";
import { DEFAULT_DECK_RULES, DEFAULT_ENGINE_RULES } from "./default-rules.js";
import { createLogger } from "../../lib/structured-logger";
const logger = createLogger("Services:ComplianceRulesEngine:EngineCore");
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

interface RulesFilter {
  sourceType?: string;
  category?: string;
  enabled?: boolean;
}

interface FindingsFilter {
  vesselId?: string;
  sourceType?: string;
  severity?: string;
  status?: string;
  ruleCode?: string;
  startDate?: string | Date;
  endDate?: string | Date;
}

type NewFindingInput = InsertComplianceFinding & {
  title?: string;
  description?: string;
};

type NewRuleInput = {
  orgId: string;
  sourceType: string;
  category: string;
  ruleName: string;
  ruleCode: string;
  description?: string | null | undefined;
  severity?: string | undefined;
  ruleType?: string | undefined;
  enabled?: boolean | null | undefined;
  notifyEmails?: string[] | null | undefined;
  appliesTo?: string[] | null | undefined;
  conditions?: unknown;
  actions?: unknown;
};

async function getComplianceRules(
  orgId: string,
  filters?: RulesFilter
): Promise<ComplianceRule[]> {
  const conditions = [eq(complianceRules.orgId, orgId)];
  if (filters?.sourceType) {
    conditions.push(eq(complianceRules.sourceType, filters.sourceType));
  }
  if (filters?.category) {
    conditions.push(eq(complianceRules.category, filters.category));
  }
  if (filters?.enabled !== undefined) {
    conditions.push(eq(complianceRules.enabled, filters.enabled));
  }
  return db
    .select()
    .from(complianceRules)
    .where(and(...conditions))
    .orderBy(asc(complianceRules.ruleName));
}

function toDate(value: string | Date): Date {
  return value instanceof Date ? value : new Date(value);
}

async function getComplianceFindings(
  orgId: string,
  filters?: FindingsFilter
): Promise<ComplianceFinding[]> {
  const conditions = [eq(complianceFindings.orgId, orgId)];
  if (filters?.vesselId) {
    conditions.push(eq(complianceFindings.vesselId, filters.vesselId));
  }
  if (filters?.sourceType) {
    conditions.push(eq(complianceFindings.sourceType, filters.sourceType));
  }
  if (filters?.severity) {
    conditions.push(eq(complianceFindings.severity, filters.severity));
  }
  if (filters?.status) {
    conditions.push(eq(complianceFindings.status, filters.status));
  }
  if (filters?.ruleCode) {
    conditions.push(eq(complianceFindings.ruleCode, filters.ruleCode));
  }
  if (filters?.startDate) {
    conditions.push(gte(complianceFindings.foundAt, toDate(filters.startDate)));
  }
  if (filters?.endDate) {
    conditions.push(lte(complianceFindings.foundAt, toDate(filters.endDate)));
  }
  return db
    .select()
    .from(complianceFindings)
    .where(and(...conditions))
    .orderBy(desc(complianceFindings.foundAt));
}

async function createComplianceFinding(data: NewFindingInput): Promise<ComplianceFinding> {
  const [inserted] = await db
    .insert(complianceFindings)
    .values({
      orgId: data.orgId,
      vesselId: data.vesselId,
      logDate: data.logDate,
      sourceType: data.sourceType,
      ruleCode: data.ruleCode,
      ruleName: data.ruleName,
      category: data.category,
      severity: data.severity ?? "warning",
      message: data.message,
      status: data.status ?? "open",
      context: data.context,
      linkedDeckLogDayId: data.linkedDeckLogDayId,
      linkedEngineLogDayId: data.linkedEngineLogDayId,
      linkedEquipmentIds: data.linkedEquipmentIds,
      linkedWorkOrderIds: data.linkedWorkOrderIds,
      linkedCrewIds: data.linkedCrewIds,
      linkedAlertIds: data.linkedAlertIds,
    })
    .returning();
  if (!inserted) {
    throw new Error("createComplianceFinding: insert returned no rows");
  }
  return inserted;
}

async function createComplianceRule(data: NewRuleInput): Promise<ComplianceRule> {
  const [inserted] = await db
    .insert(complianceRules)
    .values({
      orgId: data.orgId,
      sourceType: data.sourceType,
      category: data.category,
      ruleName: data.ruleName,
      ruleCode: data.ruleCode,
      ruleType: data.ruleType ?? "system",
      description: data.description ?? null,
      severity: data.severity ?? "warning",
      enabled: data.enabled ?? true,
    })
    .returning();
  if (!inserted) {
    throw new Error("createComplianceRule: insert returned no rows");
  }
  return inserted;
}

interface ResolutionPayload {
  resolvedByUserId: string;
  resolvedByUserName: string;
  resolutionNotes?: string | undefined;
}

interface AcknowledgePayload {
  acknowledgedByUserId: string;
  acknowledgedByUserName: string;
}

interface SuppressPayload {
  suppressedUntil: Date;
  suppressedReason: string;
}

async function resolveComplianceFindingInDb(
  id: string,
  data: ResolutionPayload,
  orgId: string
): Promise<ComplianceFinding | undefined> {
  const [updated] = await db
    .update(complianceFindings)
    .set({
      status: "resolved",
      resolvedAt: new Date(),
      resolvedByUserId: data.resolvedByUserId,
      resolvedByUserName: data.resolvedByUserName,
      resolutionNotes: data.resolutionNotes ?? null,
    })
    .where(and(eq(complianceFindings.id, id), eq(complianceFindings.orgId, orgId)))
    .returning();
  return updated;
}

async function acknowledgeComplianceFindingInDb(
  id: string,
  data: AcknowledgePayload,
  orgId: string
): Promise<ComplianceFinding | undefined> {
  const [updated] = await db
    .update(complianceFindings)
    .set({
      status: "acknowledged",
      acknowledgedAt: new Date(),
      acknowledgedByUserId: data.acknowledgedByUserId,
      acknowledgedByUserName: data.acknowledgedByUserName,
    })
    .where(and(eq(complianceFindings.id, id), eq(complianceFindings.orgId, orgId)))
    .returning();
  return updated;
}

async function suppressComplianceFindingInDb(
  id: string,
  data: SuppressPayload,
  orgId: string
): Promise<ComplianceFinding | undefined> {
  const [updated] = await db
    .update(complianceFindings)
    .set({
      status: "suppressed",
      suppressedUntil: data.suppressedUntil,
      suppressedReason: data.suppressedReason,
    })
    .where(and(eq(complianceFindings.id, id), eq(complianceFindings.orgId, orgId)))
    .returning();
  return updated;
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
      logger.info(`[ComplianceRulesEngine] Rules already exist for org ${orgId}, skipping seed`);
      return;
    }

    const allRules = [...DEFAULT_DECK_RULES, ...DEFAULT_ENGINE_RULES];

    for (const rule of allRules) {
      await createComplianceRule({
        ...rule,
        orgId,
      });
    }

    logger.info(`[ComplianceRulesEngine] Seeded ${allRules.length} default rules for org ${orgId}`);
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
        logger.warn(`[ComplianceRulesEngine] No evaluator for rule ${rule.ruleCode}`);
        continue;
      }

      try {
        const existingFindings = await getComplianceFindings(orgId, {
          vesselId,
          ruleCode: rule.ruleCode,
          status: "open",
        });
        const existingForDate = existingFindings.filter((f) => f.logDate === logDate);

        const result = await evaluator(ctx, rule.ruleConfig ?? {});

        if (result.skipped) {
          logger.info(`[ComplianceRulesEngine] Rule ${rule.ruleCode} skipped: ${result.skipReason || "no log data"}`);
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
                await emailNotificationService.sendComplianceNotification(
                  inserted,
                  vesselName,
                  orgId
                );
              } catch (notifyError) {
                logger.error(`[ComplianceRulesEngine] Failed to send notification for finding ${inserted.id}:`, undefined, notifyError);
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
        logger.error(`[ComplianceRulesEngine] Error evaluating rule ${rule.ruleCode}:`, undefined, error);
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
