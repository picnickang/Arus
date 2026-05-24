# Explicit `any` Inventory

_Generated: 2026-05-24T05:44:24.965Z_

Source: `npx eslint . --format json` filtered to `@typescript-eslint/no-explicit-any`. Regenerate with `node scripts/type-debt/classify-explicit-any.mjs`.

## Headline

- **Total occurrences:** 139
- **Distinct files:** 102

**Rough split (based on bucket heuristics — see per-bucket sections for caveats):**

- ~46.8% mechanical (test mocks + external library gaps + generic inference fixes)
- ~6.5% schema / generic redesign (dynamic JSON parses + legacy DTOs)
- ~46.8% truly unsafe / residual (drives Phase 3 domain work)

**Bucket totals:**

| Bucket | Occurrences | % | Files |
|---|---:|---:|---:|
| External library typing gaps | 0 | 0.0% | 0 |
| Test mocks / stubs | 0 | 0.0% | 0 |
| Legacy DTOs (route handlers, request/response shapes) | 3 | 2.2% | 3 |
| Dynamic JSON payloads | 6 | 4.3% | 4 |
| Generic inference failures | 65 | 46.8% | 58 |
| Truly unsafe / untyped logic | 65 | 46.8% | 58 |

## External library typing gaps

**Definition.** Casts and `any` parameters that exist because a third-party library has poor or missing TypeScript types (SDK responses, untyped npm packages, raw driver rows, multer/express middleware extensions, etc.).

**Count.** 0 occurrences across 0 files (0.0% of all explicit `any`).

**Recommended remediation.** Wrap each library at a single adapter boundary. Define an internal interface that matches what we actually consume, parse the library response with Zod (or a hand-rolled type guard) once, and let the rest of the codebase depend on the internal type. If the library ships @types, upgrade. If it doesn't and the surface is stable, hand-write a `.d.ts` in `types/`.

## Test mocks / stubs

**Definition.** Occurrences inside `tests/`, `*.test.ts(x)`, jest setup, fixture factories. Mocks often need to bypass constructor visibility or stub partial shapes.

**Count.** 0 occurrences across 0 files (0.0% of all explicit `any`).

**Recommended remediation.** Prefer `jest.mocked()` + typed factory functions (`makeFakeVessel(overrides?: Partial<Vessel>): Vessel`). For partial stubs, use `Partial<T>` + `satisfies` instead of `any`. Where a mock genuinely needs to lie about a type, isolate it in a `__mocks__/` helper rather than littering test bodies with `any`.

## Legacy DTOs (route handlers, request/response shapes)

**Definition.** `any` on route-handler request bodies/queries, untyped DTO interfaces, and helper signatures that pass request-shaped data around without ever describing it. Most of these survived the wire-parses sweep because they live below the route registration layer.

**Count.** 3 occurrences across 3 files (2.2% of all explicit `any`).

**Top files:**

| File | Count |
|---|---:|
| `server/domains/software-updates/routes.ts` | 1 |
| `server/import-adapters/shipmate/routes.ts` | 1 |
| `server/ml-routes/acoustic-routes.ts` | 1 |

**Examples:**

- `server/domains/software-updates/routes.ts:20` — `auditAdminAction: (action: string) => any;`
- `server/import-adapters/shipmate/routes.ts:17` — `type ShipmateModuleType = any;`
- `server/ml-routes/acoustic-routes.ts:31` — `const data: any = mlAcousticDataSchema.parse(req.body);`

**Recommended remediation.** Define the DTO once with Zod, derive the TS type via `z.infer`, and import the type at every helper. For handlers, use `AuthenticatedRequest` from `server/middleware/auth.ts` and parse `req.body`/`req.query`/`req.params` with the schema — same contract the wire-parses sweep enforced.

## Dynamic JSON payloads

**Definition.** `JSON.parse(...) as any`, `Record<string, any>`, drizzle `jsonb()` columns, OpenAI function-call arguments, Sentry/observability event payloads, telemetry attribute bags, anything that's genuinely heterogeneous at the boundary.

**Count.** 6 occurrences across 4 files (4.3% of all explicit `any`).

**Top files:**

| File | Count |
|---|---:|
| `server/shared/base-repository.ts` | 3 |
| `client/src/components/ai-health/TrainingTab.tsx` | 1 |
| `server/routes/domain-router-registry.ts` | 1 |
| `server/routes/sensorBundles.ts` | 1 |

**Examples:**

- `client/src/components/ai-health/TrainingTab.tsx:493` — `const model = modelRow as Record<string, any>;`
- `server/routes/domain-router-registry.ts:76` — `getDeps: () => Record<string, any>;`
- `server/routes/sensorBundles.ts:394` — `const fields = template.fields as Record<string, any>;`

**Recommended remediation.** Stop trusting the payload. Parse once with `z.unknown().pipe(targetSchema)` or `JSON.parse` followed by a Zod parse. Inside the system, replace `any` with `unknown` so callers are forced to narrow. For drizzle `jsonb` columns, declare the column type as `jsonb().$type<MyShape>()` and store the Zod schema alongside.

## Generic inference failures

**Definition.** Functions whose signature uses `any` because the author couldn't get a generic to flow (callback params typed `(x: any)`, `Array<any>`, `Promise<any>`, return-type `any` on a helper that should have inferred).

**Count.** 65 occurrences across 58 files (46.8% of all explicit `any`).

**Top files:**

| File | Count |
|---|---:|
| `server/services/ml/ml-training-job-queue.ts` | 6 |
| `docs/examples/telemetry-service-with-logging.ts` | 2 |
| `server/services/ml/prediction-outcome-tracker.ts` | 2 |
| `artifacts/mockup-sandbox/src/components/mockups/home-layouts/SidebarSplit.tsx` | 1 |
| `client/src/features/serviceOrders/pages/ServiceOrdersPage.tsx` | 1 |
| `client/src/lib/api/finance.ts` | 1 |
| `client/src/lib/desktop.ts` | 1 |
| `client/src/lib/desktopFetch.ts` | 1 |
| `client/src/pages/ai-sensor-audits.tsx` | 1 |
| `client/src/pages/digital-twin/ReplayTab.tsx` | 1 |

**Examples:**

- `artifacts/mockup-sandbox/src/components/mockups/home-layouts/SidebarSplit.tsx:48` — `const Button = ({ children, variant = 'default', size = 'default', className = '', ...props }: any) => {`
- `client/src/features/serviceOrders/pages/ServiceOrdersPage.tsx:127` — `onSuccess: (res: any) => {`
- `client/src/lib/api/finance.ts:80` — `): Promise<any> {`

**Recommended remediation.** Reach for `Parameters<typeof fn>[n]` / `Awaited<ReturnType<typeof fn>>` / `infer` rather than `any`. For callbacks, type the higher-order function generically (`<T>(items: T[], cb: (x: T) => void)`) instead of widening the parameter. For Promise chains, type the resolution value, not the wrapper.

## Truly unsafe / untyped logic

**Definition.** Residual `any` that isn't explained by any of the above — typically deep cross-domain glue, dynamic property access on heterogeneous registries, or code that genuinely needs a domain redesign before it can be typed.

**Count.** 65 occurrences across 58 files (46.8% of all explicit `any`).

**Top files:**

| File | Count |
|---|---:|
| `server/services/ml/ml-training-job-queue.ts` | 4 |
| `docs/examples/telemetry-service-with-logging.ts` | 3 |
| `server/services/ml/prediction-outcome-tracker.ts` | 2 |
| `server/shared/base-repository.ts` | 2 |
| `client/src/features/analytics/hooks/useReportsData.ts` | 1 |
| `client/src/features/serviceOrders/pages/ServiceOrdersPage.tsx` | 1 |
| `client/src/features/settings/hooks/useOrganizationData.ts` | 1 |
| `client/src/lib/desktop.ts` | 1 |
| `client/src/main.tsx` | 1 |
| `client/src/pages/briefing.tsx` | 1 |

**Examples:**

- `client/src/features/analytics/hooks/useReportsData.ts:14` — `const { data: equipmentHealth, isLoading: healthLoading } = useQuery<any[]>({`
- `client/src/features/serviceOrders/pages/ServiceOrdersPage.tsx:324` — `serviceOrders={filteredOrders.map((o): any => ({`
- `client/src/features/settings/hooks/useOrganizationData.ts:198` — `const result: any = await apiRequest("POST", \`/api/users/${userId}/reset-password\`);`

**Recommended remediation.** Don't paper over with a cast. These are the call sites that should drive Phase 3 work (Result/Either, branded IDs, discriminated unions, shared API envelopes, typed domain errors). Capture the call site in the follow-up task list and resolve it as part of the domain redesign — not as a one-line edit.

## Notes for Phase 3

- **Dynamic JSON payloads** is the bucket most likely to motivate a shared API response envelope and a convention for storing Zod schemas next to `jsonb()` columns. Pick one representative call site (e.g. an OpenAI function-call handler) and design the envelope there before fanning out.
- **Legacy DTOs** below the route layer is the bucket most likely to motivate branded IDs and discriminated unions for workflow states — the same DTOs are often the ones losing identity-type information across service boundaries.
- **Truly unsafe / untyped logic** is the smallest bucket but the highest-leverage. Each occurrence should be inspected by hand and either converted into a typed-pattern task (Result/Either, typed domain error hierarchy) or kept under a tracked exception with a comment explaining why no type fits.
- **Bucket fuzziness.** The classifier prefers path-based rules first (tests/, external-integrations/, adapters/) and then snippet heuristics. Files that look like routes but parse JSON payloads will land in _Dynamic JSON payloads_ rather than _Legacy DTOs_. When triaging follow-ups, re-read the snippet rather than trusting the bucket label blindly.

