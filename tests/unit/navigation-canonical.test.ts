/**
 * Navigation Canonicalization — regression test
 *
 * The hubs `/maint`, `/crew`, and `/system` are plain landing pages: they
 * do NOT read a `?tab=` query param. A link such as `/maint?tab=work-orders`
 * therefore just re-renders the hub overview (a dead click) instead of
 * opening the intended page. Every in-app navigation must instead target a
 * real registered route (e.g. `/work-orders`, `/crew-management`,
 * `/system-administration`).
 *
 * This test pins that contract: no string or template literal under
 * client/src may build a `/maint?…`, `/crew?…`, or `/system?…` URL — whether
 * via `href=`, `href:`, `setLocation/navigate/push(…)`, or a dynamic
 * `history.replaceState/pushState` path. The legacyRedirects map must also
 * stay wired so external bookmarks to retired aliases keep resolving.
 */

import { describe, it, expect } from "@jest/globals";
import * as fs from "node:fs";
import * as path from "node:path";

const ROOT = path.resolve(process.cwd());
const CLIENT_SRC = path.join(ROOT, "client", "src");

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name.startsWith(".")) {continue;}
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {walk(full, out);}
    else if (/\.(tsx?|jsx?)$/.test(entry.name)) {out.push(full);}
  }
  return out;
}

// Matches a broken hub URL with a query inside any string or template
// literal — covers href="/maint?…", href: "/crew?…", setLocation("/system?…"),
// and dynamic builds like `history.replaceState({}, "", `/maint?${qs}`)`.
const HUB_TAB_PATTERN = /["`]\/(?:maint|crew|system)\?/g;

describe("Navigation Canonicalization", () => {
  const files = walk(CLIENT_SRC);

  it("no in-app navigation builds a non-functional hub ?query URL", () => {
    const offenders: string[] = [];

    for (const file of files) {
      const rel = path.relative(ROOT, file);
      const src = fs.readFileSync(file, "utf8");
      // Strip block + line comments so doc references don't trip the scan.
      const stripped = src
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/(^|[^:])\/\/.*$/gm, "$1");
      HUB_TAB_PATTERN.lastIndex = 0;
      let m: RegExpExecArray | null;
      while ((m = HUB_TAB_PATTERN.exec(stripped)) !== null) {
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
    // A representative subset of retired aliases that must continue to redirect.
    for (const alias of ["/dashboard", "/alerts", "/inventory-management", "/devices"]) {
      expect(froms.has(alias)).toBe(true);
    }
  });
});
