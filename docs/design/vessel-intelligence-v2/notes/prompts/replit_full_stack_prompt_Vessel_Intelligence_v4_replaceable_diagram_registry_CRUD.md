# Replit full-stack implementation prompt — ARUS Vessel Intelligence Hub v4

Implement the updated **ARUS Vessel Intelligence / Digital Twin Hub v4** using the attached Figma SVG package.

Use these design references:

- `00_ARUS_Vessel_Intelligence_FULL_HUB_v2_FIGMA_BOARD.svg` for the full board overview.
- `desktop/*.svg` for desktop operational and admin/configuration screens.
- `mobile/*.svg` for mobile operational screens.
- `components/01_sectioned_vessel_component_exact_underlay_editable_polygons.svg` for the accurate sectioned vessel component.
- `components/02_sectioned_vessel_component_vector_only_normalized.svg` for the vector-only fallback component.
- `data/section_mapping.json`, `data/equipment_mapping.json`, `data/diagram_types.json`, and `data/thumbnail_fallback_rules.json` for the intended data-driven model.

## Product decision

Create one consolidated vessel-technical command center:

```text
live vessel data
→ uploaded active vessel diagram
→ editable section map and equipment assignments
→ health/anomaly detection
→ recommended action
→ work order or expert case
→ closeout evidence and report
```

The hub must replace/consolidate the fragmented vessel-technical experience:

- Fleet landing / vessel selector
- Predictive Maintenance / PDM
- Equipment schematic
- Asset / equipment health
- Technical anomaly alerts
- Vessel-linked maintenance work orders
- Vessel-linked expert cases
- Vessel diagnostic / performance reports
- Vessel performance analytics and AI/digital-twin insights

The hub must **not** replace:

- Crew Management
- Logistics
- Inventory / stock control
- Safety Hub, emergency alarms, safety bulletins, drills, incidents and compliance workflows
- System Admin, role creation, global permissions and audit logs
- Role-based user dashboards
- Public landing / login

Vessel Intelligence may reference crew, logistics, inventory, safety and admin data only where relevant, but those hubs remain separate.

## Core implementation rule

Do not create a fake standalone demo and do not fabricate production numbers.

Recycle existing ARUS data sources wherever possible:

- fleet/vessel records → vessel selector, fleet triage, voyage context
- assets/equipment → section equipment lists and equipment detail
- telemetry/time-series → trends, live values, sensor freshness and anomaly evidence
- technical alerts/anomalies → active anomalies and timeline
- maintenance/work orders/PMS → due tasks, work order details and closeout
- inventory/parts → parts availability inside work orders only
- users/crew → assignment, acknowledgement, evidence ownership
- expert cases/messages → case list, case detail and conversation
- reports/export services → generated reports and PDF/export flow
- roles/permissions → hub visibility and action access
- existing media/files/attachments → diagrams, section thumbnails, equipment thumbnails and evidence uploads
- WebSocket/SSE → live updates for telemetry, alerts, health, work orders and expert cases

Only add new tables/modules when no equivalent exists.

## Routes

Create or update these routes:

```text
/vessel-intelligence
/vessel-intelligence/fleet
/vessel-intelligence/:vesselId/overview
/vessel-intelligence/:vesselId/sections
/vessel-intelligence/:vesselId/sections/:sectionId
/vessel-intelligence/:vesselId/equipment/:equipmentId
/vessel-intelligence/:vesselId/performance
/vessel-intelligence/:vesselId/health
/vessel-intelligence/:vesselId/alerts
/vessel-intelligence/:vesselId/maintenance
/vessel-intelligence/:vesselId/maintenance/:workOrderId
/vessel-intelligence/:vesselId/expert-cases
/vessel-intelligence/:vesselId/reports
/vessel-intelligence/:vesselId/settings
/vessel-intelligence/:vesselId/diagrams
/vessel-intelligence/:vesselId/diagrams/:diagramId
/vessel-intelligence/:vesselId/diagrams/:diagramId/versions
/vessel-intelligence/:vesselId/section-maps/:mapId/edit
/vessel-intelligence/:vesselId/section-maps/:mapId/validate
/vessel-intelligence/:vesselId/thumbnails
```

Legacy route redirects/compatibility wrappers:

```text
/fleet                                      -> /vessel-intelligence
/fleet/:vesselId                            -> /vessel-intelligence/:vesselId/overview
/fleet-map                                  -> /vessel-intelligence/fleet
/predictive-maintenance                     -> /vessel-intelligence
/pdm                                        -> /vessel-intelligence
/pdm-analytics                              -> /vessel-intelligence/:selectedVesselId/performance
/ai-analytics                               -> /vessel-intelligence/:selectedVesselId/performance or /insights if that route exists
/equipment-schematic                        -> /vessel-intelligence/:selectedVesselId/sections
/equipment-schematic/:vesselId              -> /vessel-intelligence/:vesselId/sections
/vessel-alerts                              -> /vessel-intelligence/:selectedVesselId/alerts
/reports/vessel/:vesselId                   -> /vessel-intelligence/:vesselId/reports
```

If `vesselId` cannot be resolved, route to `/vessel-intelligence` and preserve the original destination in query params.

## Replaceable diagram registry

The vessel twin must not be a hardcoded diagram. It must be a versioned, tenant-scoped, replaceable diagram registry.

A vessel can have multiple diagram types:

```text
side_elevation
Deck Plan
deck_plan
machinery_arrangement
electrical_single_line
fire_safety_plan
system_schematic
custom
```

Each diagram type can have its own active version, section map, hotspots, thumbnails and equipment assignments.

Recommended model:

```text
Vessel
→ vessel_diagrams
→ vessel_diagram_versions
→ vessel_section_maps
→ vessel_sections
→ vessel_section_equipment
→ section thumbnails
→ equipment thumbnails
```

When a user uploads a replacement schematic, prompt:

```text
New schematic uploaded.
Choose mapping behavior:
1. Keep existing section map as draft overlay
2. Start blank section map
3. Copy from another vessel
4. Copy from vessel type template
```

Warn the user when the new diagram dimensions/aspect ratio differ materially from the old active version.

Historical work orders, alerts, reports and cases must not mutate when a diagram is replaced. Persist the diagram version, section ID, equipment ID and label used at the time the record was created.

## Coordinates and section maps

Store all polygon points, hotspot points, label anchors and crop boxes as normalized coordinates from `0.0` to `1.0` relative to the active diagram bounds.

Do not store raw pixel coordinates as the source of truth.

Each section supports:

- section number
- stable section key
- name
- description
- type/category
- color
- polygon points
- label anchor
- thumbnail crop region
- health rollup rule
- visibility
- display order
- multiple assigned equipment records

A section can contain many equipment items. Do not force one section to equal one equipment item.

## Physical section vs functional system

Separate the physical location from the functional system.

Example:

```text
Equipment: Jacket Water Pump 1
Physical section: Main Engine Room
Functional system: Cooling System
Subsystem: Jacket Water Circuit
Linked sensors: pressure, temperature, running status
Linked work orders: PM-2041, WO-3910
Linked parts: seals, impeller, bearing kit
```

Equipment records should support:

- primary physical section
- secondary/related section where needed
- functional system
- subsystem
- equipment category
- linked telemetry/sensors
- linked alerts
- linked work orders
- linked spare parts
- thumbnail/media state

## Equipment label formatting

Labels must be generated from equipment registry data, not typed manually into the diagram.

Desktop label format:

```text
Equipment Name
Asset Code / Tag
Status chip | Section chip
```

Mobile compact label format:

```text
Equipment Name
Asset Code · Status
```

Examples:

```text
Main Engine 1
ME-01
Healthy | Section 03
```

```text
Sea Water Pump 1
SWP-01 · Healthy
```

## Thumbnail management

Support replaceable thumbnails at both section and equipment level.

Section thumbnail fallback:

```text
manual uploaded section thumbnail
→ crop from active vessel diagram section polygon
→ generated section-colour placeholder
→ generic section icon
```

Equipment thumbnail fallback:

```text
manual uploaded equipment thumbnail
→ existing equipment/asset photo
→ parent section thumbnail
→ generic equipment icon by equipment category
```

## Backend API requirements

Use existing Express/TypeScript conventions, auth middleware, validation, tenant scoping, upload utilities, audit log utilities, query patterns and error handling.

### Summary and operational APIs

```text
GET /api/vessel-intelligence/vessels
GET /api/vessel-intelligence/:vesselId/summary
GET /api/vessel-intelligence/:vesselId/sections
GET /api/vessel-intelligence/:vesselId/sections/:sectionId
GET /api/vessel-intelligence/:vesselId/equipment/:equipmentId
GET /api/vessel-intelligence/:vesselId/performance
GET /api/vessel-intelligence/:vesselId/health
GET /api/vessel-intelligence/:vesselId/alerts
POST /api/vessel-intelligence/:vesselId/alerts/:alertId/acknowledge
POST /api/vessel-intelligence/:vesselId/alerts/:alertId/create-work-order
POST /api/vessel-intelligence/:vesselId/alerts/:alertId/create-expert-case
GET /api/vessel-intelligence/:vesselId/maintenance
GET /api/vessel-intelligence/:vesselId/maintenance/:workOrderId
PATCH /api/vessel-intelligence/:vesselId/maintenance/:workOrderId
GET /api/vessel-intelligence/:vesselId/expert-cases
GET /api/vessel-intelligence/:vesselId/reports
```

### Vessel diagram CRUD

```text
GET    /api/vessel-intelligence/:vesselId/diagrams
POST   /api/vessel-intelligence/:vesselId/diagrams
GET    /api/vessel-intelligence/:vesselId/diagrams/:diagramId
PATCH  /api/vessel-intelligence/:vesselId/diagrams/:diagramId
DELETE /api/vessel-intelligence/:vesselId/diagrams/:diagramId
POST   /api/vessel-intelligence/:vesselId/diagrams/:diagramId/set-primary
```

### Diagram version/upload CRUD

```text
GET    /api/vessel-intelligence/:vesselId/diagrams/:diagramId/versions
POST   /api/vessel-intelligence/:vesselId/diagrams/:diagramId/versions/upload
GET    /api/vessel-intelligence/:vesselId/diagrams/:diagramId/versions/:versionId
POST   /api/vessel-intelligence/:vesselId/diagrams/:diagramId/versions/:versionId/set-active
DELETE /api/vessel-intelligence/:vesselId/diagrams/:diagramId/versions/:versionId
```

### Section map CRUD

```text
GET    /api/vessel-intelligence/:vesselId/section-maps
POST   /api/vessel-intelligence/:vesselId/section-maps
GET    /api/vessel-intelligence/:vesselId/section-maps/:mapId
PATCH  /api/vessel-intelligence/:vesselId/section-maps/:mapId
DELETE /api/vessel-intelligence/:vesselId/section-maps/:mapId
POST   /api/vessel-intelligence/:vesselId/section-maps/:mapId/clone
POST   /api/vessel-intelligence/:vesselId/section-maps/:mapId/validate
POST   /api/vessel-intelligence/:vesselId/section-maps/:mapId/publish
POST   /api/vessel-intelligence/:vesselId/section-maps/import
GET    /api/vessel-intelligence/:vesselId/section-maps/:mapId/export
```

### Section CRUD and equipment assignments

```text
POST   /api/vessel-intelligence/:vesselId/section-maps/:mapId/sections
PATCH  /api/vessel-intelligence/:vesselId/sections/:sectionId
DELETE /api/vessel-intelligence/:vesselId/sections/:sectionId
POST   /api/vessel-intelligence/:vesselId/sections/:sectionId/equipment
PATCH  /api/vessel-intelligence/:vesselId/sections/:sectionId/equipment/:equipmentId
DELETE /api/vessel-intelligence/:vesselId/sections/:sectionId/equipment/:equipmentId
```

### Thumbnail CRUD

```text
GET    /api/vessel-intelligence/:vesselId/sections/:sectionId/thumbnail
POST   /api/vessel-intelligence/:vesselId/sections/:sectionId/thumbnail/upload
PATCH  /api/vessel-intelligence/:vesselId/sections/:sectionId/thumbnail
DELETE /api/vessel-intelligence/:vesselId/sections/:sectionId/thumbnail
POST   /api/vessel-intelligence/:vesselId/sections/:sectionId/thumbnail/generate-from-crop

GET    /api/vessel-intelligence/:vesselId/equipment/:equipmentId/thumbnail
POST   /api/vessel-intelligence/:vesselId/equipment/:equipmentId/thumbnail/upload
PATCH  /api/vessel-intelligence/:vesselId/equipment/:equipmentId/thumbnail
DELETE /api/vessel-intelligence/:vesselId/equipment/:equipmentId/thumbnail
```

## Recommended additive data model

Use existing tables if equivalent tables already exist. If not, add minimal additive tables:

```text
media_assets
vessel_diagrams
vessel_diagram_versions
vessel_section_maps
vessel_sections
vessel_section_equipment
digital_twin_benchmarks
anomaly_insights
```

`media_assets` must be tenant/company scoped and support owner type/owner ID/media role. Use it for vessel schematics, section thumbnails, equipment thumbnails, work order evidence and report attachments where compatible.

## Security requirements for media uploads

- allow only approved MIME types/extensions: SVG, PNG, JPG/JPEG, WebP; PDF only if existing conversion utilities exist
- verify MIME server-side, not by extension only
- sanitize SVG files before storage/rendering
- remove script tags, event handlers, foreignObject, external references, unsafe URLs and embedded active content
- strip EXIF metadata from raster images
- enforce file size limits from config
- generate safe previews/thumbnails server-side
- tenant-scope all media records
- prevent cross-tenant access to media, diagrams, section maps and thumbnails
- audit log upload, replacement, deletion, publish and rollback actions
- soft-delete/archive media linked to historical records

## Frontend components

Create or update:

```text
VesselIntelligenceShell
FleetTriagePage
VesselSelector
DiagramTypeSelector
ActiveDiagramPreview
SectionedVesselMap
EditableSectionPolygon
SectionBadge
SectionLegend
SectionDetailPanel
EquipmentLabelList
EquipmentAssignmentEditor
EquipmentThumbnailPreview
SectionThumbnailPreview
ThumbnailFallbackIndicator
VesselDiagramManager
DiagramReplacementWizard
VesselDiagramUploader
VesselDiagramVersionHistory
SectionMapEditor
SectionPolygonToolbar
PublishValidationPanel
ImportExportTemplatePanel
HealthRiskCard
ActiveAnomaliesCard
RecommendedActionCard
PerformanceVsTwinChart
DataFreshnessIndicator
AlertsTimelineTable
MaintenanceTaskPanel
WorkOrderDetailPanel
ExpertCasePanel
ReportLibraryPanel
MobileVesselIntelligenceNav
OfflineCacheBanner
```

Mobile should not expose complex polygon editing unless already feasible. It may allow lightweight thumbnail replacement and simple equipment assignment if permissioned, with a desktop-required state for full map editing.

## Permissions

Add and enforce:

```text
hub:vessel-intelligence:view
vessel-intelligence:view
vessel-intelligence:configure
vessel-intelligence:manage-diagrams
vessel-intelligence:upload-diagram
vessel-intelligence:archive-diagram
vessel-intelligence:manage-section-map
vessel-intelligence:publish-section-map
vessel-intelligence:manage-section-thumbnails
vessel-intelligence:manage-equipment-thumbnails
vessel-intelligence:assign-equipment-section
vessel-intelligence:acknowledge-alert
vessel-intelligence:create-work-order
vessel-intelligence:update-work-order
vessel-intelligence:create-expert-case
vessel-intelligence:approve-insight
vessel-intelligence:export-report
```

A user may view Vessel Intelligence without being able to upload diagrams or publish maps. Super admin remains the source of truth for granting hub visibility and action permissions.

## Draft / publish workflow

Use this flow:

```text
Upload diagram version
→ choose mapping behavior
→ create draft section map
→ edit sections/equipment/thumbnails
→ validate
→ preview desktop and mobile
→ publish
→ old active map becomes archived
```

Publishing must fail if blockers exist. Warnings may be publishable if the user has permission and explicitly confirms.

## Validation rules

Before publishing, validate:

- every section has a name and type
- every polygon is inside diagram bounds
- all polygon coordinates are normalized or valid SVG viewBox coordinates
- assigned equipment belongs to the same vessel/tenant or follows existing fleet-sharing rules
- critical equipment is mapped or intentionally marked unmapped
- no deleted equipment remains assigned
- all section/equipment thumbnails have a valid fallback path
- no active technical alert points to missing equipment/section
- route guards and permissions are respected

## Mobile/offline behavior

Mobile should cache:

- active vessel diagram
- active section map
- equipment list
- assigned work orders
- recent alerts
- recent thumbnails
- checklists and evidence drafts

Support an offline/stale data state that clearly shows whether data is live, partial, stale, manual or unavailable.

## Tests

Add API, integration, frontend component and Playwright tests.

Required test groups:

1. Route migration tests for Fleet/PDM/Equipment/Schematic/Vessel Reports legacy routes.
2. Hub visibility and action permission tests.
3. Vessel diagram CRUD tests.
4. Diagram version upload/replace/archive/rollback tests.
5. Unsafe upload rejection and SVG sanitization tests.
6. Section map CRUD tests.
7. Section polygon create/update/delete/clone/publish tests.
8. Multiple equipment assignment per section tests.
9. Section thumbnail CRUD and fallback tests.
10. Equipment thumbnail CRUD and fallback tests.
11. Historical work order/report/case references after diagram replacement.
12. Tenant isolation tests.
13. Mobile rendering and offline cache tests.
14. Desktop section map editor smoke tests.
15. Regression tests proving Crew, Logistics, Inventory, Safety, Admin, dashboards and login still work.

## Acceptance criteria

Implementation is accepted only when:

- Vessel Intelligence replaces the fragmented vessel-technical hubs without breaking unrelated hubs.
- The vessel schematic is replaceable per vessel and per diagram type.
- Diagram versions are preserved with rollback/history.
- Section maps are editable, versioned, draft/publish controlled and stored with normalized coordinates.
- Section thumbnails and equipment thumbnails are replaceable and have correct fallback behavior.
- Multiple equipment items can be assigned to a single vessel section.
- Equipment labels format correctly on desktop and mobile.
- Alerts can create work orders or expert cases.
- Work orders preserve diagram version, section and equipment context.
- Reports include vessel, section, equipment, alert, maintenance and case context.
- Uploads are sanitized, tenant-scoped, permission-gated and audit-logged.
- All CRUD, permission, mobile, desktop and regression tests pass.
- Empty states are clear when no diagram, no section map, no telemetry, no alerts or no thumbnails exist.
