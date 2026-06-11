#!/usr/bin/env node
/**
 * Envelope adoption ratchet.
 *
 * Reads ENVELOPED_PREFIXES from server/lib/envelope-manifest.ts and compares
 * it to the committed baseline. Migrated prefixes may only be ADDED — removing
 * one would silently revert a domain to legacy response shapes for clients
 * that already rely on the envelope. After adding a wave, update the baseline:
 *
 *   node scripts/check-envelope-adoption.mjs --update
 */

import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const manifestPath = path.join(root, "server/lib/envelope-manifest.ts");
const baselinePath = path.join(root, "scripts/envelope-manifest-baseline.json");

function extractPrefixes(source, constName) {
  const match = source.match(new RegExp(`${constName}[^=]*=\\s*\\[([^\\]]*)\\]`, "m"));
  if (!match) {
    console.error(`✗ Could not find ${constName} in ${manifestPath}`);
    process.exit(1);
  }
  return [...match[1].matchAll(/"([^"]+)"/g)].map((m) => m[1]);
}

const source = readFileSync(manifestPath, "utf-8");
const current = extractPrefixes(source, "ENVELOPED_PREFIXES");

if (process.argv.includes("--update")) {
  writeFileSync(baselinePath, `${JSON.stringify({ envelopedPrefixes: current }, null, 2)}\n`);
  console.log(`✓ Baseline updated with ${current.length} prefix(es)`);
  process.exit(0);
}

const baseline = JSON.parse(readFileSync(baselinePath, "utf-8")).envelopedPrefixes;
const removed = baseline.filter((prefix) => !current.includes(prefix));

console.log("=== Envelope Adoption Ratchet ===");
if (removed.length > 0) {
  console.error(`✗ ${removed.length} migrated prefix(es) removed from the manifest:`);
  for (const prefix of removed) {
    console.error(`    ${prefix}`);
  }
  console.error(
    "Migrated domains must stay migrated. If this removal is truly intentional,\n" +
      "update scripts/envelope-manifest-baseline.json in the same commit."
  );
  process.exit(1);
}

const added = current.filter((prefix) => !baseline.includes(prefix));
console.log(
  `✓ ${current.length} enveloped prefix(es); ${added.length} new vs baseline${
    added.length > 0 ? ` — run with --update to ratchet: ${added.join(", ")}` : ""
  }`
);
