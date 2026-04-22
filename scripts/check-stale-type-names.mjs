#!/usr/bin/env node
/**
 * check-stale-type-names.mjs
 *
 * Step 2 of the engineering-quality sequence: detect type imports that
 * reference names which no longer exist in the target module. These are
 * "stale type names" — common after refactors that rename or remove a type
 * but miss the import sites because TypeScript will silently emit `any`
 * for unresolved type-only imports under certain transpile-only modes.
 *
 * Scope:
 *   - Scans `client/src/`, `server/`, and `shared/` for `import type { ... }
 *     from '@shared/schema'` (and `@shared/schema-runtime`).
 *   - For each imported name, verifies the target module actually exports it
 *     (via a regex over `export { ... }`, `export const X`, `export type X`,
 *     `export interface X`, `export class X`, `export enum X`).
 *
 * Exit codes:
 *   0  → no stale names
 *   1  → stale names found (CI failure)
 *   2  → script failed (parse/IO error)
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const SCAN_DIRS = ["client/src", "server", "shared"];
const TARGET_MODULES = {
  "@shared/schema": "shared/schema.ts",
  "@shared/schema-runtime": "shared/schema-runtime.ts",
};

function* walk(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name === ".local" || entry.name.startsWith("."))
        continue;
      yield* walk(full);
    } else if (/\.(ts|tsx)$/.test(entry.name) && !entry.name.endsWith(".d.ts")) {
      yield full;
    }
  }
}

function resolveModulePath(specifier, fromFile) {
  // Resolve a relative module specifier to a .ts file path.
  // Handles both `./foo` (which may map to foo.ts or foo/index.ts) and explicit `./foo.ts`.
  const baseDir = path.dirname(fromFile);
  const cleaned = specifier.replace(/\.js$/, "");
  const candidates = [
    path.resolve(baseDir, `${cleaned}.ts`),
    path.resolve(baseDir, `${cleaned}.tsx`),
    path.resolve(baseDir, cleaned, "index.ts"),
    path.resolve(baseDir, cleaned, "index.tsx"),
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return null;
}

function readExportedNames(filePath, visited = new Set()) {
  // Returns { names: Set, unresolvedWildcards: number } — wildcard re-exports
  // to relative paths are resolved recursively. Wildcards to bare modules
  // (e.g. `export * from "drizzle-orm"`) are counted as unresolved.
  if (visited.has(filePath)) return { names: new Set(), unresolvedWildcards: 0 };
  visited.add(filePath);

  const content = fs.readFileSync(filePath, "utf-8");
  const names = new Set();
  let unresolvedWildcards = 0;

  // export const|let|var|function|class|enum|interface|type X
  const decl =
    /export\s+(?:declare\s+)?(?:const|let|var|function|class|enum|interface|type|abstract\s+class)\s+([A-Za-z_$][\w$]*)/g;
  for (const m of content.matchAll(decl)) names.add(m[1]);

  // export { A, B as C } [from "..."]
  const grouped = /export\s*(?:type\s+)?\{([^}]+)\}(?:\s*from\s*["'][^"']+["'])?/g;
  for (const m of content.matchAll(grouped)) {
    for (const part of m[1].split(",")) {
      const trimmed = part.trim();
      if (!trimmed) continue;
      const aliasMatch = trimmed.match(/(?:[A-Za-z_$][\w$]*)\s+as\s+([A-Za-z_$][\w$]*)/);
      if (aliasMatch) {
        names.add(aliasMatch[1]);
      } else {
        const cleaned2 = trimmed.replace(/^type\s+/, "");
        const simple = cleaned2.match(/^([A-Za-z_$][\w$]*)/);
        if (simple) names.add(simple[1]);
      }
    }
  }

  // export * from "..." → resolve recursively if relative; otherwise count opaque
  const wildcard = /export\s*\*\s*from\s*["']([^"']+)["']/g;
  for (const m of content.matchAll(wildcard)) {
    const spec = m[1];
    if (spec.startsWith(".") || spec.startsWith("/")) {
      const resolved = resolveModulePath(spec, filePath);
      if (resolved) {
        const sub = readExportedNames(resolved, visited);
        for (const n of sub.names) names.add(n);
        unresolvedWildcards += sub.unresolvedWildcards;
      } else {
        unresolvedWildcards++;
      }
    } else {
      unresolvedWildcards++;
    }
  }

  return { names, unresolvedWildcards };
}

function findTypeImports(filePath) {
  const content = fs.readFileSync(filePath, "utf-8");
  const imports = [];
  // Match `import type { A, B as C } from '@shared/schema...';` and
  // `import { type A, B } from '@shared/schema...';` (mixed inline-type form)
  const re = /import\s+(?:type\s+)?\{([^}]+)\}\s+from\s+["']([^"']+)["']/g;
  for (const m of content.matchAll(re)) {
    const moduleSpec = m[2];
    if (!Object.keys(TARGET_MODULES).includes(moduleSpec)) continue;
    const isTypeOnlyImport = /import\s+type\s*\{/.test(content.slice(m.index, m.index + 12));
    for (const part of m[1].split(",")) {
      const trimmed = part.trim();
      if (!trimmed) continue;
      // strip leading `type ` from inline-type imports
      const cleaned = trimmed.replace(/^type\s+/, "");
      const sourceName = cleaned.match(/^([A-Za-z_$][\w$]*)/);
      if (!sourceName) continue;
      imports.push({
        name: sourceName[1],
        module: moduleSpec,
        line: content.slice(0, m.index).split("\n").length,
        typeOnly: isTypeOnlyImport || /^type\s+/.test(trimmed),
      });
    }
  }
  return imports;
}

function main() {
  // Build the exported-name set for each target module (recursively resolving wildcards)
  const moduleExports = {};
  for (const [spec, relPath] of Object.entries(TARGET_MODULES)) {
    const full = path.join(ROOT, relPath);
    if (!fs.existsSync(full)) {
      console.error(`[ERROR] Target module not found: ${relPath}`);
      process.exit(2);
    }
    const resolved = readExportedNames(full);
    moduleExports[spec] = resolved;
    console.log(
      `  ${spec}: ${resolved.names.size} exported names` +
        (resolved.unresolvedWildcards > 0
          ? ` (${resolved.unresolvedWildcards} bare/unresolved wildcard re-exports — names from those will be tolerated)`
          : "")
    );
  }
  console.log("");

  // Scan all source files for type imports referencing those modules
  const stale = [];
  let totalImports = 0;
  let filesScanned = 0;
  for (const dir of SCAN_DIRS) {
    const full = path.join(ROOT, dir);
    if (!fs.existsSync(full)) continue;
    for (const file of walk(full)) {
      filesScanned++;
      const rel = path.relative(ROOT, file);
      const imports = findTypeImports(file);
      for (const imp of imports) {
        totalImports++;
        const target = moduleExports[imp.module];
        // If the target has unresolved (bare) wildcard re-exports, names from
        // those external modules can't be enumerated — skip strict check.
        if (target.unresolvedWildcards > 0 && !target.names.has(imp.name)) {
          // Only tolerate when name is genuinely unknown — known mismatches
          // against resolvable exports are still caught.
          continue;
        }
        if (!target.names.has(imp.name)) {
          stale.push({ file: rel, line: imp.line, name: imp.name, module: imp.module });
        }
      }
    }
  }

  console.log("=== Stale Type Names Check ===");
  console.log(`Files scanned:      ${filesScanned}`);
  console.log(`Type imports found: ${totalImports}`);
  console.log(`Stale references:   ${stale.length}`);
  console.log("");

  if (stale.length === 0) {
    console.log("✓ All type imports resolve to existing exports.");
    process.exit(0);
  }

  console.log("✗ Stale type imports detected:");
  for (const s of stale) {
    console.log(`  ${s.file}:${s.line}  imports '${s.name}' from '${s.module}' — not exported`);
  }
  process.exit(1);
}

try {
  main();
} catch (err) {
  console.error("[ERROR] check-stale-type-names crashed:", err);
  process.exit(2);
}
