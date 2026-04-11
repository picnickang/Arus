#!/usr/bin/env node
/**
 * Dual-DB Schema Guardrail
 *
 * Validates that tables exported from shared/schema-runtime.ts have
 * corresponding definitions in both PG and SQLite modes — or are
 * explicitly marked as cloud-only / config constants.
 *
 * Run:  node scripts/validate-dual-schema.mjs
 * Exit: 0 = pass, 1 = new unguarded tables found
 */

import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

const runtimePath = resolve(root, "shared/schema-runtime.ts");
const runtimeSrc = readFileSync(runtimePath, "utf8");

const guardedNames = new Set();

const lines = runtimeSrc.split("\n");
for (const line of lines) {
  const exportMatch = line.match(/^export const (\w+)\s*=/);
  if (!exportMatch) continue;
  const name = exportMatch[1];

  const isSwitched =
    line.includes("isLocalMode ?") ||
    line.includes("isEmbedded ?") ||
    line.includes("IS_POSTGRES ?") ||
    line.includes("IS_SQLITE ?");

  const isCloudOnlyExplicit =
    (line.includes("IS_POSTGRES ?") && (line.includes(": null") || line.includes(": undefined"))) ||
    (line.includes("isLocalMode ?") && line.includes("? undefined"));

  const isDirectPgExport = line.includes("pgSchema.") && !isSwitched;

  const isConfigConst =
    name === "DEPLOYMENT_MODE" ||
    name === "IS_SQLITE" ||
    name === "IS_POSTGRES" ||
    name === "isLocalMode" ||
    name === "isEmbedded";

  if (isSwitched || isCloudOnlyExplicit || isDirectPgExport || isConfigConst) {
    guardedNames.add(name);
  }
}

const exportLineRe = /^export const (\w+)\s*=/gm;
const allExports = [];
let m;
while ((m = exportLineRe.exec(runtimeSrc)) !== null) {
  allExports.push(m[1]);
}

const unguarded = allExports.filter(
  (name) =>
    !guardedNames.has(name) &&
    !name.startsWith("insert") &&
    !name.startsWith("select")
);

const switchedCount = allExports.filter(
  (n) => guardedNames.has(n) && !["DEPLOYMENT_MODE", "IS_SQLITE", "IS_POSTGRES"].includes(n)
).length;

const cloudOnlyPatterns = allExports.filter((n) => {
  const line = lines.find((l) => l.match(new RegExp(`^export const ${n}\\s*=`)));
  return (
    line &&
    ((line.includes("IS_POSTGRES ?") && (line.includes(": null") || line.includes(": undefined"))) ||
      (line.includes("isLocalMode ?") && line.includes("? undefined")) ||
      (line.includes("pgSchema.") && !line.includes("isLocalMode") && !line.includes("IS_POSTGRES")))
  );
});

console.log("=== Dual-DB Schema Guardrail ===");
console.log(`Guarded table exports:         ${switchedCount}`);
console.log(`Cloud-only / PG-direct:        ${cloudOnlyPatterns.length}`);
console.log(`Total runtime exports:         ${allExports.length}`);

if (unguarded.length > 0) {
  console.log(`\nWARNING: ${unguarded.length} export(s) not explicitly guarded:`);
  for (const name of unguarded) {
    console.log(`  - ${name}`);
  }
  console.log(
    "\nFix: Each table export in schema-runtime.ts must use one of:"
  );
  console.log(
    "  1. Switched:    export const t = isLocalMode ? sqlite.tSqlite : pgSchema.t;"
  );
  console.log(
    "  2. Cloud-only:  export const t = IS_POSTGRES ? pgSchema.t : null;"
  );
  console.log(
    "  3. PG-direct:   export const t = pgSchema.t; // (explicit cloud-only)"
  );
  process.exit(1);
} else {
  console.log("\nAll table exports are properly guarded.");
  process.exit(0);
}
