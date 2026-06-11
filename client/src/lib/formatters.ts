/**
 * Shared formatting utilities to eliminate code duplication across components
 */

/**
 * Format a number as currency (USD by default)
 * Consolidated from savings-dashboard.tsx, optimization-tools.tsx, and EquipmentProfileCard.tsx
 *
 * The `display` variants preserve, verbatim, the rendering of formerly
 * duplicated local helpers — do not change their output:
 * - "symbol" (default): Intl currency formatting, e.g. "$12,345"
 * - "code-prefix": currency code + plain space + formatNumber(), e.g. "USD 12,345.5"
 * - "compact-k": "$12.3k" when |value| >= 1000, otherwise "$123"
 */
export function formatCurrency(
  value: number | null | undefined,
  options?: {
    minimumFractionDigits?: number;
    maximumFractionDigits?: number;
    /** ISO 4217 currency code (default "USD"). Ignored by "compact-k". */
    currency?: string;
    /** Output shape; see function doc. Default "symbol". */
    display?: "symbol" | "code-prefix" | "compact-k";
    /** Returned when value is null/undefined (default "—"). */
    fallback?: string;
  }
): string {
  const {
    currency = "USD",
    display = "symbol",
    fallback = "—",
    ...fractionOptions
  } = options ?? {};

  if (value == null) {
    return fallback;
  }

  if (display === "code-prefix") {
    return `${currency} ${formatNumber(value, fractionOptions)}`;
  }

  if (display === "compact-k") {
    return Math.abs(value) >= 1000 ? `$${(value / 1000).toFixed(1)}k` : `$${value.toFixed(0)}`;
  }

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
    ...fractionOptions,
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
 * Format dates with locale-specific formatting.
 *
 * Defaults to "Jun 11, 2026, 02:30 PM" (en-US, date + time). Any
 * Intl.DateTimeFormatOptions can be overridden; pass
 * `hour: undefined, minute: undefined` for a date-only rendering.
 *
 * Extras beyond Intl options:
 * - `locale`: BCP-47 tag (default "en-US"); pass "auto" to use the runtime's
 *   default locale. With "auto" and all-numeric parts this exactly matches
 *   `Date#toLocaleString()` / `Date#toLocaleDateString()` output.
 * - `fallback`: returned for null/undefined input (default "—").
 * - `invalidFallback`: returned for unparseable dates (defaults to `fallback`).
 */
export function formatDate(
  date: Date | string | number | null | undefined,
  options: Intl.DateTimeFormatOptions & {
    locale?: string;
    fallback?: string;
    invalidFallback?: string;
  } = {}
): string {
  const { locale = "en-US", fallback = "—", invalidFallback = fallback, ...intlOptions } = options;

  if (date == null) {
    return fallback;
  }

  const dateObj = typeof date === "string" || typeof date === "number" ? new Date(date) : date;
  if (Number.isNaN(dateObj.getTime())) {
    return invalidFallback;
  }

  const defaultOptions: Intl.DateTimeFormatOptions = {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    ...intlOptions,
  };

  return new Intl.DateTimeFormat(locale === "auto" ? undefined : locale, defaultOptions).format(
    dateObj
  );
}

/**
 * Format days with specified decimal precision
 */
export function formatDays(value: number, decimals: number = 2): string {
  return `${value.toFixed(decimals)} days`;
}
