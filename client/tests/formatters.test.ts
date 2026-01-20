/**
 * Unit tests for shared formatting utilities
 * Validates correct output formatting for currency, numbers, dates, and time
 */

import { describe, it, expect } from "@jest/globals";
import {
  formatCurrency,
  formatHours,
  formatPercent,
  formatCompactNumber,
  formatDecimal,
  formatNumber,
  formatDate,
  formatDays,
} from "../src/lib/formatters";

describe("formatCurrency", () => {
  it("should format USD currency with default zero decimal places", () => {
    expect(formatCurrency(1000)).toBe("$1,000");
    expect(formatCurrency(42)).toBe("$42");
    expect(formatCurrency(0)).toBe("$0");
  });

  it("should handle negative values", () => {
    expect(formatCurrency(-1500)).toBe("-$1,500");
  });

  it("should respect custom decimal places", () => {
    expect(formatCurrency(1234.56, { minimumFractionDigits: 2, maximumFractionDigits: 2 })).toBe(
      "$1,234.56"
    );
    expect(formatCurrency(99.9, { minimumFractionDigits: 2, maximumFractionDigits: 2 })).toBe(
      "$99.90"
    );
  });

  it("should handle large numbers", () => {
    expect(formatCurrency(1000000)).toBe("$1,000,000");
    expect(formatCurrency(1234567.89, { maximumFractionDigits: 2 })).toBe("$1,234,567.89");
  });

  it("should handle decimal rounding", () => {
    expect(formatCurrency(123.456, { maximumFractionDigits: 2 })).toBe("$123.46");
  });
});

describe("formatHours", () => {
  it("should format hours with default 1 decimal place", () => {
    expect(formatHours(8.5)).toBe("8.5h");
    expect(formatHours(24)).toBe("24.0h");
  });

  it("should respect custom decimal precision", () => {
    expect(formatHours(7.123, 0)).toBe("7h");
    expect(formatHours(7.123, 2)).toBe("7.12h");
    expect(formatHours(7.123, 3)).toBe("7.123h");
  });

  it("should handle zero and negative values", () => {
    expect(formatHours(0)).toBe("0.0h");
    expect(formatHours(-2.5, 1)).toBe("-2.5h");
  });

  it("should handle large hour values", () => {
    expect(formatHours(8760, 0)).toBe("8760h"); // 1 year
  });
});

describe("formatPercent", () => {
  it("should format percentage with default 1 decimal place", () => {
    expect(formatPercent(85.5)).toBe("85.5%");
    expect(formatPercent(100)).toBe("100.0%");
  });

  it("should respect custom decimal precision", () => {
    expect(formatPercent(99.999, 0)).toBe("100%");
    expect(formatPercent(99.999, 2)).toBe("100.00%");
    expect(formatPercent(33.333, 1)).toBe("33.3%");
  });

  it("should handle edge cases", () => {
    expect(formatPercent(0, 1)).toBe("0.0%");
    expect(formatPercent(0.1, 2)).toBe("0.10%");
  });
});

describe("formatCompactNumber", () => {
  it("should format small numbers without suffix", () => {
    expect(formatCompactNumber(999)).toBe("999");
    expect(formatCompactNumber(42)).toBe("42");
  });

  it("should format thousands with K suffix", () => {
    expect(formatCompactNumber(1000)).toBe("1K");
    expect(formatCompactNumber(1500)).toBe("1.5K");
    expect(formatCompactNumber(999999)).toBe("1M");
  });

  it("should format millions with M suffix", () => {
    expect(formatCompactNumber(1000000)).toBe("1M");
    expect(formatCompactNumber(2500000)).toBe("2.5M");
  });

  it("should format billions with B suffix", () => {
    expect(formatCompactNumber(1000000000)).toBe("1B");
    expect(formatCompactNumber(3700000000)).toBe("3.7B");
  });

  it("should handle zero", () => {
    expect(formatCompactNumber(0)).toBe("0");
  });
});

describe("formatDecimal", () => {
  it("should format decimals with default 1 decimal place", () => {
    expect(formatDecimal(3.14159)).toBe("3.1");
    expect(formatDecimal(10)).toBe("10.0");
  });

  it("should respect custom decimal precision", () => {
    expect(formatDecimal(3.14159, 0)).toBe("3");
    expect(formatDecimal(3.14159, 2)).toBe("3.14");
    expect(formatDecimal(3.14159, 4)).toBe("3.1416");
  });

  it("should handle edge cases", () => {
    expect(formatDecimal(0, 2)).toBe("0.00");
    expect(formatDecimal(-5.678, 2)).toBe("-5.68");
  });
});

describe("formatNumber", () => {
  it("should format numbers with default locale", () => {
    expect(formatNumber(1000)).toBe("1,000");
    expect(formatNumber(1234567)).toBe("1,234,567");
  });

  it("should respect custom options", () => {
    expect(formatNumber(0.5, { style: "percent" })).toBe("50%");
    expect(formatNumber(1234.56, { minimumFractionDigits: 2, maximumFractionDigits: 2 })).toBe(
      "1,234.56"
    );
  });

  it("should handle edge cases", () => {
    expect(formatNumber(0)).toBe("0");
    expect(formatNumber(-999)).toBe("-999");
  });
});

describe("formatDate", () => {
  it("should format Date objects with default options", () => {
    const testDate = new Date("2025-11-05T14:30:00Z");
    const formatted = formatDate(testDate);

    // Verify it contains key components (exact format may vary by environment)
    expect(formatted).toContain("Nov");
    expect(formatted).toContain("5");
    expect(formatted).toContain("2025");
  });

  it("should accept string dates", () => {
    const formatted = formatDate("2025-01-15T10:00:00Z");
    expect(formatted).toContain("Jan");
    expect(formatted).toContain("15");
    expect(formatted).toContain("2025");
  });

  it("should accept timestamp numbers", () => {
    const timestamp = new Date("2025-06-20T18:00:00Z").getTime();
    const formatted = formatDate(timestamp);
    expect(formatted).toContain("Jun");
    expect(formatted).toContain("20");
    expect(formatted).toContain("2025");
  });

  it("should respect custom formatting options", () => {
    const testDate = new Date("2025-11-05T14:30:00Z");
    const formatted = formatDate(testDate, {
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    expect(formatted).toContain("November");
    expect(formatted).toContain("2025");
  });

  it("should handle different date options", () => {
    const testDate = new Date("2025-11-05T14:30:00Z");

    // Date only
    const dateOnly = formatDate(testDate, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: undefined,
      minute: undefined,
    });
    expect(dateOnly).toContain("Nov");
    expect(dateOnly).toContain("2025");
  });
});

describe("formatDays", () => {
  it("should format days with default 2 decimal places", () => {
    expect(formatDays(7.5)).toBe("7.50 days");
    expect(formatDays(30)).toBe("30.00 days");
  });

  it("should respect custom decimal precision", () => {
    expect(formatDays(15.123, 0)).toBe("15 days");
    expect(formatDays(15.123, 1)).toBe("15.1 days");
    expect(formatDays(15.123, 3)).toBe("15.123 days");
  });

  it("should handle edge cases", () => {
    expect(formatDays(0, 1)).toBe("0.0 days");
    expect(formatDays(0.5, 1)).toBe("0.5 days");
    expect(formatDays(-3, 0)).toBe("-3 days");
  });

  it("should handle large values", () => {
    expect(formatDays(365, 0)).toBe("365 days");
    expect(formatDays(1000.99, 2)).toBe("1000.99 days");
  });
});

describe("Edge cases and integration", () => {
  it("should handle Infinity and very large numbers", () => {
    // Intl.NumberFormat returns "∞" without currency symbol for Infinity
    expect(formatCurrency(Infinity)).toBe("∞");
    // NOSONAR: S5852 - Simple bounded pattern (\d+ followed by single char class) is safe
    expect(formatCompactNumber(9999999999999)).toMatch(/^\d+[TMB]$/); // Trillions
  });

  it("should handle very small decimal values", () => {
    expect(formatDecimal(0.0001, 4)).toBe("0.0001");
    expect(formatPercent(0.01, 2)).toBe("0.01%");
  });

  it("should maintain precision for financial calculations", () => {
    const total = 1234.56;
    expect(formatCurrency(total, { minimumFractionDigits: 2, maximumFractionDigits: 2 })).toBe(
      "$1,234.56"
    );
  });

  it("should handle mixed positive and negative values consistently", () => {
    expect(formatCurrency(100)).toBe("$100");
    expect(formatCurrency(-100)).toBe("-$100");
    expect(formatHours(5.5, 1)).toBe("5.5h");
    expect(formatHours(-5.5, 1)).toBe("-5.5h");
  });
});
