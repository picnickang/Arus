# ARUS UI & Codebase Scorecard

Scored: 2026-06-11, against branch `claude/loving-planck-i23ijo` at `196d8d0`
(= main after PR #21 **plus** the unmerged CI green-up commit). Where main and
this branch differ, the row says so. Companion to
`docs/UI-CONSOLIDATION-AUDIT.md` (the "audit"); deltas reference the audit's
2026-06-10 measurements. Every number is reproducible — commands in §13.

Grading: A = best-practice, nothing material to fix · B = sound with known,
bounded debt · C = working but systemically duplicated/unguarded · D/F =
actively harmful. Points A=4.0, A−=3.7, B+=3.3, B=3.0, B−=2.7, C+=2.3, C=2.0,
C−=1.7.

## Overall: **B− (2.93 / 4.0 ≈ 73 / 100)** — _dim 9 regraded after the integration erratum; was 2.89_

| #   | Dimension                          | Weight | Grade | Trend since audit                       |
| --- | ---------------------------------- | ------ | ----- | --------------------------------------- |
| 1   | Information architecture & routing | 12     | B     | ▲ (Wave 1 landed)                       |
| 2   | Component reuse & design system    | 12     | C−    | ▼ (header sprawl grew)                  |
| 3   | Styling & theming discipline       | 8      | B+    | ▼ (audit's "zero raw colors" corrected) |
| 4   | Render performance & state         | 10     | B−    | ▲ (3 verified bugs fixed)               |
| 5   | Bundle & code-splitting            | 6      | A−    | →                                       |
| 6   | Client code health                 | 8      | C+    | ◆ mixed (one split done, crew grew)     |
| 7   | Architecture boundaries (server)   | 12     | B+ \* | ▲ on branch; **failing on main**        |
| 8   | Type safety & debt ratchets        | 10     | B−    | ▲ (casts under baseline)                |
| 9   | Test & CI health                   | 12     | B     | ▲ (erratum: integration is green)       |
| 10  | Guardrail tooling maturity         | 10     | A     | ▲ (leak baseline ratcheted down)        |

\* Dimension 7 and the boot-health half of 9 are graded on this branch; main
currently fails `check:guards` and `check:boot-health` until `196d8d0` lands.

---

## 1. Information architecture & routing — **B** (weight 12)

| Metric                                                      | Audit (06-10) | Now    |
| ----------------------------------------------------------- | ------------- | ------ |
| Hub-group route registrations                               | 91            | **83** |
| Shadowed (dead) registrations                               | 9             | **0**  |
| Redirect registry (`routeMigrations` + hardcoded)           | 30 + 4        | 31 + 4 |
| URL grammars for the Records area                           | 3             | 3      |
| Settings pages registered twice (standalone + embedded tab) | 6             | 6      |

Routing is centralized (`client/src/routes/*.ts`), fully lazy, hub-gated, and
redirects carry usage telemetry. Wave 1 removed every provably-dead
registration. What holds the grade at B: the Records grammar fork (audit §2.2
— nav serves a different UI than the hub tab for the same intent), the six
double-registered settings pages (audit C3), and the unresolved duplicate
surfaces (vessel detail ×2, equipment detail ×2, scheduler naming collision —
audit §2.3). Executing audit C2–C4 is the path to A−.

## 2. Component reuse & design system — **C−** (weight 12)

| Metric                                                       | Audit          | Now                 |
| ------------------------------------------------------------ | -------------- | ------------------- |
| Pages importing canonical `PageHeader`                       | 17             | 17                  |
| Hand-rolled `text-2xl/3xl font-bold` headers                 | 97 in 33 files | **107 in 37 files** |
| Hubs on shared layouts (`IconGridLayout`/`TabbedPageLayout`) | 3 / 12         | 3 / 12              |
| Separate `getSeverityColor` implementations                  | 10             | 10                  |
| shadcn/ui primitives (all used)                              | 31             | 39, 1,556 imports   |

The primitive layer is genuinely strong — 39 shadcn components with 1,556
imports and zero unused. Everything above the primitive layer is the
weakest area of the codebase, and it is **actively regressing**: ten more
hand-rolled headers appeared in the single day since the audit. Without the
audit §10 burn-down guard, every new page widens the gap. Top fixes: the
`AppPage` shell (audit §3.3, §8.6), one `lib/severity.ts`, and the header
ratchet — those three alone lift this to C+/B−.

## 3. Styling & theming discipline — **B+** (weight 8)

| Metric                                                        | Value                                             |
| ------------------------------------------------------------- | ------------------------------------------------- |
| Semantic tokens                                               | 46 custom properties × 4 themes                   |
| Inline `style={{…}}`                                          | 97 — all dynamic values (widths, transforms, SVG) |
| Raw colors (`#hex` / `rgb(`) in TSX                           | **119 occurrences in 31 files**                   |
| …of which Tailwind arbitrary color utilities (`bg-[#…]` etc.) | 25                                                |

**Correction to the audit:** §5.1 claimed zero raw colors; the measurement was
wrong. The 119 hits cluster in maps/3D/charts (`fleet-triage-components` 14,
`vessel-dashboard` 14, `SectionedVesselMap` 9, `Vessel3DTwin` 7…) where hex
fills for canvas/SVG/recharts are semi-legitimate — but the 25 arbitrary-value
utilities (e.g. `bg-[#080e1a]` in `IntelligenceLayout.tsx`) are genuine token
bypasses in ordinary UI. The token system itself, the four marine themes
(light/dark/bridge/daylight), and the all-dynamic inline-style discipline
remain excellent. Fix: a `--chart-*` token palette + ban `-[#` via the §10
token guard.

## 4. Render performance & state — **B−** (weight 10)

| Metric                                           | Audit                 | Now                    |
| ------------------------------------------------ | --------------------- | ---------------------- |
| Unmemoized context values re-rendering consumers | 2 (38 + 14 consumers) | **0**                  |
| Hub tabs remounting on revisit                   | yes                   | **fixed** (lazy cache) |
| Memoized components (`memo(`)                    | 10                    | 13                     |
| Index keys (`key={i}` / `key={idx}`)             | ~129\*                | 91\*                   |
| `refetchInterval` sites                          | ~115                  | **132**                |

\* different grep definitions; both reproducible (§13).

The three verified High-severity re-render bugs from the audit are fixed and
merged. Remaining debt is breadth, not bugs: 132 raw polling literals
(constants already exist — `POLL_INTERVALS` in `client/src/lib/polling.ts`;
the gap is adoption), index keys in the mutable SchedulePlanner/RMS
grids, and near-zero list-row memoization. Polling grew since the audit —
another candidate for a ratchet.

## 5. Bundle & code-splitting — **A−** (weight 6)

Every route is `lazy()`; vite `manualChunks` splits vendor-react/ui/charts/
export/tanstack plus feature chunks; lucide imports are all per-icon (zero
wildcards); three.js loads only on the 3D route. Held off A only by recharts
being eagerly imported by chart components (mitigated by the vendor-charts
chunk + lazy pages) and the 2.6 MB server esbuild artifact warning.

## 6. Client code health — **C+** (weight 8)

| Metric                    | Audit                      | Now                           |
| ------------------------- | -------------------------- | ----------------------------- |
| Largest client file       | 1,766 (`registry-screens`) | **1,290** (`CrewTaskTracker`) |
| Files > 1,000 lines       | 2                          | **7**                         |
| Confirmed-dead artifacts  | 7 items                    | **0** (purged in Wave 1)      |
| `client/src` `.tsx` files | 482                        | 502                           |

Mixed picture: the worst god-file was split exactly as the audit prescribed
(`registry-screens.tsx` → 111-line dispatcher + 8 modules ≤ 430 L, done on
main), and all Wave-1 dead code is gone — but the crew/scheduling cluster grew
past 1,000 lines in five places (`CrewTaskTracker` 1,290, `equipment-dependencies`
1,112, `ScheduleGeneratorPanel` 1,090, `HoursOfRestGrid` 1,077, `CrewFormDialog`
1,073). The long-file ratchet (ceiling 146) caps the count but not the depth.

## 7. Architecture boundaries (server) — **B+ on branch / failing on main** (weight 12)

| Metric                            | Main HEAD | This branch | Baseline |
| --------------------------------- | --------- | ----------- | -------- |
| Dynamic internal imports (A)      | 415       | **410**     | 410      |
| Route-level `db*Storage` refs (B) | 111       | **103**     | 103      |
| Cross-domain storage refs (C)     | 85        | **80**      | 80       |

62 hexagonal domains with enforced boundaries (cross-domain imports
hard-fail; raw DB confined to infrastructure; composition seams are the
sanctioned wiring point and now have five worked examples from this session).
The grade is earned on this branch — main has failed its own leak guard three
separate times in 24 h as parallel sessions merged red. Structural quality:
B+. Process discipline around it: see dimension 10's caveat.

## 8. Type safety & debt ratchets — **B−** (weight 10)

| Metric                    | Value                                      |
| ------------------------- | ------------------------------------------ |
| `tsc` errors              | 0                                          |
| Typed casts               | 1,306 vs baseline 1,307 (ratcheted)        |
| ESLint                    | 0 errors; 2,667 warnings vs 3,992 baseline |
| Duplicate-type hard gates | 8/8 canonical                              |
| zod escape-hatches        | 22 allowlisted, 0 wild                     |

Direction is right everywhere — every debt class is enumerated, baselined,
and monotonically shrinking. The absolute stock is still large (1,306 casts,
2,667 warnings, 290 tracked duplicate types), which is what separates B− from
B+. The lint-warning baseline shows the biggest banked win: −1,325 warnings
since baseline.

## 9. Test & CI health — **B** (weight 12) — _regraded from B−, erratum 2026-06-11_

| Metric                  | Value                                                                                                                                                                   |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Unit lane               | **127 suites / 1,375 tests — green** (OOM fixed: worker recycling + heap headroom)                                                                                      |
| Server-colocated suites | 33 files                                                                                                                                                                |
| Integration lane        | 88 files / **144 tests — green** (erratum: the earlier "17 failing" was an `EADDRINUSE :5000` port collision in the scoring container, not breakage; re-verified clean) |
| Boot-health             | green on branch (113 routers, 0 failures); **red on main** (stale 111 pin)                                                                                              |
| CI on main HEAD         | **red** (Lint & Typecheck job: leak guard) until `196d8d0` lands                                                                                                        |

Test infrastructure is solid and behavior-pinning (route-shadow, redirect,
public-API audits). **Erratum:** the originally reported failing integration
suite was a fixed-port collision (`tests/integration/utils/test-server.ts:41`
binds :5000) with a stray local dev-server — with the port free the lane is
144/144. Remaining drags: main's red Lint & Typecheck job until `196d8d0`
lands, and the fixed-port fragility itself (gap D6 in
`docs/GAP-CLOSURE-PLAN.md`).

## 10. Guardrail tooling maturity — **A** (weight 10)

~15 enforced checks: domain boundaries, domain leaks (3 categories), hex
storage, repositories-barrel, typed-cast/explicit-any/lint-warning/hygiene/
long-file/format ratchets, duplicate-type gates, zod allowlist, knip budget
(4,053), route-contract drift (130 baselined), boot-health pin, orgId gate
audit, migration reversibility. This is a materially stronger guard ecosystem
than most production codebases, and it ratchets down only. The one structural
gap is **process, not tooling**: three merged-red episodes in 24 h because
nothing blocks merging on a failing required check — branch protection on
`Lint & Typecheck`/`Unit Tests` would convert this tooling into an actual
floor. The audit's §10 client-side guards (header burn-down, token guard,
context-memo lint, route-shadow test) are the remaining additions.

---

## 11. Drift watchlist (worsened in the 1 day since the audit)

| Metric                     | 06-10       | 06-11 | Guard that would have caught it              |
| -------------------------- | ----------- | ----- | -------------------------------------------- |
| Hand-rolled page headers   | 97          | 107   | audit §10.2 header burn-down (not yet built) |
| `refetchInterval` sites    | ~115        | 132   | none yet — add to §10                        |
| Client files > 1,000 lines | 2           | 7     | long-file ratchet caps count only            |
| Domain-leak entries (main) | at baseline | +12   | exists — was merged through red              |

The pattern: every guard that exists held or improved; every metric without a
guard drifted. That is the strongest empirical argument in this codebase for
finishing the audit's §10 list.

## 12. Fastest grade lifts

1. **Land `196d8d0`** → dimension 7 to B+ and dimension 9's CI row to green on main (zero new work).
2. **Branch protection on the two core CI jobs** → dimension 10's caveat closed; prevents the entire §11 class.
3. **`AppPage` + header ratchet + `lib/severity.ts`** (audit §3.3/§8.6/§5.3) → dimension 2 from C− toward B−; the single highest-leverage code change.
4. **Records grammar unification (audit C2)** → dimension 1 to B+/A−.
5. **Ephemeral port for the integration test server** (`tests/integration/utils/test-server.ts`) → removes the collision class behind the now-corrected "17 failures".

## 13. Re-scoring commands

```bash
# 1 routes per group / redirects
grep -c "{ path:" client/src/routes/{operations,fleet,maintenance,crew,logistics,records,analytics,system}.ts
python3 -c "import re;s=open('client/src/config/navigationConfig.ts').read();m=re.search(r'export const routeMigrations[^{]*{(.*?)\n};',s,re.S);print(len(re.findall(r'\"[^\"]+\":',m.group(1))))"
# 2 headers / severity / hubs
grep -rl "import.*PageHeader" client/src/pages | wc -l
grep -rE "text-[23]xl font-bold" client/src/pages | wc -l
grep -rlE "const getSeverityColor|function getSeverityColor" client/src | wc -l
# 3 colors / inline styles
grep -rE "#[0-9a-fA-F]{6}|rgb\(" client/src --include="*.tsx" | wc -l
grep -rE "(bg|text|border)-\[#" client/src --include="*.tsx" | wc -l
grep -r "style={{" client/src | wc -l
# 4 render
grep -r "\bmemo(" client/src | wc -l ; grep -rE "key=\{(i|idx)\}" client/src | wc -l
grep -r "refetchInterval" client/src | wc -l
# 6 size
find client/src -name "*.tsx" -exec wc -l {} + | sort -rn | head -9
# 7–10 server health
node scripts/check-domain-leaks.mjs ; npm run check:typed-casts ; npm run check:guards
npm run test:unit ; npm run check:boot-health
```
