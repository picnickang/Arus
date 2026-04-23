export const HOUR_W = 24;
export const HDR_H = 26;
export const HDR_H_TOTAL = HDR_H + 6;
export const HDR_H_LINE = `${HDR_H_TOTAL}px` as const;
export const CELL_H = 18;
export const GRID_COLS = `110px repeat(24, ${HOUR_W}px) 75px 75px` as const;
export const HOURS = Array.from({ length: 24 }, (_, i) => i) as readonly number[];

export function hourValue(row: Record<string, number | string>, h: number): number {
  return Number(row[`h${h}`]) || 0;
}

export function isNight(h: number): boolean {
  return h >= 20 || h < 6;
}

export function parseLocalDate(dateStr: string): Date {
  return new Date(`${dateStr}T00:00:00`);
}
