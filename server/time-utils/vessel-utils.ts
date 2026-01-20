/**
 * Vessel Time Utilities
 */

import { SGT_TIMEZONE } from "./constants";

export function getVesselTimeInfo(
  utcTime: Date,
  vesselTimezone: string = SGT_TIMEZONE
): { date: string; time: string; timezone: string; display: string } {
  try {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: vesselTimezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    }).formatToParts(utcTime);

    const partsMap = parts.reduce((acc, part) => { acc[part.type] = part.value; return acc; }, {} as any);

    const date = `${partsMap.year}-${partsMap.month}-${partsMap.day}`;
    const time = `${partsMap.hour}:${partsMap.minute}:${partsMap.second}`;
    const timezone = vesselTimezone === SGT_TIMEZONE ? "SGT" : vesselTimezone;

    return { date, time, timezone, display: `${date} ${time} ${timezone}` };
  } catch (_error) {
    console.warn(`Invalid timezone ${vesselTimezone}, falling back to Singapore Time`);
    return getVesselTimeInfo(utcTime, SGT_TIMEZONE);
  }
}

export function toVesselTime(utcTime: Date, vesselTimezone?: string): Date {
  return utcTime;
}
