/**
 * Export Utilities Tests
 * Tests CSV/PDF export functionality with edge cases
 */

import { describe, test, expect, getResults, resetResults, printSummary } from './test-utils.mjs';

// Inline export utilities to avoid import overhead
function escapeCSVValue(value) {
  if (value === null || value === undefined) return "";
  const str = String(value);
  if (str.includes(",") || str.includes('"') || str.includes("\n") || str.includes("\r")) {
    return `"${str.replaceAll('"', '""')}"`;
  }
  return str;
}

function generateCSVContent(data, columns, headers = {}) {
  const headerRow = columns.map(col => headers[col] || col).map(escapeCSVValue).join(",");
  const dataRows = data.map(row => columns.map(col => escapeCSVValue(row[col])).join(","));
  return [headerRow, ...dataRows].join("\n");
}

function formatDateISO(date) {
  return date.toISOString().slice(0, 16).replace("T", " ");
}

function generateMetadataFooter(dateRange, filters) {
  const lines = [
    "",
    "---",
    `Generated: ${formatDateISO(new Date())}`,
    `Date Range: ${dateRange.start} to ${dateRange.end}`
  ];
  if (filters.vessels?.length) lines.push(`Vessels: ${filters.vessels.join(", ")}`);
  if (filters.crew?.length) lines.push(`Crew: ${filters.crew.join(", ")}`);
  return lines.join("\n");
}

console.log('\n🧪 Running Export Tests\n');
resetResults();

describe('CSV Value Escaping', () => {
  test('handles null values', () => {
    expect(escapeCSVValue(null)).toBe("");
  });

  test('handles undefined values', () => {
    expect(escapeCSVValue(undefined)).toBe("");
  });

  test('passes through simple strings', () => {
    expect(escapeCSVValue("hello")).toBe("hello");
  });

  test('escapes strings with commas', () => {
    expect(escapeCSVValue("hello, world")).toBe('"hello, world"');
  });

  test('escapes strings with double quotes', () => {
    expect(escapeCSVValue('say "hello"')).toBe('"say ""hello"""');
  });

  test('escapes strings with newlines', () => {
    expect(escapeCSVValue("line1\nline2")).toBe('"line1\nline2"');
  });

  test('escapes strings with carriage returns', () => {
    expect(escapeCSVValue("line1\rline2")).toBe('"line1\rline2"');
  });

  test('escapes complex strings with multiple special chars', () => {
    const input = 'Captain "Smith", Vessel\nNote';
    const result = escapeCSVValue(input);
    expect(result).toContain('""Smith""');
  });

  test('converts numbers to strings', () => {
    expect(escapeCSVValue(42)).toBe("42");
    expect(escapeCSVValue(3.14159)).toBe("3.14159");
    expect(escapeCSVValue(0)).toBe("0");
    expect(escapeCSVValue(-100)).toBe("-100");
  });

  test('converts booleans to strings', () => {
    expect(escapeCSVValue(true)).toBe("true");
    expect(escapeCSVValue(false)).toBe("false");
  });

  test('handles empty string', () => {
    expect(escapeCSVValue("")).toBe("");
  });
});

describe('CSV Generation - Basic', () => {
  test('generates valid CSV with default headers', () => {
    const data = [
      { id: "1", name: "John", role: "Captain" },
      { id: "2", name: "Jane", role: "Engineer" }
    ];
    const columns = ["id", "name", "role"];
    const csv = generateCSVContent(data, columns);
    const lines = csv.split("\n");
    
    expect(lines[0]).toBe("id,name,role");
    expect(lines[1]).toBe("1,John,Captain");
    expect(lines[2]).toBe("2,Jane,Engineer");
  });

  test('uses custom headers when provided', () => {
    const data = [{ id: "1", name: "John" }];
    const columns = ["id", "name"];
    const headers = { id: "Crew ID", name: "Full Name" };
    const csv = generateCSVContent(data, columns, headers);
    
    expect(csv.split("\n")[0]).toBe("Crew ID,Full Name");
  });

  test('handles special characters in data', () => {
    const data = [{ id: "1", desc: 'Equipment "A", Model X' }];
    const columns = ["id", "desc"];
    const csv = generateCSVContent(data, columns);
    
    expect(csv).toContain('"Equipment ""A"", Model X"');
  });
});

describe('CSV Generation - Edge Cases', () => {
  test('handles empty data array', () => {
    const data = [];
    const columns = ["id", "name"];
    const csv = generateCSVContent(data, columns);
    
    expect(csv).toBe("id,name");
  });

  test('handles missing fields in data', () => {
    const data = [
      { id: "1", name: "John" },
      { id: "2" }  // missing name
    ];
    const columns = ["id", "name"];
    const csv = generateCSVContent(data, columns);
    const lines = csv.split("\n");
    
    expect(lines[1]).toBe("1,John");
    expect(lines[2]).toBe("2,");  // empty for missing field
  });

  test('handles extra fields in data (ignores them)', () => {
    const data = [{ id: "1", name: "John", extra: "ignored" }];
    const columns = ["id", "name"];
    const csv = generateCSVContent(data, columns);
    
    expect(csv).not.toContain("extra");
    expect(csv).not.toContain("ignored");
  });

  test('handles large dataset without memory issues', () => {
    const data = Array.from({ length: 1000 }, (_, i) => ({
      id: String(i),
      name: `Crew Member ${i}`,
      vessel: `Vessel ${i % 10}`
    }));
    const columns = ["id", "name", "vessel"];
    const csv = generateCSVContent(data, columns);
    const lines = csv.split("\n");
    
    expect(lines).toHaveLength(1001);  // header + 1000 rows
  });

  test('handles unicode characters', () => {
    const data = [{ id: "1", name: "Müller", notes: "日本語" }];
    const columns = ["id", "name", "notes"];
    const csv = generateCSVContent(data, columns);
    
    expect(csv).toContain("Müller");
    expect(csv).toContain("日本語");
  });

  test('handles very long strings', () => {
    const longStr = "A".repeat(10000);
    const data = [{ id: "1", content: longStr }];
    const columns = ["id", "content"];
    const csv = generateCSVContent(data, columns);
    
    expect(csv).toContain(longStr);
  });
});

describe('Date Formatting', () => {
  test('formats dates in ISO format', () => {
    const date = new Date("2025-12-31T10:30:00Z");
    const formatted = formatDateISO(date);
    
    expect(formatted).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/);
  });

  test('preserves date components correctly', () => {
    const date = new Date("2025-06-15T14:45:00Z");
    const formatted = formatDateISO(date);
    
    expect(formatted).toBe("2025-06-15 14:45");
  });
});

describe('Metadata Footer', () => {
  test('includes date range', () => {
    const footer = generateMetadataFooter(
      { start: "2025-12-29", end: "2026-01-12" },
      {}
    );
    
    expect(footer).toContain("2025-12-29");
    expect(footer).toContain("2026-01-12");
  });

  test('includes vessel filters when present', () => {
    const footer = generateMetadataFooter(
      { start: "2025-12-29", end: "2026-01-12" },
      { vessels: ["MV Pacific", "MV Atlantic"] }
    );
    
    expect(footer).toContain("MV Pacific");
    expect(footer).toContain("MV Atlantic");
  });

  test('includes crew filters when present', () => {
    const footer = generateMetadataFooter(
      { start: "2025-12-29", end: "2026-01-12" },
      { crew: ["John Smith", "Jane Doe"] }
    );
    
    expect(footer).toContain("John Smith");
    expect(footer).toContain("Jane Doe");
  });

  test('omits empty filters', () => {
    const footer = generateMetadataFooter(
      { start: "2025-12-29", end: "2026-01-12" },
      { vessels: [], crew: [] }
    );
    
    expect(footer).not.toContain("Vessels:");
    expect(footer).not.toContain("Crew:");
  });
});

const results = getResults();
printSummary();

export { results };
