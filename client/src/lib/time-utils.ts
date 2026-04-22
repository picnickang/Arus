/**
 * Frontend Time Utilities - Singapore Time (SGT) Support
 *
 * Provides consistent Singapore Time formatting for the frontend
 * to match the backend SGT configuration.
 */

import { formatDistanceToNow } from "date-fns";
import { formatInTimeZone } from "date-fns-tz";

// Singapore Time constants
export const SGT_TIMEZONE = "Asia/Singapore";

/**
 * Format date in Singapore Time with custom format (proper timezone formatting)
 */
export function formatSgt(
  date: Date | string,
  formatString: string = "MMM d, yyyy HH:mm:ss"
): string {
  const inputDate = typeof date === "string" ? new Date(date) : date;
  // Use explicit format without timezone info, then add our own SGT label
  const formatted = formatInTimeZone(inputDate, SGT_TIMEZONE, formatString);
  return `${formatted} SGT`;
}

/**
 * Format relative time (e.g., "2 hours ago") - timezone-agnostic
 */
export function formatDistanceToNowSgt(date: Date | string): string {
  const inputDate = typeof date === "string" ? new Date(date) : date;
  // formatDistanceToNow works with UTC timestamps, no conversion needed
  return formatDistanceToNow(inputDate, { addSuffix: true, includeSeconds: true });
}

/**
 * Format date only in Singapore Time (YYYY-MM-DD)
 */
export function formatDateSgt(date: Date | string): string {
  const inputDate = typeof date === "string" ? new Date(date) : date;
  return formatInTimeZone(inputDate, SGT_TIMEZONE, "yyyy-MM-dd");
}

/**
 * Format time only in Singapore Time (HH:mm:ss)
 */
export function formatTimeSgt(date: Date | string | null | undefined): string {
  if (!date) {return "N/A";}
  const inputDate = typeof date === "string" ? new Date(date) : date;
  if (isNaN(inputDate.getTime())) {return "N/A";}
  return formatInTimeZone(inputDate, SGT_TIMEZONE, "HH:mm:ss");
}

/**
 * Format datetime for display in Singapore Time
 */
export function formatDateTimeSgt(date: Date | string): string {
  return formatSgt(date, "MMM d, yyyy HH:mm:ss");
}

/**
 * Format compact datetime for tables in Singapore Time
 */
export function formatCompactSgt(date: Date | string): string {
  return formatSgt(date, "MM/dd HH:mm");
}

/**
 * Get current time (returns actual current time, no mutation)
 */
export function nowSgt(): Date {
  return new Date();
}

/**
 * Check if a time is during night shift hours (20:00-06:00 SGT)
 */
export function isNightShiftSgt(date: Date | string): boolean {
  const inputDate = typeof date === "string" ? new Date(date) : date;
  /* eslint-disable no-restricted-syntax -- Direct Intl use for timezone extraction */
  const sgtHour = Number.parseInt(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: SGT_TIMEZONE,
      hour: "2-digit",
      hour12: false,
    }).format(inputDate)
  );
  /* eslint-enable no-restricted-syntax */
  return sgtHour >= 20 || sgtHour < 6;
}
