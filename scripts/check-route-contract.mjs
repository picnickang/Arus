#!/usr/bin/env node
/**
 * Route contract checker — fails when the client references an /api path
 * the server never registers.
 *
 * Motivation: /api/pdm/health/:equipmentId was documented in Swagger and
 * queried by the PdM equipment page since its introduction, but no server
 * route existed — in dev the 404 returned Vite's HTML and the page crashed
 * parsing it. This class of drift is invisible to tsc and unit tests.
 *
 * Method:
 *  1. CLIENT (static): every string literal starting with /api/ in
 *     client/src — apiRequest/fetch arguments and queryKey first elements
 *     (the default queryFn fetches queryKey[0]). `${...}` interpolations
 *     normalize to a `*` segment; query strings are stripped.
 *  2. SERVER (runtime): scripts/dump-routes.ts boots the real
 *     `registerRoutes(app)` and walks the Express stack, so the table is
 *     exactly what production serves (1,100+ routes), not a grep estimate.
 *  3. MATCH: segment-by-segment; server `:param` matches anything, client
 *     `*` matches anything.
 *
 * Pre-existing drift is ratcheted (same pattern as check:cast-burndown):
 * scripts/route-contract-baseline.json holds the known-unmatched set
 * (per-entry dispositions: docs/qa/route-contract-triage.md); the
 * check fails only on NEW unmatched paths, and reports when baseline
 * entries get fixed so the file can be pruned. Run with --update-baseline
 * to regenerate it (do this only when you've verified the new entries are
 * intentional, e.g. a removed legacy page).
 */

import {
  closeSync,
  existsSync,
  mkdtempSync,
  openSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const CLIENT_DIR = join(ROOT, "client", "src");
const BASELINE_FILE = join(ROOT, "scripts", "route-contract-baseline.json");
const ROUTE_DUMP_MAX_BUFFER = 128 * 1024 * 1024;

function walkFiles(dir, exts, out = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      if (entry === "node_modules" || entry.startsWith(".")) continue;
      walkFiles(full, exts, out);
    } else if (exts.some((ext) => entry.endsWith(ext))) {
      out.push(full);
    }
  }
  return out;
}

function normalize(path) {
  let p = path.split("?")[0];
  p = p.replace(/\$\{[^}]*\}/g, "*");
  p = p.replace(/\/+$/, "");
  return p;
}

function segments(path) {
  return normalize(path).split("/").filter(Boolean);
}

const CLIENT_LITERAL = /["'`](\/api\/[^"'`\s]*)["'`]/g;

export function collectClientPaths() {
  const found = new Map(); // path -> first file seen
  for (const file of walkFiles(CLIENT_DIR, [".ts", ".tsx"])) {
    const text = readFileSync(file, "utf8");
    for (const match of text.matchAll(CLIENT_LITERAL)) {
      const norm = normalize(match[1]);
      if (norm === "/api" || norm === "/api/*") continue;
      if (!found.has(norm)) found.set(norm, file.replace(ROOT + "/", ""));
    }
  }
  return found;
}

export function collectServerPaths() {
  const tempDir = mkdtempSync(join(tmpdir(), "arus-route-contract-"));
  const routeDumpFile = join(tempDir, "routes.json");
  const stdoutFd = openSync(routeDumpFile, "w");
  let result;
  try {
    result = spawnSync(
      process.execPath,
      ["--import", "tsx", join(ROOT, "scripts", "dump-routes.ts")],
      {
        cwd: ROOT,
        encoding: "utf8",
        timeout: 180_000,
        env: process.env,
        maxBuffer: ROUTE_DUMP_MAX_BUFFER,
        stdio: ["ignore", stdoutFd, "pipe"],
      }
    );
  } finally {
    closeSync(stdoutFd);
  }

  try {
    if (result.error) {
      if (result.error.code === "ENOBUFS") {
        throw new Error(
          `dump-routes.ts exceeded ${ROUTE_DUMP_MAX_BUFFER} bytes of stderr; increase ROUTE_DUMP_MAX_BUFFER`
        );
      }
      throw result.error;
    }
    if (result.status !== 0) {
      console.error(result.stderr?.slice(-2000));
      throw new Error(
        `dump-routes.ts failed with status ${result.status}${result.signal ? ` signal ${result.signal}` : ""}`
      );
    }
    const stdout = readFileSync(routeDumpFile, "utf8");
    const lines = stdout.trim().split("\n").filter(Boolean);
    if (lines.length === 0) {
      throw new Error("dump-routes.ts produced no stdout; expected a JSON route table");
    }
    let routes;
    try {
      routes = JSON.parse(lines[lines.length - 1]);
    } catch (error) {
      const tail = stdout.slice(-2000);
      throw new Error(
        `dump-routes.ts stdout did not end with parseable JSON (${error.message}). stdout tail:\n${tail}`
      );
    }
    return new Set(routes.map(normalize));
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
}

function pathMatches(clientSegs, serverSegs) {
  if (clientSegs.length !== serverSegs.length) return false;
  for (let i = 0; i < clientSegs.length; i++) {
    const c = clientSegs[i];
    const s = serverSegs[i];
    if (s.startsWith(":") || s === "*" || c === "*") continue;
    if (c !== s) return false;
  }
  return true;
}

export function findUnmatched(clientPaths, serverPaths) {
  const serverSegLists = [...serverPaths].map(segments);
  const matches = (clientPath) => {
    const cSegs = segments(clientPath);
    return serverSegLists.some((sSegs) => pathMatches(cSegs, sSegs));
  };
  const unmatched = [];
  for (const [clientPath, file] of clientPaths) {
    let ok = matches(clientPath);
    // server/middleware/api-versioning.ts rewrites /api/v1/* → /api/* and
    // re-dispatches, so a versioned client path is served whenever its
    // unversioned form has a route. The rewrite is invisible to the route
    // table walk — model it here.
    if (!ok && clientPath.startsWith("/api/v1/")) {
      ok = matches(clientPath.replace("/api/v1/", "/api/"));
    }
    if (!ok) unmatched.push({ path: clientPath, file });
  }
  return unmatched.sort((a, b) => a.path.localeCompare(b.path));
}

function loadBaseline() {
  if (!existsSync(BASELINE_FILE)) return new Set();
  return new Set(JSON.parse(readFileSync(BASELINE_FILE, "utf8")));
}

function main() {
  const updateBaseline = process.argv.includes("--update-baseline");
  const clientPaths = collectClientPaths();
  const serverPaths = collectServerPaths();
  const unmatched = findUnmatched(clientPaths, serverPaths);

  console.log(
    `[route-contract] client /api literals: ${clientPaths.size}, server routes: ${serverPaths.size}, unmatched: ${unmatched.length}`
  );

  if (updateBaseline) {
    writeFileSync(
      BASELINE_FILE,
      JSON.stringify(
        unmatched.map((u) => u.path),
        null,
        2
      ) + "\n"
    );
    console.log(`[route-contract] baseline rewritten with ${unmatched.length} entries.`);
    return;
  }

  const baseline = loadBaseline();
  const fresh = unmatched.filter((u) => !baseline.has(u.path));
  const fixed = [...baseline].filter((path) => !unmatched.some((u) => u.path === path));

  if (fixed.length > 0) {
    console.log(
      `[route-contract] ${fixed.length} baseline entr${fixed.length === 1 ? "y" : "ies"} now resolved — prune with --update-baseline:`
    );
    for (const path of fixed.slice(0, 20)) console.log(`  ✓ ${path}`);
  }

  if (fresh.length > 0) {
    console.error(
      `[route-contract] ${fresh.length} NEW client path(s) have no server route (not in baseline):`
    );
    for (const { path, file } of fresh) {
      console.error(`  ✗ ${path}   (first seen in ${file})`);
    }
    console.error(
      "[route-contract] Implement the route, fix the client path, or (only if intentional) run with --update-baseline. Baseline dispositions: docs/qa/route-contract-triage.md"
    );
    process.exit(1);
  }
  console.log("[route-contract] OK — no new client/server route drift.");
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  main();
}
