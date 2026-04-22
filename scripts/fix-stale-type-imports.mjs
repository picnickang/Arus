#!/usr/bin/env node
/**
 * fix-stale-type-imports.mjs
 *
 * Codemod with two modes:
 *
 *   Mode A: Pure type-only `import type { ... } from "@shared/schema-runtime"`
 *     blocks where any name is not exported by schema-runtime → redirect the
 *     entire block to "@shared/schema".
 *
 *   Mode B: Mixed value+type `import { val, type T1, type T2 } from
 *     "@shared/schema-runtime"` blocks → split into a value-only import
 *     (kept on schema-runtime) and a type-only import (redirected to
 *     @shared/schema).
 *
 * Rationale: type-only imports are erased at runtime and unaffected by the
 * dual-mode switch. Sourcing them from `@shared/schema` (which exports the
 * PG-derived types directly) is cleaner and avoids the schema-runtime
 * re-export gap.
 *
 * Idempotent and safe to re-run.
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();

function readExportedNames(filePath) {
  const content = fs.readFileSync(filePath, "utf-8");
  const names = new Set();
  const decl = /export\s+(?:declare\s+)?(?:const|let|var|function|class|enum|interface|type|abstract\s+class)\s+([A-Za-z_$][\w$]*)/g;
  for (const m of content.matchAll(decl)) names.add(m[1]);
  const grouped = /export\s*(?:type\s+)?\{([^}]+)\}/g;
  for (const m of content.matchAll(grouped)) {
    for (const part of m[1].split(",")) {
      const trimmed = part.trim();
      if (!trimmed) continue;
      const aliasMatch = trimmed.match(/(?:[A-Za-z_$][\w$]*)\s+as\s+([A-Za-z_$][\w$]*)/);
      if (aliasMatch) names.add(aliasMatch[1]);
      else {
        const simple = trimmed.match(/^([A-Za-z_$][\w$]*)/);
        if (simple) names.add(simple[1]);
      }
    }
  }
  return names;
}

const runtimeExports = readExportedNames(path.join(ROOT, "shared/schema-runtime.ts"));

let filesChanged = 0;
let typeOnlyRewritten = 0;
let mixedSplit = 0;

function* walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(full);
    else if (/\.(ts|tsx)$/.test(entry.name) && !entry.name.endsWith(".d.ts")) yield full;
  }
}

const SCAN_DIRS = ["client/src", "server", "shared"];

// Match any `import [type] { ... } from "@shared/schema-runtime";`
const IMPORT_RE = /import\s+(type\s+)?\{([^}]+)\}\s+from\s+["']@shared\/schema-runtime["']\s*;?/gs;

for (const dir of SCAN_DIRS) {
  const full = path.join(ROOT, dir);
  if (!fs.existsSync(full)) continue;
  for (const file of walk(full)) {
    let content = fs.readFileSync(file, "utf-8");
    let modified = false;

    content = content.replace(IMPORT_RE, (match, isTypeOnlyKeyword, body) => {
      const items = body
        .split(",")
        .map((p) => p.trim())
        .filter(Boolean);

      // Classify each item: value vs type
      const valueItems = [];
      const typeItems = [];
      for (const raw of items) {
        const isType = isTypeOnlyKeyword || /^type\s+/.test(raw);
        const cleaned = raw.replace(/^type\s+/, "");
        if (isType) typeItems.push(cleaned);
        else valueItems.push(cleaned);
      }

      // Mode A: pure type-only block, no stale → leave alone.
      if (isTypeOnlyKeyword) {
        const namesInBlock = items.map(
          (p) => p.replace(/^type\s+/, "").match(/^([A-Za-z_$][\w$]*)/)?.[1]
        ).filter(Boolean);
        const hasStale = namesInBlock.some((n) => !runtimeExports.has(n));
        if (!hasStale) return match;
        modified = true;
        typeOnlyRewritten++;
        return match.replace(/from\s+["']@shared\/schema-runtime["']/, 'from "@shared/schema"');
      }

      // Mode B: mixed import — only split if there's at least one type item.
      if (typeItems.length === 0) return match;

      modified = true;
      mixedSplit++;
      const valuePart = valueItems.length > 0
        ? `import { ${valueItems.join(", ")} } from "@shared/schema-runtime";`
        : "";
      const typePart = `import type { ${typeItems.join(", ")} } from "@shared/schema";`;
      return [valuePart, typePart].filter(Boolean).join("\n");
    });

    if (modified) {
      fs.writeFileSync(file, content);
      filesChanged++;
    }
  }
}

console.log(`Files changed:               ${filesChanged}`);
console.log(`Type-only blocks redirected: ${typeOnlyRewritten}`);
console.log(`Mixed imports split:         ${mixedSplit}`);
