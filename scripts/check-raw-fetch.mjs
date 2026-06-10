#!/usr/bin/env node
/**
 * Raw-fetch ratchet (U6).
 *
 * Client code should go through apiRequest/getQueryFn (auth + org headers,
 * desktop URL resolution, offline queueing, envelope unwrapping, typed
 * errors). Raw `fetch(` call sites miss all of that and silently break as
 * domains migrate to the response envelope.
 *
 * The count may only go DOWN. After removing call sites, refresh with:
 *   node scripts/check-raw-fetch.mjs --update
 */

import { readFileSync, writeFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const clientRoot = path.join(root, "client/src");
const baselinePath = path.join(root, "scripts/raw-fetch-baseline.json");

// Files that legitimately own a raw fetch (the client itself, the global
// fetch patch, beacons that must not depend on app plumbing, tests).
const ALLOWLIST = [
  "lib/queryClient.ts",
  "lib/errorHandler.ts",
  "lib/desktopFetch.ts",
  "lib/web-vitals.ts",
  "test/",
  "serviceWorker",
  "sw.ts",
];

function isAllowlisted(relPath) {
  return (
    relPath.endsWith(".test.ts") ||
    relPath.endsWith(".test.tsx") ||
    ALLOWLIST.some((entry) => relPath.includes(entry))
  );
}

function* walk(dir) {
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) {
      yield* walk(full);
    } else if (/\.(ts|tsx)$/.test(entry)) {
      yield full;
    }
  }
}

// `\bfetch(` but not `.fetch(` member calls (queryClient.fetchQuery is
// excluded by the word boundary + paren anyway) and not `desktopFetch(`.
const FETCH_PATTERN = /(?<![.\w])fetch\(/;

const offenders = new Map();
for (const file of walk(clientRoot)) {
  const relPath = path.relative(clientRoot, file);
  if (isAllowlisted(relPath)) {
    continue;
  }
  const lines = readFileSync(file, "utf-8").split("\n");
  lines.forEach((line, index) => {
    if (FETCH_PATTERN.test(line) && !line.trimStart().startsWith("//") && !line.trimStart().startsWith("*")) {
      const list = offenders.get(relPath) ?? [];
      list.push(index + 1);
      offenders.set(relPath, list);
    }
  });
}

const total = [...offenders.values()].reduce((sum, lines) => sum + lines.length, 0);

if (process.argv.includes("--update")) {
  writeFileSync(baselinePath, `${JSON.stringify({ maxRawFetchCallSites: total }, null, 2)}\n`);
  console.log(`✓ Baseline updated: ${total} raw fetch call site(s)`);
  process.exit(0);
}

if (process.argv.includes("--list")) {
  for (const [file, lines] of [...offenders.entries()].sort()) {
    console.log(`${file}: ${lines.join(", ")}`);
  }
}

const baseline = JSON.parse(readFileSync(baselinePath, "utf-8")).maxRawFetchCallSites;

console.log("=== Raw Fetch Ratchet ===");
if (total > baseline) {
  console.error(
    `✗ ${total} raw fetch call site(s) in client/src (baseline ${baseline}).\n` +
      "New code must use apiRequest/getQueryFn from @/lib/queryClient.\n" +
      "Run with --list to see call sites."
  );
  process.exit(1);
}
console.log(
  `✓ ${total} raw fetch call site(s) (baseline ${baseline})${
    total < baseline ? " — run with --update to ratchet down" : ""
  }`
);
