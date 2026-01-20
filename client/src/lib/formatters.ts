/**
 * Shared formatting utilities to eliminate code duplication across components
 */

/**
 * Format a number as USD currency
 * Consolidated from savings-dashboard.tsx, optimization-tools.tsx, and EquipmentProfileCard.tsx
 */
export function formatCurrency(
  value: number,
  options?: {
    minimumFractionDigits?: number;
    maximumFractionDigits?: number;
  }
): string {
  const defaults = {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  };

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    ...defaults,
    ...options,
  }).format(value);
}

/**
 * Format hours with optional decimal precision
 */
export function formatHours(hours: number, decimals: number = 1): string {
  return `${hours.toFixed(decimals)}h`;
}

/**
 * Format percentage with optional decimal precision
 */
export function formatPercent(value: number, decimals: number = 1): string {
  return `${value.toFixed(decimals)}%`;
}

/**
 * Format large numbers with K/M/B suffixes
 */
export function formatCompactNumber(value: number): string {
  return new Intl.NumberFormat("en-US", {
    notation: "compact",
    compactDisplay: "short",
  }).format(value);
}

/**
 * Format decimal numbers with specified precision
 */
export function formatDecimal(value: number, decimals: number = 1): string {
  return value.toFixed(decimals);
}

/**
 * Format numbers with locale-specific formatting
 */
export function formatNumber(value: number, options: Intl.NumberFormatOptions = {}): string {
  return new Intl.NumberFormat("en-US", options).format(value);
}

/**
 * Format dates with locale-specific formatting
 */
export function formatDate(
  date: Date | string | number,
  options: Intl.DateTimeFormatOptions = {}
): string {
  const dateObj = typeof date === "string" || typeof date === "number" ? new Date(date) : date;

  const defaultOptions: Intl.DateTimeFormatOptions = {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    ...options,
  };

  return new Intl.DateTimeFormat("en-US", defaultOptions).format(dateObj);
}

/**
 * Format days with specified decimal precision
 */
export function formatDays(value: number, decimals: number = 2): string {
  return `${value.toFixed(decimals)} days`;
}
