/**
 * Crew Scheduler OR-Tools - Backward Compatible Shim
 * Re-exports all functionality from modular implementation
 */

export { ENGINE_GREEDY, ENGINE_OR_TOOLS } from "./crew-scheduler-ortools/index.js";
export type {
  SchedulingPreferences,
  ConstraintScheduleRequest,
  Assignment,
  UnfilledShift,
  ScheduleResult,
} from "./crew-scheduler-ortools/index.js";
export {
  overlaps,
  toUtc,
  shiftWindow,
  leaveOverlaps,
  isWindowAllowed,
  isNightShift,
  hasValidCertification,
  scheduleWithConstraints,
  planWithEngine,
} from "./crew-scheduler-ortools/index.js";
