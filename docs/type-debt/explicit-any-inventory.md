# Explicit `any` Inventory

_Generated: 2026-05-22T12:35:17.212Z_

Source: `npx eslint . --format json` filtered to `@typescript-eslint/no-explicit-any`. Regenerate with `node scripts/type-debt/classify-explicit-any.mjs`.

## Headline

- **Total occurrences:** 796
- **Distinct files:** 292

**Rough split (based on bucket heuristics — see per-bucket sections for caveats):**

- ~47.5% mechanical (test mocks + external library gaps + generic inference fixes)
- ~25.1% schema / generic redesign (dynamic JSON parses + legacy DTOs)
- ~27.4% truly unsafe / residual (drives Phase 3 domain work)

**Bucket totals:**

| Bucket | Occurrences | % | Files |
|---|---:|---:|---:|
| External library typing gaps | 2 | 0.3% | 2 |
| Test mocks / stubs | 0 | 0.0% | 0 |
| Legacy DTOs (route handlers, request/response shapes) | 161 | 20.2% | 50 |
| Dynamic JSON payloads | 39 | 4.9% | 32 |
| Generic inference failures | 376 | 47.2% | 165 |
| Truly unsafe / untyped logic | 218 | 27.4% | 118 |

## External library typing gaps

**Definition.** Casts and `any` parameters that exist because a third-party library has poor or missing TypeScript types (SDK responses, untyped npm packages, raw driver rows, multer/express middleware extensions, etc.).

**Count.** 2 occurrences across 2 files (0.3% of all explicit `any`).

**Top files:**

| File | Count |
|---|---:|
| `server/telemetry/adapters/batch-ack.ts` | 1 |
| `server/telemetry/adapters/raw-archive.ts` | 1 |

**Examples:**

- `server/telemetry/adapters/batch-ack.ts:81` — `metadata: input.metadata as any,`
- `server/telemetry/adapters/raw-archive.ts:89` — `metadata: payload.metadata as any,`

**Recommended remediation.** Wrap each library at a single adapter boundary. Define an internal interface that matches what we actually consume, parse the library response with Zod (or a hand-rolled type guard) once, and let the rest of the codebase depend on the internal type. If the library ships @types, upgrade. If it doesn't and the surface is stable, hand-write a `.d.ts` in `types/`.

## Test mocks / stubs

**Definition.** Occurrences inside `tests/`, `*.test.ts(x)`, jest setup, fixture factories. Mocks often need to bypass constructor visibility or stub partial shapes.

**Count.** 0 occurrences across 0 files (0.0% of all explicit `any`).

**Recommended remediation.** Prefer `jest.mocked()` + typed factory functions (`makeFakeVessel(overrides?: Partial<Vessel>): Vessel`). For partial stubs, use `Partial<T>` + `satisfies` instead of `any`. Where a mock genuinely needs to lie about a type, isolate it in a `__mocks__/` helper rather than littering test bodies with `any`.

## Legacy DTOs (route handlers, request/response shapes)

**Definition.** `any` on route-handler request bodies/queries, untyped DTO interfaces, and helper signatures that pass request-shaped data around without ever describing it. Most of these survived the wire-parses sweep because they live below the route registration layer.

**Count.** 161 occurrences across 50 files (20.2% of all explicit `any`).

**Top files:**

| File | Count |
|---|---:|
| `server/routes/equipment-context/data-queries.ts` | 16 |
| `server/routes/equipment-context/context-builder.ts` | 15 |
| `server/routes/vessel-3d-routes.ts` | 9 |
| `server/routes/analytics/model-governance.ts` | 5 |
| `server/routes/wo-so-bridge-routes.ts` | 5 |
| `server/domains/config-management/routes.ts` | 4 |
| `server/domains/integrations/routes.ts` | 4 |
| `server/domains/work-orders/interfaces/workflow-routes.ts` | 4 |
| `server/routes/kb-ask-route.ts` | 4 |
| `server/routes/pdm-gap-fill-routes.ts` | 4 |

**Examples:**

- `server/compliance/routes/ml-governance-routes.ts:164` — `const existingOverride: any = Array.isArray(existingOverrideRaw)`
- `server/domains/config-management/routes.ts:17` — `db: any;`
- `server/domains/config-management/routes.ts:18` — `configAuditLog: any;`

**Recommended remediation.** Define the DTO once with Zod, derive the TS type via `z.infer`, and import the type at every helper. For handlers, use `AuthenticatedRequest` from `server/middleware/auth.ts` and parse `req.body`/`req.query`/`req.params` with the schema — same contract the wire-parses sweep enforced.

## Dynamic JSON payloads

**Definition.** `JSON.parse(...) as any`, `Record<string, any>`, drizzle `jsonb()` columns, OpenAI function-call arguments, Sentry/observability event payloads, telemetry attribute bags, anything that's genuinely heterogeneous at the boundary.

**Count.** 39 occurrences across 32 files (4.9% of all explicit `any`).

**Top files:**

| File | Count |
|---|---:|
| `client/src/features/settings/hooks/useDiagnosticsData.ts` | 3 |
| `server/shared/base-repository.ts` | 3 |
| `server/digital-twin/physics-calculations.ts` | 2 |
| `server/domains/vibration/routes.ts` | 2 |
| `server/routes/diagnostics/types.ts` | 2 |
| `client/src/components/ai-health/TrainingTab.tsx` | 1 |
| `client/src/features/crew/hooks/useSchedulePlannerData.ts` | 1 |
| `client/src/pages/digital-twin/ScenariosTab.tsx` | 1 |
| `server/bootstrap/middleware.ts` | 1 |
| `server/compliance/audit-middleware.ts` | 1 |

**Examples:**

- `client/src/components/ai-health/TrainingTab.tsx:493` — `const model = modelRow as Record<string, any>;`
- `client/src/features/crew/hooks/useSchedulePlannerData.ts:21` — `payload: any;`
- `client/src/features/settings/hooks/useDiagnosticsData.ts:24` — `details?: Record<string, any>;`

**Recommended remediation.** Stop trusting the payload. Parse once with `z.unknown().pipe(targetSchema)` or `JSON.parse` followed by a Zod parse. Inside the system, replace `any` with `unknown` so callers are forced to narrow. For drizzle `jsonb` columns, declare the column type as `jsonb().$type<MyShape>()` and store the Zod schema alongside.

## Generic inference failures

**Definition.** Functions whose signature uses `any` because the author couldn't get a generic to flow (callback params typed `(x: any)`, `Array<any>`, `Promise<any>`, return-type `any` on a helper that should have inferred).

**Count.** 376 occurrences across 165 files (47.2% of all explicit `any`).

**Top files:**

| File | Count |
|---|---:|
| `server/ml-prediction-service.ts` | 13 |
| `server/openai/dossier-builder.ts` | 11 |
| `server/services/compliance-rules-engine/engine-core.ts` | 9 |
| `client/src/pages/dashboard-improved.tsx` | 7 |
| `server/inventory-risk/analyzer.ts` | 6 |
| `server/ml-model-registry.ts` | 6 |
| `server/mqtt-reliable-sync/mqtt-reliable-sync.ts` | 6 |
| `server/services/data-export-import/data-transforms.ts` | 6 |
| `server/services/ml/ml-training-job-queue.ts` | 6 |
| `server/db-utils/timescale.ts` | 5 |

**Examples:**

- `artifacts/mockup-sandbox/src/components/mockups/home-layouts/SidebarSplit.tsx:48` — `const Button = ({ children, variant = 'default', size = 'default', className = '', ...props }: any) => {`
- `client/src/components/ai-health/ReportsTab.tsx:125` — `{audiences.map((aud: any) => (`
- `client/src/components/ai-health/ReportsTab.tsx:144` — `{models.map((model: any) => (`

**Recommended remediation.** Reach for `Parameters<typeof fn>[n]` / `Awaited<ReturnType<typeof fn>>` / `infer` rather than `any`. For callbacks, type the higher-order function generically (`<T>(items: T[], cb: (x: T) => void)`) instead of widening the parameter. For Promise chains, type the resolution value, not the wrapper.

## Truly unsafe / untyped logic

**Definition.** Residual `any` that isn't explained by any of the above — typically deep cross-domain glue, dynamic property access on heterogeneous registries, or code that genuinely needs a domain redesign before it can be typed.

**Count.** 218 occurrences across 118 files (27.4% of all explicit `any`).

**Top files:**

| File | Count |
|---|---:|
| `server/services/data-export-import/entity-upserters.ts` | 10 |
| `server/lp-optimizer/lp-formulation.ts` | 8 |
| `server/job-processors/report-processors.ts` | 6 |
| `server/report-context/data-fetchers.ts` | 6 |
| `server/integrations/aquametro-fmcc/rest-client.ts` | 5 |
| `server/ml-model-registry.ts` | 5 |
| `server/services/compliance-rules-engine/engine-core.ts` | 5 |
| `server/services/data-export-import/entity-fetchers.ts` | 5 |
| `server/services/ml/prediction-outcome-tracker.ts` | 5 |
| `client/src/features/maintenance/hooks/usePdmPackData.ts` | 4 |

**Examples:**

- `client/src/components/UnifiedCrewManagement/CrewFormDialog.tsx:32` — `d: any;`
- `client/src/components/UnifiedCrewManagement/RosterFilters.tsx:15` — `export function RosterFilters({ d }: { d: any }) {`
- `client/src/components/UnifiedCrewManagement/RosterTable.tsx:48` — `d: any;`

**Recommended remediation.** Don't paper over with a cast. These are the call sites that should drive Phase 3 work (Result/Either, branded IDs, discriminated unions, shared API envelopes, typed domain errors). Capture the call site in the follow-up task list and resolve it as part of the domain redesign — not as a one-line edit.

## Notes for Phase 3

- **Dynamic JSON payloads** is the bucket most likely to motivate a shared API response envelope and a convention for storing Zod schemas next to `jsonb()` columns. Pick one representative call site (e.g. an OpenAI function-call handler) and design the envelope there before fanning out.
- **Legacy DTOs** below the route layer is the bucket most likely to motivate branded IDs and discriminated unions for workflow states — the same DTOs are often the ones losing identity-type information across service boundaries.
- **Truly unsafe / untyped logic** is the smallest bucket but the highest-leverage. Each occurrence should be inspected by hand and either converted into a typed-pattern task (Result/Either, typed domain error hierarchy) or kept under a tracked exception with a comment explaining why no type fits.
- **Bucket fuzziness.** The classifier prefers path-based rules first (tests/, external-integrations/, adapters/) and then snippet heuristics. Files that look like routes but parse JSON payloads will land in _Dynamic JSON payloads_ rather than _Legacy DTOs_. When triaging follow-ups, re-read the snippet rather than trusting the bucket label blindly.

