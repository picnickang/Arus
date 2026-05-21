#!/usr/bin/env node
/**
 * Frontend ↔ Backend API Contract Verifier (baseline mode)
 *
 * Walks the frontend for references to `/api/...` paths in:
 *   - `queryKey: ['/api/...', ...]`
 *   - `apiRequest('METHOD', '/api/...')`
 *   - `apiRequest<T>('METHOD', '/api/...')`
 *   - `fetch('/api/...', { method: 'METHOD' })`
 *
 * Walks the backend for route registrations:
 *   - `app.<method>('/api/...')`
 *   - `router.<method>('/api/...')`
 *   - `<anything>.<method>('/api/...')` on Express-shaped values
 *
 * Each frontend reference is resolved to a (method, normalized-path) pair and
 * checked against the set of backend routes. Path params (`:id`, `:vesselId`)
 * are normalized to `:param` on both sides so dynamic segments line up.
 *
 * Baseline behaviour:
 *   - Stored in `scripts/api-contracts-baseline.json` as `{ "unbacked": N }`.
 *   - CI fails when the unbacked count rises above the baseline.
 *   - `--write-baseline` lowers the floor; the file should be committed.
 *
 * NOTE: This is intentionally a structural / route-shape check. Response-shape
 * pairing (validateResponse<T> ↔ server Zod schema) is tracked separately by
 * scripts/check-client-wire-parses.mjs.
 *
 * Usage:
 *   node scripts/check-api-contracts.mjs                  # CI check
 *   node scripts/check-api-contracts.mjs --report         # list offenders
 *   node scripts/check-api-contracts.mjs --write-baseline # lock new floor
 */
import { readdirSync, readFileSync, statSync, writeFileSync, existsSync } from "node:fs";
import { join, relative, resolve } from "node:path";

const ROOT = process.cwd();
const BASELINE_PATH = resolve("scripts/api-contracts-baseline.json");
const CLIENT_ROOT = "client/src";
const SERVER_ROOT = "server";
const SKIP_DIR_NAMES = new Set([
  "node_modules", "dist", "build", ".git", "__tests__", "tests", "test",
]);
const FILE_EXTS = [".ts", ".tsx", ".mts", ".cts"];

function walk(dir, out = []) {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const ent of entries) {
    if (SKIP_DIR_NAMES.has(ent.name)) continue;
    const p = join(dir, ent.name);
    if (ent.isDirectory()) walk(p, out);
    else if (FILE_EXTS.some((e) => ent.name.endsWith(e))) out.push(p);
  }
  return out;
}

// Normalize a path so that dynamic params line up regardless of name.
//   /api/vessels/:vesselId/3d-model  →  /api/vessels/:param/3d-model
//   /api/equipment/${id}/parts       →  /api/equipment/:param/parts
//   /api/equipment/abc-123/parts     →  /api/equipment/:param/parts   (only when it's an interpolation)
function normalizePath(p) {
  return p
    .replace(/\$\{[^}]+\}/g, ":param")
    .replace(/:[A-Za-z_][A-Za-z0-9_]*/g, ":param")
    .replace(/\/+$/g, "")
    .toLowerCase();
}

const METHOD_RE = /(get|post|put|patch|delete|head|options)/i;

// ---- Backend route extraction ----------------------------------------------

// Match any expression ending in `.<method>('/api/...')` or `.<method>("/api/...")`.
// Captures: 1=method, 2=path. Anchored on a word boundary so `.getRequest(` is excluded by the path filter.
const SERVER_ROUTE_RE = /\.(get|post|put|patch|delete|head|options)\(\s*['"`](\/api\/[^'"`]+)['"`]/gi;

function extractServerRoutes(src) {
  const out = [];
  let m;
  SERVER_ROUTE_RE.lastIndex = 0;
  while ((m = SERVER_ROUTE_RE.exec(src)) !== null) {
    const method = m[1].toUpperCase();
    const path = normalizePath(m[2]);
    out.push({ method, path });
  }
  return out;
}

// ---- Frontend reference extraction -----------------------------------------

// queryKey: ['/api/...', ...]   → method defaults to GET (TanStack convention).
const QUERYKEY_RE = /queryKey\s*:\s*\[\s*['"`](\/api\/[^'"`]+)['"`]/g;

// apiRequest('METHOD', '/api/...')  or  apiRequest<T>('METHOD', '/api/...')
const APIREQUEST_RE =
  /\bapiRequest\s*(?:<[^>(]*>)?\s*\(\s*['"`](get|post|put|patch|delete|head|options)['"`]\s*,\s*['"`](\/api\/[^'"`]+)['"`]/gi;

// apiRequest('METHOD', `/api/...${x}/...`) — template literals
const APIREQUEST_TPL_RE =
  /\bapiRequest\s*(?:<[^>(]*>)?\s*\(\s*['"`](get|post|put|patch|delete|head|options)['"`]\s*,\s*`(\/api\/[^`]+)`/gi;

// fetch('/api/...', { method: 'METHOD' })   — best-effort, GET when no method object
const FETCH_RE = /\bfetch\s*\(\s*['"`](\/api\/[^'"`]+)['"`]\s*(?:,\s*\{([^}]{0,400})\})?/g;

// fetch(`/api/...`, { method: 'METHOD' })
const FETCH_TPL_RE = /\bfetch\s*\(\s*`(\/api\/[^`]+)`\s*(?:,\s*\{([^}]{0,400})\})?/g;

function extractMethodFromFetchOpts(opts) {
  if (!opts) return "GET";
  const m = /method\s*:\s*['"`]([A-Za-z]+)['"`]/i.exec(opts);
  return m ? m[1].toUpperCase() : "GET";
}

function extractClientRefs(src) {
  const out = [];
  let m;

  QUERYKEY_RE.lastIndex = 0;
  while ((m = QUERYKEY_RE.exec(src)) !== null) {
    out.push({ method: "GET", path: normalizePath(m[1]), kind: "queryKey" });
  }

  APIREQUEST_RE.lastIndex = 0;
  while ((m = APIREQUEST_RE.exec(src)) !== null) {
    out.push({ method: m[1].toUpperCase(), path: normalizePath(m[2]), kind: "apiRequest" });
  }
  APIREQUEST_TPL_RE.lastIndex = 0;
  while ((m = APIREQUEST_TPL_RE.exec(src)) !== null) {
    out.push({ method: m[1].toUpperCase(), path: normalizePath(m[2]), kind: "apiRequest" });
  }

  FETCH_RE.lastIndex = 0;
  while ((m = FETCH_RE.exec(src)) !== null) {
    if (!m[1].startsWith("/api/")) continue;
    out.push({ method: extractMethodFromFetchOpts(m[2]), path: normalizePath(m[1]), kind: "fetch" });
  }
  FETCH_TPL_RE.lastIndex = 0;
  while ((m = FETCH_TPL_RE.exec(src)) !== null) {
    if (!m[1].startsWith("/api/")) continue;
    out.push({ method: extractMethodFromFetchOpts(m[2]), path: normalizePath(m[1]), kind: "fetch" });
  }

  return out;
}

// ---- Main -----------------------------------------------------------------

function main() {
  const serverFiles = walk(resolve(SERVER_ROOT));
  const clientFiles = walk(resolve(CLIENT_ROOT));

  const serverRoutes = new Set();
  // Also build a per-method set of normalized path prefixes so that frontend
  // references with extra trailing segments can match a router mounted higher
  // up. The route table is the source of truth for exact pairing; the prefix
  // table is the structural fallback that captures the "this route exists in
  // some form" relaxation we apply when path params are aggressively renamed.
  for (const f of serverFiles) {
    const src = readFileSync(f, "utf8");
    for (const r of extractServerRoutes(src)) {
      serverRoutes.add(`${r.method} ${r.path}`);
    }
  }

  const unbacked = [];
  let totalRefs = 0;
  for (const f of clientFiles) {
    const src = readFileSync(f, "utf8");
    for (const r of extractClientRefs(src)) {
      totalRefs++;
      const key = `${r.method} ${r.path}`;
      if (!serverRoutes.has(key)) {
        unbacked.push({ file: relative(ROOT, f), ...r });
      }
    }
  }

  const args = new Set(process.argv.slice(2));

  if (args.has("--report")) {
    const byFile = new Map();
    for (const u of unbacked) {
      if (!byFile.has(u.file)) byFile.set(u.file, []);
      byFile.get(u.file).push(u);
    }
    const sorted = [...byFile.entries()].sort((a, b) => b[1].length - a[1].length);
    for (const [f, refs] of sorted.slice(0, 30)) {
      console.log(`${f}: ${refs.length}`);
      for (const r of refs.slice(0, 5)) console.log(`  ${r.method} ${r.path}   (${r.kind})`);
    }
    console.log(`\nFrontend refs: ${totalRefs}`);
    console.log(`Backend routes: ${serverRoutes.size}`);
    console.log(`Unbacked: ${unbacked.length}`);
    return;
  }

  if (args.has("--write-baseline")) {
    writeFileSync(
      BASELINE_PATH,
      JSON.stringify(
        { unbacked: unbacked.length, totalRefs, totalRoutes: serverRoutes.size },
        null,
        2,
      ) + "\n",
    );
    console.log(`Wrote baseline: unbacked=${unbacked.length}`);
    return;
  }

  let baseline = unbacked.length;
  if (existsSync(BASELINE_PATH)) {
    try {
      baseline = JSON.parse(readFileSync(BASELINE_PATH, "utf8")).unbacked ?? unbacked.length;
    } catch {
      baseline = unbacked.length;
    }
  } else {
    writeFileSync(
      BASELINE_PATH,
      JSON.stringify(
        { unbacked: unbacked.length, totalRefs, totalRoutes: serverRoutes.size },
        null,
        2,
      ) + "\n",
    );
    console.log(`Initialized api-contracts baseline: unbacked=${unbacked.length}`);
    return;
  }

  if (unbacked.length > baseline) {
    console.error(
      `\n✗ API contract regression: ${baseline} → ${unbacked.length} (+${unbacked.length - baseline})`,
    );
    console.error(
      `  A frontend reference to /api/... does not resolve to any registered backend route.`,
    );
    console.error(
      `  Run \`node ${relative(ROOT, process.argv[1])} --report\` to see offenders.`,
    );
    process.exit(1);
  }

  if (unbacked.length < baseline) {
    console.log(
      `✓ Reduction: ${baseline} → ${unbacked.length} (-${baseline - unbacked.length}). Consider regenerating the baseline.`,
    );
  } else {
    console.log(`✓ API contract count at baseline: ${unbacked.length}`);
  }
}

main();
