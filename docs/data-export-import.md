# ARUS Data Export/Import System

This document describes the versioned data export/import system for ARUS Marine Equipment Registry.

## Overview

The data export/import system provides a robust way to:
- **Export** all data for an organization to a portable archive
- **Import** data from older app versions into newer versions
- **Migrate** between deployment modes (vessel SQLite to cloud PostgreSQL)
- **Backup** critical operational data with version tracking

## Features

- **Versioned Manifests**: Every export includes schema version for compatibility checking
- **JSONL Format**: Streaming-friendly newline-delimited JSON for large datasets
- **Org-Scoped**: Full tenant isolation - exports only include data for the specified organization
- **Dual-Mode Support**: Works identically on PostgreSQL (cloud) and SQLite (vessel/desktop)
- **Chunked Telemetry**: Large telemetry datasets are exported in manageable chunks

## Export Format

Exports are created as `.tar.gz` archives with the following structure:

```
export-2025-11-26T12-00-00-abc123.tar.gz
├── manifest.json           # Export metadata & versioning
├── organizations.jsonl     # Organization record
├── vessels.jsonl           # Fleet data
├── equipment.jsonl         # Equipment registry
├── devices.jsonl           # Edge devices
├── users.jsonl             # User accounts
├── crew.jsonl              # Crew members
├── crew_certifications.jsonl
├── crew_assignments.jsonl
├── sensor_configurations.jsonl
├── alert_configurations.jsonl
├── alert_notifications.jsonl
├── maintenance_schedules.jsonl
├── maintenance_records.jsonl
├── work_orders.jsonl
├── work_order_completions.jsonl
├── parts_inventory.jsonl
├── pdm_score_logs.jsonl
├── system_settings.jsonl
├── kb_docs.jsonl           # Knowledge base (optional)
└── telemetry/              # Chunked telemetry (optional)
    ├── equipment_telemetry_chunk_001.jsonl
    └── ...
```

### Manifest Schema

```json
{
  "exportVersion": 2,
  "appVersion": "1.0.0",
  "schemaVersion": "2025-11-26",
  "exportedAt": "2025-11-26T12:00:00.000Z",
  "exportedBy": "admin",
  "deploymentMode": "cloud",
  "scope": {
    "type": "org",
    "orgId": "default-org-id",
    "vesselFilter": null
  },
  "entities": {
    "vessels": { "count": 12, "file": "vessels.jsonl" },
    "equipment": { "count": 180, "file": "equipment.jsonl" }
  },
  "options": {
    "includeTelemetry": true,
    "telemetryDays": 30,
    "includeKnowledgeBase": true
  }
}
```

## API Endpoints

All endpoints require admin authentication via `X-Admin-Token` header and `X-Org-Id` header.

### Export Data

```http
POST /api/admin/export
Content-Type: application/json

{
  "includeTelemetry": false,
  "telemetryDays": 30,
  "includeKnowledgeBase": true
}
```

**Response:**
```json
{
  "success": true,
  "exportId": "export-2025-11-26T12-00-00-abc123",
  "downloadUrl": "/api/admin/export/download/export-2025-11-26T12-00-00-abc123",
  "manifest": { ... },
  "duration": 1234
}
```

### List Exports

```http
GET /api/admin/exports
```

**Response:**
```json
[
  {
    "id": "export-2025-11-26T12-00-00-abc123",
    "createdAt": "2025-11-26T12:00:00.000Z",
    "size": 16118,
    "downloadUrl": "/api/admin/export/download/export-2025-11-26T12-00-00-abc123"
  }
]
```

### Download Export

```http
GET /api/admin/export/download/:exportId
```

Returns the `.tar.gz` file.

### Delete Export

```http
DELETE /api/admin/export/:exportId
```

### Import Data

```http
POST /api/admin/import
Content-Type: multipart/form-data

file: <.tar.gz file>
targetOrgId: new-org-id (optional)
dryRun: true|false (optional)
skipTelemetry: true|false (optional)
conflictResolution: skip|upsert|replace (optional, default: upsert)
```

**Response:**
```json
{
  "success": true,
  "importId": "import-2025-11-26T12-00-00-xyz789",
  "entitiesImported": {
    "vessels": 12,
    "equipment": 180
  },
  "warnings": [],
  "errors": [],
  "duration": 5678
}
```

## CLI Scripts

### Export Data

```bash
# Basic export
npm run export:data -- --org-id=default-org-id

# Export with telemetry
npm run export:data -- --org-id=default-org-id --include-telemetry --telemetry-days=7

# Custom output directory
npm run export:data -- --org-id=default-org-id --out=./backups/

# Direct execution
npx tsx scripts/export-data.ts --org-id=default-org-id --help
```

### Import Data

```bash
# Basic import
npm run import:data -- --file=./data-exports/export-2025-11-26.tar.gz

# Import to different org
npm run import:data -- --file=./export.tar.gz --target-org-id=new-org

# Dry run (preview without changes)
npm run import:data -- --file=./export.tar.gz --dry-run

# Skip telemetry data
npm run import:data -- --file=./export.tar.gz --skip-telemetry

# Change conflict resolution
npm run import:data -- --file=./export.tar.gz --conflict=skip
```

## Upgrade Flow

When upgrading ARUS to a new version:

1. **Export data from old version:**
   ```bash
   npm run export:data -- --org-id=your-org-id --include-telemetry
   ```

2. **Install new version** (apply migrations automatically)

3. **Import data into new version:**
   ```bash
   npm run import:data -- --file=./data-exports/export-2025-11-26.tar.gz
   ```

4. **Verify import:**
   - Check entity counts match
   - Review any warnings
   - Validate critical operational data

## Schema Version Compatibility

The system tracks schema versions to ensure safe imports:

- **Same version**: Direct import, no transforms needed
- **Older export**: Warnings shown, data transforms applied automatically
- **Newer export**: Import blocked with clear error message

### Current Schema Version

The current schema version is `2025-11-26`. This is tracked in:
- `server/services/data-export-import.ts` (CURRENT_SCHEMA_VERSION constant)
- Export manifests (schemaVersion field)

## Conflict Resolution

When importing, conflicts can be handled in three ways:

| Strategy | Behavior |
|----------|----------|
| `skip` | Skip records that already exist |
| `upsert` | Update existing records, insert new ones (default) |
| `replace` | Delete existing and insert fresh |

## Security Considerations

1. **Admin-only access**: All endpoints require `X-Admin-Token`
2. **Org-scoped**: Exports never include data from other organizations
3. **Rate limited**: Critical operations have rate limiting
4. **Audit logged**: All export/import actions are logged
5. **Telemetry tenant isolation**: Multi-layer defense ensures no cross-tenant data leakage:
   - Equipment fetched by org scope
   - Equipment ID set membership validation
   - Direct `orgId` field validation on each telemetry record
   - Records skipped and logged if any validation fails
6. **Schema version guards**: Imports from newer schema versions are rejected
7. **Target org validation**: Imports verify target organization exists before writing
8. **Path traversal protection**: Archive extraction filters block malicious file paths

## Best Practices

1. **Regular exports**: Schedule periodic exports for disaster recovery
2. **Test imports**: Use `--dry-run` to preview before actual import
3. **Exclude telemetry for transfers**: Skip telemetry when moving between environments
4. **Verify counts**: Compare entity counts between export and import
5. **Keep exports**: Retain at least 7 days of exports

## Troubleshooting

### Export fails with timeout
- Exclude telemetry for faster exports
- Reduce telemetry days if included

### Import validation errors
- Check schema version compatibility
- Review manifest for missing entities
- Ensure target org exists

### Partial import
- Use `skip` conflict resolution to continue
- Check warnings for skipped entities
- Re-import specific entities if needed

## Cross-Organization Import

The system supports importing data from one organization into a different target organization. This is useful for:
- Migrating data between test and production environments
- Consolidating data from multiple deployments
- Creating isolated copies for testing

### How Cross-Org Import Works

1. **Target Org Auto-Creation**: If the target org doesn't exist, it's automatically created
2. **New ID Generation**: All entities (vessels, equipment, work orders) get new UUIDs
3. **FK Relationship Remapping**: Foreign key references are updated to point to new IDs
4. **Unmapped FK Handling**: References to entities not in the export are set to null

### Usage

```bash
# Import into a new organization
npm run import:data -- \
  --file=./exports/org-data.tar.gz \
  --target-org-id=new-org-id

# Dry run to preview changes
npm run import:data -- \
  --file=./exports/org-data.tar.gz \
  --target-org-id=new-org-id \
  --dry-run
```

### ID Mapping Flow

```
Source Export          →  Cross-Org Import          →  Target Database
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Equipment ID: abc123   →  New ID: xyz789             →  equipment.id = xyz789
  vesselId: vessel-1   →  Lookup mapping             →  vesselId = new-vessel-id
                          (or NULL if not in export)
Work Order ID: wo-001  →  New ID: wo-new             →  work_orders.id = wo-new
  equipmentId: abc123  →  Remap: abc123 → xyz789     →  equipmentId = xyz789
```

### Cross-Org Limitations

- **Vessel references**: If vessels aren't in the export, equipment `vesselId` is set to null
- **WO number uniqueness**: Work order numbers are regenerated to avoid conflicts
- **Telemetry not remapped**: Large telemetry datasets should be skipped for cross-org imports

---

## Upgrade Safety & Data Migration Patterns

### Schema Version Management

The system uses schema versioning to ensure safe data migrations:

```typescript
// In server/services/data-export-import.ts
const CURRENT_SCHEMA_VERSION = "2025-11-26";
```

**Best practices:**
1. Update `CURRENT_SCHEMA_VERSION` when making breaking schema changes
2. Add data transform logic in `applySchemaTransforms()` for older exports
3. Document schema changes in the manifest

### Adding Data Transforms

When schema changes require data transformation during import:

```typescript
// In data-export-import.ts, add to applySchemaTransforms()
private applySchemaTransforms(record: any, entityName: string, fromVersion: string): any {
  // Transform from 2025-11-01 to 2025-11-26
  if (fromVersion < "2025-11-26" && entityName === "equipment") {
    // Example: Rename field
    if (record.oldFieldName) {
      record.newFieldName = record.oldFieldName;
      delete record.oldFieldName;
    }
    // Example: Add default for new required field
    if (!record.newRequiredField) {
      record.newRequiredField = "default_value";
    }
  }
  return record;
}
```

### Backward-Compatible Schema Changes

When adding new columns or tables:

1. **New columns**: Always provide defaults or make nullable
2. **New tables**: Create without foreign key constraints initially
3. **Renamed columns**: Keep old column as alias during transition period
4. **Type changes**: Never change primary key types (serial ↔ varchar)

### Recommended Upgrade Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│ ARUS Safe Upgrade Flow                                              │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  1. BACKUP: Export from old version                                 │
│     npm run export:data -- --org-id=<org> --include-telemetry       │
│                                                                     │
│  2. VERIFY: Check export integrity                                  │
│     - Review manifest.json for entity counts                        │
│     - Verify no errors in export log                                │
│                                                                     │
│  3. INSTALL: Deploy new version                                     │
│     - Run database migrations (npm run db:push)                     │
│     - Verify application starts                                     │
│                                                                     │
│  4. PREVIEW: Dry run import                                         │
│     npm run import:data -- --file=<export> --dry-run                │
│     - Check for schema version warnings                             │
│     - Review expected entity counts                                 │
│                                                                     │
│  5. IMPORT: Execute import                                          │
│     npm run import:data -- --file=<export> --conflict=upsert        │
│                                                                     │
│  6. VALIDATE: Verify imported data                                  │
│     - Check entity counts match                                     │
│     - Test critical functionality                                   │
│     - Review any warnings                                           │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Architectural Compatibility

### Integration with Existing Systems

The export/import system is designed to work alongside:

| System | Compatibility | Notes |
|--------|---------------|-------|
| MQTT Sync | ✅ Compatible | Export is independent of real-time sync |
| Turso/libSQL | ✅ Compatible | Uses same storage abstraction |
| Multi-tenant | ✅ Compatible | Respects org-id isolation |
| WebSocket | ✅ Compatible | No broadcast during bulk import |
| Cron Jobs | ✅ Compatible | Pause cron during large imports |

### No Conflict with Sync Mechanisms

- Export reads from the authoritative DB for current deployment mode
- Import writes through the standard storage layer (not direct SQL)
- Both operations respect the existing dual-write patterns

### Tenant Isolation Maintained

```
┌────────────────────────────────────────────────────────┐
│ Multi-Layer Tenant Isolation During Import             │
├────────────────────────────────────────────────────────┤
│ 1. Target org validated before any writes              │
│ 2. All records tagged with target org_id               │
│ 3. FK references stay within org boundary              │
│ 4. Cross-org imports create isolated data copies       │
│ 5. No data leakage between organizations               │
└────────────────────────────────────────────────────────┘
```

---

## Limitations

1. **Large telemetry**: Very large telemetry datasets may require chunked processing
2. **Binary attachments**: KB document attachments are exported as references
3. **Cross-version**: Major schema changes may require manual data transforms
4. **Cross-org vessels**: If vessels aren't exported, equipment vesselId becomes null
5. **WO number conflicts**: Cross-org imports regenerate work order numbers
