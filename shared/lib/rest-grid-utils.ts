/**
 * Rest Grid Utilities
 *
 * Shared utilities for STCW/MLC Hours of Rest grid management.
 * Consolidates duplicate implementations per SonarQube duplication reduction guidance.
 */

export type DayRow = { date: string } & Record<`h${number}`, number>;

export interface RestGridCrew {
  id: string;
  name: string;
  rank: string;
  vesselId?: string;
}

export interface RestGridVessel {
  id: string;
  name: string;
  type: string;
  orgId: string;
}

export interface ShiftPattern {
  id: string;
  name: string;
  description: string;
  pattern: number[];
}

export interface GridMeta {
  vessel_id: string;
  crew_id: string;
  crew_name: string;
  rank: string;
  month: string;
  year: number;
}

export type ViewMode = "month" | "week" | "mobile";
export type SaveStatus = "saved" | "saving" | "unsaved";

export const MONTHS = [
  { label: "JANUARY", days: 31 },
  { label: "FEBRUARY", days: 29 },
  { label: "MARCH", days: 31 },
  { label: "APRIL", days: 30 },
  { label: "MAY", days: 31 },
  { label: "JUNE", days: 30 },
  { label: "JULY", days: 31 },
  { label: "AUGUST", days: 31 },
  { label: "SEPTEMBER", days: 30 },
  { label: "OCTOBER", days: 31 },
  { label: "NOVEMBER", days: 30 },
  { label: "DECEMBER", days: 31 },
];

export const DEFAULT_PATTERNS: ShiftPattern[] = [
  {
    id: "watch-4-8",
    name: "4-8 Watch Rotation",
    description: "4 hours on, 8 hours off",
    pattern: [1, 1, 1, 1, 0, 0, 0, 0, 1, 1, 1, 1, 0, 0, 0, 0, 1, 1, 1, 1, 0, 0, 0, 0],
  },
  {
    id: "watch-6-6",
    name: "6-6 Split Shift",
    description: "6 hours work, 6 hours rest",
    pattern: [0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1],
  },
  {
    id: "night-watch",
    name: "Night Watch",
    description: "Work 20:00-04:00",
    pattern: [0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0],
  },
  {
    id: "day-shift",
    name: "Day Shift",
    description: "Work 08:00-18:00, rest otherwise",
    pattern: [1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1],
  },
];

export function createDefaultGridMeta(): GridMeta {
  return {
    vessel_id: "all",
    crew_id: "",
    crew_name: "",
    rank: "Chief Eng",
    month: "AUGUST",
    year: new Date().getUTCFullYear(),
  };
}

export function ymd(year: number, mIdx: number, d: number): string {
  return new Date(Date.UTC(year, mIdx, d)).toISOString().slice(0, 10);
}

export function emptyMonth(year: number, monthLabel: string): DayRow[] {
  const idx = MONTHS.findIndex((m) => m.label === monthLabel);
  const month = MONTHS[idx];
  const days =
    idx === 1
      ? year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0)
        ? 29
        : 28
      : month?.days ?? 30;
  const rows: DayRow[] = [];
  for (let d = 1; d <= days; d++) {
    const row = { date: ymd(year, idx, d) } as Record<string, string | number>;
    for (let h = 0; h < 24; h++) {
      row[`h${h}`] = 0;
    }
    rows.push(row as DayRow);
  }
  return rows;
}

export function toCSV(rows: DayRow[]): string {
  if (!rows.length) {
    return "";
  }
  const header = ["date", ...Array.from({ length: 24 }, (_, i) => `h${i}`)];
  const lines = [header.join(",")];
  for (const r of rows) {
    lines.push(header.map((k) => String(r[k as keyof DayRow] ?? "")).join(","));
  }
  return lines.join("\n");
}

export function parseCSV(text: string): DayRow[] {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) {
    return [];
  }
  const firstLine = lines[0];
  if (firstLine === undefined) return [];
  const header = firstLine.split(",").map((s) => s.trim());
  const out: DayRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (line === undefined) continue;
    const col = line.split(",");
    const row = {} as Record<string, string | number>;
    header.forEach((h, j) => {
      const raw = col[j];
      row[h] =
        j < col.length
          ? h === "date"
            ? raw ?? ""
            : Number(raw || 0)
          : h === "date"
          ? ""
          : 0;
    });
    out.push(row as DayRow);
  }
  return out;
}

export function sum24(r: DayRow): number {
  let s = 0;
  for (let h = 0; h < 24; h++) {
    s += (r[`h${h}` as keyof DayRow] as number) || 0;
  }
  return s;
}

export function chunks(r: DayRow): Array<[number, number]> {
  const segs: Array<[number, number]> = [];
  let cur = -1;
  for (let h = 0; h < 24; h++) {
    const v = (r[`h${h}` as keyof DayRow] as number) || 0;
    if (v === 1 && cur === -1) {
      cur = h;
    }
    if ((v === 0 || h === 23) && cur !== -1) {
      const end = v === 0 ? h : 24;
      segs.push([cur, end]);
      cur = -1;
    }
  }
  return segs;
}

export function splitOK(r: DayRow): boolean {
  const segs = chunks(r);
  const one6 = segs.some(([a, b]) => b - a >= 6);
  return segs.length <= 2 && one6;
}

export function minRest24Around(idx: number, rows: DayRow[]): number {
  const flat: number[] = [];
  rows.forEach((r) => {
    for (let h = 0; h < 24; h++) {
      flat.push((r[`h${h}` as keyof DayRow] as number) || 0);
    }
  });
  const base = idx * 24;
  let minv = 999;
  for (let k = 1; k <= 24; k++) {
    const start = Math.max(0, base + k - 24);
    const end = base + k;
    const v = flat.slice(start, end).reduce((a, b) => a + b, 0);
    if (v < minv) {
      minv = v;
    }
  }
  return minv;
}

export function getSaveStatusBadgeVariant(status: SaveStatus): {
  variant: "outline";
  className: string;
  icon: "save" | "clock" | "alert";
  text: string;
} {
  switch (status) {
    case "saved":
      return {
        variant: "outline",
        className: "bg-emerald-50 text-emerald-700 border-emerald-200",
        icon: "save",
        text: "Saved",
      };
    case "saving":
      return {
        variant: "outline",
        className: "bg-blue-50 text-blue-700 border-blue-200",
        icon: "clock",
        text: "Saving...",
      };
    case "unsaved":
      return {
        variant: "outline",
        className: "bg-amber-50 text-amber-700 border-amber-200",
        icon: "alert",
        text: "Unsaved changes",
      };
  }
}

export function getWeekViewData(rows: DayRow[], weekOffset: number): DayRow[] {
  const start = weekOffset * 7;
  return rows.slice(start, start + 7);
}

export function calculateWeekCount(rows: DayRow[]): number {
  return Math.ceil(rows.length / 7);
}

export function filterCrewByVessel(crew: RestGridCrew[], vesselId: string): RestGridCrew[] {
  if (!vesselId || vesselId === "all") {
    return crew;
  }
  return crew.filter((c) => c.vesselId === vesselId);
}

export function isGridReady(
  vesselId: string,
  crewId: string
): { isVesselSelected: boolean; isCrewSelected: boolean; isReadyForActions: boolean } {
  const isVesselSelected = !!vesselId;
  const isCrewSelected = crewId && crewId !== "";
  const isReadyForActions = isVesselSelected && isCrewSelected;
  return {
    isVesselSelected: !!isVesselSelected,
    isCrewSelected: !!isCrewSelected,
    isReadyForActions: !!isReadyForActions,
  };
}
