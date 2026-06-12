import type * as React from "react";
import type {
  calculateDayCompliance,
  calculateSummaryStats,
  Crew,
  DayRow,
  SaveStatus,
  Vessel,
  ViewMode,
} from "@/features/crew";

export interface ComplianceResult {
  compliant?: boolean;
  error?: string;
  message?: string;
  success?: boolean;
}

export interface HoursOfRestMeta {
  vessel_id: string;
  crew_id: string;
  crew_name: string;
  rank: string;
  month: string;
  year: number;
}

export interface UseHoursOfRestDataReturn {
  meta: HoursOfRestMeta;
  setMeta: React.Dispatch<React.SetStateAction<HoursOfRestMeta>>;
  rows: DayRow[];
  setRows: React.Dispatch<React.SetStateAction<DayRow[]>>;
  csv: string;
  setCsv: React.Dispatch<React.SetStateAction<string>>;
  result: ComplianceResult | null;
  mode: "GRID" | "CSV";
  setMode: React.Dispatch<React.SetStateAction<"GRID" | "CSV">>;
  history: DayRow[][];
  historyIndex: number;
  saveStatus: SaveStatus;
  viewMode: ViewMode;
  setViewMode: React.Dispatch<React.SetStateAction<ViewMode>>;
  weekOffset: number;
  setWeekOffset: React.Dispatch<React.SetStateAction<number>>;
  selectedDay: number | null;
  setSelectedDay: React.Dispatch<React.SetStateAction<number | null>>;
  liveCheck: boolean;
  setLiveCheck: React.Dispatch<React.SetStateAction<boolean>>;
  showSummary: boolean;
  setShowSummary: React.Dispatch<React.SetStateAction<boolean>>;
  customRestStart: string;
  setCustomRestStart: React.Dispatch<React.SetStateAction<string>>;
  customRestEnd: string;
  setCustomRestEnd: React.Dispatch<React.SetStateAction<string>>;
  monthsToCopy: string[];
  setMonthsToCopy: React.Dispatch<React.SetStateAction<string[]>>;
  monthsToRemove: string[];
  setMonthsToRemove: React.Dispatch<React.SetStateAction<string[]>>;
  isDragging: boolean;
  crew: Crew[];
  vessels: Vessel[];
  filteredCrew: Crew[];
  isVesselSelected: boolean;
  isCrewSelected: boolean;
  isReadyForActions: boolean;
  compliance: ReturnType<typeof calculateDayCompliance>;
  summaryStats: ReturnType<typeof calculateSummaryStats>;
  displayRows: DayRow[];
  undo: () => void;
  redo: () => void;
  startDrag: (dIdx: number, h: number) => void;
  onDrag: (dIdx: number, h: number) => void;
  endDrag: () => void;
  exportCSV: () => void;
  importCSV: () => void;
  clearAll: () => void;
  applyPattern: (patternId: string, dayIndices: number[]) => void;
  applyToWeekdays: (patternId: string) => void;
  applyToWeekends: (patternId: string) => void;
  copyWeek: (sourceWeek: number, targetWeeks: number[]) => void;
  applyCustomRestToAllDays: () => void;
  copyMonthToYear: () => Promise<void>;
  removeMonths: () => Promise<void>;
  upload: () => Promise<void>;
  runCheck: () => Promise<void>;
  exportPdf: () => Promise<void>;
  loadFromProposedPlan: () => void;
}
