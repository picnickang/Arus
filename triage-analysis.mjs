/* One-off triage enrichment for route-contract baseline entries. */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const baseline = JSON.parse(readFileSync("scripts/route-contract-baseline.json", "utf8"));
const routes = JSON.parse(readFileSync("/tmp/routes-now.json", "utf8"));
const knipDead = new Set(
  readFileSync("/tmp/knip-files.txt", "utf8").split("\n").filter(Boolean),
);

function walk(dir, exts, out = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      if (entry === "node_modules" || entry.startsWith(".")) continue;
      walk(full, exts, out);
    } else if (exts.some((e) => entry.endsWith(e))) out.push(full);
  }
  return out;
}
const normalize = (p) => p.split("?")[0].replace(/\$\{[^}]*\}/g, "*").replace(/\/+$/, "");

// path -> [{file, contexts}]
const refs = new Map(baseline.map((p) => [p, []]));
const LIT = /["'`](\/api\/[^"'`\s]*)["'`]/g;
for (const file of walk(join(ROOT, "client", "src"), [".ts", ".tsx"])) {
  const text = readFileSync(file, "utf8");
  const rel = file.replace(ROOT + "/", "");
  for (const m of text.matchAll(LIT)) {
    const norm = normalize(m[1]);
    if (!refs.has(norm)) continue;
    // crude context: what surrounds the literal on its line
    const lineStart = text.lastIndexOf("\n", m.index) + 1;
    const line = text.slice(lineStart, text.indexOf("\n", m.index)).trim().slice(0, 120);
    const arr = refs.get(norm);
    let entry = arr.find((e) => e.file === rel);
    if (!entry) { entry = { file: rel, lines: [] }; arr.push(entry); }
    if (entry.lines.length < 2) entry.lines.push(line);
  }
}

// nearest server route: same trailing segment(s)
const routeSegs = routes.map((r) => ({ r, segs: r.split("/").filter(Boolean) }));
function nearest(path) {
  const segs = path.split("/").filter(Boolean);
  const tail = segs[segs.length - 1];
  const cands = routeSegs
    .filter(({ segs: s }) => s[s.length - 1] === tail || (tail === "*" && true))
    .map(({ r }) => r);
  return cands.slice(0, 3);
}

const out = baseline.map((p) => {
  const r = refs.get(p) || [];
  const allDead = r.length > 0 && r.every((e) => knipDead.has(e.file));
  return {
    path: p,
    refCount: r.length,
    allRefsDeadCode: allDead,
    refs: r.map((e) => e.file),
    sampleLines: r.flatMap((e) => e.lines).slice(0, 2),
    nearestRoutes: nearest(p),
  };
});
console.log(JSON.stringify(out, null, 1));
