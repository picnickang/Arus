# Explicit `any` Inventory

_Generated: 2026-05-24T11:11:35.924Z_

Source: `npx eslint . --format json` filtered to `@typescript-eslint/no-explicit-any`. Regenerate with `node scripts/type-debt/classify-explicit-any.mjs`.

## Headline

- **Total occurrences:** 23
- **Distinct files:** 6

**Rough split (based on bucket heuristics — see per-bucket sections for caveats):**

- ~39.1% mechanical (test mocks + external library gaps + generic inference fixes)
- ~13.0% schema / generic redesign (dynamic JSON parses + legacy DTOs)
- ~47.8% truly unsafe / residual (drives Phase 3 domain work)

**Bucket totals:**

| Bucket | Occurrences | % | Files |
|---|---:|---:|---:|
| External library typing gaps | 0 | 0.0% | 0 |
| Test mocks / stubs | 0 | 0.0% | 0 |
| Legacy DTOs (route handlers, request/response shapes) | 0 | 0.0% | 0 |
| Dynamic JSON payloads | 3 | 13.0% | 1 |
| Generic inference failures | 9 | 39.1% | 5 |
| Truly unsafe / untyped logic | 11 | 47.8% | 6 |

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

**Count.** 0 occurrences across 0 files (0.0% of all explicit `any`).

**Recommended remediation.** Define the DTO once with Zod, derive the TS type via `z.infer`, and import the type at every helper. For handlers, use `AuthenticatedRequest` from `server/middleware/auth.ts` and parse `req.body`/`req.query`/`req.params` with the schema — same contract the wire-parses sweep enforced.

## Dynamic JSON payloads

**Definition.** `JSON.parse(...) as any`, `Record<string, any>`, drizzle `jsonb()` columns, OpenAI function-call arguments, Sentry/observability event payloads, telemetry attribute bags, anything that's genuinely heterogeneous at the boundary.

**Count.** 3 occurrences across 1 files (13.0% of all explicit `any`).

**Top files:**

| File | Count |
|---|---:|
| `server/shared/base-repository.ts` | 3 |

**Examples:**

- `server/shared/base-repository.ts:72` — `return (this.table as Record<string, any>)[name];`
- `server/shared/base-repository.ts:75` — `private columns(): Record<string, any> {`
- `server/shared/base-repository.ts:76` — `return this.table as Record<string, any>;`

**Recommended remediation.** Stop trusting the payload. Parse once with `z.unknown().pipe(targetSchema)` or `JSON.parse` followed by a Zod parse. Inside the system, replace `any` with `unknown` so callers are forced to narrow. For drizzle `jsonb` columns, declare the column type as `jsonb().$type<MyShape>()` and store the Zod schema alongside.

## Generic inference failures

**Definition.** Functions whose signature uses `any` because the author couldn't get a generic to flow (callback params typed `(x: any)`, `Array<any>`, `Promise<any>`, return-type `any` on a helper that should have inferred).

**Count.** 9 occurrences across 5 files (39.1% of all explicit `any`).

**Top files:**

| File | Count |
|---|---:|
| `server/services/ml/ml-training-job-queue.ts` | 4 |
| `server/services/ml/prediction-outcome-tracker.ts` | 2 |
| `server/ml-prediction/model-loader.ts` | 1 |
| `server/services/ml/model-evaluation-gate.ts` | 1 |
| `server/services/ml/prediction-calibration.ts` | 1 |

**Examples:**

- `server/ml-prediction/model-loader.ts:26` — `): Promise<any> {`
- `server/services/ml/ml-training-job-queue.ts:75` — `constructor(pgBoss: any, db: any, wsServer?: any, storage?: any) {`
- `server/services/ml/ml-training-job-queue.ts:75` — `constructor(pgBoss: any, db: any, wsServer?: any, storage?: any) {`

**Recommended remediation.** Reach for `Parameters<typeof fn>[n]` / `Awaited<ReturnType<typeof fn>>` / `infer` rather than `any`. For callbacks, type the higher-order function generically (`<T>(items: T[], cb: (x: T) => void)`) instead of widening the parameter. For Promise chains, type the resolution value, not the wrapper.

## Truly unsafe / untyped logic

**Definition.** Residual `any` that isn't explained by any of the above — typically deep cross-domain glue, dynamic property access on heterogeneous registries, or code that genuinely needs a domain redesign before it can be typed.

**Count.** 11 occurrences across 6 files (47.8% of all explicit `any`).

**Top files:**

| File | Count |
|---|---:|
| `server/services/ml/ml-training-job-queue.ts` | 4 |
| `server/services/ml/prediction-outcome-tracker.ts` | 2 |
| `server/shared/base-repository.ts` | 2 |
| `server/ml-prediction/model-loader.ts` | 1 |
| `server/services/ml/model-evaluation-gate.ts` | 1 |
| `server/services/ml/prediction-calibration.ts` | 1 |

**Examples:**

- `server/ml-prediction/model-loader.ts:69` — `circuitBreaker: any,`
- `server/services/ml/ml-training-job-queue.ts:69` — `private boss: any;`
- `server/services/ml/ml-training-job-queue.ts:70` — `private db: any;`

**Recommended remediation.** Don't paper over with a cast. These are the call sites that should drive Phase 3 work (Result/Either, branded IDs, discriminated unions, shared API envelopes, typed domain errors). Capture the call site in the follow-up task list and resolve it as part of the domain redesign — not as a one-line edit.

## Notes for Phase 3

- **Dynamic JSON payloads** is the bucket most likely to motivate a shared API response envelope and a convention for storing Zod schemas next to `jsonb()` columns. Pick one representative call site (e.g. an OpenAI function-call handler) and design the envelope there before fanning out.
- **Legacy DTOs** below the route layer is the bucket most likely to motivate branded IDs and discriminated unions for workflow states — the same DTOs are often the ones losing identity-type information across service boundaries.
- **Truly unsafe / untyped logic** is the smallest bucket but the highest-leverage. Each occurrence should be inspected by hand and either converted into a typed-pattern task (Result/Either, typed domain error hierarchy) or kept under a tracked exception with a comment explaining why no type fits.
- **Bucket fuzziness.** The classifier prefers path-based rules first (tests/, external-integrations/, adapters/) and then snippet heuristics. Files that look like routes but parse JSON payloads will land in _Dynamic JSON payloads_ rather than _Legacy DTOs_. When triaging follow-ups, re-read the snippet rather than trusting the bucket label blindly.

