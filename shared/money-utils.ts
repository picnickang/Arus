/**
 * Currency Arithmetic Utilities
 *
 * Provides safe integer-based currency arithmetic to avoid floating-point precision errors.
 * All internal calculations use cents (integers), external APIs use dollars (floats).
 *
 * Why cents? JavaScript floats cause precision errors:
 *   19.99 * 3 = 59.97000000000001 ❌
 *   1999 * 3 = 5997 ✅ (then divide by 100 = 59.97)
 *
 * @example
 * const priceC = toCents(19.99); // 1999
 * const totalC = priceC * 3;     // 5997
 * const total = toDollars(totalC); // 59.97
 */

/**
 * Convert dollars to cents for safe integer arithmetic
 * @param dollars - Dollar amount (can be float)
 * @returns Integer cents (rounded to nearest cent)
 *
 * @example
 * toCents(19.99) // 1999
 * toCents(0) // 0
 * toCents(-10.50) // -1050
 * toCents(null) // 0
 * toCents(undefined) // 0
 */
export function toCents(dollars: number | null | undefined): number {
  if (dollars === null || dollars === undefined || !Number.isFinite(dollars)) {
    return 0;
  }
  // Round to nearest cent (handles float precision)
  return Math.round(dollars * 100);
}

/**
 * Convert cents back to dollars for external APIs
 * @param cents - Integer cents
 * @returns Dollar amount with max 2 decimal places
 *
 * @example
 * toDollars(1999) // 19.99
 * toDollars(0) // 0.00
 * toDollars(-1050) // -10.50
 */
export function toDollars(cents: number | null | undefined): number {
  if (cents === null || cents === undefined || !Number.isFinite(cents)) {
    return 0;
  }
  // Round to 2 decimal places to avoid float precision errors
  return Math.round(cents) / 100;
}

/**
 * Add two dollar amounts safely
 * @param a - First dollar amount
 * @param b - Second dollar amount
 * @returns Sum in dollars (precise to 2 decimal places)
 *
 * @example
 * addDollars(19.99, 5.01) // 25.00 (not 25.000000000000004)
 */
export function addDollars(a: number, b: number): number {
  return toDollars(toCents(a) + toCents(b));
}

/**
 * Multiply dollar amount by quantity safely
 * @param dollars - Unit price in dollars
 * @param quantity - Quantity (integer or float)
 * @returns Total in dollars (precise to 2 decimal places)
 *
 * @example
 * multiplyDollars(19.99, 3) // 59.97 (not 59.97000000000001)
 */
export function multiplyDollars(dollars: number, quantity: number): number {
  return toDollars(toCents(dollars) * quantity);
}

/**
 * Calculate percentage of dollar amount safely
 * @param dollars - Base amount
 * @param percentage - Percentage (0-100)
 * @returns Percentage amount in dollars
 *
 * @example
 * percentageDollars(100, 15) // 15.00
 * percentageDollars(19.99, 10) // 2.00 (10% discount)
 */
export function percentageDollars(dollars: number, percentage: number): number {
  const centsAmount = toCents(dollars);
  const percentageCents = Math.round(centsAmount * (percentage / 100));
  return toDollars(percentageCents);
}
