# ARUS Release-Readiness Scorecard

```
╔══════════════════════════════════════════════════════════════════════╗
║  VERDICT: HOLD                                                         ║
║  Scored: 2026-06-14 · commit a54c17e · branch claude/elegant-noether   ║
║  Modes covered: CLOUD (Postgres) · VESSEL (SQLite) · Tauri binaries    ║
║  7 PASS · 3 FAIL · 1 not-measured  (across 11 categories)              ║
╚══════════════════════════════════════════════════════════════════════╝
```

**HOLD** — the branch is **not mergeable as-is** because **4 blocking CI gates are RED** at this
commit. None are architecture, security, or correctness defects: three are reconcile-the-ratchet
housekeeping (one is a single command) and one is a genuine bundle-size regression. The
fundamentals — type safety, all 20 architecture guards, security invariants, dual-schema parity,
migration down-files, and **1,687 passing tests** (1,543 unit + 144 integration) — are all green.

**Active blockers (must clear before ship):**
1. `format:check` — **108 files** violate `.prettierrc.json` (`printWidth: 100`). → `npm run format`
2. `check:dead-code` (knip) — **regressed** past baseline (+56 atomic). → remove dead code, or re-baseline
3. `check:client-wire-parses` — **92 → 93** (one new unparsed `fetch`/`apiRequest`). → Zod-wrap it, or re-baseline
4. `size-limit` — **initial app bundle 287 kB gzip vs 215 kB budget (+72 kB)**. → code-split/lazy-load, or raise budget (deliberate)

**Active caveats (do not block, but track):** no automated rollback proof (C5); coverage configured
but not CI-gated (C7); 13 high + 9 moderate dependency advisories, all mitigated/upstream-blocked (C10);
deferred security-ledger items — 70 MB git-history bloat, branch-protection required-checks not yet
enforced, Dependency Graph off (C9); high-but-holding debt — 1,967 lint warnings, ~3.9k knip atomic,
552/1,211 unbacked API refs (C3/C11); dual-schema drift baseline of 5 missing tables + 29 column-drift (C4).

---

## Category scorecard

| # | Category | Status | Evidence (command → live result) |
|---|----------|:------:|----------------------------------|
| C1 | Type Safety & Compilation | ✅ PASS | `check` (tsc) 0 · `check:tests` 0 · ts-burndown 0 · explicit-any 0 · casts at baseline (4 prod / 83 test) |
| C2 | Architecture & Boundary Guards | ✅ PASS | `check:guards` exit 0 — all 20 guards green |
| C3 | API / Wire Contracts | ❌ FAIL | `check:client-wire-parses` **92 → 93 (+1)**. api-contracts 552, server-wire 285, route-contract (114 unmatched, no new drift), hex-storage 145/145, raw-fetch 16, envelope 36 — all hold |
| C4 | Data Layer & Dual-Schema | ✅ PASS | `check:schema` parity ok · drizzle-config · schema-builders · rls-coverage · `check:dup-types` 8/8 canonicals = 1, 225 tracked dup ≤ baseline |
| C5 | Migration & Rollback Safety | ✅ PASS\* | LR-1A: 49 up-migrations, **0 missing `.down.sql`**. \*reversibility advisory-only — see caveat |
| C6 | Test Suite Health | ✅ PASS | `test:unit` 159 suites / **1,543** tests / 0 fail · `test:integration:embedded` 17 suites / **144** / 0 fail |
| C7 | Coverage Depth | ⏳ n/m | 20% threshold configured in `jest.config.mjs`, **not CI-gated**; not measured this run |
| C8 | Build, Bundle & Deploy | ❌ FAIL | build:renderer ✓ · build:server ✓ · boot-health ✓ (113 modules, 0 fail) · **`size-limit` initial bundle 287.28 kB > 215 kB budget** |
| C9 | Security Posture (invariants) | ✅ PASS | LR-1B org-id gate (145 route files) · lr35 public-API allowlist pin **60/60** · Ed25519/secure-exec/LLM-redact/const-time sources present |
| C10 | Dependency & Vuln Posture | ✅ PASS | `npm audit --omit=dev --audit-level=critical` exit 0 — **0 critical**. 13 high + 9 moderate (advisory) |
| C11 | Hygiene & Debt Ratchets | ❌ FAIL | **`format:check` 108 files** · **`check:dead-code` knip regressed**. lint 0-err / 1,967-warn (≤1,984 ✓), lint-warnings improved, hygiene & ui-ratchets hold |

Status legend: ✅ PASS · ❌ FAIL (a blocking gate is red) · ⏳ n/m (not measured this run).

---

## Blocking vs caveat (verdict rule)

The blocking set mirrors **CI's own hard-fail surface**; the caveat set mirrors what CI marks
`continue-on-error`/advisory. Grading philosophy follows the repo's ratchet model: **a ratchet that
holds is PASS regardless of absolute debt; a ratchet that regresses past its committed baseline is FAIL.**

- **Release-blocking** (any FAIL ⇒ HOLD): C1, C2, C3, C4, C6, C8, C9, C10 (critical only), and the
  LR-1A down-file gate within C5. These are exactly the gates the `ci.yml` `lint-and-typecheck`,
  `unit-tests`, `integration-tests`, `build`, and `security.yml` jobs hard-fail on.
- **Non-blocking → caveat** (FAIL never forces HOLD): C5 migration *reversibility*
  (`check-migrations-reversible.sh`, `continue-on-error: true`), C7 coverage (configured, not gated),
  C9 deferred-ledger items, C10 high/moderate advisories, and the high-but-holding WARN tier of C3/C4/C11.
- **Decision:** any blocking FAIL → **HOLD** · else any caveat → SHIP WITH CAVEATS · all clean → SHIP.

This commit has **4 blocking gate failures across C3, C8, C11 → HOLD.**

---

## Per-category detail

**C1 — Type Safety & Compilation · PASS.** `tsc` and `tsc -p tsconfig.tests.json` both clean.
Burndown ratchets all at baseline: TypeScript errors 0, explicit-`any` 0, `as any`/`as unknown as`
4 prod & 83 test, typed-casts within baseline, `.d.ts` shims clean.

**C2 — Architecture & Boundary Guards · PASS.** The 20-guard `check:guards` chain exits 0:
dual-schema parity, drizzle-config, schema-builders, RLS coverage, storage/schema import boundaries,
domain boundaries, route registration, domain-leak ratchet, org-context boundary, workflow routes,
operator-experience architecture, domain-repository imports, deploy-image guard, type-debt composite,
envelope adoption, raw-fetch (16), tsconfig target, UI ratchets (headers 58 / rawPoll 95 / indexKeys 51).

**C3 — API / Wire Contracts · FAIL.** One new client-side `await fetch(...)` / `apiRequest(...)`
result is not flowed through a Zod parse: `check:client-wire-parses` reports **92 → 93 (+1)** in
`client/src`. Every other contract ratchet holds (api-contracts 552/1,211, server-wire 285,
route-contract no new drift, hex-storage 145/145). Remediation: wrap the new call's result in its
response schema, or `node scripts/check-client-wire-parses.mjs` to locate it and re-baseline if intended.
Tracked liability (not a blocker): the unbacked API surface is large (552 of 1,211 refs) and the
error-envelope `message`/`code` mirrors are scheduled for sunset 2026-11-18.

**C4 — Data Layer & Dual-Schema · PASS.** PG/SQLite schema parity validates; all 8 hard-gated
canonical types (Vessel, Equipment, TelemetryReading, CrewMember, Crew, WorkOrder, WorkOrderTask,
WorkOrderPart) resolve to exactly 1 definition; 225 tracked duplicate type names sit within baseline.
Caveat: the dual-schema drift baseline still records 5 missing tables + 29 column-drift tables — a real
CLOUD/VESSEL parity liability that is ratcheted, not yet zero.

**C5 — Migration & Rollback Safety · PASS (hard gate).** All 49 up-migrations have a matching
`.down.sql` (LR-1A). **Caveat — the single largest rollback risk:** down-migrations are never proven
to restore schema. `scripts/check-migrations-reversible.sh` is advisory (`continue-on-error: true`) and
a from-empty replay fails at `0001` because the numbered SQL files ALTER tables the `drizzle-kit push`
baseline created. Rollback is therefore unverified.

**C6 — Test Suite Health · PASS.** Unit lane 159 suites / 1,543 tests / 0 failures; integration
embedded lane 17 suites / 144 tests / 0 failures. Not exercised in this container (CI-verified):
the Postgres integration lane, Playwright e2e smoke, and the Python ML sidecar. One suite remains
`describe.skip` (pdm-decision-support-registry, dual-mode ESM linker) and ~50 legacy integration tests
are quarantined from the default gate.

**C7 — Coverage Depth · NOT MEASURED.** `jest.config.mjs` configures a 20% global threshold
(branches/functions/lines/statements), but **no CI job runs `--coverage`**, so coverage is
informational only and is not a release gate. A full `test:coverage` run (≈8 GB heap, serial) was not
performed in this scoring pass.

**C8 — Build, Bundle & Deploy · FAIL.** Client (vite, 21.9 s) and server (esbuild, 2.8 mb) builds
succeed and boot-health is green (113 domain modules registered, 0 failures, app live). But
**`size-limit` fails: the initial app bundle is 287.28 kB gzip against a 215 kB budget (+72.28 kB,
~34% over)** — a blocking gate in the `build` job. The other budgets pass (vendor-export 138/320,
vendor-charts 123/150, total client JS 1.35 MB / 1.95 MB). Remediation: code-split/lazy-load the
entry + critical vendor chunks back under budget, or make a deliberate budget increase in
`.size-limit.json`. Tauri desktop/vessel/cloud binaries are verified via `tauri-build.yml` config only.

**C9 — Security Posture · PASS.** Every non-public route is org-id gated (LR-1B audited 145 route
files); the public-API exact-match allowlist pin test passes 60/60; the Ed25519 patch-trust,
tar-slip scan, secure-exec path validation, LLM PII-redaction/budget-preflight, and constant-time
comparison sources are present and unchanged. CodeQL and gitleaks are CI-only (`security.yml`).
Caveats are the open security-ledger items: 70 MB git-history bloat, GitHub branch-protection required
checks not yet enforced, and Dependency Graph not yet enabled (keeps `dependency-review` advisory).

**C10 — Dependency & Vulnerability Posture · PASS.** The blocking gate
`npm audit --omit=dev --audit-level=critical` exits 0 — **no critical advisories in production deps**.
The full advisory report shows 22 vulnerabilities (13 high, 9 moderate, 0 critical); the highs are the
tracked, mitigated/upstream-blocked set (`xlsx` surface-hardened, `@dsnp/parquetjs`→thrift,
`@tensorflow/tfjs-node`→tar).

**C11 — Hygiene & Debt Ratchets · FAIL.** Two ratchets are red:
- **`format:check` — 108 files** do not match `.prettierrc.json` (`printWidth: 100`); verified as a
  genuine config/format drift (committed files retain 80-column import wrapping). This is a hard CI
  gate (`ci.yml` "Prettier format gate"). Remediation: `npm run format`.
- **`check:dead-code` (knip) regressed** past baseline: files 0→4, dependencies 0→1, devDependencies
  0→1, exports 2,685→2,704, types 1,122→1,153 (+56 atomic). Remediation: remove the dead code, or
  `node scripts/check-knip.mjs --write-baseline` if intentional.

Holding sub-ratchets: lint 0 errors / 1,967 warnings (≤ 1,984 baseline — actually improved by 17),
hygiene at baseline (todo 7, dense-oneliner 1, long-files 0), UI ratchets all ≤ baseline.

---

## Debt-ratchet appendix (baseline ceiling vs live)

| Ratchet | Baseline | Live | Held? |
|---------|---------:|-----:|:-----:|
| ts-burndown (tsc errors) | 0 | 0 | ✅ |
| explicit-any | 0 | 0 | ✅ |
| cast-burndown (prod / test) | 4 / 83 | 4 / 83 | ✅ |
| duplicate types (canonicals / tracked) | 8×1 / ≤ baseline | 8×1 / 225 | ✅ |
| lint (errors / warnings) | 0 / 1,984 | 0 / 1,967 | ✅ (improved) |
| hygiene (todo / dense / long-files) | 7 / 1 / 0 | 7 / 1 / 0 | ✅ |
| ui-ratchets (headers / poll / indexKeys) | 58 / 95 / 51 | 58 / 95 / 51 | ✅ |
| raw-fetch call sites | 16 | 16 | ✅ |
| envelope adoption (prefixes) | 36 | 36 | ✅ |
| hex-storage boundary (files) | 145 | 145 | ✅ |
| api-contracts (unbacked) | 552 | 552 | ✅ |
| server-wire-parses | 285 | 285 | ✅ |
| route-contract drift | no new | no new | ✅ |
| **client-wire-parses** | **92** | **93** | ❌ |
| **knip dead-code (exports / types / atomic)** | **2,685 / 1,122 / 3,853** | **2,704 / 1,153 / 3,909** | ❌ |
| **size-limit — initial app bundle (gzip)** | **215 kB** | **287.28 kB** | ❌ |
| size-limit — vendor-export / vendor-charts / total | 320 / 150 kB / 1.95 MB | 138 / 123 kB / 1.35 MB | ✅ |
| **prettier format:check (non-conforming files)** | **0** | **108** | ❌ |

---

## Environment & coverage caveats

- **Scored in-container** (Node 22.22.2, embedded SQLite, no external Postgres/Redis): C1–C6, C8 (build
  + bundle + boot-health), C9 invariant pins, C10 audit, C11.
- **Verified via CI config, not run locally** (need external Postgres/Redis/browser/Python): the Postgres
  integration lane and `db:migrate` apply, `check-migrations-reversible.sh` (advisory), Playwright
  `e2e-smoke`, the Python ML sidecar, CodeQL / gitleaks / dependency-review (`security.yml`), and Tauri
  binaries (`tauri-build.yml`).
- **Coverage (C7)** was not measured; it is configured at 20% but not CI-gated.

---

## How to re-score

Run the gates individually (not the `&&`-chained `check:guards-full`, so one failure does not mask
later categories), capturing each exit code:

```
npm ci
npm run check && npm run check:tests                 # C1
npm run check:guards                                  # C2 + C4
npm run check:contract-ratchets                       # C3
# C5: assert every migrations/NNNN_*.sql has a matching .down.sql
npx tsx scripts/check-routes-require-orgid.ts         # C9 (LR-1B)
npm run test:unit && npm run test:integration:embedded # C6
npm run build:renderer && npm run build:server && npx size-limit && (unset DATABASE_URL; npm run check:boot-health)  # C8
npm audit --omit=dev --audit-level=critical           # C10
npm run lint && npm run format:check && npm run check:hygiene && npm run check:dead-code  # C11
```

`.github/workflows/scorecard-drift.yml` already re-runs `check:guards + lint + check` nightly against
`main`; this scorecard adds the full-depth build/test/audit layer that the nightly drift job does not cover.
