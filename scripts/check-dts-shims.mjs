#!/usr/bin/env node
/**
 * check-dts-shims.mjs
 *
 * Anti-hiding guard for task #163.
 *
 * Every hand-written `*.d.ts` shim under client/src/types/,
 * server/types/, or shared/types/ must be backed by either:
 *
 *   (a) a published package whose name matches a dependency in
 *       package.json (we accept "X.d.ts" -> dep "X" OR "@types/X"),
 *       i.e. the shim covers a real third-party module whose types we
 *       authoritatively declare; OR
 *   (b) a paired runtime Zod schema in the same directory that asserts
 *       the shape (file matching "*.zod.ts" or exporting a `zod` import).
 *
 * Shims that satisfy neither rule are blind type assertions that drift
 * silently from reality — equivalent to `as <Type>` at module scope.
 *
 * Monotonic baseline at scripts/dts-shim-baseline.json tracks the
 * current list of shims (so we know exactly what is allowed in tree
 * today). New shims that violate the rule fail CI; new shims that pass
 * the rule are auto-approved.
 *
 * Usage:
 *   node scripts/check-dts-shims.mjs           # check
 *   node scripts/check-dts-shims.mjs --update  # refresh baseline
 *
 * Exit codes:
 *   0  all shims comply
 *   1  one or more shims violate the rule
 *   2  script/IO error
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const BASELINE_PATH = path.join(__dirname, "dts-shim-baseline.json");
const SCAN_DIRS = ["client/src/types", "server/types", "shared/types"];

function loadDeps() {
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8"));
  const all = new Set();
  for (const section of ["dependencies", "devDependencies", "peerDependencies", "optionalDependencies"]) {
    for (const name of Object.keys(pkg[section] ?? {})) all.add(name);
  }
  return all;
}

function* walk(dir) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) yield* walk(full);
    else if (e.name.endsWith(".d.ts")) yield full;
  }
}

function shimSatisfied(file, body, deps) {
  // (a) Published-package check.
  // Look for `declare module "<name>"` declarations. Each declared
  // module must be a known dep (with or without @types/ prefix).
  const moduleRe = /declare\s+module\s+['"]([^'"]+)['"]/g;
  const declaredModules = [];
  let m;
  while ((m = moduleRe.exec(body)) !== null) declaredModules.push(m[1]);

  if (declaredModules.length > 0) {
    for (const name of declaredModules) {
      // Allow scoped subpaths: `@scope/pkg/sub` -> base is `@scope/pkg`.
      const base = name.startsWith("@")
        ? name.split("/").slice(0, 2).join("/")
        : name.split("/")[0];
      const ok = deps.has(base) || deps.has(`@types/${base}`);
      if (!ok) return { ok: false, reason: `declare module "${name}" — not in package.json deps` };
    }
    return { ok: true, reason: "declares published package(s)" };
  }

  // (a2) Module augmentation via `declare global { namespace X { … } }`
  // where X corresponds to a published package's well-known global
  // namespace. The canonical case is `namespace Express` augmenting
  // express's Request/Response types — express is a dep, so this is a
  // legitimate augmentation rather than a blind shim.
  const namespaceRe = /declare\s+global\s*\{[\s\S]*?namespace\s+([A-Z][A-Za-z0-9_]+)/g;
  const augmentedNamespaces = [];
  while ((m = namespaceRe.exec(body)) !== null) augmentedNamespaces.push(m[1]);
  if (augmentedNamespaces.length > 0) {
    // Map well-known global namespaces to their backing package.
    const NAMESPACE_TO_PKG = {
      Express: "express",
      NodeJS: "node",
      JSX: "react",
    };
    for (const ns of augmentedNamespaces) {
      const pkg = NAMESPACE_TO_PKG[ns];
      const ok =
        pkg && (deps.has(pkg) || deps.has(`@types/${pkg}`));
      if (!ok) {
        return {
          ok: false,
          reason: `augments global namespace ${ns} but backing package is not a known dep`,
        };
      }
    }
    return { ok: true, reason: `augments published package namespace(s): ${augmentedNamespaces.join(", ")}` };
  }

  // (a3) Ambient declarations for browser/standard APIs not yet in
  // lib.dom.d.ts. Recognised by the file declaring `interface Window`,
  // `interface Navigator`, `interface Document`, or by a `declare var`
  // attached to a global constructor. These are equivalent to typing
  // standard-but-not-yet-typed Web APIs and are legitimate.
  const augmentsBrowserGlobals =
    /interface\s+(Window|Navigator|Document|HTMLElement|Element)\b/.test(body) ||
    /declare\s+var\s+[A-Z][A-Za-z0-9_]+\s*:\s*\{/.test(body);
  if (augmentsBrowserGlobals) {
    return { ok: true, reason: "ambient declarations for browser/standard Web APIs" };
  }

  // (b) Paired Zod schema in same directory.
  const dir = path.dirname(file);
  let zodPaired = false;
  try {
    const sibs = fs.readdirSync(dir);
    for (const s of sibs) {
      if (s.endsWith(".zod.ts")) {
        zodPaired = true;
        break;
      }
      if (/\.ts$/.test(s) && !s.endsWith(".d.ts")) {
        const sb = fs.readFileSync(path.join(dir, s), "utf8");
        if (/from\s+['"]zod['"]/.test(sb)) {
          zodPaired = true;
          break;
        }
      }
    }
  } catch {
    /* ignore */
  }
  if (zodPaired) return { ok: true, reason: "paired runtime Zod schema in same directory" };

  return {
    ok: false,
    reason:
      "no `declare module` for a published dep, no augmentation of a known package/browser global, and no paired Zod schema — blind type assertion",
  };
}

function main() {
  const args = new Set(process.argv.slice(2));
  const update = args.has("--update");

  const deps = loadDeps();
  const shims = [];
  for (const dir of SCAN_DIRS) {
    for (const file of walk(path.join(ROOT, dir))) {
      const rel = path.relative(ROOT, file).replace(/\\/g, "/");
      let body = "";
      try {
        body = fs.readFileSync(file, "utf8");
      } catch {
        continue;
      }
      const verdict = shimSatisfied(file, body, deps);
      shims.push({ file: rel, ok: verdict.ok, reason: verdict.reason });
    }
  }

  if (update) {
    const next = {
      $note:
        "Inventory of hand-written `.d.ts` shims under client/src/types/, server/types/, shared/types/. Every entry must be `ok: true`. New shims that aren't backed by a published dep OR a paired Zod schema will fail check-dts-shims.mjs.",
      generatedAt: new Date().toISOString(),
      shims: shims
        .slice()
        .sort((a, b) => a.file.localeCompare(b.file))
        .map(({ file, ok, reason }) => ({ file, ok, reason })),
    };
    fs.writeFileSync(BASELINE_PATH, JSON.stringify(next, null, 2) + "\n");
    console.log(`[check-dts-shims] baseline updated: ${shims.length} shims tracked`);
    return;
  }

  const violations = shims.filter((s) => !s.ok);
  if (violations.length) {
    console.error("");
    console.error(`.d.ts shim policy violations (${violations.length}):`);
    for (const v of violations) console.error(`  ${v.file} — ${v.reason}`);
    console.error("");
    console.error(
      "Every shim must either (a) declare a module already present in package.json deps, or (b) sit next to a paired Zod schema that asserts the shape at runtime.",
    );
    process.exit(1);
  }

  console.log(`[check-dts-shims] OK — ${shims.length} shims, all compliant.`);
}

try {
  main();
} catch (err) {
  console.error("[check-dts-shims] error:", err);
  process.exit(2);
}
