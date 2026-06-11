# ARUS Style Guide

Short, specific, and about patterns this codebase actually uses. Not generic
advice about what TypeScript is or why tests matter. Things here are
prescriptive because inconsistent patterns cost maintenance time.

## Scope

Applies to `server/`, `client/`, `shared/`. Excludes `src-tauri/` (Rust),
generated code, migrations, data files.

---

## 1. Error handling

### Rule 1.1 — `catch` binding usage

Name the error binding by what you do with it.

| Pattern                                                                 | When to use                                                                                                                             |
| ----------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `catch { ... }`                                                         | You intentionally ignore the error (and maintain behavior). No underscore prefix needed — bare `catch` says this more clearly.          |
| `catch (error) { logger.warn(...); return null; }`                      | You swallow the error but at least log it for diagnostics.                                                                              |
| `catch (error) { throw error; }`                                        | You rethrow. Don't do this — just don't catch. If you need to catch-and-rethrow for cleanup, use `try { ... } finally { ... }` instead. |
| `catch (error) { throw new DomainError("context", { cause: error }); }` | You're wrapping a low-level error with domain context. Good.                                                                            |

The prior `catch (_error) { ... }` idiom with an underscore-prefixed binding is
being phased out — the codemod converts these to bare `catch { ... }`.

### Rule 1.2 — Error types in catch

TypeScript 4.4+ defaults `catch` bindings to `unknown`. Don't fight it.

```ts
// Good
catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  logger.error(LOG_CTX, `Something failed: ${message}`);
}

// Avoid
catch (error: any) {        // defeats the type system
  logger.error(error.message);  // runtime crash if error isn't an Error
}
```

### Rule 1.3 — Never silently swallow errors in paths users care about

Silent error swallowing is acceptable in:

- Non-critical telemetry (running hours sync, RAG ingestion, cache writes)
- Background sync workers where retry will handle it
- Journal/outbox operations where missing one entry is acceptable

Silent error swallowing is NOT acceptable in:

- Anything the user initiated (work order save, import, login)
- Anything that writes to the primary tables (work orders, equipment, parts)
- Anything tied to compliance or audit (STCW, certificates, import manifest)

When in doubt: log at `warn` or `error` level with context, then decide
whether to rethrow.

### Rule 1.4 — Error response shape (HTTP handlers)

Use one shape across the API:

```ts
// Good
res.status(400).json({
  error: "Human-readable message",
  code: "E_VESSEL_AMBIGUOUS",    // optional but encouraged
  details: { candidates: [...] }, // optional
});

// Avoid — inconsistent patterns
res.status(400).json({ message: "...", ok: false });
res.status(400).json({ success: false, error: "..." });
res.status(400).send("error text");
```

Matching shapes let the frontend's `apiRequest` have one error handler, not
four.

---

## 2. Type assertions

### Rule 2.1 — `as any` is debt, not a tool

Each `as any` in the codebase is silencing a question the type system was
trying to answer. Some of those questions don't have good answers (Drizzle
insert value shapes, external JSON parsing), so `as any` is sometimes the
pragmatic choice. But each one is a TODO.

Before adding `as any`, try in order:

1. **A type assertion to a specific type:** `x as EmailQueue`. This at least
   documents what you expect.
2. **A type guard:** `if (isEmailQueue(x)) { ... }`. Best option for runtime
   boundaries where you control the guard logic.
3. **`unknown` with a validator:** `const parsed = schema.parse(json)`. Best
   for external input.
4. **`as any`:** only if the above are genuinely too painful. Leave a TODO.

### Rule 2.2 — `as any` placement

If you must use `as any`, put it at the narrowest point possible.

```ts
// Good — the cast is at the argument, not the whole variable
await db.insert(equipment).values({
  ...cleanData,
  createdAt: new Date(),
} as any);

// Avoid — casts the whole variable forever
const values: any = { ...cleanData, createdAt: new Date() };
await db.insert(equipment).values(values);
```

### Rule 2.3 — The schema-runtime cast-lies

The 203 `as typeof pgSchema.X` casts in `shared/schema-runtime.ts` are a
known structural debt, not individual violations. They're tracked as a
separate workstream (schema unification plan). Don't add new ones without
acknowledging the existing pattern.

---

## 3. Logging

### Rule 3.1 — Use the structured logger

```ts
// Good — at the top of the file:
import { logger } from "../utils/logger";
const LOG_CTX = "EmailWorker";

// Then:
logger.info(LOG_CTX, "Message", { orgId, count });
logger.warn(LOG_CTX, "Message", { reason });
logger.error(LOG_CTX, "Message", { error });

// Avoid
console.log("Email sent"); // not structured, can't be filtered
console.log(LOG_CTX, "Email sent"); // still not structured
console.error(error); // no context
```

`console.log` is currently common in the codebase (~677 occurrences). Not all
need to go, but new code should default to the structured logger.

### Rule 3.2 — Log levels

| Level   | Use for                                                                                  |
| ------- | ---------------------------------------------------------------------------------------- |
| `error` | Something failed that a human should look at. Usually paired with an alert or dashboard. |
| `warn`  | Unexpected but handled. Accumulating `warn`s is a signal something's off.                |
| `info`  | Normal operation milestones. Sync completed. Import finished. Not per-request.           |
| `debug` | Detailed tracing. Off in production. Don't rely on it for diagnostics.                   |

Per-HTTP-request logging goes through middleware, not `logger.info` at route
handlers.

### Rule 3.3 — What not to log

Never log:

- Passwords (ever, in any form)
- Session tokens (redact to first/last 4 chars)
- PII without explicit redaction (names are sometimes ok, emails rarely,
  IMO/passport/licence numbers never)
- Full request bodies (they often contain the above)

The structured logger auto-redacts based on field names, but don't rely on
that for sensitive data. Use explicit redaction at the source.

---

## 4. Database access

### Rule 4.1 — Go through the repository layer

```ts
// Good — route handler calls a service/repo method
const order = await workOrderRepository.create(data);

// Avoid — route handler queries Drizzle directly
const [order] = await db.insert(workOrders).values(data).returning();
```

Exception: ad-hoc diagnostic queries in `/api/admin/*` endpoints. Those can
hit Drizzle directly, but isolate them to the admin surface.

### Rule 4.2 — Always scope by `orgId`

Multi-tenant requires every query to scope by `orgId`. This is non-negotiable
and the source of a whole class of bugs when violated.

```ts
// Good
const [vessel] = await db
  .select()
  .from(vessels)
  .where(and(eq(vessels.id, id), eq(vessels.orgId, orgId)));

// NEVER — will return another tenant's data
const [vessel] = await db.select().from(vessels).where(eq(vessels.id, id));
```

Yes, even if the caller "knows" the ID. The caller might be wrong. The
cheapest check is always adding the `orgId` constraint.

### Rule 4.3 — Transactions for multi-row writes

Any write that touches more than one table, or more than one row in a
user-initiated flow, goes through `db.transaction()`. The SHIPMATE import
Fix #2 is the canonical example.

```ts
// Good
await db.transaction(async (tx) => {
  const [wo] = await tx.insert(workOrders).values(...).returning();
  await tx.insert(workOrderHistory).values({ workOrderId: wo.id, ... });
});

// Avoid — non-atomic
const [wo] = await db.insert(workOrders).values(...).returning();
await db.insert(workOrderHistory).values(...); // can fail mid-way
```

### Rule 4.4 — Never `LIKE '%x%'` on identifier columns

The SHIPMATE vessel resolver bug was `LIKE %name%` on `vessels.name`. Partial
matches on identifier-like columns silently attach data to wrong records.
Use exact match (case-insensitive via `LOWER()` if needed), fail on
ambiguity.

`LIKE` is fine for user-facing search with multiple results presented. Never
for resolving a single target row from a name.

---

## 5. Async patterns

### Rule 5.1 — Sequential awaits are usually a bug

```ts
// Avoid — sequential, waits for each independently
const vessel = await getVessel(id);
const equipment = await getEquipment(id);
const crew = await getCrew(id);

// Better — parallel
const [vessel, equipment, crew] = await Promise.all([getVessel(id), getEquipment(id), getCrew(id)]);
```

Exception: when later calls depend on earlier results.

### Rule 5.2 — Promises in loops

```ts
// Avoid — sequential loop awaits
for (const row of rows) {
  await processRow(row); // processes one at a time
}

// Often better — parallel
await Promise.all(rows.map((row) => processRow(row)));

// Sometimes necessary — bounded parallelism
// Use a small library (p-limit) or write a simple chunker
```

When writing to a database in a loop, sequential is usually what you want
— parallel writes can deadlock on the same index. Sequential is also
required when the order of operations matters.

### Rule 5.3 — No `async` functions that don't `await`

If a function is declared `async` but contains no `await`, remove the
`async`. The keyword changes the caller's contract (they now have to
`await` or get a `Promise`), which is gratuitous complexity for sync code.

---

## 6. React / client

### Rule 6.1 — TanStack Query generics

Every `useQuery` call has an explicit generic:

```ts
// Good
const { data } = useQuery<WorkOrder[]>({
  queryKey: ["/api/work-orders"],
  queryFn: () => fetchWorkOrders(),
});

// Avoid — data is inferred as `never[] | TQueryFnData`,
// which cascades into a wall of errors in downstream code
const { data } = useQuery({
  queryKey: ["/api/work-orders"],
  queryFn: () => fetchWorkOrders(),
});
```

This was a recurring source of error cascades in the bug-fix waves.

### Rule 6.2 — No localStorage/sessionStorage in Claude-authored artifacts

This is a Claude-artifact rule, not a general rule. If Claude generates code
that uses `localStorage`, the artifact will fail silently in the
Claude.ai environment. Use React state or in-memory variables instead. In
production code outside artifacts, localStorage is fine where appropriate.

### Rule 6.3 — Form validation

Use Zod schemas (already the codebase convention) not hand-rolled validation:

```ts
// Good — single source of truth for shape + validation
const formSchema = insertWorkOrderSchema.extend({
  assignedCrewId: z.string().uuid().optional(),
});

// Avoid
function validateForm(data) {
  if (!data.title) return "Title required";
  if (data.title.length < 3) return "Title too short";
  // ... 30 lines of conditionals
}
```

### Rule 6.4 — Component file size

If a component file passes 400 lines, it's a refactor candidate. Not a
hard block — ESLint warns at 400 lines per function for `.tsx` — but
worth noting. Common refactor: split the presentational component from
the data-fetching hook.

---

## 7. File organization

### Rule 7.1 — Domain boundaries

Code lives in one of:

- `server/domains/<name>/` — domain modules (alerts, work-orders, stcw-rest, …)
- `server/db/<name>/` — repository layer, thin wrapper over Drizzle
- `server/services/` — cross-domain services (notification, reporting, …)
- `server/lib/` — utilities, no business logic
- `shared/schema/` — Drizzle schemas, Zod schemas, exported types
- `client/src/features/<name>/` — frontend feature modules
- `client/src/components/` — shared components
- `client/src/pages/` — route-level components

If you're writing something that doesn't fit one of these, you're either
putting it in the wrong place or identifying a new category.

### Rule 7.2 — No imports that cross domain boundaries

```ts
// Good
import { workOrderService } from "../work-orders/service";

// Avoid — client code importing server internals
import { dbWorkOrderStorage } from "@server/db/work-orders/index";

// Avoid — domain importing from another domain's internals
import { cooldownCheck } from "../alerts/cooldown"; // from work-orders
```

Cross-domain communication goes through service or repository interfaces, not
through the other domain's internal files. The `check:guards` chain has a
boundary check that enforces this; don't disable it.

### Rule 7.3 — Dynamic imports

ARUS has three dynamic-import patterns (registry-loader, string-template, and
extension-switching). All of them trip static analysis. Avoid adding new
dynamic imports unless you have a specific reason.

If you must add a dynamic import:

- Use it for genuinely optional features (not for code organization)
- Add the target to the `knip.json` allowlist
- Verify the `scripts/check-route-imports.mjs` smoke check still passes
- Document why the import needs to be dynamic in a comment at the call site

### Rule 7.4 — File naming

- TypeScript files: `kebab-case.ts` (e.g. `email-worker.ts`)
- React components: `PascalCase.tsx` (e.g. `VesselDashboard.tsx`)
- Hooks: `use-kebab-case.ts` (e.g. `use-work-orders.ts`)
- Types-only files: `types.ts` or `<domain>-types.ts`

Consistency is more important than the specific choice. Match the convention
of the directory you're in.

---

## 8. Comments

### Rule 8.1 — Comment the "why", not the "what"

```ts
// Good
// Vessels in production drift up to 2 hours in clock time when their
// GPS lock drops. LWW conflict resolution uses version numbers when
// wall-clock skew exceeds this threshold.
const CLOCK_SKEW_THRESHOLD_MS = 2 * 60 * 60 * 1000;

// Avoid
// 2 hours in milliseconds
const CLOCK_SKEW_THRESHOLD_MS = 2 * 60 * 60 * 1000;
```

### Rule 8.2 — TODO comments link to issues

```ts
// Good
// TODO(ARUS-1234): Replace with streaming parser once SHIPMATE
// sample export is available
const csv = fs.readFileSync(path, "utf8");

// Avoid
// TODO: fix this later
const csv = fs.readFileSync(path, "utf8");
```

If the issue doesn't exist yet, create it before writing the TODO. A TODO
without a tracked issue becomes archaeological debris.

### Rule 8.3 — No commented-out code

Delete it. Git preserves history. Commented-out code accumulates and future
readers won't know if it's "draft" or "deleted but might come back."

The one exception: comments that demonstrate a known-bad pattern for
teaching purposes, always clearly marked:

```ts
// Example of the LIKE bug that caused the SHIPMATE vessel resolver
// incident in pre-deployment. DO NOT use this pattern:
//
//   LOWER(${vessels.name}) LIKE LOWER(${'%' + vesselName + '%'})
//
// Use exact match instead — see resolveVesselId() below.
```

---

## 9. Testing

### Rule 9.1 — Tests are load-bearing

ARUS has 337 unit tests. They're the safety net during refactors. Don't
skip them. Don't mark them as `.skip`. If a test is genuinely wrong, fix
the test in a separate commit that's clearly reviewable, not hidden in a
feature change.

### Rule 9.2 — Test naming

`describe("<subject under test>", () => { it("<expected behavior>", ...) })`
where the `it` sentence reads as "it <behavior>":

```ts
// Good
describe("SHIPMATE vessel resolver", () => {
  it("returns the vessel ID on exact name match", ...);
  it("throws VesselResolutionError when the name is ambiguous", ...);
  it("throws VesselResolutionError when the name is not found", ...);
});

// Avoid
describe("resolver test", () => {
  it("works", ...);
  it("test 2", ...);
});
```

### Rule 9.3 — Test the boundary, not the implementation

Tests that mock every internal call to prove the implementation matches the
test author's mental model are brittle. Test the observable behavior:
inputs in, outputs out, side effects visible.

---

## 10. Things to avoid entirely

- **`eval()`, `new Function()`** — never.
- **`process.exit()` in non-CLI code** — crashes the whole server.
- **Synchronous file I/O in request handlers** — blocks the event loop.
- **`any` in public API surfaces** (exported types, route response shapes).
  Internal `any` is debt; external `any` is a bug.
- **Catching `TypeError` to hide runtime bugs** — fix the bug.
- **Relying on JavaScript number precision for financial math** — use the
  existing `formatCurrency` helpers and integer-cents storage.

---

## Adopting this guide

- **New code:** follow it from now on.
- **Existing code:** retrofit opportunistically when you're in the file
  for other reasons. Don't make a "style sweep" PR — diffs that only
  reformat are hard to review and collide with everyone else's work.
- **Enforcement:** the hygiene dashboard (`scripts/hygiene-dashboard.mjs`)
  tracks the mechanical signals. The ESLint rules enforce what they can.
  The rest is reviewer discipline.

## Revision

This guide is v1. It'll need updates as the codebase evolves. Treat it
like the runbook — draft state, improves with real feedback, lives or
dies based on whether people actually read it.
