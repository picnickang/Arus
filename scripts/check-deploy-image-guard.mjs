#!/usr/bin/env node
/**
 * Deploy Image Guard
 *
 * Prevents a class of publish failures where the deployable Docker image
 * either (a) fails to build or (b) creeps back toward the 8 GiB Cloud Run
 * limit because of choices in `.dockerignore`.
 *
 * Two independent checks:
 *
 * 1. ASSETS BUILD-CONTEXT INVARIANT (fatal):
 *    `attached_assets/` is excluded from the Docker build context (it is
 *    listed in `.dockerignore`) on the assumption that nothing under
 *    `client/src` imports `@assets/*`. If someone later adds an
 *    `@assets/...` import, the in-container `vite build` will fail because
 *    the folder is missing from the build context. This check fails the
 *    moment `client/src` imports `@assets/*` while `attached_assets/` is
 *    still ignored — forcing whoever adds the import to also un-ignore the
 *    folder (or move the asset into the build context).
 *
 * 2. DEPLOYABLE FOOTPRINT (warn-only):
 *    A lightweight estimate of the build-context size after applying the
 *    top-level directory exclusions in `.dockerignore`. Prints a warning
 *    when the footprint grows past a soft threshold so the image doesn't
 *    silently approach the hard 8 GiB limit. Never fails the build.
 *
 * Run:  node scripts/check-deploy-image-guard.mjs
 * Exit: 0 = pass (warnings allowed), 1 = fatal invariant violated
 */

import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { dirname, resolve, relative, join } from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

// The asset folder + alias under guard. Keep in sync with the `@assets`
// alias in vite.config.ts.
const ASSET_DIR = "attached_assets";
const ASSET_ALIAS = "@assets";

// Soft warning threshold for the estimated build-context footprint.
// The hard Cloud Run image limit is 8 GiB; warn well before that so there
// is room for node_modules + the built image layers on top of the context.
const FOOTPRINT_WARN_BYTES = 4 * 1024 * 1024 * 1024; // 4 GiB

function readDockerignoreEntries() {
  const path = resolve(root, ".dockerignore");
  if (!existsSync(path)) return [];
  return readFileSync(path, "utf8")
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith("#"));
}

function dockerignoreExcludes(entries, dirName) {
  // Treat `dir`, `dir/`, `/dir`, `/dir/` as excluding the directory.
  const normalized = new Set(entries.map((e) => e.replace(/^\//, "").replace(/\/$/, "")));
  return normalized.has(dirName);
}

function walkForAssetImports(dir) {
  const hits = [];
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return hits;
  }
  for (const entry of entries) {
    if (entry.name === "node_modules" || entry.name === ".git") continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      hits.push(...walkForAssetImports(full));
      continue;
    }
    if (!/\.(ts|tsx|js|jsx|mjs|cjs|css)$/.test(entry.name)) continue;
    const content = readFileSync(full, "utf8");
    const lines = content.split("\n");
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      // Match `from "@assets/..."`, `import("@assets/...")`,
      // `require("@assets/...")`, and CSS `url(@assets/...)`.
      if (/['"(]@assets\//.test(line)) {
        hits.push(`${relative(root, full)}:${i + 1}: ${line.trim()}`);
      }
    }
  }
  return hits;
}

function dirSizeBytes(dir) {
  // Prefer `du` (fast, handles large trees); fall back to a JS walk.
  try {
    const out = execSync(`du -sb ${JSON.stringify(dir)}`, {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
    return Number.parseInt(out.split(/\s+/)[0], 10) || 0;
  } catch {
    // Fallback: recursive stat (slower, but portable).
    let total = 0;
    const stack = [dir];
    while (stack.length) {
      const cur = stack.pop();
      let entries;
      try {
        entries = readdirSync(cur, { withFileTypes: true });
      } catch {
        continue;
      }
      for (const entry of entries) {
        const full = join(cur, entry.name);
        if (entry.isDirectory()) {
          stack.push(full);
        } else {
          try {
            total += statSync(full).size;
          } catch {}
        }
      }
    }
    return total;
  }
}

function fmtBytes(n) {
  const units = ["B", "KiB", "MiB", "GiB"];
  let v = n;
  let u = 0;
  while (v >= 1024 && u < units.length - 1) {
    v /= 1024;
    u++;
  }
  return `${v.toFixed(2)} ${units[u]}`;
}

console.log("=== Deploy Image Guard ===");

const entries = readDockerignoreEntries();
const assetsIgnored = dockerignoreExcludes(entries, ASSET_DIR);

// --- Check 1: assets build-context invariant (fatal) ----------------------
const clientSrc = resolve(root, "client", "src");
const assetImports = walkForAssetImports(clientSrc);

let fatal = false;

if (assetsIgnored && assetImports.length > 0) {
  fatal = true;
  console.error(
    `\n✗ FATAL: client/src imports ${ASSET_ALIAS}/* but ${ASSET_DIR}/ is excluded in .dockerignore.`
  );
  console.error(
    `  The in-container \`vite build\` will fail — the ${ASSET_DIR}/ folder is not in the Docker build context.`
  );
  console.error(`  ${assetImports.length} offending import(s):`);
  for (const hit of assetImports.slice(0, 20)) {
    console.error(`    ✗ ${hit}`);
  }
  if (assetImports.length > 20) {
    console.error(`    … and ${assetImports.length - 20} more`);
  }
  console.error(
    `\n  Fix: remove \`${ASSET_DIR}/\` from .dockerignore so the asset ships in the build context,`
  );
  console.error(
    `  or move the imported asset into a directory already in the build context (e.g. client/src/assets).`
  );
} else if (assetsIgnored) {
  console.log(
    `✓ ${ASSET_DIR}/ excluded from build context and no ${ASSET_ALIAS}/* imports in client/src — safe.`
  );
} else {
  console.log(`✓ ${ASSET_DIR}/ is in the build context — ${ASSET_ALIAS}/* imports are safe.`);
}

// --- Check 2: deployable footprint (warn-only) ----------------------------
const ignoredTopLevelDirs = entries
  .map((e) => e.replace(/^\//, "").replace(/\/$/, ""))
  .filter((e) => !e.includes("/") && !e.includes("*") && !e.startsWith("."));

let footprint = 0;
let topEntries;
try {
  topEntries = readdirSync(root, { withFileTypes: true });
} catch {
  topEntries = [];
}
const ignoredSet = new Set([...ignoredTopLevelDirs, "node_modules", ".git"]);
const breakdown = [];
for (const entry of topEntries) {
  if (!entry.isDirectory()) continue;
  if (entry.name.startsWith(".")) continue;
  if (ignoredSet.has(entry.name)) continue;
  const size = dirSizeBytes(join(root, entry.name));
  footprint += size;
  breakdown.push({ name: entry.name, size });
}

breakdown.sort((a, b) => b.size - a.size);
console.log(
  `\nEstimated build-context footprint (excluding .dockerignore dirs + node_modules): ${fmtBytes(footprint)}`
);
for (const { name, size } of breakdown.slice(0, 5)) {
  console.log(`  - ${name}/: ${fmtBytes(size)}`);
}

if (footprint > FOOTPRINT_WARN_BYTES) {
  console.warn(
    `\n⚠ WARNING: build-context footprint ${fmtBytes(footprint)} exceeds soft threshold ${fmtBytes(
      FOOTPRINT_WARN_BYTES
    )}.`
  );
  console.warn(
    "  The hard Cloud Run image limit is 8 GiB. Consider excluding large non-runtime dirs in .dockerignore."
  );
}

if (fatal) {
  process.exit(1);
}
console.log("\nDeploy image guard passed.");
process.exit(0);
