/**
 * UTC Time Utilities
 */

import { cryptoRandomId } from "@shared/crypto-random";

export function nowUtc(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), now.getUTCHours(), now.getUTCMinutes(), now.getUTCSeconds(), now.getUTCMilliseconds()));
}

export function parseIsoUtc(isoString: string): Date {
  if (!isoString.endsWith("Z") && !isoString.match(/[+-]\d{2}:\d{2}$/)) {
    throw new Error(`Invalid UTC ISO string - must have 'Z' suffix or explicit offset: ${isoString}`);
  }

  try {
    const workingString = isoString.endsWith("Z") ? isoString.slice(0, -1) : isoString.split(/[+-]/)[0];
    const [datePart, timePart] = workingString.split("T");

    if (!datePart || !timePart) {throw new Error(`Invalid ISO string format: ${isoString}`);}

    const [yearStr, monthStr, dayStr] = datePart.split("-");
    const timeComponents = timePart.split(".")[0].split(":");
    const [hourStr, minuteStr, secondStr] = timeComponents;

    const year = Number.parseInt(yearStr, 10), month = Number.parseInt(monthStr, 10), day = Number.parseInt(dayStr, 10);
    const hour = Number.parseInt(hourStr, 10), minute = Number.parseInt(minuteStr, 10), second = Number.parseInt(secondStr, 10);

    if (month < 1 || month > 12) {throw new Error(`Invalid month: ${month}`);}
    if (day < 1 || day > 31) {throw new Error(`Invalid day: ${day}`);}
    if (hour < 0 || hour > 23) {throw new Error(`Invalid hour: ${hour}`);}
    if (minute < 0 || minute > 59) {throw new Error(`Invalid minute: ${minute}`);}
    if (second < 0 || second > 59) {throw new Error(`Invalid second: ${second}`);}

    const parsed = new Date(Date.UTC(year, month - 1, day, hour, minute, second));
    if (Number.isNaN(parsed.getTime())) {throw new Error(`Invalid date components: ${isoString}`);}

    if (parsed.getUTCFullYear() !== year || parsed.getUTCMonth() !== month - 1 || parsed.getUTCDate() !== day || parsed.getUTCHours() !== hour || parsed.getUTCMinutes() !== minute || parsed.getUTCSeconds() !== second) {
      throw new Error(`Calendar rollover detected in ISO string: ${isoString}`);
    }

    return parsed;
  } catch (error) {
    throw new Error(`Failed to parse ISO UTC string "${isoString}": ${error instanceof Error ? error.message : error}`);
  }
}

export function toIsoUtc(date: Date): string { return date.toISOString(); }
export function nowIsoUtc(): string { return toIsoUtc(nowUtc()); }
export function toDateUtc(date: Date): string { return date.toISOString().split("T")[0]; }
export function toTimeUtc(date: Date): string { return date.toISOString().split("T")[1].split(".")[0]; }

export function fromUtcComponents(year: number, month: number, day: number, hour: number = 0, minute: number = 0, second: number = 0): Date {
  return new Date(Date.UTC(year, month - 1, day, hour, minute, second));
}

export function isValidUtcDate(dateString: string): boolean {
  const regex = /^\d{4}-\d{2}-\d{2}$/;
  if (!regex.test(dateString)) {return false;}

  const [yearStr, monthStr, dayStr] = dateString.split("-");
  const year = Number.parseInt(yearStr, 10), month = Number.parseInt(monthStr, 10), day = Number.parseInt(dayStr, 10);

  if (month < 1 || month > 12) {return false;}
  if (day < 1 || day > 31) {return false;}

  const parsed = new Date(Date.UTC(year, month - 1, day));
  if (Number.isNaN(parsed.getTime())) {return false;}

  return parsed.getUTCFullYear() === year && parsed.getUTCMonth() === month - 1 && parsed.getUTCDate() === day;
}

export function isValidUtcTime(timeString: string): boolean {
  const regex = /^\d{2}:\d{2}:\d{2}$/;
  if (!regex.test(timeString)) {return false;}

  const [hours, minutes, seconds] = timeString.split(":").map(Number);
  return hours >= 0 && hours < 24 && minutes >= 0 && minutes < 60 && seconds >= 0 && seconds < 60;
}

export function addDaysUtc(date: Date, days: number): Date {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

export function startOfDayUtc(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

export function endOfDayUtc(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 23, 59, 59, 999));
}

export function generateRequestId(): string { return `${Date.now()}-${cryptoRandomId(13)}`; }
export function durationSeconds(start: Date, end: Date): number { return (end.getTime() - start.getTime()) / 1000; }
