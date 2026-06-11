# Repository Wrapper Deprecation Schedule

## Overview

As part of Phase 3 repository modularization (completed December 2025), we've created modular directories for 14 major repositories. The legacy `*.repo.ts` wrapper files are now thin re-export shims maintained for backward compatibility.

## Deprecated Files (Target Removal: Q2 2026)

| Deprecated File                 | Replacement Import                 |
| ------------------------------- | ---------------------------------- |
| `workorders.repo.ts`            | `./workorders/index.js`            |
| `inventory.repo.ts`             | `./inventory/index.js`             |
| `crew.repo.ts`                  | `./crew/index.js`                  |
| `maintenance.repo.ts`           | `./maintenance/index.js`           |
| `system-admin.repo.ts`          | `./system-admin/index.js`          |
| `ml-analytics.repo.ts`          | `./ml-analytics/index.js`          |
| `maintenance-templates.repo.ts` | `./maintenance-templates/index.js` |
| `checklists.repo.ts`            | `./checklists/index.js`            |
| `operating-conditions.repo.ts`  | `./operating-conditions/index.js`  |
| `hub-sync.repo.ts`              | `./hub-sync/index.js`              |
| `logbooks.repo.ts`              | `./logbooks/index.js`              |
| `stormgeo.repo.ts`              | `./stormgeo/index.js`              |
| `digital-twin.repo.ts`          | `./digital-twin/index.js`          |
| `crew-extensions.repo.ts`       | `./crew-extensions/index.js`       |

## Migration Steps

### For New Code

Always import directly from modular directories:

```typescript
// DO THIS - New pattern
import { dbWorkOrdersStorage, memWorkOrdersStorage } from "./workorders/index.js";
import { dbInventoryStorage, InventoryFilters } from "./inventory/index.js";

// DON'T DO THIS - Legacy pattern (deprecated)
import { dbWorkOrdersStorage } from "./workorders.repo.js";
```

### For Existing Code Migration

1. Find all imports from `*.repo.ts` files
2. Update to import from modular `./domain/index.js` instead
3. Verify type exports are still available (types are re-exported from index.ts)

### Verification Command

```bash
# Find deprecated imports that need migration
grep -r "from.*\.repo" server/ --include="*.ts" | grep -v node_modules
```

## Timeline

- **December 2025**: Modularization complete, deprecated wrappers in place
- **January 2026**: Begin migrating existing imports to new patterns
- **March 2026**: Complete migration, add deprecation warnings to wrapper files
- **Q2 2026**: Remove deprecated wrapper files

## Notes

- The deprecated wrappers are thin re-exports (15-25 lines each)
- Backward compatibility is maintained until removal
- All singleton exports work identically through either import path
- Types are available from both import paths
