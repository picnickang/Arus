#!/usr/bin/env node
/**
 * ARUS Post-Repair Verifier
 * Run after Replit applies the unified schema + SQLite fixes.
 *
 * Usage:
 *   node scripts/arus-verify-fix.mjs
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, "..");

const SERVER_DIR = path.join(root, "server");
const SHARED_DIR = path.join(root, "shared");

// Helpers
function walk(dir, exts = [".ts", ".tsx", ".js", ".mjs"]) {
  /** @type {string[]} */
  const files = [];
  (function rec(p) {
    for (const entry of fs.readdirSync(p, { withFileTypes: true })) {
      if (entry.name.startsWith(".")) continue;
      const full = path.join(p, entry.name);
      if (entry.isDirectory()) rec(full);
      else if (exts.includes(path.extname(entry.name))) files.push(full);
    }
  })(dir);
  return files;
}

function read(file) {
  return fs.readFileSync(file, "utf8");
}

function rel(p) {
  return path.relative(root, p);
}

let hasError = false;

// 1) Verify all schema imports go through @shared/schema-runtime
console.log("🔍 Checking schema imports...");
const serverFiles = walk(SERVER_DIR);

const badSchemaImports = [];
for (const file of serverFiles) {
  const text = read(file);

  // Any direct ./schema or ../schema import is suspicious now
  if (
    text.match(/from\s+["']\.\/schema["']/) ||
    text.match(/from\s+["']\.\.\/schema["']/) ||
    text.match(/from\s+["']\.\/schema-sqlite-vessel["']/) ||
    text.match(/from\s+["']\.\.\/schema-sqlite-vessel["']/)
  ) {
    badSchemaImports.push(file);
  }
}

if (badSchemaImports.length) {
  hasError = true;
  console.log("❌ Found direct schema imports (should use @shared/schema-runtime):");
  badSchemaImports.forEach(f => console.log("   -", rel(f)));
} else {
  console.log("✅ All schema imports appear to use the runtime alias.");
}

// 2) Verify there are no DB-generated UUIDs left (SKIP PostgreSQL schema files - they're correct!)
console.log("\n🔍 Scanning for Postgres-only UUID functions in application code...");
const uuidBad = [];

// Skip schema definition files - they're SUPPOSED to have gen_random_uuid() for PostgreSQL
const skipFiles = [
  "shared/schema.ts",
  "shared/sync-conflicts-schema.ts",
  "server/inventory/webhook-schema.ts",
  "server/index.js", // build output
  "server/index.mjs", // build output
];

for (const file of [...serverFiles, ...walk(SHARED_DIR)]) {
  // Skip PostgreSQL schema definition files and build outputs
  if (skipFiles.some(skip => file.endsWith(skip))) continue;
  
  const text = read(file);
  if (
    text.includes("gen_random_uuid(") ||
    text.includes("uuid_generate_v4(") ||
    text.includes("DEFAULT gen_random_uuid") ||
    text.includes("DEFAULT uuid_generate_v4")
  ) {
    uuidBad.push(file);
  }
}

if (uuidBad.length) {
  hasError = true;
  console.log("❌ Found Postgres-only UUID usage in application code:");
  uuidBad.forEach(f => console.log("   -", rel(f)));
} else {
  console.log("✅ No PostgreSQL-only UUIDs in application code (schema files are OK).");
}

// 3) Verify update_settings table exists in SQLite schema
console.log("\n🔍 Checking SQLite schema for update_settings table...");
const sqliteSchemaFile = path.join(SHARED_DIR, "schema-sqlite-vessel.ts");
if (fs.existsSync(sqliteSchemaFile)) {
  const text = read(sqliteSchemaFile);
  if (text.includes("update_settings")) {
    console.log("✅ update_settings table defined in schema-sqlite-vessel.ts");
  } else {
    hasError = true;
    console.log("❌ update_settings table NOT found in schema-sqlite-vessel.ts");
  }
} else {
  hasError = true;
  console.log("❌ schema-sqlite-vessel.ts not found at:", rel(sqliteSchemaFile));
}

// 4) Rough check for db.execute in local mode code
console.log("\n🔍 Checking for db.execute usage in server...");
const executeHits = [];
for (const file of serverFiles) {
  const text = read(file);
  if (text.includes("db.execute(")) {
    executeHits.push(file);
  }
}

if (executeHits.length) {
  hasError = true;
  console.log("❌ db.execute detected. Ensure this is only used with libSQL client,");
  console.log("   and NOT in the local SQLite path / health checks.");
  executeHits.forEach(f => console.log("   -", rel(f)));
} else {
  console.log("✅ No db.execute calls found in server code.");
}

// Summary
console.log("\n==================== SUMMARY ====================");
if (hasError) {
  console.log("⚠️  One or more issues detected. See logs above.");
  process.exitCode = 1;
} else {
  console.log("🎉 All basic post-repair checks passed.");
}
console.log("=================================================");
