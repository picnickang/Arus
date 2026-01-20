/**
 * Compliance Rules Engine - Backward Compatibility Shim
 * 
 * This file re-exports all functions from the modularized compliance-rules-engine/ directory.
 * All functionality has been preserved in focused, maintainable modules.
 * 
 * @see server/services/compliance-rules-engine/index.ts for the modular implementation
 */

export {
  type RuleContext,
  type RuleResult,
  type RuleEvaluator,
  DEFAULT_DECK_RULES,
  DEFAULT_ENGINE_RULES,
  ComplianceRulesEngine,
  complianceRulesEngine,
} from "./compliance-rules-engine/index.js";
