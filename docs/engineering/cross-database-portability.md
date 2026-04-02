# Cross-Database Portability Engineering Rules

> ARUS dual-mode deployment: **PostgreSQL** (cloud/shore) + **SQLite via libSQL/Turso** (vessel/desktop).
> These rules prevent future development from accidentally introducing PG-only patterns
> that break the vessel/desktop SQLite deployment path.

---

## Architecture Context

ARUS maintains two parallel schema sets:

| Concern | PostgreSQL | SQLite |
|---------|-----------|--------|
| Schema directory | `shared/schema/` | `shared/sqlite-schema/` |
| Table builder | `pgTable` (drizzle-orm/pg-core) | `sqliteTable` (drizzle-orm/sqlite-core) |
| Base file | `shared/schema/base.ts` | `shared/sqlite-schema/base.ts` |
| Runtime switcher | `shared/schema-runtime.ts` — exports correct table per `LOCAL_MODE` env var |
| DB config | `server/db-config.ts` — Neon/node-postgres (cloud) or libSQL (vessel) |
| Drizzle config | `drizzle.config.ts` — PostgreSQL only (used for cloud migrations) |

The `schema-runtime.ts` file uses ternary exports for each table:
```typescript
export const workOrders = isLocalMode
  ? sqliteVessel.workOrdersSqlite
  : pgSchema.workOrders;
```

Tables that only exist in cloud mode are guarded:
```typescript
export const ragConversations = IS_POSTGRES ? pgSchema.ragConversations : undefined as any;
```

---

## Rule 1: Primary Key Strategy — UUID Text, Not Serial

**Rule:** All new tables MUST use `text`/`varchar` primary keys with UUID default values.
Never use `serial` (PostgreSQL auto-increment) for new tables.

**Why:** SQLite has no `serial` type. It uses `INTEGER PRIMARY KEY AUTOINCREMENT`, which
is semantically different and breaks cross-database sync (IDs generated on vessel
conflict with IDs generated on cloud).

### Correct (portable)

PostgreSQL side:
```typescript
// shared/schema/my-table.ts
id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
```

SQLite side:
```typescript
// shared/sqlite-schema/my-table.ts
id: text("id").primaryKey(),
// UUID generated in application code before insert
```

### Incorrect (PG-only)
```typescript
id: serial("id").primaryKey(),  // BREAKS SQLite
```

### Shared column builder (preferred)
```typescript
import { uuidPrimaryKey } from "./base";
const myTable = pgTable("my_table", {
  ...uuidPrimaryKey(),
  // ...
});
```

---

## Rule 2: Timestamp Handling — PG `timestamp` vs SQLite `integer`

**Rule:** PostgreSQL schemas use `timestamp("col", { mode: "date" })`.
SQLite schemas use `integer("col", { mode: "timestamp" })` (Unix epoch storage).
Application code must handle both representations.

### Correct mapping

| PostgreSQL | SQLite | JS type |
|-----------|--------|---------|
| `timestamp("created_at", { mode: "date" }).defaultNow()` | `integer("created_at", { mode: "timestamp" })` | `Date` |

### Gotcha: Default values

PostgreSQL uses `defaultNow()` which maps to `NOW()`. SQLite has no equivalent —
defaults must be applied in application code or via a `DEFAULT (strftime('%s','now'))` raw SQL.

### Incorrect
```typescript
// In SQLite schema — this will silently produce wrong data
createdAt: text("created_at").default("now"),  // String, not epoch
```

---

## Rule 3: Boolean Columns — PG `boolean` vs SQLite `integer`

**Rule:** PostgreSQL schemas use `boolean("col")`.
SQLite schemas use `integer("col", { mode: "boolean" })`.
Drizzle handles the mapping automatically — no application-level conversion needed.

### Correct mapping

| PostgreSQL | SQLite |
|-----------|--------|
| `boolean("is_active").default(true)` | `integer("is_active", { mode: "boolean" }).default(true)` |

### Incorrect
```typescript
// In SQLite schema — loses semantic meaning and Drizzle won't coerce
isActive: integer("is_active").default(1),  // No mode: "boolean"
```

---

## Rule 4: JSON Fields — PG `jsonb` vs SQLite `text`

**Rule:** PostgreSQL uses `jsonb("col")`. SQLite stores JSON as `text("col")`.
Application code that reads JSON from SQLite must parse the string.

### Correct mapping

PostgreSQL:
```typescript
specifications: jsonb("specifications"),
```

SQLite:
```typescript
specifications: text("specifications"),
// Use sqliteJsonHelpers.parseJson() when reading
```

### Helper utilities (shared/sqlite-schema/base.ts)
```typescript
import { sqliteJsonHelpers } from "./base";
const parsed = sqliteJsonHelpers.parseJson<MyType>(row.specifications);
const serialized = sqliteJsonHelpers.stringifyJson(data);
```

### Incorrect
```typescript
// In SQLite schema — jsonb does not exist in SQLite
specifications: jsonb("specifications"),  // IMPORT ERROR
```

---

## Rule 5: Array Columns — PG `text().array()` vs SQLite `text`

**Rule:** PostgreSQL uses `.array()` on column types (e.g., `text("tags").array()`).
SQLite has no array type — use `text` and store as JSON-serialized strings.

### Correct mapping

PostgreSQL:
```typescript
requiredSkills: text("required_skills").array(),
```

SQLite:
```typescript
requiredSkills: text("required_skills"),
// Stored as '["welding","electrical"]'
// Use sqliteJsonHelpers.parseArray() to read
```

### Incorrect
```typescript
// In SQLite schema — .array() is a PG-only method
requiredSkills: text("required_skills").array(),  // RUNTIME ERROR
```

---

## Rule 6: Vector Columns — PostgreSQL Only

**Rule:** `vector("col", { dimensions: N })` is PostgreSQL-only (pgvector extension).
Tables using vector columns (RAG, knowledge base embeddings) must be marked as
**cloud-only** in `schema-runtime.ts`.

### Cloud-only guard pattern
```typescript
// schema-runtime.ts
export const kbChunks = IS_POSTGRES ? pgSchema.kbChunks : undefined as any;
```

Any code accessing cloud-only tables must check `IS_POSTGRES` before use.

---

## Rule 7: Numeric/Decimal Precision — PG `numeric` vs SQLite `real`

**Rule:** PostgreSQL `numeric(precision, scale)` provides exact decimal arithmetic.
SQLite `real` is IEEE 754 double precision (approximate). For financial/metric fields
requiring exact precision, the SQLite schema should use `integer` (store cents) or
`text` (store string decimals) with application-level conversion.

### Correct mapping (financial)

PostgreSQL:
```typescript
dayRateSgd: numeric("day_rate_sgd", { precision: 10, scale: 2 }),
```

SQLite:
```typescript
dayRateSgd: real("day_rate_sgd"),
// Acceptable for display-only fields on vessel
// For financial calculations, use integer cents
```

---

## Rule 8: Index Strategy — Portable vs PG-Only

**Rule:** Standard B-tree indexes (`index("name").on(col)`) are portable.
GIN, GiST, full-text search (`to_tsvector`), and expression indexes are
PostgreSQL-only and must not appear in SQLite schemas.

### Portable (both databases)
```typescript
// Drizzle index builder — works on both PG and SQLite
(table) => ({
  orgIdx: index("idx_my_table_org").on(table.orgId),
})
```

### PG-only (cloud schema only)
```typescript
// Full-text search — PostgreSQL GIN index
searchIdx: sql`CREATE INDEX ... USING gin(to_tsvector('english', name || ...))`,
```

### Rule: Never put raw `sql` index expressions in SQLite schema definitions.

---

## Rule 9: Foreign Key Constraints

**Rule:** PostgreSQL enforces foreign keys by default. SQLite requires
`PRAGMA foreign_keys=ON` (already set in `server/db-config.ts`).

Drizzle's `.references()` works on both, but the SQLite schemas currently omit
`.references()` calls and rely on application-level integrity. This is intentional
for vessel deployments where referenced tables may not have synced yet.

### PG schema (strict references)
```typescript
equipmentId: varchar("equipment_id").notNull().references(() => equipment.id),
```

### SQLite schema (no FK references)
```typescript
equipmentId: text("equipment_id").notNull(),
// No .references() — data may arrive out of order during sync
```

### `onDelete: "cascade"` — PG only

Cascade deletes work in PG but are not defined in SQLite schemas. Application
code handling deletes must manually cascade when `IS_SQLITE` is true.

---

## Rule 10: Enum Patterns — Text with Zod Validation

**Rule:** ARUS does not use PostgreSQL `pgEnum`. Enum-like fields use `text("col")`
with Zod validation on insert schemas. This is already portable.

### Correct (current pattern)
```typescript
// Schema
status: text("status").notNull().default("scheduled"),

// Zod insert schema
status: z.enum(["scheduled", "in_progress", "completed", "cancelled"]).default("scheduled"),
```

### Incorrect (would break SQLite)
```typescript
import { pgEnum } from "drizzle-orm/pg-core";
const statusEnum = pgEnum("status", ["open", "closed"]);
status: statusEnum("status"),  // PG-only, no SQLite equivalent
```

---

## Rule 11: CHECK Constraints

**Rule:** PostgreSQL `CHECK` constraints defined via raw SQL are not portable.
Use Zod validation on insert schemas instead.

### Current PG usage (inventory.ts)
```typescript
// PG-only CHECK constraints
validReservedQuantity: sql`CHECK (quantity_reserved <= quantity_on_hand)`,
nonNegativeOnHand: sql`CHECK (quantity_on_hand >= 0)`,
```

These do not exist in the SQLite schema — validation is at the application layer.

---

## Rule 12: Unique Constraints

**Rule:** Drizzle's `unique("name").on(col1, col2)` is portable. Raw SQL
`ALTER TABLE ... ADD CONSTRAINT` is PG-only syntax.

### Portable
```typescript
import { unique } from "./base";
uniqueWoEquipment: unique("uq_work_order_equipment").on(table.workOrderId, table.equipmentId),
```

### PG-only (avoid in shared code)
```typescript
sql`ALTER TABLE ${table} ADD CONSTRAINT unique_supplier_code_org UNIQUE (${table.orgId}, ${table.code})`,
```

---

## Rule 13: Transaction Isolation

**Rule:** PostgreSQL supports `SERIALIZABLE`, `REPEATABLE READ`, `READ COMMITTED`.
SQLite supports `DEFERRED`, `IMMEDIATE`, `EXCLUSIVE`.

Application code must not hardcode PG-specific isolation levels. Use Drizzle's
`.transaction()` without specifying isolation, or gate isolation level on `IS_POSTGRES`.

---

## Rule 14: Migration Discipline

**Rule:** PostgreSQL migrations live in `./migrations/` (managed by drizzle-kit).
SQLite schema changes are applied via `server/sqlite-init.ts` which creates
tables from the Drizzle schema definitions.

When adding a new table:
1. Create PG schema in `shared/schema/<domain>.ts`
2. Create SQLite schema in `shared/sqlite-schema/<domain>.ts`
3. Add ternary export in `shared/schema-runtime.ts`
4. Run `npm run db:push` for PG
5. SQLite tables auto-create on next vessel startup via `sqlite-init.ts`

---

## Rule 15: New Table Checklist

Before merging any PR that adds or modifies a table:

- [ ] PG schema file updated (`shared/schema/`)
- [ ] SQLite schema file updated (`shared/sqlite-schema/`) — or explicitly marked cloud-only
- [ ] `schema-runtime.ts` ternary export added
- [ ] No `serial` PKs — use `varchar`/`text` with UUID
- [ ] No `pgEnum` — use `text` + Zod
- [ ] No `.array()` in SQLite — use `text` (JSON-serialized)
- [ ] No `jsonb` in SQLite — use `text`
- [ ] No `vector` in SQLite — mark cloud-only
- [ ] No raw SQL indexes in SQLite (GIN, GiST, full-text)
- [ ] `boolean` uses `{ mode: "boolean" }` in SQLite
- [ ] `timestamp` uses `{ mode: "timestamp" }` in SQLite
- [ ] Foreign key references omitted in SQLite schema (sync-safe)
- [ ] Zod insert schema validates enums and constraints

---

## Rule 16: Testing Requirements

Every schema or storage-layer change touching dual-mode tables must pass these gates:

### 16.1 Schema Parity Smoke Test

Before merging, manually verify that both PG and SQLite schemas for the affected
table define the same logical columns (accounting for type mapping rules above).
Run a diff of column names between `shared/schema/<domain>.ts` and
`shared/sqlite-schema/<domain>.ts` for any modified table.

### 16.2 Insert/Read Parity Tests

For any new or modified table that exists in both modes, write a test (or manually
verify) that:

1. **UUID PK generation:** Insert a row with an app-generated UUID into both schemas.
   Confirm the ID round-trips correctly.
2. **Timestamp fields:** Insert a `Date` value. Read it back. Confirm both PG
   (`timestamp` → `Date`) and SQLite (`integer` epoch → `Date`) produce the same
   JS `Date` object.
3. **Boolean fields:** Insert `true`/`false`. Read back. Confirm PG returns
   `boolean` and SQLite returns `boolean` (not `0`/`1`).
4. **JSON fields:** Insert a complex object. Read back via `jsonb` (PG) and
   `text` + `sqliteJsonHelpers.parseJson()` (SQLite). Confirm structural equality.
5. **Array fields:** Insert a string array. Read back via `.array()` (PG) and
   `text` + `sqliteJsonHelpers.parseArray()` (SQLite). Confirm array equality.

### 16.3 Cloud-Only Table Guard Tests

For any table marked cloud-only in `schema-runtime.ts`:

1. Set `LOCAL_MODE=true` in the test environment.
2. Attempt to access the table export.
3. Confirm access throws or returns `undefined` (current behavior) rather than
   silently succeeding with wrong data.

### 16.4 Dual-DB Test Matrix (Recommended for CI)

When CI infrastructure supports it, the following matrix should run:

| Test target | DATABASE_URL | LOCAL_MODE | Expected |
|------------|-------------|------------|----------|
| Cloud mode | PostgreSQL connection | `false` | All PG schemas operational |
| Vessel mode | (none) | `true` | SQLite schemas operational, cloud-only tables guarded |

### 16.5 Schema-Runtime Consistency Check

Periodically verify that every table exported by `schema-runtime.ts` has a valid
ternary (PG branch and SQLite/guard branch). A simple grep-based check:

```bash
grep -c "IS_POSTGRES\|isLocalMode" shared/schema-runtime.ts
```

The count should match the number of exported table constants.

---

## Automation Status

The following automation is **deferred** from this task (documentation-only scope):

| Automation | Status | Follow-up |
|-----------|--------|-----------|
| ESLint rule banning `serial()` imports in new schema files | Deferred | Create custom ESLint plugin or `no-restricted-imports` rule |
| CI schema parity check (PG vs SQLite column name diff) | Deferred | Shell script comparing column names across schema pairs |
| Automated dual-DB test matrix in CI | Deferred | Requires CI pipeline with both PG and SQLite test databases |
| Pre-commit hook for `schema-runtime.ts` ternary validation | Deferred | Script to verify every table export has both branches |

These should be tracked as separate engineering tasks and implemented incrementally.

---

## Appendix A: Current Violations Audit

### A.1 Serial Primary Keys (Breaking — prevents SQLite sync)

The following PG tables use `serial("id").primaryKey()` instead of UUID:

| File | Tables |
|------|--------|
| `shared/schema/core.ts` | `metricsHistory`, `dbSchemaVersion` |
| `shared/schema/telemetry.ts` | `rawTelemetry` (line 139) |
| `shared/schema/ml-analytics-core.ts` | `modelVersions`, `modelAccuracyHistory`, `trainingJobs`, `featureEngineering`, `hyperparameterSets` |
| `shared/schema/ml-analytics-advanced.ts` | `realTimePredictions`, `calibrationCurves`, `sensorFusionSnapshots`, `acousticEvents`, `featureImportances`, `modelDeployments`, `modelDriftDetection`, `retrainingTriggers`, `thresholdOptimizations` |
| `shared/schema/insights.ts` | `dailyMetricRollups` |
| `shared/schema/iot-edge.ts` | `sensorCalibrationRecords` |

**Impact:** These tables cannot participate in bidirectional sync. The SQLite schemas
define equivalent tables with `text("id").primaryKey()` to work around this, but
IDs are incompatible between the two databases.

**Severity:** Breaking for sync; non-blocking for cloud-only tables.

### A.2 JSONB in PG Without SQLite Text Equivalent (Cosmetic)

All `jsonb` columns in PG schemas have corresponding `text` columns in SQLite schemas.
This is correctly handled throughout the codebase. No violations found.

### A.3 Array Columns in PG Without SQLite Text Equivalent (Cosmetic)

All `.array()` columns in PG schemas have corresponding plain `text` columns in SQLite schemas.
This is correctly handled. No violations found.

### A.4 PG-Only Index Patterns (Non-breaking)

| File | Pattern |
|------|---------|
| `shared/schema/inventory.ts:103` | `USING gin(to_tsvector(...))` — full-text search index |
| `shared/schema/inventory.ts:60` | `ALTER TABLE ... ADD CONSTRAINT` via raw SQL |

**Impact:** These only run during PG migration. SQLite schemas define separate,
simpler indexes. Not a portability break since indexes are schema-specific.

### A.5 Vector Columns (Correctly Guarded)

`shared/schema/rag.ts` uses `vector("col", { dimensions: 384 })` for embedding storage.
All vector-using tables are correctly guarded as cloud-only in `schema-runtime.ts`.
No violation.

### A.6 Numeric Precision (Minor)

`shared/schema/vessels.ts` and `shared/schema/ml-analytics-core.ts` use `numeric(precision, scale)`.
SQLite equivalents use `real` (approximate). This is acceptable for vessel-side
display but could cause rounding differences in financial calculations synced
between cloud and vessel.

**Severity:** Minor — vessel-side values are display-only.

### A.7 CHECK Constraints (Non-portable, Correctly Separated)

`shared/schema/inventory.ts` defines CHECK constraints via raw SQL for `partsInventory`.
These are PG-only and not replicated in SQLite. Validation is handled by Zod at
the application layer.

**Severity:** Cosmetic — application validation covers the gap.

### A.8 Cloud-Only Tables Using `undefined as any` Guard (Technical Debt)

`schema-runtime.ts` uses `undefined as any` for ~30 cloud-only tables. This
suppresses TypeScript errors but means any accidental access in vessel mode
produces a runtime error with an unhelpful `Cannot read properties of undefined` message.

**Recommendation:** Replace with a `cloudOnlyProxy()` helper that throws a descriptive
error: `"Table X is cloud-only and not available in vessel mode"`.

### A.9 Schema Column Drift Between PG and SQLite (Informational)

Some tables have minor column differences between PG and SQLite definitions:

| Table | PG column | SQLite equivalent | Difference |
|-------|----------|-------------------|------------|
| `maintenance_records` | `performedBy`, `cost` | `technician`, `laborHours`, `downtimeMinutes` | Different column names/structure |
| `work_order_completions` | `completedBy: varchar` | `completedBy: text` + extra fields | SQLite has additional vessel-specific fields |
| `maintenance_costs` | has `orgId` FK | no `orgId` column | Missing tenant isolation |

**Impact:** Sync logic must handle column mapping between PG and SQLite representations.
This is by design (vessel schemas are optimized for offline operation) but increases
maintenance burden when adding new fields.

---

## Appendix B: SQL Feature Whitelist/Blacklist

### Allowed in Both (Whitelist)
- `SELECT`, `INSERT`, `UPDATE`, `DELETE`
- `JOIN` (INNER, LEFT, RIGHT via subquery)
- `WHERE`, `ORDER BY`, `LIMIT`, `OFFSET`
- `GROUP BY`, `HAVING`
- `COUNT`, `SUM`, `AVG`, `MIN`, `MAX`
- `COALESCE`, `CASE WHEN`
- `LIKE`, `IN`, `BETWEEN`
- `CREATE INDEX ... ON` (standard B-tree)
- `BEGIN`, `COMMIT`, `ROLLBACK`
- `RETURNING` clause (SQLite 3.35+ / libSQL supports this)
- `ON CONFLICT ... DO UPDATE` (UPSERT — SQLite 3.24+ / libSQL supports this)
- `ON CONFLICT ... DO NOTHING`
- `WINDOW` functions with `PARTITION BY`, `ROW_NUMBER`, `RANK` (SQLite 3.25+)
- `CAST(expr AS type)`
- `INSERT OR REPLACE` (SQLite), `ON CONFLICT DO UPDATE` (both)
- `CURRENT_TIMESTAMP` (literal, not function — works in both)
- `->>` JSON extract operator (SQLite 3.38+ / libSQL supports this)

### PostgreSQL Only (Blacklist for Portable Code)
- `jsonb` operators beyond `->>`: `->` (returns jsonb), `@>`, `?`, `?|`, `?&`
- `ARRAY` operators (`ANY`, `ALL`, `@>`, `<@`)
- `LATERAL JOIN`
- `MATERIALIZED VIEW`
- `LISTEN`/`NOTIFY`
- `COPY` command
- `EXPLAIN ANALYZE` (SQLite uses `EXPLAIN QUERY PLAN`)
- `CREATE INDEX ... USING gin/gist/brin`
- `ALTER TABLE ... ADD CONSTRAINT`
- `gen_random_uuid()` (SQLite: generate in app code via `crypto.randomUUID()`)
- `NOW()` as a function call (SQLite: use `datetime('now')` or `strftime`)
- Type casts with `::` syntax (use `CAST()` instead)
- `INTERVAL` arithmetic (use app-layer date math)
- `DISTINCT ON` (use `GROUP BY` + window function instead)
- `FOR UPDATE` / `FOR SHARE` (row-level locking — SQLite uses file-level locking)
- `TRUNCATE` (use `DELETE FROM` in portable code)
- `pgEnum` type definitions
- `serial` / `bigserial` auto-increment types

### Version-Dependent (Use with Caution)

The following features work in modern SQLite/libSQL but may not be available in
older embedded SQLite versions. ARUS uses libSQL via Turso, which supports all of these:

| Feature | Minimum SQLite version | libSQL status |
|---------|----------------------|---------------|
| `RETURNING` | 3.35.0 (2021-03) | Supported |
| `UPSERT` (`ON CONFLICT DO UPDATE`) | 3.24.0 (2018-06) | Supported |
| Window functions | 3.25.0 (2018-09) | Supported |
| `->>`  JSON extract | 3.38.0 (2022-02) | Supported |
| `STRICT` tables | 3.37.0 (2021-11) | Supported |
| `RIGHT JOIN` / `FULL OUTER JOIN` | 3.39.0 (2022-09) | Supported |
