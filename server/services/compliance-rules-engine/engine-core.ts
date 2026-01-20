/**
 * Compliance Rules Engine Core
 * 
 * Main engine class for running compliance checks.
 */

import { storage } from "../../storage";
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
    const existingRules = await storage.getComplianceRules(orgId);

    if (existingRules.length > 0) {
      console.log(`[ComplianceRulesEngine] Rules already exist for org ${orgId}, skipping seed`);
      return;
    }

    const allRules = [...DEFAULT_DECK_RULES, ...DEFAULT_ENGINE_RULES];

    for (const rule of allRules) {
      await storage.createComplianceRule({
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

    const rules = await storage.getComplianceRules(orgId, {
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
        const existingFindings = await storage.getComplianceFindings(orgId, {
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
            const inserted = await storage.createComplianceFinding({
              ...result.finding,
              orgId,
              vesselId,
              logDate,
            });
            newFindings.push(inserted);

            if (rule.notifyOnTrigger) {
              try {
                const vessel = await storage.getVessel(vesselId);
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
            const resolved = await storage.resolveComplianceFinding(
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
    const finding = await storage.resolveComplianceFinding(
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
    const finding = await storage.acknowledgeComplianceFinding(
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
    const finding = await storage.suppressComplianceFinding(
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
