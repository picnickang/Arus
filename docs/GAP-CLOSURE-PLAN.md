# Gap-Closure Plan

Date: 2026-06-11 · Companion to `docs/UI-SCORECARD.md` (grades) and
`docs/UI-CONSOLIDATION-AUDIT.md` (the audit; C-items referenced below).
Branch context: written on `claude/loving-planck-i23ijo`, which carries the
CI green-up main still needs.

## Why this shape: lock, then drain

One day of measurement (audit → scorecard) produced the governing fact:

> **Every metric with a guard held or improved. Every metric without one
> drifted.** Headers 97→107, raw polling literals ~115→132, >1,000-line
> client files 2→7, +12 domain leaks merged onto a red main — while casts,
> leaks, lint warnings, and format (all ratcheted) only went down.

So the strategy is sequenced _lock, then drain_: first make every known gap
impossible to widen (guards + process), then burn the debt down in leverage
order. Draining first would leak.

## Corrections from this assessment (errata applied to the scorecard)

1. **The "17 failing integration tests" do not exist.** The failures were
   `EADDRINUSE 0.0.0.0:5000` — the integration server binds a fixed port
   (`tests/integration/utils/test-server.ts:41`) and a stray dev-server from
   an earlier boot-health run held it. With the port free the lane is
   **144/144 green** (re-verified 2026-06-11). Residual gap is hardening
   (D6), not breakage. Scorecard dim 9 regraded B− → B; overall 2.89 → 2.93.
2. **Polling constants already exist** — `POLL_INTERVALS` in
   `client/src/lib/polling.ts` (FAST/STANDARD/SLOW/RELAXED). The gap is
   adoption (132 raw `refetchInterval` literals), which changes D2 from
   "design constants" to a mechanical sweep + ratchet.
3. **Chart tokens already exist** — `--chart-1..5` per theme in
   `client/src/index.css`. D3 is adoption + a `-[#` ban, not palette design.

## Gap register

Class G-P = process (root causes) · G-G = missing guard · G-D = debt.
Effort: S < ½ day · M ≈ 1–2 days · L = multi-session.

| ID  | Gap (evidence)                                                                                        | Class | Closure                                                                                                     | Effort | Phase |
| --- | ----------------------------------------------------------------------------------------------------- | ----- | ----------------------------------------------------------------------------------------------------------- | ------ | ----- |
| P1  | No required status checks — merges landed on red 3× in 24 h                                           | G-P   | Branch protection requiring `Lint & Typecheck` + `Unit Tests` (admin action; command in §Branch protection) | S      | 0/1   |
| P2  | No CODEOWNERS — parallel sessions rewrite `scripts/*-baseline.json` concurrently                      | G-P   | `.github/CODEOWNERS` covering baselines, guard scripts, workflows                                           | S      | 1     |
| P3  | No PR template — guard expectations invisible at review time                                          | G-P   | `.github/PULL_REQUEST_TEMPLATE.md` with the guard checklist                                                 | S      | 1     |
| P4  | Drift between merges detected only by manual re-scoring                                               | G-P   | Nightly `scorecard-drift` workflow (05:00 UTC) running guards + UI ratchets on main                         | S      | 1     |
| P5  | No written red-main / baseline-edit protocol                                                          | G-P   | `docs/runbooks/ci-merge-discipline.md`                                                                      | S      | 1     |
| G1  | Hand-rolled page headers unguarded (107 in 37 files, ▲10/day)                                         | G-G   | `check-ui-ratchets.mjs` counter `handRolledHeaders`                                                         | —      | 1     |
| G2  | Raw `refetchInterval` literals unguarded (132, ▲)                                                     | G-G   | counter `rawPollLiterals` (literals not using `POLL_INTERVALS`)                                             | —      | 1     |
| G3  | Arbitrary color utilities unguarded (25 `-[#…]`)                                                      | G-G   | counter `arbitraryColorUtilities`                                                                           | —      | 1     |
| G4  | Index keys unguarded (91 `key={i}`/`key={idx}`)                                                       | G-G   | counter `indexKeys`                                                                                         | —      | 1     |
| G5  | Route-shadow class of bug can return (audit §2.1)                                                     | G-G   | `tests/unit/route-shadow.test.ts` (redirects ∩ routes = ∅; migration targets resolve)                       | S      | 1     |
| G6  | Unmemoized provider values can return (audit items 4–5)                                               | G-G   | ESLint `no-restricted-syntax` ban on object-literal `value=` in `client/src/contexts/`                      | S      | 1     |
| D1  | Dim 2 C−: 107 hand-rolled headers, 10 severity impls, 9/12 hand-rolled hubs                           | G-D   | `AppPage` shell (audit §3.3/§8.6) + top-10 header migration + `client/src/lib/severity.ts`                  | M      | 2     |
| D2  | Dim 4: 132 raw poll literals; index keys in SchedulePlanner/RMS                                       | G-D   | Tier-map sweep onto `POLL_INTERVALS`; entity keys in mutable grids                                          | M      | 2     |
| D3  | Dim 3: 25 `-[#` bypasses; chart hexes off-token                                                       | G-D   | Replace with semantic/`--chart-N` tokens                                                                    | S/M    | 2     |
| D4  | Dim 1: Records 3-grammar fork; 6 settings double-registrations; dup surfaces                          | G-D   | Audit C2, C3, C9, C10; then product-call C4/C6/C7                                                           | M/L    | 3     |
| D5  | Dim 6: crew cluster god-files (CrewTaskTracker 1,290; CrewFormDialog 1,073; +3 schedule files >1,000) | G-D   | Dispatcher-split per the proven `registry-screens/` recipe                                                  | L      | 4     |
| D6  | Integration server binds fixed :5000 — collision-prone for local/parallel runs                        | G-D   | Ephemeral port (or pre-flight check with actionable error) in `tests/integration/utils/test-server.ts`      | S      | 2     |
| D7  | Main is red (`check:guards`, `check:boot-health`) — fixes sit unmerged on this branch                 | G-D   | Land `196d8d0..HEAD` via PR                                                                                 | S      | 0     |

## Phases and exit criteria

| Phase | Contents                            | Exit criteria (measurable)                                                                                    |
| ----- | ----------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| 0     | D7 + integration re-verify + errata | PR open; integration 144/144 recorded; scorecard corrected (done in this commit)                              |
| 1     | G1–G6, P2–P5 (+P1 instructions)     | `check:guards` includes `check:ui-ratchets`; nightly drift job exists; negative test proves the ratchet bites |
| 2     | D1, D2, D3, D6                      | Dim 2 ≥ C+, dim 3 ≥ A−, dim 4 ≥ B → overall ≥ B                                                               |
| 3     | D4                                  | Dim 1 ≥ B+ → overall ≥ B+ (3.3)                                                                               |
| 4     | D5 + C4/C6/C7/C8                    | ≤2 client files >1,000 lines; aspirational overall A−                                                         |

Re-score after each phase with the scorecard §13 commands; the nightly job
(P4) makes inter-phase drift visible without waiting for a re-score.

## Branch protection (P1 — repo-admin action)

Cannot be set from a working tree. One-time:

```bash
gh api -X PUT repos/picnickang/Arus/branches/main/protection \
  -f required_status_checks[strict]=true \
  -f "required_status_checks[contexts][]=Lint & Typecheck" \
  -f "required_status_checks[contexts][]=Unit Tests" \
  -f enforce_admins=false \
  -f required_pull_request_reviews=null -f restrictions=null
```

Until this is on, every other guard can be bypassed by merging red — it is
the single highest-leverage action in this document.

## Decisions needed (flagged, not assumed)

- **C6** crew-scheduler vs schedule-planner: which surface is the product?
- **C4** notifications-hub parity before folding the three settings pages.
- **C8** vessel detail: confirm `VesselIntelligence` absorbs `VesselDashboard`.
- **P1** requires repo admin (above).

## Phase 1 implementation notes (for the executing session)

- Ratchet template: `scripts/check-typed-casts.mjs` (scan dirs → regex →
  baseline JSON → `--update`/`--list`). One script, four counters, one
  baseline file `scripts/ui-ratchets-baseline.json`; wire as
  `check:ui-ratchets` into the `check:guards` chain and ci.yml lint job.
- Index-key counter excludes obvious skeleton files
  (`*skeleton*`, `*Skeleton*`) where index keys are legitimate.
- Poll counter flags `refetchInterval:` whose value is a numeric literal;
  references to `POLL_INTERVALS.*`/`CACHE_TIMES.*` pass.
- Provider-memo lint: restrict to `client/src/contexts/**` to avoid false
  positives on non-context `value=` props elsewhere.
