/**
 * Singapore Time Utilities
 */

import { SGT_TIMEZONE, SGT_OFFSET_HOURS } from "./constants";

export function isNightShift(time: Date): boolean {
  const sgtHour = Number.parseInt(
    new Intl.DateTimeFormat("en-GB", { timeZone: SGT_TIMEZONE, hour: "2-digit", hour12: false }).format(time)
  );
  return sgtHour >= 20 || sgtHour < 6;
}

export function toDateSgt(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: SGT_TIMEZONE, year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

export function toTimeSgt(date: Date): string {
  return new Intl.DateTimeFormat("en-GB", { timeZone: SGT_TIMEZONE, hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }).format(date);
}

export function formatSgtDisplay(date: Date): string {
  return `${toDateSgt(date)} ${toTimeSgt(date)} SGT`;
}

export function nowIsoSgt(): string {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: SGT_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });

  const parts = formatter.formatToParts(now);
  const partsMap = parts.reduce((acc, part) => { acc[part.type] = part.value; return acc; }, {} as any);

  return `${partsMap.year}-${partsMap.month}-${partsMap.day}T${partsMap.hour}:${partsMap.minute}:${partsMap.second}+08:00`;
}

export function startOfDaySgt(date: Date): Date {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: SGT_TIMEZONE, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date);
  const partsMap = parts.reduce((acc, part) => { acc[part.type] = Number.parseInt(part.value); return acc; }, {} as any);
  return new Date(Date.UTC(partsMap.year, partsMap.month - 1, partsMap.day, -SGT_OFFSET_HOURS, 0, 0, 0));
}

export function endOfDaySgt(date: Date): Date {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: SGT_TIMEZONE, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date);
  const partsMap = parts.reduce((acc, part) => { acc[part.type] = Number.parseInt(part.value); return acc; }, {} as any);
  return new Date(Date.UTC(partsMap.year, partsMap.month - 1, partsMap.day, 23 - SGT_OFFSET_HOURS, 59, 59, 999));
}
