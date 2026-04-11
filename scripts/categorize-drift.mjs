#!/usr/bin/env node
/**
 * Drift Burn-Down Categorization
 *
 * Reads drift-baseline.json and categorizes each drifted table into:
 *   - quick-fix: typeDrift only (timestamp/id normalization)
 *   - medium:    1-5 column differences (rename/add columns)
 *   - heavy:     6+ column differences or missing tables
 *
 * Outputs a JSON report to scripts/drift-burndown.json
 */
import { readFile, writeFile } from "node:fs/promises";

const baseline = JSON.parse(await readFile("scripts/drift-baseline.json", "utf8"));

const categories = { quickFix: [], medium: [], heavy: [], missing: [] };
const summary = { quickFix: 0, medium: 0, heavy: 0, missing: 0, total: 0 };

for (const table of baseline.missingTables || []) {
  categories.missing.push({ table, action: "Add to SQLite schema or remove from PG if unused" });
  summary.missing++;
  summary.total++;
}

for (const [table, drift] of Object.entries(baseline.columnDrift || {})) {
  const d = drift;
  const pgOnly = d.pgOnly || [];
  const sqliteOnly = d.sqliteOnly || [];
  const typeDrift = d.typeDrift || [];
  const totalDiffs = pgOnly.length + sqliteOnly.length + typeDrift.length;

  const entry = {
    table,
    pgOnly: pgOnly.length > 0 ? pgOnly : undefined,
    sqliteOnly: sqliteOnly.length > 0 ? sqliteOnly : undefined,
    typeDrift: typeDrift.length > 0 ? typeDrift : undefined,
    totalDiffs,
  };

  if (pgOnly.length === 0 && sqliteOnly.length === 0 && typeDrift.length > 0) {
    entry.action = "Normalize timestamp/id types between PG and SQLite";
    categories.quickFix.push(entry);
    summary.quickFix++;
  } else if (totalDiffs <= 5) {
    entry.action = "Align column names/types — small schema patch";
    categories.medium.push(entry);
    summary.medium++;
  } else {
    entry.action = "Major schema divergence — needs dedicated migration effort";
    categories.heavy.push(entry);
    summary.heavy++;
  }
  summary.total++;
}

categories.quickFix.sort((a, b) => a.totalDiffs - b.totalDiffs);
categories.medium.sort((a, b) => a.totalDiffs - b.totalDiffs);
categories.heavy.sort((a, b) => b.totalDiffs - a.totalDiffs);

const report = {
  _comment: "Drift burn-down categorization. Regenerate with: node scripts/categorize-drift.mjs",
  generatedAt: new Date().toISOString(),
  summary,
  categories,
};

await writeFile("scripts/drift-burndown.json", JSON.stringify(report, null, 2) + "\n");

console.log("Drift Burn-Down Report");
console.log("======================");
console.log(`  Quick-fix (type drift only):  ${summary.quickFix} tables`);
console.log(`  Medium (1-5 col diffs):       ${summary.medium} tables`);
console.log(`  Heavy (6+ col diffs):         ${summary.heavy} tables`);
console.log(`  Missing from SQLite:          ${summary.missing} tables`);
console.log(`  Total:                        ${summary.total} tables`);
console.log(`\nWritten to scripts/drift-burndown.json`);
