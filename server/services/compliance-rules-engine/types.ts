/**
 * Compliance Rules Engine Types
 * 
 * Type definitions for compliance rule evaluation.
 */

import type { InsertComplianceFinding } from "@shared/schema";

export interface RuleContext {
  orgId: string;
  vesselId: string;
  logDate: string;
  logType: "deck" | "engine";
}

export interface RuleResult {
  triggered: boolean;
  skipped?: boolean;
  skipReason?: string;
  finding?: Omit<InsertComplianceFinding, "orgId">;
}

export type RuleEvaluator = (ctx: RuleContext, config: Record<string, unknown>) => Promise<RuleResult>;
