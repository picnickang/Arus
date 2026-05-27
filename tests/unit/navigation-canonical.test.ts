/**
 * Navigation Canonicalization — regression test
 *
 * Pins the Navigation Canonicalization Sweep: every in-app `href=…`,
 * `href: "…"`, or `setLocation("…")` under client/src must use the
 * canonical hub-with-tab URL (e.g. `/maint?tab=work-orders`) instead
 * of a legacy alias that lives in `routeMigrations` / `legacyRedirects`.
 *
 * The legacyRedirects map itself MUST remain intact so external bookmarks
 * keep resolving; this test enforces both halves of that contract.
 */

import { describe, it, expect } from "@jest/globals";
import * as fs from "node:fs";
import * as path from "node:path";

const ROOT = path.resolve(process.cwd());
const CLIENT_SRC = path.join(ROOT, "client", "src");

const LEGACY_ALIASES = [
  "/work-orders",
  "/maintenance",
  "/maintenance-templates",
  "/equipment-intelligence",
  "/inventory-management",
  "/vendors",
  "/crew-management",
  "/schedule-planner",
  "/hours-of-rest",
  "/system-administration",
  "/configuration",
  "/notifications",
  "/sensors",
  "/sensor-templates",
  "/governance-dashboard",
  "/logs-compliance",
  "/engine-logbook",
  "/deck-logbook",
  "/fuel-emissions-log",
  "/condition-monitoring-log",
  "/decommissioned-equipment-log",
  "/vessel-track-log",
  "/health-monitor",
];

const ALLOWED_FILES = new Set<string>([
  // Defines the legacy → canonical mapping. The aliases MUST live here.
  path.join(CLIENT_SRC, "config", "navigationConfig.ts").replace(/^.*\/client/, "client"),
  // Test fixtures / route definitions referencing the alias as the route key
  // are added here as needed.
]);

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (/\.(tsx?|jsx?)$/.test(entry.name)) out.push(full);
  }
  return out;
}

function buildAliasPattern(): RegExp {
  // Match either:
  //   href="<alias>" / href="<alias>?…" / href="<alias>&…" (JSX attribute)
  //   href: "<alias>…" (object literal)
  //   setLocation("<alias>…") / navigate("<alias>…") / push("<alias>…")
  // Trailing char must be `"`, `?`, `&`, or `#` so we don't match e.g.
  // `/work-orders-extra`.
  const aliases = LEGACY_ALIASES.map((a) => a.replace(/[/-]/g, (m) => `\\${m}`)).join("|");
  const trailing = `(?=["?&#])`;
  return new RegExp(
    `(?:href\\s*=\\s*"|href\\s*:\\s*"|(?:setLocation|navigate|push)\\s*\\(\\s*")(?:${aliases})${trailing}`,
    "g",
  );
}

describe("Navigation Canonicalization", () => {
  const files = walk(CLIENT_SRC);

  it("no in-app navigation uses a legacy alias as its target", () => {
    const pattern = buildAliasPattern();
    const offenders: string[] = [];

    for (const file of files) {
      const rel = path.relative(ROOT, file);
      if (ALLOWED_FILES.has(rel)) continue;
      const src = fs.readFileSync(file, "utf8");
      // Strip block + line comments so doc references don't trip the scan.
      const stripped = src
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/(^|[^:])\/\/.*$/gm, "$1");
      pattern.lastIndex = 0;
      let m: RegExpExecArray | null;
      while ((m = pattern.exec(stripped)) !== null) {
        const line = stripped.slice(0, m.index).split("\n").length;
        offenders.push(`${rel}:${line}  ${m[0]}`);
      }
    }

    expect(offenders).toEqual([]);
  });

  it("legacyRedirects map is still wired (external bookmarks must keep resolving)", async () => {
    const mod = await import("../../client/src/routes/legacy-redirects");
    expect(Array.isArray(mod.legacyRedirects)).toBe(true);
    expect(mod.legacyRedirects.length).toBeGreaterThan(0);

    const froms = new Set(mod.legacyRedirects.map((r: { from: string }) => r.from));
    // A representative subset of aliases that must continue to redirect.
    for (const alias of [
      "/work-orders",
      "/maintenance",
      "/equipment-intelligence",
      "/crew-management",
      "/inventory-management",
      "/system-administration",
    ]) {
      expect(froms.has(alias)).toBe(true);
    }
  });
});
