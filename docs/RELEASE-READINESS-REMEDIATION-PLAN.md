# ARUS Release-Readiness — Remediation Plan

> Third in the set: `RELEASE-READINESS-SCORECARD.md` (state) → `…-GAP-ANALYSIS.md` (gaps) → **this**
> (sequenced, executable close-out). Turns the 4 blocking + 6 caveat gaps into tasks, each with an
> **acceptance gate** (the exact command that must exit 0). Verified against commit a54c17e.

> **STATUS — 2026-06-14: Phase 1 (G1/G3/G4) and Phase 2 (G2) COMPLETE** on `claude/elegant-noether-g8jez5`
> (`212c75c`, `0f1c82f`, `3946087`+`038a9cf`, `e7f37a1`). All 4 blocking gates green → **SHIP WITH CAVEATS**.
> Remaining: Phase 4 caveats (G5–G10).

## Working rules

- **Acceptance = the gate is green**, not "looks done". Every task names the command that must exit 0.
- **Isolate noisy commits:** the format pass (touches ~108 files) and any chunking change land as their
  own commits, never mixed into a feature diff.
- **No gate-gaming:** reduce real cost; do not rename chunks or widen baselines just to dodge a check
  (matches the repo's no-fabricated-health ethos). Budget/baseline changes are deliberate, commented, reviewed.
- **⚑ = decision point** needing a human/product call before acting (listed in §Decision points).

---

## Phase 1 — Unblock the merge · clears 3 of 4 blocking gates · ~½ day

### Task 1.1 — G1 Prettier drift _(effort XS)_

- **Do:** `npm run format`, review the diff is formatting-only, commit as `style: prettier --write (printWidth 100 reconcile)`.
- **Then:** re-run `npm run check:lint-warnings` (formatting can nudge a few line-length warnings; there are 17 of headroom under the 1,984 ceiling).
- **Accept:** `npm run format:check` exits 0.

### Task 1.2 — G3 Dead-code regression _(effort S; contains ⚑)_

Address per item (do **not** blanket-delete the `ops/` directory — `UniversalOpsShell` is live):

1. **Remove the truly orphaned runtime:** delete `client/src/core/runtime/opsRuntimeMachine.ts` and drop
   `xstate` from `package.json` dependencies (it is imported only by that file). ⚑ confirm no imminent
   plan to use the state machine.
2. **Drop the unused packaging dep:** remove `@yao-pkg/pkg` from `devDependencies` (grep shows zero
   references outside `package*.json`; the sidecar uses `scripts/build-sidecar.mjs`, not pkg). ⚑ confirm
   it is not earmarked for future binary packaging.
3. **Trim redundant exports:** remove the unused `default` exports from `client/src/components/ops/OpsShell.tsx`,
   `OpsSidebar.tsx`, `OpsTopBar.tsx` (each is imported by _name_ via `UniversalOpsShell.tsx`).
4. **⚑ Phase-2 compliance components** `client/src/components/ops/ActionCard.tsx` + `OpsStatusRail.tsx`:
   these are referenced as planned maritime-HMI controls (`docs/compliance/Maritime-HMI-Compliance.md`) and a
   playwright spec. **Decide:** (a) wire them into `UniversalOpsShell` now, (b) keep as WIP and add a scoped
   knip ignore with a comment, or (c) remove if abandoned. Default recommendation: (b) until the Phase-2 work lands.
5. **Spec entry:** add `…/playwright-mobile-guard.spec.ts` to knip's test entry globs (it is a real spec, not dead).

- **Accept:** `npm run check:dead-code` exits 0 (knip back at/under baseline) **without** running
  `--write-baseline`. Re-baseline only if the team consciously accepts residual items.
- **Also run after:** `npm run check` + `npm run lint` (removing `xstate`/files must not break types/imports).

### Task 1.3 — G4 Unparsed client wire read _(effort XS–S)_

- The baseline is count-only (`scripts/client-wire-parses-baseline.json` = `{"unparsed":92}`), so pinpoint the
  +1 via `node scripts/check-client-wire-parses.mjs --report` cross-referenced with recent `git log -p` on `client/src`.
- **Do:** wrap the offending response in its Zod schema (the `validateResponse`/parse pattern the ratchet enforces).
  If the new read is a control-plane call with no body (e.g. `/api/healthz`, `/api/me/logout`, the SSE
  `streamClient.ts`), add it to the documented exemption instead.
- **Accept:** `npm run check:client-wire-parses` exits 0 (count ≤ 92).

**Phase 1 exit:** `npm run check:guards-full` advances past format/dead-code/contract gates; CI
`lint-and-typecheck` + `dead-code` jobs go green. One blocking gate (G2) remains.

---

## Phase 2 — Initial bundle budget (G2) · the real engineering blocker · 1–3 days

Current `app-*` 125.7 + `vendor-react-*` 116.9 + `vendor-ui-*` 45.3 = **287.3 kB gzip vs 215 kB**.
`vendor-react` is near-fixed; the lever is the `app-*` entry chunk.

### Task 2.1 — Measure _(effort S)_

- Add `rollup-plugin-visualizer` (dev-only) to `vite.config.ts` to break down `app-*` into first-party vs
  ungrouped-vendor contributors. (Today `manualChunks` groups only react / radix+lucide+cmdk / recharts+d3 /
  @tanstack / jspdf+xlsx+pdf-lib; everything else collapses into `app-*`.)

### Task 2.2 — Genuine reduction _(effort M; the core work)_

- **Lazy-load non-first-paint code** reachable synchronously from `client/src/App.tsx` (heavy providers,
  dialogs, admin/analytics surfaces) using the `React.lazy` + Suspense pattern already used for ~22 page chunks.
- **Defer lib-heavy paths:** ensure libraries only needed by lazy routes are reached via dynamic `import()`,
  not eagerly from the entry graph.
- **⚑ Vendor re-bucketing is allowed only when it reflects real deferral** (a chunk that genuinely loads
  later), not merely to move bytes out of the measured glob. Renaming to dodge `.size-limit.json` is gate-gaming.

### Task 2.3 — Re-measure & decide _(⚑)_

- `npm run build:renderer && npx size-limit`.
- If genuinely ≤ 215 kB → done. If the residual is truly first-paint-critical and accepted, **raise the
  budget in `.size-limit.json` with a justifying comment** (honest budget decision, reviewed) — do not re-glob.
- **Accept:** `npx size-limit` exits 0.

---

## Phase 3 — Re-score

- Run the scorecard sequence (`RELEASE-READINESS-SCORECARD.md` §How to re-score) and update the scorecard +
  this plan's status.
- **Expected verdict after Phases 1–2:** **SHIP WITH CAVEATS** (all 4 blocking gates green; caveats remain).

---

## Phase 4 — Caveats, by leverage _(post-ship; ongoing)_

1. **G8 repo settings (S):** enable GitHub branch-protection required checks (`lint-and-typecheck`,
   `unit-tests`, `integration-tests`, `build`); enable Dependency Graph, then drop `continue-on-error`
   from `dependency-review` in `security.yml`. Plan the 70 MB git-history cleanup separately (force-push coordination).
2. **G6 coverage gate (S):** add a CI `--coverage` step (start non-blocking) so the configured 20% floor is enforced.
3. **G5 rollback proof (L) — highest operational value:** reconcile the `drizzle-kit push` baseline vs the
   numbered-migration mechanism so `check-migrations-reversible.sh` can run from a real baseline; then flip it
   from advisory (`continue-on-error`) to blocking. Tracked in `docs/SECURITY-REVIEW-FOLLOWUPS.md`.
4. **G9 dual-schema drift (M):** burn down the 5 missing tables + 29 column-drift tables toward 0.
5. **G7 dependency HIGHs (M, partly external):** swap `xlsx`; evaluate whether the `@dsnp/parquetjs`
   telemetry-export feature is needed; track the `@tensorflow/tfjs-node` upgrade.
6. **G10 debt burndown (L, ongoing):** continue lint-warning / knip / typed-cast / unbacked-API ratchets
   down; the error-envelope `message`/`code` mirrors have a hard sunset of **2026-11-18**.

---

## Acceptance matrix

| Gap          | Task    | Acceptance gate (must exit 0)                                      |
| ------------ | ------- | ------------------------------------------------------------------ |
| G1           | 1.1     | `npm run format:check`                                             |
| G3           | 1.2     | `npm run check:dead-code` (no `--write-baseline`)                  |
| G4           | 1.3     | `npm run check:client-wire-parses`                                 |
| G2           | 2.1–2.3 | `npx size-limit`                                                   |
| all blocking | 3       | `npm run check:guards-full` + CI jobs green                        |
| G6           | 4.2     | CI coverage step present (≥20%)                                    |
| G5           | 4.3     | `check-migrations-reversible.sh` blocking (no `continue-on-error`) |

## Decision points (⚑ — need a human call)

1. **`opsRuntimeMachine.ts` + `xstate`** — remove (abandoned) vs keep (imminent use)?
2. **`@yao-pkg/pkg`** — remove vs reserve for future binary packaging?
3. **`ActionCard.tsx` + `OpsStatusRail.tsx`** — wire the Phase-2 compliance controls now, knip-ignore as WIP, or cut?
4. **Bundle budget** — invest to bring `app-*` genuinely under 215 kB, or raise `.size-limit.json` with justification?

## Files touched (by phase, representative)

- **P1:** repo-wide (format); `package.json` (drop `xstate`, `@yao-pkg/pkg`); `client/src/core/runtime/opsRuntimeMachine.ts`;
  `client/src/components/ops/{OpsShell,OpsSidebar,OpsTopBar}.tsx`; knip config; one `client/src/**` wire-read site.
- **P2:** `vite.config.ts` (`manualChunks`, visualizer), `client/src/App.tsx` (+ root-eager modules), possibly `.size-limit.json`.
- **P4:** GitHub repo settings, `.github/workflows/{ci,security}.yml`, migration tooling, dependency swaps.
