#!/usr/bin/env node
/**
 * Guardrail: single-tenant org context must be centralized.
 *
 * Runtime code should not read x-org-id or req.query.orgId directly. The only
 * permitted files are org validation utilities that normalize/validate legacy
 * headers before protected routes run.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const root = process.cwd();
const serverDir = join(root, "server");
const allowed = new Set([
  "server/orgIdValidation.ts",
  "server/utils/orgIdValidation.ts",
]);

const forbiddenPatterns = [
  /req\.headers\[['"]x-org-id['"]\]/,
  /req\.header\(['"]x-org-id['"]\)/,
  /req\.get\(['"]x-org-id['"]\)/,
  /req\.query\.orgId/,
];

function walk(dir) {
  const entries = readdirSync(dir);
  const files = [];
  for (const entry of entries) {
    const path = join(dir, entry);
    const stat = statSync(path);
    if (stat.isDirectory()) {
      files.push(...walk(path));
    } else if (path.endsWith(".ts")) {
      files.push(path);
    }
  }
  return files;
}

const violations = [];
for (const file of walk(serverDir)) {
  const rel = relative(root, file).replaceAll("\\", "/");
  if (allowed.has(rel)) continue;
  const lines = readFileSync(file, "utf8").split(/\r?\n/);
  lines.forEach((line, idx) => {
    if (forbiddenPatterns.some((pattern) => pattern.test(line))) {
      violations.push(`${rel}:${idx + 1}: ${line.trim()}`);
    }
  });
}

if (violations.length > 0) {
  console.error("❌ Direct org-context reads found outside validation utilities:");
  console.error(violations.join("\n"));
  process.exit(1);
}

console.log("✅ Org context boundary clean: routes use canonical single-tenant context");
process.exit(0);
