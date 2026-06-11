# Work Orders Module Overhaul

## Overview

This document summarizes the comprehensive overhaul of the Work Orders module, implementing **Phases 0-9** of the modernization plan. The overhaul provides virtualized tables for performance, advanced filtering with URL persistence, task/checklist management, automated inventory consumption on work order completion, work order form dialog, cloning, maintenance templates integration, and checklist completion tracking.

## Completed Phases

### Phase 0: Database Optimization

- Added database indexes for improved query performance (defined in `shared/schema.ts`):
  - `work_orders_vessel_idx` on `vessel_id`
  - `work_orders_priority_idx` on `priority`
  - `work_orders_due_date_idx` on `planned_end_date`
  - `work_orders_assigned_crew_idx` on `assigned_crew_id`
  - `work_orders_org_status_idx` composite index on `(org_id, status)`

### Phase 1: UI Component Overhaul

#### VirtualizedWorkOrderTable

- High-performance virtualized table using `@tanstack/react-virtual`
- Efficiently renders large datasets (1000+ work orders)
- Sortable columns: WO#, Vessel, Equipment, Priority, Status, Due Date, Created
- Sticky header for consistent navigation
- Row virtualization for minimal DOM footprint

#### WorkOrderFilterPanel

- Collapsible filter sidebar (desktop) / sheet drawer (mobile)
- Filter options:
  - **Search**: Full-text search across WO#, equipment, description
  - **Status**: Open, In Progress, Completed, Cancelled
  - **Priority**: Critical, High, Medium, Low
  - **Vessel**: Multi-select vessel filter
  - **Engineer**: Assigned crew member filter
  - **Equipment Category**: Engine, Electrical, HVAC, etc.
  - **Due Date Range**: From/To date pickers
- Active filter badges with quick removal
- Clear All filters action

#### WorkOrderDetailDrawer

- Slide-in drawer for viewing work order details
- Tabbed interface:
  - **Details**: Core work order information, cost summary, time tracking
  - **Parts**: Associated parts and inventory
  - **Tasks**: Checklist management (Phase 2)
  - **History**: Audit trail (placeholder)
- Quick actions: Edit Work Order, Add to Work Order

#### URL Query Parameters

- Filter state persisted in URL for shareable links
- Browser navigation support (back/forward)
- 300ms debounce on filter changes for performance

### Phase 2: Backend & Tasks Enhancement

#### API Filtering

- Enhanced GET `/api/work-orders` with comprehensive filter parameters:
  - `vesselId`: Filter by vessel
  - `engineerId`: Filter by assigned crew
  - `status`: Filter by work order status
  - `priority`: Filter by priority level
  - `dueDateFrom`/`dueDateTo`: Date range filtering
  - `equipmentCategory`: Filter by equipment type
  - `search`: Full-text search

#### Work Order Tasks (Checklists)

- **Database Table**: `work_order_tasks` with fields:
  - `id`, `orgId`, `workOrderId`, `description`
  - `isCompleted`, `completedBy`, `completedByName`, `completedAt`
  - `sortOrder`, `createdAt`, `updatedAt`

- **API Endpoints**:
  - `GET /api/work-orders/:id/tasks` - List tasks
  - `POST /api/work-orders/:id/tasks` - Create task
  - `PATCH /api/work-orders/:id/tasks/:taskId` - Update task (completion tracking)
  - `DELETE /api/work-orders/:id/tasks/:taskId` - Delete task

- **Validation**: Zod schemas for request validation
- **Completion Metadata**: Automatic tracking of completedAt, completedBy, completedByName

- **Dual-Mode Parity**: Both PostgreSQL (DatabaseStorage) and in-memory (MemStorage) implementations

#### WorkOrderTasksTab UI

- Add task input with validation
- Toggle task completion with visual feedback
- Delete task with confirmation
- Progress indicator showing completion percentage
- Real-time updates via TanStack Query mutations

### Phase 3: Inventory Integration

#### Automatic Inventory Consumption

When a work order is completed via the `completeWorkOrder()` method in `server/storage.ts`:

1. **Fetch Work Order Parts**: Retrieves all parts linked to the work order from `work_order_parts` table
2. **Update Inventory Levels**:
   - Decreases `quantityOnHand` by the quantity used
   - Decreases `quantityReserved` by the quantity used
   - **PostgreSQL (DatabaseStorage)**: Uses SQL `GREATEST(0, quantity - amount)` to prevent negative quantities
   - **In-Memory (MemStorage)**: Uses JavaScript `Math.max(0, quantity - amount)` for parity
3. **Create Audit Trail**: Logs `inventoryMovements` records with:
   - `movementType`: "consume"
   - `quantityBefore` / `quantityAfter`: Stock levels before and after consumption
   - `reservedBefore` / `reservedAfter`: Reserved levels before and after consumption
   - `performedBy`: User who completed the work order (or "system")
   - `workOrderId`: Link to the completed work order
   - `notes`: Human-readable description

#### Transaction Safety

- **DatabaseStorage**: All inventory updates wrapped in the same `db.transaction()` as work order status change - atomic commit/rollback
- **MemStorage**: Sequential Map operations for offline/vessel mode, maintaining in-memory consistency

#### Edge Case Handling

- **Parts not found in inventory**: Gracefully skipped (no error thrown)
- **Over-consumption prevented**: Quantities clamped to zero minimum with `GREATEST()`/`Math.max()`
- **Missing work order parts**: Empty array handled gracefully

## Architecture

### File Structure

```
client/src/
├── pages/
│   └── work-orders.tsx          # Main work orders page
├── components/work-orders/
│   ├── WorkOrderFilterPanel.tsx # Filter sidebar component
│   ├── VirtualizedWorkOrderTable.tsx # Virtualized table
│   ├── WorkOrderDetailDrawer.tsx # Detail drawer with tabs
│   └── WorkOrderTasksTab.tsx    # Tasks/checklist tab

server/
├── domains/work-orders/
│   ├── routes.ts    # API route handlers with Zod validation
│   ├── service.ts   # Business logic layer (WorkOrderService class)
│   └── repository.ts # Data access layer (WorkOrderRepository class)
├── storage.ts       # IStorage interface + DatabaseStorage & MemStorage implementations

shared/
├── schema.ts             # PostgreSQL schema definitions (work_order_tasks table, indexes)
├── schema-runtime.ts     # Type exports (WorkOrderTask, InsertWorkOrderTask) and Zod schemas
└── schema-sqlite-vessel.ts # SQLite schema for desktop/vessel mode parity
```

### Key Implementation Files

- **Task CRUD Storage**: `server/storage.ts` - `getWorkOrderTasks()`, `createWorkOrderTask()`, `updateWorkOrderTask()`, `deleteWorkOrderTask()`
- **Task CRUD Domain**: `server/domains/work-orders/service.ts` & `repository.ts` - orchestration layer
- **Inventory Consumption**: `server/storage.ts` - `completeWorkOrder()` method (both DatabaseStorage and MemStorage)
  - Embedded in the completion transaction, no separate function
- **Types**: `shared/schema-runtime.ts` - `WorkOrderTask`, `InsertWorkOrderTask`, `insertWorkOrderTaskSchema`

### Call Flow for Work Order Completion

```
routes.ts: POST /api/work-orders/:id/complete
  → service.ts: WorkOrderService.completeWorkOrder()
    → repository.ts: WorkOrderRepository.complete()
      → storage.ts: DatabaseStorage.completeWorkOrder() or MemStorage.completeWorkOrder()
        └─ Inventory consumption logic embedded in transaction
```

### API Response Transformation

- Database uses `unitCost`, frontend expects `standardCost`
- Parts tab displays nested `stock` object with current inventory levels
- Both GET single and list endpoints apply consistent transformation

## Testing

### API Testing (curl)

```bash
# List work orders with filters
curl -H "x-org-id: default-org-id" \
  "http://localhost:5000/api/work-orders?status=open&priority=high"

# Create task
curl -X POST -H "x-org-id: default-org-id" \
  -H "Content-Type: application/json" \
  -d '{"description": "Check oil levels"}' \
  "http://localhost:5000/api/work-orders/{id}/tasks"

# Complete task
curl -X PATCH -H "x-org-id: default-org-id" \
  -H "Content-Type: application/json" \
  -d '{"isCompleted": true}' \
  "http://localhost:5000/api/work-orders/{id}/tasks/{taskId}"
```

### Validation Testing

```bash
# Test empty description validation
curl -X POST -H "x-org-id: default-org-id" \
  -H "Content-Type: application/json" \
  -d '{"description": ""}' \
  "http://localhost:5000/api/work-orders/{id}/tasks"
# Returns 400 with validation errors
```

## Migration Notes

### Schema Changes

- New table: `work_order_tasks` added to `shared/schema.ts` and `shared/schema-sqlite-vessel.ts`
- New indexes on `work_orders` table for query performance
- Schema changes pushed via `npm run db:push` (use `--force` if data-loss warning appears)

### Validation Commands

```bash
# Push schema changes
npm run db:push

# Verify server starts without errors
npm run dev

# Test API endpoints
curl -H "x-org-id: default-org-id" "http://localhost:5000/api/work-orders"
curl -H "x-org-id: default-org-id" "http://localhost:5000/api/work-orders/{id}/tasks"
```

### Dual-Mode Testing

- **Cloud Mode**: Test with PostgreSQL (default in Replit)
- **Vessel Mode**: Test with SQLite (Electron desktop app)

---

## Phase 4: Parts Tracking Enhancements

### Overview

Enhanced parts tracking for work orders with planned vs. actual quantity tracking and stock validation warnings.

### Schema Changes

- Added `quantityPlanned` field to `work_order_parts` table (PostgreSQL and SQLite parity)
- Captures available stock at selection time for validation

### Stock Warning System

- **Persistent Validation**: Stock levels captured when part is selected
- **Visual Indicators**: Red border and inline warnings for insufficient stock
- **Banner Alerts**: Prominent notification when any parts have insufficient stock
- **Real-time Feedback**: Warnings update as quantities are adjusted

### Rollback Logic

- Consistent rollback restoring both `quantityPlanned` and `quantityUsed` on reservation failures
- Prevents partial state when stock operations fail

### Test IDs

- `parts-tab-stock-warning-${partId}` - Individual part stock warning
- `parts-tab-insufficient-banner` - Overall insufficient stock banner
- `input-quantity-planned-${partId}` - Planned quantity input

---

## Phase 5: Audit Trail System

### Schema Additions

- `work_order_history` table for tracking status changes
- `inventory_movements` table for ledger-style stock auditing

### API Endpoint

```bash
# Get work order history (combined status changes + inventory movements)
GET /api/work-orders/:id/history
```

### WorkOrderHistoryTab Component

- Timeline UI with chronological event display
- Status change icons with before/after values
- Inventory movement tracking with part details
- Audit metadata (actor, timestamp, notes)

---

## Phase 6: Work Order Form Dialog

### WorkOrderFormDialog Component

Located: `client/src/components/work-orders/WorkOrderFormDialog.tsx`

A unified React Hook Form + Zod-validated modal supporting both create and edit modes.

### Features

- **Full Field Coverage**: vessel, equipment, maintenance type, priority, status, planned dates, estimated hours, crew assignment, reason, description, downtime settings
- **Vessel → Equipment Cascade**: Equipment dropdown filters based on selected vessel
- **Date Validation**: Planned end date must be >= planned start date
- **Create/Edit Modes**: Single component handles both workflows with appropriate defaults

### Form Schema

```typescript
const workOrderFormSchema = z.object({
  vesselId: z.string().min(1, "Vessel is required"),
  equipmentId: z.string().min(1, "Equipment is required"),
  reason: z.string().min(1, "Reason is required"),
  description: z.string().optional(),
  priority: z.coerce.number().min(1).max(4).default(3),
  status: z.string().default("open"),
  maintenanceType: z.string().optional(),
  assignedCrewId: z.string().optional(),
  plannedStartDate: z.date().optional().nullable(),
  plannedEndDate: z.date().optional().nullable(),
  estimatedHours: z.preprocess(..., z.number().min(0).optional()),
  estimatedDowntimeHours: z.preprocess(..., z.number().min(0).optional()),
  affectsVesselDowntime: z.boolean().default(false),
}).refine((data) => {
  if (data.plannedStartDate && data.plannedEndDate) {
    return data.plannedEndDate >= data.plannedStartDate;
  }
  return true;
}, { message: "End date must be after start date", path: ["plannedEndDate"] });
```

### Usage Example

```tsx
import { WorkOrderFormDialog } from "@/components/work-orders/WorkOrderFormDialog";

// Create mode
<WorkOrderFormDialog
  mode="create"
  open={createDialogOpen}
  onOpenChange={setCreateDialogOpen}
/>

// Edit mode
<WorkOrderFormDialog
  mode="edit"
  workOrder={selectedWorkOrder}
  open={editDialogOpen}
  onOpenChange={setEditDialogOpen}
/>
```

### Test IDs

- `work-order-form-dialog` - Dialog container
- `select-vessel` - Vessel dropdown
- `select-equipment` - Equipment dropdown
- `select-priority` - Priority dropdown
- `select-maintenance-type` - Maintenance type dropdown
- `select-status` - Status dropdown
- `select-crew` - Crew assignment dropdown
- `input-reason` - Reason textarea
- `input-description` - Description textarea
- `input-planned-start-date` - Planned start date picker
- `input-planned-end-date` - Planned end date picker
- `input-estimated-hours` - Estimated hours input
- `input-estimated-downtime` - Estimated downtime input
- `checkbox-affects-downtime` - Affects vessel downtime toggle
- `button-submit` - Submit button
- `button-cancel` - Cancel button

---

## Phase 7: Work Order Cloning

### Overview

Ability to clone (duplicate) an existing work order for recurring maintenance tasks. Creates a new work order with the same equipment, vessel, reason, and configuration but with a new WO number and "open" status.

### API Endpoint

```bash
# Clone a work order
POST /api/work-orders/:id/clone
Content-Type: application/json

{
  "plannedStartDate": "2025-12-01",   // Optional: New planned start date
  "plannedEndDate": "2025-12-05",     // Optional: New planned end date
  "includeTasks": true,                // Optional: Clone tasks (default: true)
  "includeParts": true                 // Optional: Clone parts list (default: true)
}
```

### Response

Returns the newly created work order with:

- New unique ID and WO number
- Status set to "open"
- All actual dates/hours reset to null
- Costs reset to 0
- Cloned tasks (uncompleted)
- Cloned parts (as planned quantities, no inventory reserved)

### WorkOrderCloneDialog Component

Located: `client/src/components/work-orders/WorkOrderCloneDialog.tsx`

Features:

- Date adjustment options for planned start/end dates
- Toggle to include/exclude tasks in clone
- Toggle to include/exclude parts list in clone
- Form validation (end date >= start date)
- Success callback with navigation to cloned work order

### Usage

```tsx
import { WorkOrderCloneDialog } from "@/components/work-orders";

<WorkOrderCloneDialog
  workOrder={selectedWorkOrder}
  open={cloneDialogOpen}
  onOpenChange={setCloneDialogOpen}
  onSuccess={(clonedOrder) => {
    // Navigate to cloned work order
  }}
/>;
```

### Test IDs

- `work-order-clone-dialog` - Dialog container
- `input-clone-start-date` - Planned start date input
- `input-clone-end-date` - Planned end date input
- `checkbox-include-tasks` - Include tasks checkbox
- `checkbox-include-parts` - Include parts checkbox
- `button-clone-cancel` - Cancel button
- `button-clone-submit` - Clone button
- `button-clone-wo-drawer` - Clone button in detail drawer

---

## Phase 8: Maintenance Templates Integration

### Overview

Maintenance Templates provide reusable PM procedures that can be applied when creating work orders. Templates define standard maintenance procedures with checklist items, estimated duration, priority, and safety notes.

### MaintenanceTemplatesPage

Located: `client/src/pages/MaintenanceTemplatesPage.tsx`
Route: `/maintenance-templates`

Features:

- Full CRUD operations for templates
- Checklist items management within templates
- Clone template functionality (with items)
- Filter by equipment type, maintenance type, active status
- List and grid view modes
- Expandable details with checklist preview

### Database Schema

Three related tables (templates and items are actively used; completions is for future checklist tracking):

- **maintenanceTemplates**: Template definitions with equipmentType, maintenanceType, priority, estimatedDurationHours, frequencyDays/Hours, safetyNotes
- **maintenanceChecklistItems**: Individual steps within a template (stepNumber, title, description, category, required, estimatedMinutes)
- **maintenanceChecklistCompletions**: (Future use) Will track execution of checklist items during work order completion

### API Endpoints

```bash
# List all templates
GET /api/maintenance-templates?equipmentType=engine&isActive=true

# Get single template
GET /api/maintenance-templates/:id

# Create template
POST /api/maintenance-templates

# Update template
PUT /api/maintenance-templates/:id

# Delete template
DELETE /api/maintenance-templates/:id

# Clone template (with items)
POST /api/maintenance-templates/:id/clone

# Get template checklist items
GET /api/maintenance-templates/:id/items

# Create/Update/Delete checklist items
POST /api/maintenance-templates/:id/items
PUT /api/maintenance-templates/:templateId/items/:itemId
DELETE /api/maintenance-templates/:templateId/items/:itemId

# Reorder checklist items
POST /api/maintenance-templates/:id/items/reorder
```

### WorkOrderFormDialog Template Integration

Located: `client/src/components/work-orders/WorkOrderFormDialog.tsx`

Features:

- Template selector dropdown appears only in create mode (not edit)
- Templates auto-filtered by selected equipment type
- Applying template pre-fills form fields:
  - maintenanceType (from template)
  - reason (template name + maintenance type)
  - description (template description)
  - priority (template priority)
  - estimatedHours (template estimatedDurationHours)
- Clear button to reset template-applied values
- Visual feedback when template is applied ("Template applied - form fields have been pre-filled")

### Test IDs

**WorkOrderFormDialog Template Integration:**

- `template-selector-section` - Template selector container (appears only in create mode with matching equipment)
- `select-template` - Template dropdown selector
- `template-option-none` - "No template" option
- `template-option-${id}` - Template option by ID
- `template-name-${id}` - Template name within option
- `template-priority-${id}` - Template priority badge (if priority <= 2)
- `template-duration-${id}` - Template duration indicator
- `button-clear-template` - Clear applied template button
- `template-applied-status` - Template applied success message

**MaintenanceTemplatesPage:**

- `maintenance-templates-page` - Page container
- `page-title` - Page title
- `card-template-${id}` - Template card (grid view)
- `row-template-${id}` - Template row (list view)
- `button-edit-${id}` - Edit template button
- `button-clone-${id}` - Clone template button
- `button-delete-${id}` - Delete template button

### Usage Example

```tsx
// Template auto-populates work order form
1. Select vessel and equipment in WorkOrderFormDialog
2. Template selector appears (filtered by equipment type)
3. Choose template to pre-fill maintenance details
4. Modify fields if needed
5. Submit to create work order with template-based values
```

---

## Phase 9: Checklist Completion Tracking

### Overview

Phase 9 connects template-derived checklist items to work order execution, enabling technicians to track pass/fail status with notes and providing supervisors with auditable completion data.

### Template Linking on Work Order Creation

When creating a work order with a template selected:

1. Work order is created via POST `/api/work-orders`
2. Automatically calls POST `/api/work-orders/:id/initialize-checklist` with the template ID
3. Creates `maintenanceChecklistCompletions` records for each template checklist item
4. Items start with `passed: null` (pending status)

### Enhanced WorkOrderTasksTab

Located: `client/src/components/work-orders/WorkOrderTasksTab.tsx`

Features:

- **Template Checklist Items**: Interactive pass/fail buttons with visual status indicators
- **Notes Input**: Collapsible notes section for each checklist item
- **Reset Functionality**: "Undo" button to reset completed items back to pending
- **Progress Tracking**: Overall progress bar with pending/passed/failed counts
- **Dual Lists**: Separate sections for template checklist items and manual ad-hoc tasks

### LinkTemplateDialog

Located: `client/src/components/work-orders/LinkTemplateDialog.tsx`

Features:

- Link maintenance templates to existing work orders
- Filter templates by equipment type
- Preview selected template details before linking
- Automatically switches to Tasks tab after linking

### API Endpoints Used

```bash
# Get checklist completions for a work order
GET /api/maintenance-checklist/:workOrderId

# Complete/update a checklist item
POST /api/maintenance-checklist/:workOrderId/complete
Body: { itemId, completedBy, completedByName, passed, notes }

# Initialize checklist from template (on work order creation or linking)
POST /api/work-orders/:workOrderId/initialize-checklist
Body: { templateId }
```

### Test IDs

**WorkOrderTasksTab:**

- `work-order-tasks-tab` - Tab container
- `tasks-progress-section` - Progress section
- `tasks-progress-text` - Progress count text
- `tasks-progress-bar` - Progress bar
- `badge-pending-items` - Pending items badge
- `badge-failed-items` - Failed items badge
- `badge-passed-items` - Passed items badge
- `template-checklist-section` - Template items section
- `additional-tasks-section` - Manual tasks section
- `no-tasks-message` - Empty state message
- `input-new-task` - New task input
- `button-add-task` - Add task button
- `button-save-task` - Save new task button
- `button-cancel-task` - Cancel adding task button

**TemplateChecklistItem:**

- `checklist-item-${id}` - Checklist item container
- `status-icon-${id}` - Status icon (pending/passed/failed)
- `completion-info-${id}` - Completion metadata
- `notes-display-${id}` - Notes text display
- `button-pass-${id}` - Mark as passed button
- `button-fail-${id}` - Mark as failed button
- `button-reset-${id}` - Reset to pending button
- `button-notes-${id}` - Toggle notes section button
- `textarea-notes-${id}` - Notes textarea
- `button-pass-with-notes-${id}` - Pass with notes button
- `button-fail-with-notes-${id}` - Fail with notes button

**LinkTemplateDialog:**

- `link-template-dialog` - Dialog container
- `select-link-template` - Template selector
- `template-option-${id}` - Template option
- `template-preview` - Selected template preview
- `button-cancel-link-template` - Cancel button
- `button-confirm-link-template` - Confirm link button
- `button-link-template-drawer` - Link Template button in drawer

### Checklist Item States

| State   | passed Value | Visual Indicator                  |
| ------- | ------------ | --------------------------------- |
| Pending | `null`       | Gray circle, white background     |
| Passed  | `true`       | Green checkmark, green background |
| Failed  | `false`      | Red X, red background             |

---

## Known Limitations

1. **Bulk Task Operations**: Single task CRUD only - bulk import/export pending
2. **Task Reordering**: `sortOrder` field exists but drag-drop UI not implemented

## Future Enhancements

1. **Drag-and-drop task reordering** using sortOrder field
2. ~~**Task templates** for common maintenance checklists~~ (Completed in Phase 8 - Maintenance Templates)
3. **Nested subtasks** for complex procedures
4. ~~**Task comments/notes** per checklist item~~ (Completed in Phase 9 - Checklist Completion Tracking)
5. **Bulk task completion** for efficiency
6. ~~**Checklist completion tracking** for work orders using `maintenanceChecklistCompletions` table~~ (Completed in Phase 9)
