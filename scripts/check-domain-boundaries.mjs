#!/usr/bin/env node
/**
 * Cross-Domain Import Boundary Guardrail
 *
 * Detects imports between server/domains/X/ and server/domains/Y/.
 * Domains must not import from each other — they should go through
 * shared infrastructure (repositories, services, middleware, utils).
 *
 * Exit 0 = clean, Exit 1 = violations found.
 */
import { readdir, readFile, stat } from "node:fs/promises";
import { join, relative, resolve } from "node:path";

const DOMAINS_DIR = resolve("server/domains");

const ALLOWLIST = [
  "server/domains/crew/interfaces/crew-member-routes.ts::../../permissions/repository.js",
  "server/domains/equipment/routes.ts::../permissions/middleware",
  "server/domains/inventory/interfaces/routes.ts::../../permissions/middleware",
  "server/domains/vessels/routes.ts::../permissions/middleware",
  "server/domains/work-orders/interfaces/parts.ts::../../permissions/middleware",
];

async function walkTs(dir) {
  const results = [];
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return results;
  }
  for (const e of entries) {
    const full = join(dir, e.name);
    if (e.isDirectory()) {
      results.push(...(await walkTs(full)));
    } else if (e.name.endsWith(".ts") || e.name.endsWith(".tsx")) {
      results.push(full);
    }
  }
  return results;
}

function domainOf(filePath) {
  const rel = relative(DOMAINS_DIR, filePath);
  return rel.split("/")[0];
}

function resolveRelativeTarget(filePath, importPath) {
  const dir = filePath.replace(/\/[^/]+$/, "");
  const resolved = resolve(dir, importPath);
  return resolved;
}

async function main() {
  const files = await walkTs(DOMAINS_DIR);
  const importRe = /from\s+["']([^"']+)["']/g;
  const violations = [];

  for (const file of files) {
    const sourceDomain = domainOf(file);
    const content = await readFile(file, "utf8");
    let match;
    importRe.lastIndex = 0;
    while ((match = importRe.exec(content)) !== null) {
      const imp = match[1];
      if (!imp.startsWith(".")) continue;

      const resolved = resolveRelativeTarget(file, imp);
      if (!resolved.startsWith(DOMAINS_DIR + "/")) continue;

      const targetDomain = domainOf(resolved);
      if (targetDomain === sourceDomain) continue;

      const rel = relative(process.cwd(), file);
      const key = `${rel}::${imp}`;
      if (ALLOWLIST.includes(key)) continue;

      violations.push({ file: rel, import: imp, from: sourceDomain, to: targetDomain });
    }
  }

  if (violations.length === 0) {
    console.log(
      `✅ Domain boundary check passed — ${files.length} files scanned, 0 cross-domain imports.`
    );
    process.exit(0);
  }

  console.error(`❌ ${violations.length} cross-domain import violation(s):`);
  for (const v of violations) {
    console.error(`  [${v.from}] → [${v.to}]  ${v.file}  import "${v.import}"`);
  }
  console.error(
    `\nFix: move shared logic to server/repositories.ts, server/services/, or server/lib/.`
  );
  console.error(`Or add to ALLOWLIST in scripts/check-domain-boundaries.mjs if intentional.`);
  process.exit(1);
}

main().catch((err) => {
  console.error("Domain boundary check failed:", err);
  process.exit(1);
});
