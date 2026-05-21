/**
 * Rest Grid Utilities
 *
 * Re-exports shared rest grid utilities for backward compatibility.
 * See @shared/lib/rest-grid-utils.ts for implementation.
 */

export {
  type DayRow,
  type RestGridCrew as Crew,
  type RestGridVessel as Vessel,
  type ShiftPattern,
  type GridMeta,
  type ViewMode,
  type SaveStatus,
  MONTHS,
  DEFAULT_PATTERNS,
  createDefaultGridMeta,
  ymd,
  emptyMonth,
  toCSV,
  parseCSV,
  sum24,
  chunks,
  splitOK,
  minRest24Around,
  getSaveStatusBadgeVariant,
  getWeekViewData,
  calculateWeekCount,
  filterCrewByVessel,
  isGridReady,
} from "@shared/lib/rest-grid-utils";
