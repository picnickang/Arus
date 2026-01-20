/**
 * LP Optimizer - Index
 * 
 * Modularized Linear Programming Maintenance Optimizer
 * 
 * Original: 926 lines
 * Modularized into 7 files:
 * - types.ts (~75 lines): Type definitions
 * - estimation-helpers.ts (~95 lines): Duration/parts estimation
 * - metrics-recorder.ts (~85 lines): Prometheus metrics
 * - persistence.ts (~115 lines): Database operations
 * - lp-formulation.ts (~240 lines): LP problem formulation
 * - job-loader.ts (~85 lines): Job data loading
 * - optimizer.ts (~105 lines): Main optimizer class
 */

export { LinearProgrammingOptimizer } from "./optimizer.js";

export type {
  OptimizationConstraints,
  MaintenanceJob,
  OptimizationResult,
} from "./types.js";

export {
  getPriorityCost,
  getRequiredSkillLevel,
  getRequiredSkillLevelFromPriority,
  estimateWorkOrderDuration,
  estimatePartsRequired,
  estimatePartsFromDescription,
  createEmptyResult,
} from "./estimation-helpers.js";

export {
  recordOptimizationMetrics,
  recordEmptyRun,
  recordErrorRun,
} from "./metrics-recorder.js";

export {
  persistOptimizationResults,
  getOptimizationResults,
} from "./persistence.js";

export {
  formulateLinearProgram,
  relaxConstraints,
  processSolution,
} from "./lp-formulation.js";

export {
  getPendingMaintenanceJobs,
  getPartsAvailability,
} from "./job-loader.js";
