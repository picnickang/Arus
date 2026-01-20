# Schema Synchronization Guide

## Problem

ARUS uses a **dual-schema architecture** for maximum compatibility:

- **Cloud Mode**: PostgreSQL with Drizzle ORM (`shared/schema.ts`)
- **Vessel/Desktop Mode**: SQLite with Drizzle ORM (`shared/schema-sqlite-vessel.ts` + `server/sqlite-init.ts`)

The challenge: keeping these schemas synchronized manually is error-prone.

**Recent Example**: We discovered 28 column mismatches across equipment, vessels, and ml_models tables.

---

## Current Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  CLOUD MODE (PostgreSQL)                                    │
│  ─────────────────────────                                  │
│  shared/schema.ts (Drizzle) → Drizzle generates SQL         │
│  Used by: Replit, Render deployments                        │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  VESSEL/DESKTOP MODE (SQLite)                               │
│  ───────────────────────────────                            │
│  1. shared/schema-sqlite-vessel.ts (Drizzle schema)         │
│     - Type definitions for TypeScript                       │
│     - Used by application code                              │
│                                                              │
│  2. server/sqlite-init.ts (Raw SQL)                         │
│     - CREATE TABLE statements                               │
│     - Used to initialize database                           │
│     - ⚠️  MUST be kept in sync with schema-sqlite-vessel.ts │
│                                                              │
│  Used by: Electron macOS app, vessel deployments            │
└─────────────────────────────────────────────────────────────┘
```

---

## Synchronization Process

### When to Sync

Sync schemas whenever you modify database structure:

- ✅ Adding a new table
- ✅ Adding/removing columns
- ✅ Changing column types
- ✅ Modifying constraints (NOT NULL, DEFAULT, etc.)
- ✅ Adding/removing indexes

### Step-by-Step Process

#### 1. Make Changes to Cloud Schema First

```typescript
// shared/schema.ts (PostgreSQL)
export const equipment = pgTable("equipment", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  // ... existing columns ...
  newColumn: varchar("new_column", { length: 100 }), // ← NEW COLUMN
});
```

#### 2. Mirror to SQLite Drizzle Schema

```typescript
// shared/schema-sqlite-vessel.ts
export const equipmentSqlite = sqliteTable("equipment", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  // ... existing columns ...
  newColumn: text("new_column"), // ← MIRROR THE CHANGE
});
```

#### 3. Update Raw SQL Init File

```sql
-- server/sqlite-init.ts
CREATE TABLE IF NOT EXISTS equipment (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  -- ... existing columns ...
  new_column TEXT  -- ← ADD TO SQL
);
```

#### 4. Don't Forget ALTER TABLE for Migrations

If this is an existing table, add migration SQL:

```sql
-- At the end of server/sqlite-init.ts
-- Add migration for new column (safe for existing databases)
db.run(`
  ALTER TABLE equipment 
  ADD COLUMN new_column TEXT
`).catch(() => {
  // Column might already exist, ignore error
});
```

#### 5. Run Validation

```bash
npx tsx scripts/validate-schema-sync.ts
```

This catches missing tables early!

---

## Type Mapping Reference

| PostgreSQL (shared/schema.ts) | SQLite (schema-sqlite-vessel.ts) | SQL (sqlite-init.ts) |
|------------------------------|----------------------------------|---------------------|
| `varchar(n)` | `text()` | `TEXT` |
| `uuid()` | `text()` | `TEXT` |
| `serial()` | `integer()` | `INTEGER PRIMARY KEY AUTOINCREMENT` |
| `integer()` | `integer()` | `INTEGER` |
| `real()` | `real()` | `REAL` |
| `boolean()` | `integer()` | `INTEGER` (0/1) |
| `timestamp()` | `integer()` | `INTEGER` (Unix timestamp) |
| `json()` | `text()` | `TEXT` (JSON string) |
| `text[]` (array) | `text()` | `TEXT` (JSON array) |

---

## Common Patterns

### Adding a Nullable Column

```typescript
// 1. PostgreSQL schema
columnName: varchar("column_name", { length: 255 }),

// 2. SQLite Drizzle schema
columnName: text("column_name"),

// 3. SQLite SQL
column_name TEXT,

// 4. Migration (if needed)
ALTER TABLE table_name ADD COLUMN column_name TEXT;
```

### Adding a NOT NULL Column with Default

```typescript
// 1. PostgreSQL schema
columnName: varchar("column_name", { length: 255 }).notNull().default("default_value"),

// 2. SQLite Drizzle schema
columnName: text("column_name").notNull().default("default_value"),

// 3. SQLite SQL
column_name TEXT NOT NULL DEFAULT 'default_value',

// 4. Migration
ALTER TABLE table_name ADD COLUMN column_name TEXT NOT NULL DEFAULT 'default_value';
```

### Adding a Foreign Key

```typescript
// 1. PostgreSQL schema
vesselId: uuid("vessel_id").references(() => vessels.id),

// 2. SQLite Drizzle schema
vesselId: text("vessel_id").references(() => vesselsSqlite.id),

// 3. SQLite SQL
vessel_id TEXT REFERENCES vessels(id),
```

---

## Validation Tools

### Automated Validation Script

```bash
# Run before committing
npx tsx scripts/validate-schema-sync.ts
```

This checks:
- ✅ All Drizzle tables exist in SQL
- ✅ No extra tables in SQL
- ⚠️  Does NOT check column-level sync (manual review required)

### Manual Verification

Use these queries to verify synchronization:

```sql
-- List all tables in SQLite
SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;

-- Show table structure
PRAGMA table_info(table_name);

-- Count columns
SELECT COUNT(*) FROM pragma_table_info('table_name');
```

---

## Future Automation (Roadmap)

### Phase 1: Enhanced Validation (Current)
- ✅ Table-level drift detection
- 📋 TODO: Column-level validation
- 📋 TODO: Type mismatch detection

### Phase 2: Semi-Automated Generation
- 📋 Generate ALTER TABLE migrations from schema changes
- 📋 Drizzle schema → SQL generator

### Phase 3: Full Automation
- 📋 Use Drizzle migrations for SQLite (eliminate raw SQL)
- 📋 Single source of truth for all deployment modes
- 📋 Automated CI/CD schema validation

---

## Best Practices

### ✅ DO

- Always update all three files together (PostgreSQL schema, SQLite schema, SQLite SQL)
- Run validation script before committing
- Add ALTER TABLE migrations for existing tables
- Document breaking schema changes in commit messages
- Test on both cloud and desktop modes

### ❌ DON'T

- Don't change only one schema file
- Don't skip validation
- Don't forget to handle existing data
- Don't use PostgreSQL-specific types in SQLite schema
- Don't commit without testing both modes

---

## Troubleshooting

### "Table already exists" Error

```sql
-- Use IF NOT EXISTS
CREATE TABLE IF NOT EXISTS table_name (...);
```

### "Column already exists" Error

```sql
-- Catch and ignore
db.run(`ALTER TABLE table_name ADD COLUMN ...`).catch(() => {});
```

### Validation Failed

1. Check the validation output for missing tables
2. Compare file line counts: `wc -l shared/schema-sqlite-vessel.ts server/sqlite-init.ts`
3. Search for recently added tables in Drizzle schema
4. Add missing CREATE TABLE statements to sqlite-init.ts

---

## Getting Help

- Review recent schema changes: `git log -p shared/schema*.ts server/sqlite-init.ts`
- Check example: See the "28 column fix" commit (November 2025)
- Ask for clarification if unsure about type mappings

---

**Last Updated**: November 18, 2025  
**Author**: ARUS Development Team  
**Related**: See `scripts/validate-schema-sync.ts` for automated validation
