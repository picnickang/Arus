# ARUS Consolidated UX Structure

## Proposed Navigation (5 Top-Level Hubs)

The new structure reduces navigation from **9 categories / 39 items** to **5 hubs / ~20 items**.

```
┌─────────────────────────────────────────────────────────────────┐
│  ARUS Navigation (Sidebar)                                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  🚢 Fleet Dashboard           ← Main entry, equipment health    │
│      • Overview               ← KPIs, alerts, summary           │
│      • Vessels                ← Vessel list & status            │
│      • Equipment Health       ← Equipment cards, PDM            │
│      • Live Telemetry        ← Real-time readings               │
│                                                                 │
│  🔧 Maintenance               ← Work orders, schedules          │
│      • Work Orders            ← Active/completed orders         │
│      • Schedules              ← Maintenance calendar            │
│      • Templates              ← Reusable task templates         │
│      • Inventory              ← Parts & stock                   │
│                                                                 │
│  👥 Crew & Compliance         ← Crew, scheduling, STCW          │
│      • Crew Roster            ← Crew profiles, certs            │
│      • Schedule               ← Shift/watch scheduling          │
│      • Hours of Rest          ← STCW compliance grid            │
│      • Compliance Status      ← Violations, alerts              │
│                                                                 │
│  📋 Logs                      ← All maritime logbooks           │
│      • Logs Hub               ← Overview, compliance status     │
│      • Deck Logbook           ← Deck operations                 │
│      • Engine Logbook         ← Engine room log                 │
│      • Auto-Logs              ← Fuel, Track, Condition          │
│                                                                 │
│  📊 Analytics                 ← Intelligence & reporting        │
│      • Mission Overview       ← Prioritized alerts              │
│      • Operations             ← Fleet ops analytics             │
│      • Maintenance            ← Maintenance analytics           │
│      • Finance                ← Cost & savings                  │
│      • AI & Models            ← ML performance, training        │
│                                                                 │
│  ⚙️ Configuration             ← All settings (collapsed)        │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Detailed Hub Specifications

### 1. Fleet Dashboard (`/`)

**Purpose:** Primary entry point for fleet monitoring, equipment health, and real-time status.

**Sections (Tab-based or Collapsible):**

| Section                | Content                                            | Data Source                                |
| ---------------------- | -------------------------------------------------- | ------------------------------------------ |
| **Overview** (default) | KPI cards, critical alerts, quick actions          | `/api/dashboard`, `/api/alerts`            |
| **Vessels**            | Vessel list with status, health scores, location   | `/api/vessels`, `/api/equipment/health`    |
| **Equipment Health**   | Equipment cards grouped by vessel/type, PDM scores | `/api/equipment/health`, `/api/pdm/scores` |
| **Live Telemetry**     | Real-time sensor readings by equipment             | `/api/telemetry/latest`                    |

**Replaces:**

- `/` (Dashboard) → Overview section
- `/fleet-overview` → Vessels section + Equipment Health section
- `/bridge-view` → Equipment Health section (dark mode toggle available)
- `/health` → Equipment Health section
- `/actionable-insights` → Overview section (insights panel)
- `/ai-insights` → Overview section (AI recommendations)
- `/diagnostics` → Equipment Health section (diagnostics panel)
- `/pdm-pack` → Equipment Health section (PDM tab)

**Route Mapping:**

```
/ → Fleet Dashboard (Overview)
/fleet-overview → Fleet Dashboard (Vessels tab)
/bridge-view → Fleet Dashboard (Equipment tab, dark mode)
/health → Fleet Dashboard (Equipment tab)
/actionable-insights → Fleet Dashboard (Overview, insights expanded)
/pdm-pack → Fleet Dashboard (Equipment tab, PDM panel)
/diagnostics → Fleet Dashboard (Equipment tab, diagnostics)
/vessels/:id → Vessel Detail (unchanged)
```

---

### 2. Maintenance Hub (`/maintenance`)

**Purpose:** Unified maintenance operations - work orders, scheduling, templates, inventory.

**Tabs:**

| Tab                       | Content                                    | Route                           |
| ------------------------- | ------------------------------------------ | ------------------------------- |
| **Work Orders** (default) | Active/completed work orders, filtering    | `/maintenance?tab=work-orders`  |
| **Schedules**             | Maintenance calendar, due dates            | `/maintenance?tab=schedules`    |
| **Templates**             | Maintenance task templates                 | `/maintenance?tab=templates`    |
| **Inventory**             | Parts inventory, stock levels              | `/maintenance?tab=inventory`    |
| **Optimization**          | Resource planning, scheduling optimization | `/maintenance?tab=optimization` |

**Replaces:**

- `/work-orders` → Work Orders tab
- `/maintenance` → Schedules tab
- `/maintenance-templates` → Templates tab
- `/inventory-management` → Inventory tab
- `/optimization-tools` → Optimization tab

**Route Mapping:**

```
/work-orders → /maintenance?tab=work-orders
/maintenance → /maintenance?tab=schedules
/maintenance-templates → /maintenance?tab=templates
/inventory-management → /maintenance?tab=inventory
/optimization-tools → /maintenance?tab=optimization
```

---

### 3. Crew & Compliance Hub (`/crew`)

**Purpose:** Crew management, scheduling, and STCW/MLC compliance tracking.

**Tabs:**

| Tab                  | Content                                     | Route                     |
| -------------------- | ------------------------------------------- | ------------------------- |
| **Roster** (default) | Crew profiles, certifications, documents    | `/crew?tab=roster`        |
| **Schedule**         | Watch/shift scheduling (timeline view)      | `/crew?tab=schedule`      |
| **Hours of Rest**    | STCW compliance grid, rest tracking         | `/crew?tab=hours-of-rest` |
| **Compliance**       | Violations, expiring certifications, alerts | `/crew?tab=compliance`    |

**Replaces:**

- `/crew-management` → Roster tab
- `/crew-scheduler` → Schedule tab
- `/ops/schedule` → Schedule tab (same view, different route)
- `/hours-of-rest` → Hours of Rest tab

**Route Mapping:**

```
/crew-management → /crew?tab=roster
/crew-scheduler → /crew?tab=schedule
/ops/schedule → /crew?tab=schedule
/hours-of-rest → /crew?tab=hours-of-rest
```

---

### 4. Logs Hub (`/logs`)

**Purpose:** Maritime logbook management and compliance documentation.

**Tabs:**

| Tab                      | Content                                       | Route             |
| ------------------------ | --------------------------------------------- | ----------------- |
| **Overview** (default)   | Compliance status, log summary, pending items | `/logs`           |
| **Deck Logbook**         | Deck operations entries                       | `/logs/deck`      |
| **Engine Logbook**       | Engine room entries                           | `/logs/engine`    |
| **Fuel & Emissions**     | Auto-generated fuel log                       | `/logs/fuel`      |
| **Vessel Track**         | Auto-generated position log                   | `/logs/track`     |
| **Condition Monitoring** | Auto-generated condition log                  | `/logs/condition` |

**Replaces:**

- `/logs-compliance` → Overview tab
- `/deck-logbook` → Deck Logbook tab
- `/engine-logbook` → Engine Logbook tab
- `/fuel-emissions-log` → Fuel & Emissions tab
- `/vessel-track-log` → Vessel Track tab
- `/condition-monitoring-log` → Condition Monitoring tab

**Route Mapping:**

```
/logs-compliance → /logs
/deck-logbook → /logs/deck
/engine-logbook → /logs/engine
/fuel-emissions-log → /logs/fuel
/vessel-track-log → /logs/track
/condition-monitoring-log → /logs/condition
```

---

### 5. Analytics Hub (`/analytics`)

**Purpose:** Business intelligence, AI/ML management, and reporting.

**Tabs (Already Implemented):**

| Tab                            | Content                            | Route                           |
| ------------------------------ | ---------------------------------- | ------------------------------- |
| **Mission Overview** (default) | Prioritized alerts, critical items | `/analytics?tab=overview`       |
| **Operations**                 | Fleet operations analytics         | `/analytics?tab=operations`     |
| **Maintenance**                | Maintenance analytics              | `/analytics?tab=maintenance`    |
| **Finance**                    | Cost tracking, ROI, savings        | `/analytics?tab=finance`        |
| **AI Performance**             | Model metrics, predictions         | `/analytics?tab=ai-performance` |
| **AI Management**              | ML training, governance            | `/analytics?tab=ai-management`  |
| **Data Integrity**             | Data quality, reconciliation       | `/analytics?tab=data-integrity` |

**Additional Pages (Keep Separate for Admin):**

- `/governance` → ML Governance dashboard (admin view)
- `/knowledge-base` → Document management/RAG

**Route Mapping:**

```
/analytics → /analytics (unchanged)
/cost-savings → /analytics?tab=finance
/reports → /analytics?tab=finance
/ml-ai → /analytics?tab=ai-management
/ml-training → /analytics?tab=ai-management
```

---

### 6. Configuration Hub (`/configuration`)

**Purpose:** All application settings and system administration.

**Tabs:**

| Tab                     | Content                                | Route                             |
| ----------------------- | -------------------------------------- | --------------------------------- |
| **General** (default)   | App settings, preferences              | `/configuration`                  |
| **Organization**        | Org management, vessels                | `/configuration?tab=organization` |
| **Email & Alerts**      | Notification settings                  | `/configuration?tab=alerts`       |
| **Integrations**        | StormGeo, external APIs                | `/configuration?tab=integrations` |
| **Equipment & Sensors** | Equipment registry, sensors, templates | `/configuration?tab=equipment`    |
| **Storage & Transport** | Data storage, sync settings            | `/configuration?tab=storage`      |
| **System Admin**        | Advanced administration                | `/configuration?tab=admin`        |

**Replaces:**

- `/configuration` → General tab
- `/settings` → General tab
- `/organization-management` → Organization tab
- `/email-alerts-settings` → Email & Alerts tab
- `/notification-settings` → Email & Alerts tab
- `/stormgeo-settings` → Integrations tab
- `/equipment-registry` → Equipment & Sensors tab
- `/sensors` → Equipment & Sensors tab
- `/sensor-templates` → Equipment & Sensors tab
- `/storage-settings` → Storage tab
- `/transport-settings` → Storage tab
- `/system-administration` → System Admin tab

**Route Mapping:**

```
/settings → /configuration
/organization-management → /configuration?tab=organization
/email-alerts-settings → /configuration?tab=alerts
/notification-settings → /configuration?tab=alerts
/stormgeo-settings → /configuration?tab=integrations
/equipment-registry → /configuration?tab=equipment
/sensors → /configuration?tab=equipment
/sensor-templates → /configuration?tab=equipment
/storage-settings → /configuration?tab=storage
/transport-settings → /configuration?tab=storage
/system-administration → /configuration?tab=admin
```

---

## Preserved Standalone Routes

These routes remain as standalone pages (not hub tabs):

| Route                | Purpose                   | Reason                          |
| -------------------- | ------------------------- | ------------------------------- |
| `/vessels/:id`       | Individual vessel detail  | Deep-link/bookmark requirement  |
| `/pdm/equipment/:id` | Equipment detail with PDM | Deep-link requirement           |
| `/devices`           | Edge device registry      | Separate admin function         |
| `/alerts`            | Full alerts page          | Quick access, may also be panel |
| `/telemetry-upload`  | Manual telemetry upload   | Infrequent task                 |
| `/knowledge-base`    | Document management       | Separate content area           |
| `/governance`        | ML governance (admin)     | Regulatory requirement          |

---

## Functionality Verification

### All Existing Features Have a Home ✓

| Original Feature             | New Location                                   |
| ---------------------------- | ---------------------------------------------- |
| See all vessels and statuses | Fleet Dashboard → Vessels                      |
| Open vessel details          | Fleet Dashboard → click vessel → Vessel Detail |
| View equipment health        | Fleet Dashboard → Equipment Health             |
| Live telemetry               | Fleet Dashboard → Live Telemetry               |
| Manage work orders           | Maintenance → Work Orders                      |
| View maintenance schedules   | Maintenance → Schedules                        |
| Manage parts inventory       | Maintenance → Inventory                        |
| View crew roster             | Crew & Compliance → Roster                     |
| Manage crew schedules        | Crew & Compliance → Schedule                   |
| Track hours of rest          | Crew & Compliance → Hours of Rest              |
| Deck logbook                 | Logs → Deck Logbook                            |
| Engine logbook               | Logs → Engine Logbook                          |
| Access compliance status     | Logs → Overview                                |
| Analytics & reports          | Analytics (all tabs)                           |
| App configuration            | Configuration (all tabs)                       |
| Alerts & notifications       | Fleet Dashboard + dedicated `/alerts`          |

### No Critical Features Duplicated ✓

Each feature exists in exactly one location in the new structure.

### Nothing Important Disappears ✓

All functionality from the original ~70 pages is preserved in the consolidated structure.

---

## Implementation Priority

### Phase 1: Fleet Dashboard Consolidation (HIGH IMPACT)

- Highest user value
- Resolves most confusion
- Most overlap reduction

### Phase 2: Maintenance Hub

- Clear consolidation path
- Moderate complexity

### Phase 3: Crew & Compliance Hub

- Important for STCW compliance
- Moderate complexity

### Phase 4: Logs Hub

- Already partially consolidated
- Enhancement work

### Phase 5: Configuration Hub

- Lower user traffic
- Can be done incrementally

---

## Backward Compatibility

All old routes will redirect to new locations using thin compatibility layer:

```typescript
// Example redirect mapping
const ROUTE_REDIRECTS = {
  "/fleet-overview": "/?tab=vessels",
  "/bridge-view": "/?tab=equipment&theme=dark",
  "/health": "/?tab=equipment",
  "/work-orders": "/maintenance?tab=work-orders",
  "/crew-scheduler": "/crew?tab=schedule",
  "/deck-logbook": "/logs/deck",
  // ... etc
};
```

---

_Document: Phase 2 UX Structure Proposal - December 2025_
