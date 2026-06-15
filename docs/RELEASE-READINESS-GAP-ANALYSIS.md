# ARUS Release-Readiness — Gap Analysis

> Companion to `docs/RELEASE-READINESS-SCORECARD.md`. The scorecard reports **where the repo
> stands (verdict HOLD)**; this analysis maps each gap **current → target**, with root cause,
> effort, residual risk, and a prioritized close-out sequence.
> Scored at commit a54c17e, branch `claude/elegant-noether-g8jez5`, 2026-06-14.

> **STATUS — 2026-06-14 @ `e7f37a1`: all 4 blocking gaps CLOSED** (G1 `212c75c`, G4 `0f1c82f`,
> G3 `3946087`+`038a9cf`, G2 `e7f37a1`). Verdict **HOLD → SHIP WITH CAVEATS**. Caveat gaps G5–G10
> remain (see §Recommended close-out sequence, step 4).

## Summary

Closing the gap to a **SHIP** verdict requires clearing **4 blocking gaps** (CI hard-fail gates that
are red at this commit). None are architecture, security, or correctness defects — three are
reconcile-the-ratchet items (one is a single command) and one is a genuine bundle-size regression.
Beyond the blockers, **6 caveat gaps** are strategic debt that should be tracked but does not stop a ship.

| Gap                                | Category | Current → Target            |   Class   |        Effort        | Risk if shipped as-is                             |
| ---------------------------------- | -------- | --------------------------- | :-------: | :------------------: | ------------------------------------------------- |
| **G1** Prettier drift              | C11      | 108 files → 0               | **BLOCK** |    **XS** (1 cmd)    | None functional; blocks every PR merge            |
| **G2** Initial bundle over budget  | C8       | 287.3 kB → ≤215 kB (−72 kB) | **BLOCK** |       **M–L**        | Slower first paint, worst on VESSEL/low-bandwidth |
| **G3** Dead-code regression (knip) | C11      | +56 atomic → baseline       | **BLOCK** |        **S**         | Ships unwired feature + unused dep                |
| **G4** Unparsed client wire read   | C3       | 93 → ≤92                    | **BLOCK** |       **XS–S**       | One unvalidated client response                   |
| G5 No rollback proof               | C5       | advisory → verified         |  caveat   |          L           | Down-migrations unproven; risky prod rollback     |
| G6 Coverage ungated                | C7       | configured → CI-gated       |  caveat   |          S           | Coverage can silently rot                         |
| G7 HIGH dependency advisories      | C10      | 13 high → 0/waived          |  caveat   | M (upstream-blocked) | Known, surface-mitigated CVEs remain              |
| G8 Security-ledger deferred        | C9       | open → closed               |  caveat   |         S–M          | Branch protection/dep-graph not enforced          |
| G9 Dual-schema drift               | C4       | 5 tbl + 29 col → 0          |  caveat   |          M           | CLOUD/VESSEL parity holes                         |
| G10 High-but-holding debt          | C3/C11   | 1.9k warn, 552 unbacked     |  caveat   |     L (burndown)     | Slows change; not a regression                    |

Effort key: XS ≈ minutes · S ≈ hours · M ≈ 1–3 days · L ≈ multi-day/coordination.

---

## Blocking gaps (must close before SHIP)

### G1 — Prettier format drift · 108 files · C11

- **Gap:** `npm run format:check` fails on 108 files; the CI "Prettier format gate" (`ci.yml:63`) is red.
- **Root cause:** `.prettierrc.json` sets `printWidth: 100` (file last modified Jun 9) but the 108 files
  retain 80-column import/line wrapping — a config bump without a full reformat. Verified via diff
  (e.g. `shared/schema/crew/operations.ts` import is multi-line at width 80 but fits on one at 100).
- **Close it:** `npm run format` (rewrites in place), then commit. Confirm `npm run format:check` exits 0.
- **Effort XS · Risk none functional.** Caveat: the reformat will touch ~108 files — land it as an isolated
  "format-only" commit so it doesn't muddy a feature diff. Re-check `check:lint-warnings` after (formatting
  can shift a handful of line-length-sensitive warnings, but the ratchet has 17 warnings of headroom).

### G2 — Initial app bundle over budget · +72 kB · C8 _(the only "real engineering" blocker)_

- **Gap:** `size-limit` "Initial app bundle (entry + critical vendor chunks)" = **287.28 kB gzip vs 215 kB
  budget (+72 kB, ~34% over)**. Composition (vite gzip):

  | Chunk (size-limit glob) |          gzip |
  | ----------------------- | ------------: |
  | `app-*.js` (app entry)  |      125.7 kB |
  | `vendor-react-*.js`     |      116.9 kB |
  | `vendor-ui-*.js`        |       45.3 kB |
  | **initial total**       | **≈287.9 kB** |

  (Other budgets pass: vendor-export 138/320, vendor-charts 123/150, total JS 1.35 MB/1.95 MB. Heaviest
  _lazy_ chunk is `index-Ic-LIlS8.js` at 160 kB gzip — outside the initial budget, so it does not count here.)

- **Root cause:** the `app-*` entry chunk (125.7 kB) carries more than first-paint-critical code; `vendor-react`
  (116.9 kB) is near-fixed cost, `vendor-ui` (45.3 kB) is the Radix/UI layer.
- **Close it (in priority order):**
  1. **Shrink `app-*`** — the controllable lever. Audit eager imports in the entry/`App` tree and route
     them through `React.lazy`/dynamic `import()` (the app already code-splits pages: dozens of `index-*`
     and `*Page-*` lazy chunks exist). Move non-critical providers, dialogs, and admin/analytics surfaces
     out of the entry.
  2. **Trim `vendor-ui`** — ensure UI primitives are imported per-component (tree-shake Radix), not barrel-imported.
  3. If, after splitting, the residual is an intentional baseline, **raise `.size-limit.json` deliberately** with
     a comment justifying the new ceiling (this is a conscious budget decision, not a silent bump).
- **Effort M–L · Risk real:** initial-load latency matters most on VESSEL (offline/onboard, often constrained
  links). This is the gap most worth fixing properly rather than waiving.

### G3 — Dead-code regression (knip) · C11

- **Gap:** `check:dead-code` regressed past baseline: files 0→4, dependencies 0→1, devDependencies 0→1,
  exports 2685→2704, types 1122→1153 (+56 atomic). CI `dead-code` job is red.
- **Root cause (concrete — refined after import-graph check; see remediation plan):** a _mix_ of truly
  dead code and intentional-but-unwired code. Note `UniversalOpsShell` **is** wired (`App.tsx:336`) and
  imports `OpsShell/OpsSidebar/OpsTopBar` by name, so those files are NOT dead — knip only flags their
  **redundant `default` exports**. knip's hits break down as:
  - **Truly orphaned:** `client/src/core/runtime/opsRuntimeMachine.ts` + its sole consumer dependency
    **`xstate`** (nothing imports the machine); and devDependency **`@yao-pkg/pkg`** (unreferenced anywhere).
  - **Intentional-but-unwired (decision needed):** `client/src/components/ops/ActionCard.tsx` and
    `OpsStatusRail.tsx` — planned Phase-2 maritime-HMI compliance components (`docs/compliance/Maritime-HMI-Compliance.md`).
  - **Redundant exports:** unused `default` exports on `OpsShell/OpsSidebar/OpsTopBar` (imported by name).
  - Plus a flagged test file `…/playwright-mobile-guard.spec.ts` (likely a knip entry-config gap).
- **Close it (per item, not a blanket delete):** remove `opsRuntimeMachine.ts` + `xstate` + `@yao-pkg/pkg`
  if abandoned; drop the redundant `default` exports; **decide** whether to wire or knip-ignore the Phase-2
  `ActionCard`/`OpsStatusRail`; fix the knip entry for the spec — then `check:dead-code` returns to baseline.
  Re-baselining (`node scripts/check-knip.mjs --write-baseline`) is the last resort.
- **Effort S · Risk:** ships an unused state-machine dependency and a half-built feature surface.

### G4 — Unparsed client wire read · C3

- **Gap:** `check:client-wire-parses` regressed 92→93 — one new `await fetch(...)`/`apiRequest(...)`
  whose response is not validated through a Zod parse.
- **Root cause:** a recently-added client read skipped the `validateResponse`/schema step the ratchet enforces.
- **Close it:** `node scripts/check-client-wire-parses.mjs --report` lists all 93; the +1 sits among reads
  like `useAdvancedAnalyticsData.ts:90`, `usePdmEquipmentDetailData.ts:135`, `useSensorBaselines.ts:48`,
  `InsightsTabVesselIntelligence.tsx:65`. Wrap the new call's result in its response schema (or, if it is a
  control-plane call with no body — e.g. `/api/healthz`, `/api/me/logout`, the SSE `streamClient.ts` — add
  it to the documented exemption and re-baseline to 92).
- **Effort XS–S · Risk low** (single unvalidated read).

---

## Caveat gaps (track; do not block a ship)

- **G5 — Rollback unproven (C5).** LR-1A passes (49/49 down-files exist) but `check-migrations-reversible.sh`
  is advisory and a from-empty replay fails at `0001` (numbered SQL ALTERs tables the `drizzle-kit push`
  baseline created). _Highest-value caveat:_ there is no automated proof a rollback restores schema. Closing
  it means reconciling the push-baseline vs numbered-migration mechanisms (tracked in
  `docs/SECURITY-REVIEW-FOLLOWUPS.md`). **Effort L.**
- **G6 — Coverage ungated (C7).** A 20% threshold is configured in `jest.config.mjs` but no CI job runs
  `--coverage`. Add a coverage step (even non-blocking at first) so the floor is enforced. **Effort S.**
- **G7 — HIGH dependency advisories (C10).** 0 critical (blocking gate green), but 13 high + 9 moderate
  remain — `xlsx` (surface-hardened), `@dsnp/parquetjs`→thrift, `@tensorflow/tfjs-node`→tar. Mostly
  upstream-blocked; close by swapping `xlsx`, evaluating whether the parquet export feature is needed, and
  tracking the tfjs upgrade. **Effort M, partly external.**
- **G8 — Security-ledger deferred (C9).** Enforce GitHub branch-protection required checks
  (`lint-and-typecheck`, `unit-tests`, `integration-tests`, `build`); enable Dependency Graph (then drop
  `continue-on-error` from `dependency-review`); plan the 70 MB git-history cleanup. Mostly repo-settings, not code. **Effort S–M.**
- **G9 — Dual-schema drift (C4).** Guards pass, but the drift baseline still records 5 missing tables +
  29 column-drift tables between PG and SQLite — a CLOUD/VESSEL parity liability to burn down. **Effort M.**
- **G10 — High-but-holding debt (C3/C11).** 1,967 lint warnings, ~3.9k knip atomic, 552/1,211 unbacked API
  refs, 1,020 typed casts. All ratcheting down, none regressed — continue the burndown; the error-envelope
  `message`/`code` mirrors have a hard sunset of **2026-11-18**. **Effort L (ongoing).**

---

## Recommended close-out sequence

1. **Unblock the merge (hours):** G1 `npm run format` (isolated commit) → G4 wrap-or-exempt the one wire read
   → G3 remove (or wire) the Ops feature + drop `xstate`/`@yao-pkg/pkg`. After these, three of four blocking
   gates are green and CI `lint-and-typecheck` + `dead-code` pass.
2. **Fix the real regression (M–L):** G2 split the `app-*` entry chunk back under the 215 kB budget (or make
   a justified budget increase). This is the one blocker that is genuine engineering, not housekeeping.
3. **Re-score:** re-run the scorecard command sequence (`docs/RELEASE-READINESS-SCORECARD.md` §How to re-score).
   With G1–G4 closed the verdict moves to **SHIP WITH CAVEATS**.
4. **Burn down caveats by leverage:** G8 (repo settings, quick) and G6 (coverage gate, quick) first; then
   G5 (rollback proof — highest operational value), G9 (schema parity), G7 (dependency swaps), G10 (ongoing).

**Bottom line:** the gap to a mergeable branch is small and mostly mechanical — one format command, one
dead-feature cleanup, one wire-parse fix. The gap to a _confident_ ship is G2 (bundle) plus the operational
caveat G5 (rollback proof). The engine room (types, 20 guards, security invariants, 1,687 passing tests,
0 critical CVEs) needs no remediation.
