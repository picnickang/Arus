#!/usr/bin/env node
/**
 * Domain Layering Conformance Enforcement
 * =======================================
 *
 * Rule (see docs/adr/003-domain-layering-policy.md):
 *   A domain under server/domains/<name>/ is classified by which of the four
 *   hexagonal layer directories it contains:
 *     - "full"    — all of domain/ application/ infrastructure/ interfaces/
 *     - "partial" — at least one, but not all four
 *     - "flat"    — none of the four (legacy routes/service/repository style)
 *
 *   This guard ratchets the layering migration in two directions at once:
 *     1. The set of "full" domains may only GROW. A domain that is fully
 *        layered today must never silently regress to partial/flat.
 *     2. The "partial" + "flat" sets may only SHRINK. New flat domains are
 *        not allowed; the burn-down target is zero non-full domains.
 *
 * Burn-down workflow:
 *   1. Run this script. Any regression (a baselined "full" domain that is no
 *      longer full, or a brand-new partial/flat domain) fails the build.
 *   2. When you convert a flat/partial domain to full, regenerate the baseline
 *      so the gains are locked in:
 *        node scripts/check-domain-conformance.mjs --write-baseline
 *   3. Never hand-edit the baseline to re-add a domain to flat/partial.
 *
 * Run:   node scripts/check-domain-conformance.mjs
 * Exit:  0 = pass (no regression), 1 = regression found
 */

import { readdirSync, existsSync, statSync, writeFileSync, readFileSync } from "fs";
import { dirname, resolve, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");
const baselinePath = resolve(__dirname, "domain-conformance-baseline.json");
const writeBaseline = process.argv.includes("--write-baseline");

const LAYERS = ["domain", "application", "infrastructure", "interfaces"];
const domainsDir = resolve(root, "server", "domains");

function isDir(p) {
  try {
    return statSync(p).isDirectory();
  } catch {
    return false;
  }
}

function classify() {
  const full = [];
  const partial = [];
  const flat = [];
  let entries;
  try {
    entries = readdirSync(domainsDir, { withFileTypes: true });
  } catch {
    return { full, partial, flat };
  }
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const domainPath = join(domainsDir, entry.name);
    const present = LAYERS.filter((l) => isDir(join(domainPath, l)));
    if (present.length === LAYERS.length) full.push(entry.name);
    else if (present.length === 0) flat.push(entry.name);
    else partial.push(entry.name);
  }
  full.sort();
  partial.sort();
  flat.sort();
  return { full, partial, flat };
}

const current = classify();

if (writeBaseline) {
  const payload = {
    _comment:
      "Domain layering conformance baseline. The 'full' set may only grow; " +
      "'partial' and 'flat' may only shrink. Regenerate with: " +
      "node scripts/check-domain-conformance.mjs --write-baseline. " +
      "See docs/adr/003-domain-layering-policy.md.",
    generatedAt: new Date().toISOString(),
    counts: {
      full: current.full.length,
      partial: current.partial.length,
      flat: current.flat.length,
      total: current.full.length + current.partial.length + current.flat.length,
    },
    full: current.full,
    partial: current.partial,
    flat: current.flat,
  };
  writeFileSync(baselinePath, JSON.stringify(payload, null, 2) + "\n");
  console.log(
    `Wrote conformance baseline: ${current.full.length} full, ` +
      `${current.partial.length} partial, ${current.flat.length} flat ` +
      "to scripts/domain-conformance-baseline.json"
  );
  process.exit(0);
}

const baseline = existsSync(baselinePath)
  ? JSON.parse(readFileSync(baselinePath, "utf8"))
  : { full: [], partial: [], flat: [] };

const baselineFull = new Set(baseline.full ?? []);
const baselinePartial = new Set(baseline.partial ?? []);
const baselineFlat = new Set(baseline.flat ?? []);
const knownDomains = new Set([...baselineFull, ...baselinePartial, ...baselineFlat]);

const currentFull = new Set(current.full);
const currentNonFull = new Set([...current.partial, ...current.flat]);

// Regression 1: a domain that was "full" in the baseline is no longer full.
const regressedFromFull = [...baselineFull].filter((d) => !currentFull.has(d));

// Regression 2: a brand-new domain that is not fully layered (new flat/partial).
const newNonFull = [...currentNonFull].filter((d) => !knownDomains.has(d));

// Progress: previously non-full domains that are now full.
const newlyFull = [...currentFull].filter((d) => !baselineFull.has(d));

console.log("=== Domain Layering Conformance ===");
console.log(
  `Baseline:   ${baselineFull.size} full, ${baselinePartial.size} partial, ${baselineFlat.size} flat`
);
console.log(
  `Current:    ${current.full.length} full, ${current.partial.length} partial, ${current.flat.length} flat`
);
console.log(`Newly full: ${newlyFull.length}`);

if (newlyFull.length > 0) {
  console.log("\nNewly fully-layered domains (regenerate baseline to lock in):");
  for (const d of newlyFull) console.log(`  + ${d}`);
}

let failed = false;

if (regressedFromFull.length > 0) {
  failed = true;
  console.log("\nREGRESSION — domains that were fully layered but no longer are:");
  for (const d of regressedFromFull) console.log(`  X ${d}`);
  console.log(
    "\nFix: restore the missing layer directory, or do not remove hexagonal " +
      "layers from an already-converted domain."
  );
}

if (newNonFull.length > 0) {
  failed = true;
  console.log("\nNEW non-conformant domains (new domains must be fully 4-layered):");
  for (const d of newNonFull) console.log(`  X ${d}`);
  console.log(
    "\nFix: scaffold domain/ application/ infrastructure/ interfaces/ for the " +
      "new domain (see docs/architecture/hexagonal-remediation-plan.md), or, if " +
      "it is an intentionally-flat CRUD/utility domain, confine raw DB access to " +
      "an infrastructure/ adapter and regenerate the baseline with team agreement."
  );
}

if (failed) {
  process.exit(1);
}

if (current.partial.length === 0 && current.flat.length === 0) {
  console.log("\nAll clear — every domain is fully 4-layered.");
} else {
  console.log("\nNo regression. Burn-down remaining (target 0):");
  console.log(`  partial: ${current.partial.length}  flat: ${current.flat.length}`);
}

process.exit(0);
