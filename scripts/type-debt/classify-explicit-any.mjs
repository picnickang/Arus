#!/usr/bin/env node
/**
 * Classify @typescript-eslint/no-explicit-any violations into buckets.
 *
 * Usage:
 *   node scripts/type-debt/classify-explicit-any.mjs            # write JSON inventory + markdown report
 *   node scripts/type-debt/classify-explicit-any.mjs --json     # write only the JSON inventory
 *   node scripts/type-debt/classify-explicit-any.mjs --md       # write only the markdown report (reads existing JSON)
 *
 * Reads lint output from /tmp/lint.json by default (npx eslint . --format json -o /tmp/lint.json).
 * Override with --lint=<path>.
 *
 * Output:
 *   scripts/type-debt/explicit-any-inventory.json   (machine-readable)
 *   docs/type-debt/explicit-any-inventory.md        (human-readable report)
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { resolve, relative, dirname } from "node:path";

const ROOT = process.cwd();
const RULE = "@typescript-eslint/no-explicit-any";
const JSON_OUT = resolve(ROOT, "scripts/type-debt/explicit-any-inventory.json");
const MD_OUT = resolve(ROOT, "docs/type-debt/explicit-any-inventory.md");

const args = new Set(process.argv.slice(2));
const lintArg = process.argv.find((a) => a.startsWith("--lint="));
const LINT_PATH = lintArg ? lintArg.slice("--lint=".length) : "/tmp/lint.json";
const ONLY_JSON = args.has("--json");
const ONLY_MD = args.has("--md");

const BUCKETS = {
  external_lib_gaps: {
    label: "External library typing gaps",
    definition:
      "Casts and `any` parameters that exist because a third-party library has poor or missing TypeScript types " +
      "(SDK responses, untyped npm packages, raw driver rows, multer/express middleware extensions, etc.).",
    remediation:
      "Wrap each library at a single adapter boundary. Define an internal interface that matches what we actually " +
      "consume, parse the library response with Zod (or a hand-rolled type guard) once, and let the rest of the " +
      "codebase depend on the internal type. If the library ships @types, upgrade. If it doesn't and the surface is " +
      "stable, hand-write a `.d.ts` in `types/`.",
  },
  test_mocks: {
    label: "Test mocks / stubs",
    definition:
      "Occurrences inside `tests/`, `*.test.ts(x)`, jest setup, fixture factories. Mocks often need to bypass " +
      "constructor visibility or stub partial shapes.",
    remediation:
      "Prefer `jest.mocked()` + typed factory functions (`makeFakeVessel(overrides?: Partial<Vessel>): Vessel`). " +
      "For partial stubs, use `Partial<T>` + `satisfies` instead of `any`. Where a mock genuinely needs to lie " +
      "about a type, isolate it in a `__mocks__/` helper rather than littering test bodies with `any`.",
  },
  legacy_dto: {
    label: "Legacy DTOs (route handlers, request/response shapes)",
    definition:
      "`any` on route-handler request bodies/queries, untyped DTO interfaces, and helper signatures that pass " +
      "request-shaped data around without ever describing it. Most of these survived the wire-parses sweep because " +
      "they live below the route registration layer.",
    remediation:
      "Define the DTO once with Zod, derive the TS type via `z.infer`, and import the type at every helper. For " +
      "handlers, use `AuthenticatedRequest` from `server/middleware/auth.ts` and parse `req.body`/`req.query`/" +
      "`req.params` with the schema — same contract the wire-parses sweep enforced.",
  },
  dynamic_json: {
    label: "Dynamic JSON payloads",
    definition:
      "`JSON.parse(...) as any`, `Record<string, any>`, drizzle `jsonb()` columns, OpenAI function-call arguments, " +
      "Sentry/observability event payloads, telemetry attribute bags, anything that's genuinely heterogeneous at " +
      "the boundary.",
    remediation:
      "Stop trusting the payload. Parse once with `z.unknown().pipe(targetSchema)` or `JSON.parse` followed by a " +
      "Zod parse. Inside the system, replace `any` with `unknown` so callers are forced to narrow. For drizzle " +
      "`jsonb` columns, declare the column type as `jsonb().$type<MyShape>()` and store the Zod schema alongside.",
  },
  generic_inference: {
    label: "Generic inference failures",
    definition:
      "Functions whose signature uses `any` because the author couldn't get a generic to flow (callback params " +
      "typed `(x: any)`, `Array<any>`, `Promise<any>`, return-type `any` on a helper that should have inferred).",
    remediation:
      "Reach for `Parameters<typeof fn>[n]` / `Awaited<ReturnType<typeof fn>>` / `infer` rather than `any`. For " +
      "callbacks, type the higher-order function generically (`<T>(items: T[], cb: (x: T) => void)`) instead of " +
      "widening the parameter. For Promise chains, type the resolution value, not the wrapper.",
  },
  truly_unsafe: {
    label: "Truly unsafe / untyped logic",
    definition:
      "Residual `any` that isn't explained by any of the above — typically deep cross-domain glue, dynamic " +
      "property access on heterogeneous registries, or code that genuinely needs a domain redesign before it can " +
      "be typed.",
    remediation:
      "Don't paper over with a cast. These are the call sites that should drive Phase 3 work (Result/Either, " +
      "branded IDs, discriminated unions, shared API envelopes, typed domain errors). Capture the call site in " +
      "the follow-up task list and resolve it as part of the domain redesign — not as a one-line edit.",
  },
};

/** @param {string} relPath @param {string} src @returns {keyof typeof BUCKETS} */
function classify(relPath, src) {
  const lower = relPath.toLowerCase();
  const text = (src ?? "").trim();

  if (
    lower.includes("/tests/") ||
    lower.startsWith("tests/") ||
    lower.endsWith(".test.ts") ||
    lower.endsWith(".test.tsx") ||
    lower.endsWith(".spec.ts") ||
    lower.endsWith(".spec.tsx") ||
    lower.includes("/__mocks__/") ||
    lower.includes("/test-utils/") ||
    lower.includes("jest.setup") ||
    lower.includes("setuptests")
  ) {
    return "test_mocks";
  }

  if (
    lower.includes("/external-integrations/") ||
    lower.includes("/integrations/sdk") ||
    lower.includes("/adapters/") ||
    lower.includes("/clients/") ||
    /\.d\.ts$/.test(lower) ||
    // Browser / Node API typing gaps the project routinely casts around
    /\bSpeechRecognition\b/.test(text) ||
    /\bwebkitSpeechRecognition\b/.test(text) ||
    /\bBarcodeDetector\b/.test(text) ||
    /\bnavigator\s*as\s+any\b/.test(text) ||
    /\bwindow\s*as\s+any\b/.test(text) ||
    /\bIDBDatabase\b.*any/.test(text) ||
    /\bonnxruntime\b/i.test(text)
  ) {
    return "external_lib_gaps";
  }

  if (
    /\bJSON\.parse\b/.test(text) ||
    /jsonb?\(/.test(text) ||
    /Record\s*<\s*string\s*,\s*any\s*>/.test(text) ||
    /Record\s*<\s*string\s*,\s*unknown\s*>/.test(text) ||
    /\bevent\.data\b/.test(text) ||
    /attributes\s*:\s*Record/.test(text) ||
    /\bpayload\b.*any/.test(text) ||
    /openai|function_call|tool_call/i.test(text)
  ) {
    return "dynamic_json";
  }

  if (
    lower.includes("/routes/") ||
    lower.includes("/routes.ts") ||
    lower.endsWith("/routes.ts") ||
    lower.includes("/interfaces/") ||
    lower.includes("/dto") ||
    /\breq\.body\b/.test(text) ||
    /\breq\.query\b/.test(text) ||
    /\breq\.params\b/.test(text) ||
    /Request\s*<.*any/.test(text) ||
    /Response\s*<.*any/.test(text)
  ) {
    return "legacy_dto";
  }

  if (
    /\(\s*\w+\s*:\s*any\s*\)/.test(text) ||
    /Array\s*<\s*any\s*>/.test(text) ||
    /Promise\s*<\s*any\s*>/.test(text) ||
    /:\s*any\s*\[\s*\]/.test(text) ||
    /\(\s*\w+\s*:\s*any\s*,/.test(text) ||
    /,\s*\w+\s*:\s*any\s*[,)]/.test(text) ||
    /=>\s*any\b/.test(text) ||
    /\bMap\s*<.*,\s*any\s*>/.test(text) ||
    /\bSet\s*<\s*any\s*>/.test(text) ||
    // React hooks with `any` are inference failures, not domain redesigns
    /\buseState\s*<\s*any/.test(text) ||
    /\buseRef\s*<\s*any/.test(text) ||
    /\buseReducer\s*<\s*any/.test(text) ||
    /\buseMemo\s*<\s*any/.test(text) ||
    /\buseCallback\s*<\s*any/.test(text) ||
    // Spread-props typed as any (`...props }: any`) is a generic gap
    /\.\.\.\w+\s*\}\s*:\s*any\b/.test(text) ||
    /:\s*any\s*\|\s*null\b/.test(text) ||
    /:\s*any\s*\|\s*undefined\b/.test(text) ||
    /\bas\s+any\s*\[\s*\]/.test(text) ||
    /\bComponentType\s*<\s*any/.test(text) ||
    /\bFC\s*<\s*any/.test(text) ||
    /\bRef\s*<\s*any/.test(text)
  ) {
    return "generic_inference";
  }

  return "truly_unsafe";
}

function readSourceLine(filePath, line) {
  try {
    const src = readFileSync(filePath, "utf8");
    const lines = src.split("\n");
    return (lines[line - 1] ?? "").trim();
  } catch {
    return "";
  }
}

function buildInventory() {
  if (!existsSync(LINT_PATH)) {
    console.error(`Missing lint JSON at ${LINT_PATH}. Run: npx eslint . --format json -o ${LINT_PATH}`);
    process.exit(1);
  }
  const lintResults = JSON.parse(readFileSync(LINT_PATH, "utf8"));
  const occurrences = [];
  for (const fileResult of lintResults) {
    const messages = fileResult.messages.filter((m) => m.ruleId === RULE);
    if (messages.length === 0) {
      continue;
    }
    const relPath = relative(ROOT, fileResult.filePath);
    for (const m of messages) {
      const snippet = readSourceLine(fileResult.filePath, m.line);
      occurrences.push({
        file: relPath,
        line: m.line,
        column: m.column,
        snippet,
        bucket: classify(relPath, snippet),
      });
    }
  }

  const byBucket = {};
  for (const key of Object.keys(BUCKETS)) {
    byBucket[key] = { ...BUCKETS[key], count: 0, files: new Set(), occurrences: [] };
  }
  for (const occ of occurrences) {
    const b = byBucket[occ.bucket];
    b.count += 1;
    b.files.add(occ.file);
    b.occurrences.push(occ);
  }

  const total = occurrences.length;
  const buckets = Object.fromEntries(
    Object.entries(byBucket).map(([key, b]) => {
      const filesArr = [...b.files];
      const perFile = new Map();
      for (const occ of b.occurrences) {
        perFile.set(occ.file, (perFile.get(occ.file) ?? 0) + 1);
      }
      const topFiles = [...perFile.entries()]
        .sort((a, b2) => b2[1] - a[1] || a[0].localeCompare(b2[0]))
        .slice(0, 10)
        .map(([file, count]) => ({ file, count }));
      const examples = b.occurrences
        .filter((o) => o.snippet && o.snippet.length <= 200)
        .sort((a, c) => a.file.localeCompare(c.file) || a.line - c.line)
        .slice(0, 3)
        .map((o) => ({ file: o.file, line: o.line, snippet: o.snippet }));
      return [
        key,
        {
          label: b.label,
          definition: b.definition,
          remediation: b.remediation,
          count: b.count,
          files: filesArr.length,
          percent: total === 0 ? 0 : Math.round((b.count / total) * 1000) / 10,
          topFiles,
          examples,
        },
      ];
    })
  );

  return {
    generatedAt: new Date().toISOString(),
    rule: RULE,
    total,
    totalFiles: new Set(occurrences.map((o) => o.file)).size,
    buckets,
  };
}

function ensureDir(path) {
  mkdirSync(dirname(path), { recursive: true });
}

function fmtPct(n) {
  return `${n.toFixed(1)}%`;
}

function renderMarkdown(inventory) {
  const lines = [];
  lines.push("# Explicit `any` Inventory");
  lines.push("");
  lines.push(`_Generated: ${inventory.generatedAt}_`);
  lines.push("");
  lines.push(
    `Source: \`npx eslint . --format json\` filtered to \`${inventory.rule}\`. Regenerate with ` +
      "`node scripts/type-debt/classify-explicit-any.mjs`."
  );
  lines.push("");
  lines.push("## Headline");
  lines.push("");
  lines.push(`- **Total occurrences:** ${inventory.total}`);
  lines.push(`- **Distinct files:** ${inventory.totalFiles}`);
  lines.push("");

  const mechanicalKeys = ["test_mocks", "external_lib_gaps", "generic_inference"];
  const redesignKeys = ["dynamic_json", "legacy_dto"];
  const residualKeys = ["truly_unsafe"];
  const sum = (keys) => keys.reduce((acc, k) => acc + (inventory.buckets[k]?.count ?? 0), 0);
  const mechanical = sum(mechanicalKeys);
  const redesign = sum(redesignKeys);
  const residual = sum(residualKeys);
  const t = inventory.total || 1;
  lines.push("**Rough split (based on bucket heuristics — see per-bucket sections for caveats):**");
  lines.push("");
  lines.push(
    `- ~${fmtPct((mechanical / t) * 100)} mechanical (test mocks + external library gaps + generic inference fixes)`
  );
  lines.push(
    `- ~${fmtPct((redesign / t) * 100)} schema / generic redesign (dynamic JSON parses + legacy DTOs)`
  );
  lines.push(`- ~${fmtPct((residual / t) * 100)} truly unsafe / residual (drives Phase 3 domain work)`);
  lines.push("");
  lines.push("**Bucket totals:**");
  lines.push("");
  lines.push("| Bucket | Occurrences | % | Files |");
  lines.push("|---|---:|---:|---:|");
  for (const [, b] of Object.entries(inventory.buckets)) {
    lines.push(`| ${b.label} | ${b.count} | ${fmtPct(b.percent)} | ${b.files} |`);
  }
  lines.push("");

  for (const [, b] of Object.entries(inventory.buckets)) {
    lines.push(`## ${b.label}`);
    lines.push("");
    lines.push(`**Definition.** ${b.definition}`);
    lines.push("");
    lines.push(
      `**Count.** ${b.count} occurrences across ${b.files} files (${fmtPct(b.percent)} of all explicit \`any\`).`
    );
    lines.push("");
    if (b.topFiles.length > 0) {
      lines.push("**Top files:**");
      lines.push("");
      lines.push("| File | Count |");
      lines.push("|---|---:|");
      for (const tf of b.topFiles) {
        lines.push(`| \`${tf.file}\` | ${tf.count} |`);
      }
      lines.push("");
    }
    if (b.examples.length > 0) {
      lines.push("**Examples:**");
      lines.push("");
      for (const ex of b.examples) {
        lines.push(`- \`${ex.file}:${ex.line}\` — \`${ex.snippet.replace(/`/g, "\\`")}\``);
      }
      lines.push("");
    }
    lines.push(`**Recommended remediation.** ${b.remediation}`);
    lines.push("");
  }

  lines.push("## Notes for Phase 3");
  lines.push("");
  lines.push(
    "- **Dynamic JSON payloads** is the bucket most likely to motivate a shared API response envelope and a " +
      "convention for storing Zod schemas next to `jsonb()` columns. Pick one representative call site (e.g. an " +
      "OpenAI function-call handler) and design the envelope there before fanning out."
  );
  lines.push(
    "- **Legacy DTOs** below the route layer is the bucket most likely to motivate branded IDs and discriminated " +
      "unions for workflow states — the same DTOs are often the ones losing identity-type information across " +
      "service boundaries."
  );
  lines.push(
    "- **Truly unsafe / untyped logic** is the smallest bucket but the highest-leverage. Each occurrence should " +
      "be inspected by hand and either converted into a typed-pattern task (Result/Either, typed domain error " +
      "hierarchy) or kept under a tracked exception with a comment explaining why no type fits."
  );
  lines.push(
    "- **Bucket fuzziness.** The classifier prefers path-based rules first (tests/, external-integrations/, " +
      "adapters/) and then snippet heuristics. Files that look like routes but parse JSON payloads will land in " +
      "_Dynamic JSON payloads_ rather than _Legacy DTOs_. When triaging follow-ups, re-read the snippet rather " +
      "than trusting the bucket label blindly."
  );
  lines.push("");
  return lines.join("\n") + "\n";
}

function main() {
  if (ONLY_MD && existsSync(JSON_OUT)) {
    const inventory = JSON.parse(readFileSync(JSON_OUT, "utf8"));
    ensureDir(MD_OUT);
    writeFileSync(MD_OUT, renderMarkdown(inventory));
    console.log(`Wrote ${relative(ROOT, MD_OUT)}`);
    return;
  }
  const inventory = buildInventory();
  if (!ONLY_MD) {
    ensureDir(JSON_OUT);
    writeFileSync(JSON_OUT, JSON.stringify(inventory, null, 2) + "\n");
    console.log(`Wrote ${relative(ROOT, JSON_OUT)} (${inventory.total} occurrences)`);
  }
  if (!ONLY_JSON) {
    ensureDir(MD_OUT);
    writeFileSync(MD_OUT, renderMarkdown(inventory));
    console.log(`Wrote ${relative(ROOT, MD_OUT)}`);
  }
}

main();
