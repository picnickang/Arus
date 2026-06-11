# Inventory Overhaul Notes

## Architecture Analysis

### Frontend Entry Points

**Main Inventory Page**: `client/src/pages/inventory-management.tsx`

- 1646 lines - comprehensive parts management UI
- Uses React Query for data fetching
- Current filtering: client-side search, category, and stock status filters
- No virtualization - renders all items in a standard HTML table
- Sorting handled client-side via `useMemo`

**Key Components Used**:

- `@/components/ui/table` - Standard shadcn table (not virtualized)
- `@/components/ResponsiveDialog` - Modal dialogs for part editing
- `@tanstack/react-query` - Data fetching
- `react-hook-form` + Zod - Form validation

### API Endpoints

| Endpoint                               | Method | Purpose                        |
| -------------------------------------- | ------ | ------------------------------ |
| `/api/parts-inventory`                 | GET    | List all parts with stock info |
| `/api/parts-inventory`                 | POST   | Create new part                |
| `/api/parts-inventory/:id`             | PUT    | Update part                    |
| `/api/parts-inventory/:id`             | DELETE | Delete part                    |
| `/api/parts-inventory/:id/stock`       | PATCH  | Update stock levels            |
| `/api/parts-inventory/:id/cost`        | PATCH  | Update cost                    |
| `/api/inventory/substitutions/:partNo` | GET    | Find part substitutes          |
| `/api/inventory/optimize`              | POST   | EOQ optimization               |
| `/api/inventory/optimize/auto`         | POST   | Auto-optimize with history     |
| `/api/inventory/suppliers/performance` | POST   | Evaluate suppliers             |
| `/api/parts/availability`              | POST   | Batch availability check       |

**Current Query Parameters (GET /api/parts-inventory)**:

- `category` - Filter by category
- `search` - Text search
- `sortBy` - Sort field
- `sortOrder` - asc/desc

**Missing Server-Side Features**:

- Pagination (limit/offset)
- Vessel filtering
- Criticality filtering
- Stock level status filtering (below_min, zero, excess)
- Supplier filtering

### Database Tables

| Table                 | Purpose                   | Key Fields                                      |
| --------------------- | ------------------------- | ----------------------------------------------- |
| `parts_inventory`     | Legacy parts table        | partNo, name, category, criticality             |
| `parts`               | Enhanced parts catalog    | partNo, name, category, criticality, systemType |
| `stock`               | Stock levels per location | partId, quantityOnHand, reorderPoint, location  |
| `inventory_movements` | Audit trail               | partId, movementType, quantity                  |
| `suppliers`           | Supplier master data      | name, contact, leadTime                         |
| `part_substitutions`  | Part alternatives         | originalPartId, substitutePartId                |

**Indexes Defined in Schema**:

- `idx_stock_part_no` - Stock by part number
- `idx_stock_low_stock` - Low stock queries
- `idx_stock_supplier` - Supplier lookups
- `idx_stock_org_part` - Multi-tenant queries

### Dual-Database Architecture

**Cloud Mode (PostgreSQL)**:

- Uses Neon PostgreSQL via `DATABASE_URL`
- Drizzle ORM for queries
- Full feature set

**Vessel/Desktop Mode (SQLite)**:

- Uses libSQL/Turso via embedded database
- Schema parity maintained in `shared/schema-sqlite.ts`
- Migrations via `npm run db:push`

**Offline Behavior**:

- Parts data synced on connectivity
- Local-first writes with background sync
- Conflict resolution handled by sync service

### Current State Assessment

**Strengths**:

- Well-structured API with org-scoping
- Good type safety via Zod schemas
- Clean separation between Part and Stock tables
- Existing indexes for common queries

**Limitations Requiring Enhancement**:

1. No virtualization - table renders all rows (perf issue with 10k+ items)
2. No server-side pagination - all data fetched at once
3. Limited filtering options on backend
4. No saved filter views
5. No vessel filtering (parts span fleet)
6. No part detail drawer (full edit dialog instead)
7. Client-side sorting only

---

## Implementation Plan

### Phase 1: Backend Enhancements

1. Add server-side pagination to `/api/parts-inventory`
2. Add comprehensive filtering (vessel, criticality, stock status, supplier)
3. Add saved filter views table and endpoints
4. Ensure indexes support new queries

### Phase 2: Virtualized Table Component

1. Install `@tanstack/react-virtual` (lighter than react-window)
2. Create `VirtualizedInventoryTable` component
3. Implement sticky header with column visibility toggles
4. Add keyboard navigation support

### Phase 3: Filter Panel

1. Create `InventoryFilterPanel` sidebar component
2. Add multi-select filters for vessel, category, criticality
3. Add stock status quick filters
4. Implement saved filter views with localStorage + DB sync
5. URL query parameter sync for shareable links

### Phase 4: Part Detail Drawer

1. Create `PartDetailDrawer` slide-in component
2. Show part details, stock across locations, recent work orders
3. Add quick actions: Add to WO, Mark Critical, View Substitutes

### Phase 5: Performance & Polish

1. Debounced search input
2. Loading skeletons
3. Empty state handling
4. Keyboard shortcuts
5. Responsive layout optimization

---

## Dependencies

**New Dependencies Needed**:

- `@tanstack/react-virtual` - For virtualized lists (already using tanstack/react-query)

**No New Dependencies Needed For**:

- Filtering - existing shadcn components
- Drawer - existing shadcn sheet component
- URL sync - wouter already handles routing

---

## Migration Notes

No database schema changes required initially. If saved filter views are added:

```sql
CREATE TABLE saved_filter_views (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id VARCHAR NOT NULL REFERENCES organizations(id),
  name VARCHAR NOT NULL,
  filters JSONB NOT NULL,
  is_default BOOLEAN DEFAULT false,
  created_by VARCHAR,
  created_at TIMESTAMP DEFAULT NOW()
);
```

Compatible with both PostgreSQL and SQLite (via JSON text column in SQLite).
