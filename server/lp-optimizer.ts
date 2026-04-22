/**
 * LP Optimizer - Backward Compatibility Shim
 *
 * This file re-exports from the modular lp-optimizer/ directory.
 * New code should import from './lp-optimizer/index.js'
 *
 * Original: 926 lines → 8 modular files
 */

export { LinearProgrammingOptimizer } from "./lp-optimizer/index.js";

export type {
  OptimizationConstraints,
  MaintenanceJob,
  OptimizationResult,
} from "./lp-optimizer/index.js";
