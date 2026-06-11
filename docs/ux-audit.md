# ARUS UX Audit Report

## Executive Summary

The ARUS Marine Maintenance & Fleet Management application currently has **~70 page files** and **39 navigation items** organized across **9 navigation categories**. Analysis reveals significant functional overlap between pages, particularly in fleet/equipment monitoring, with opportunities for consolidation that would improve UX while maintaining all functionality.

## Current Navigation Structure

### Navigation Categories (9 total, 39 items)

| Category                 | Items | Routes                                                                                                                                                |
| ------------------------ | ----- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| Core Operations          | 3     | `/`, `/alerts`, `/actionable-insights`                                                                                                                |
| Fleet Overview           | 3     | `/vessel-management`, `/fleet-overview`, `/bridge-view`                                                                                               |
| Predictive Maintenance   | 4     | `/health`, `/pdm-pack`, `/diagnostics`, `/ai-insights`                                                                                                |
| Maintenance & Operations | 5     | `/work-orders`, `/maintenance`, `/maintenance-templates`, `/inventory-management`, `/optimization-tools`                                              |
| Equipment & Sensors      | 4     | `/equipment-registry`, `/sensors`, `/sensor-templates`, `/telemetry-upload`                                                                           |
| Crew Management          | 4     | `/crew-management`, `/crew-scheduler`, `/ops/schedule`, `/hours-of-rest`                                                                              |
| Analytics & Intelligence | 3     | `/analytics`, `/governance`, `/knowledge-base`                                                                                                        |
| Logs & Compliance        | 7     | `/logs-compliance`, `/deck-logbook`, `/engine-logbook`, `/fuel-emissions-log`, `/vessel-track-log`, `/condition-monitoring-log`, `/stormgeo-settings` |
| Configuration & Admin    | 4     | `/configuration`, `/email-alerts-settings`, `/organization-management`, `/system-administration`                                                      |

---

## Page-by-Page Analysis

### HIGH OVERLAP: Fleet & Equipment Monitoring

| Page                    | Route                  | Primary Purpose                         | Data Shown                                                | Overlaps With                                       |
| ----------------------- | ---------------------- | --------------------------------------- | --------------------------------------------------------- | --------------------------------------------------- |
| **Dashboard**           | `/`                    | Main entry point, summary KPIs          | Equipment health, work orders, alerts, devices, telemetry | Fleet Overview, Bridge View, Health Monitor, Alerts |
| **Fleet Overview**      | `/fleet-overview`      | Fleet-wide equipment health by vessel   | Vessel list, equipment insights grouped by vessel         | Dashboard, Bridge View, Health Monitor              |
| **Bridge View**         | `/bridge-view`         | Real-time equipment status (dark theme) | Equipment by type, live telemetry, fleet KPIs             | Dashboard, Fleet Overview, Health Monitor           |
| **Health Monitor**      | `/health`              | Equipment health & PDM analytics        | Equipment health cards, PDM scores, vessel filter         | Dashboard, Fleet Overview, Bridge View              |
| **Diagnostics**         | `/diagnostics`         | System diagnostics & troubleshooting    | DTC faults, diagnostic data                               | Health Monitor, Alerts                              |
| **PdM Pack**            | `/pdm-pack`            | Predictive maintenance analytics        | PDM scores, failure predictions, RUL                      | Health Monitor, Analytics Hub                       |
| **AI Insights**         | `/ai-insights`         | AI-powered maintenance insights         | Equipment insights, recommendations                       | Fleet Overview, Actionable Insights                 |
| **Actionable Insights** | `/actionable-insights` | Prioritized maintenance actions         | Action items, recommendations                             | AI Insights, Dashboard                              |

**Consolidation Candidate:** Dashboard, Fleet Overview, Bridge View, Health Monitor → **Unified Fleet Dashboard with tabs/sections**

### MODERATE OVERLAP: Maintenance & Work Orders

| Page                      | Route                    | Primary Purpose                     | Data Shown                                 | Overlaps With         |
| ------------------------- | ------------------------ | ----------------------------------- | ------------------------------------------ | --------------------- |
| **Work Orders**           | `/work-orders`           | Work order management               | Work order list, status, equipment         | Maintenance Schedules |
| **Maintenance Schedules** | `/maintenance`           | Scheduled maintenance calendar      | Schedules by equipment, due dates          | Work Orders           |
| **Maintenance Templates** | `/maintenance-templates` | Reusable maintenance task templates | Template definitions                       | (Unique)              |
| **Optimization Tools**    | `/optimization-tools`    | Maintenance optimization            | Scheduling optimization, resource planning | (Unique)              |

**Consolidation Candidate:** Work Orders, Maintenance Schedules, Maintenance Templates → **Unified Maintenance Hub with tabs**

### MODERATE OVERLAP: Crew Management

| Page                | Route              | Primary Purpose          | Data Shown                           | Overlaps With  |
| ------------------- | ------------------ | ------------------------ | ------------------------------------ | -------------- |
| **Crew Management** | `/crew-management` | Crew roster & profiles   | Crew list, certifications, documents | (Unique)       |
| **Crew Scheduler**  | `/crew-scheduler`  | Shift/watch scheduling   | Schedule assignments                 | Schedule Board |
| **Schedule Board**  | `/ops/schedule`    | Visual schedule board    | Timeline view of schedules           | Crew Scheduler |
| **Hours of Rest**   | `/hours-of-rest`   | STCW compliance tracking | Rest hours grid, violations          | (Unique)       |

**Consolidation Candidate:** Crew Scheduler, Schedule Board → **Single scheduler view with multiple display modes**

### MODERATE OVERLAP: Sensors & Equipment

| Page                        | Route                 | Primary Purpose             | Data Shown                           | Overlaps With    |
| --------------------------- | --------------------- | --------------------------- | ------------------------------------ | ---------------- |
| **Equipment Registry**      | `/equipment-registry` | Equipment asset management  | Equipment list, specs, configuration | Sensors          |
| **Sensors**                 | `/sensors`            | Sensor configuration hub    | Sensor list, mappings                | Sensor Templates |
| **Sensor Templates**        | `/sensor-templates`   | Sensor template definitions | Template library                     | Sensors          |
| **Manual Telemetry Upload** | `/telemetry-upload`   | CSV/file telemetry import   | Upload interface                     | (Unique)         |

**Consolidation Candidate:** Equipment Registry, Sensors → **Equipment & Sensors Hub**

### MODERATE OVERLAP: Logs & Compliance

| Page                         | Route                       | Primary Purpose                 | Data Shown                   | Overlaps With   |
| ---------------------------- | --------------------------- | ------------------------------- | ---------------------------- | --------------- |
| **Logs & Compliance Hub**    | `/logs-compliance`          | Central log access & compliance | Compliance status, log links | All logbooks    |
| **Deck Logbook**             | `/deck-logbook`             | Deck operations log             | Deck entries, weather        | (Unique)        |
| **Engine Logbook**           | `/engine-logbook`           | Engine room log                 | Engine entries, readings     | (Unique)        |
| **Fuel & Emissions Log**     | `/fuel-emissions-log`       | Auto-generated fuel log         | Fuel consumption, emissions  | (Unique)        |
| **Vessel Track Log**         | `/vessel-track-log`         | Auto-generated position log     | GPS track, positions         | (Unique)        |
| **Condition Monitoring Log** | `/condition-monitoring-log` | Auto-generated condition log    | Equipment condition entries  | (Unique)        |
| **StormGeo Settings**        | `/stormgeo-settings`        | Weather integration config      | StormGeo API settings        | (Configuration) |

**Consolidation Candidate:** Move StormGeo Settings to Configuration. Keep Logs & Compliance Hub as entry point with tabs for each log type.

### MODERATE OVERLAP: Analytics & AI

| Page                      | Route            | Primary Purpose            | Data Shown                                             | Overlaps With             |
| ------------------------- | ---------------- | -------------------------- | ------------------------------------------------------ | ------------------------- |
| **Analytics Hub**         | `/analytics`     | Unified analytics (tabbed) | Mission overview, operations, maintenance, finance, AI | Most analytics pages      |
| **AI Studio/ML Training** | `/ml-ai`         | ML model management        | Model training, deployment                             | AI Performance            |
| **AI Performance**        | within Analytics | AI model performance       | Model metrics, accuracy                                | ML Training               |
| **ML Governance**         | `/governance`    | ML model governance        | Model registry, versions, audit                        | Analytics Hub             |
| **Savings Dashboard**     | `/cost-savings`  | Cost savings tracking      | ROI, savings metrics                                   | Finance mode in Analytics |
| **Financial Reports**     | `/reports`       | Financial reporting        | Cost reports                                           | Finance mode in Analytics |

**Consolidation Candidate:** Most analytics features already consolidated in Analytics Hub. Move ML Governance, Savings Dashboard, Financial Reports as tabs.

### LOW OVERLAP: Unique Pages

| Page                        | Route                      | Primary Purpose         | Keep As-Is?                          |
| --------------------------- | -------------------------- | ----------------------- | ------------------------------------ |
| **Alerts**                  | `/alerts`                  | Alert management        | Yes, but could be panel in Dashboard |
| **Devices**                 | `/devices`                 | Edge device registry    | Yes                                  |
| **Vessel Detail**           | `/vessels/:id`             | Individual vessel view  | Yes                                  |
| **Vessel Management**       | `/vessel-management`       | Vessel fleet management | Yes                                  |
| **Inventory Management**    | `/inventory-management`    | Parts inventory         | Yes                                  |
| **Knowledge Base**          | `/knowledge-base`          | Document management/RAG | Yes                                  |
| **Organization Management** | `/organization-management` | Org settings            | Move to Config                       |
| **System Administration**   | `/system-administration`   | System settings         | Move to Config                       |
| **Configuration**           | `/configuration`           | App configuration       | Yes - consolidate admin pages here   |

---

## Identified Issues

### 1. Too Many Top-Level Navigation Items

- **Problem:** 9 categories with 39 items creates cognitive overload
- **Target:** Reduce to 5-7 top-level navigation items

### 2. Fleet Monitoring Fragmentation

- **Problem:** Dashboard, Fleet Overview, Bridge View, Health Monitor show similar data differently
- **Impact:** Users unsure which view to use for what task
- **Solution:** Consolidate into single "Fleet Dashboard" with sections/tabs

### 3. Duplicate Component Variants

- **Problem:** Multiple versions of similar components (KPI cards, equipment tables, health indicators)
- **Solution:** Create shared component library

### 4. Inconsistent Navigation Patterns

- **Problem:** Some hubs use tabs (Analytics), others use separate pages
- **Solution:** Consistent hub+tabs pattern for related functionality

### 5. Configuration Scattered

- **Problem:** Settings spread across multiple pages and navigation items
- **Solution:** Consolidate all configuration in single Configuration hub

---

## Recommended Consolidations

### 1. Fleet Dashboard (NEW)

**Combines:** Dashboard, Fleet Overview, Bridge View, Health Monitor  
**Structure:** Single page with sections/tabs:

- Overview (KPIs, critical alerts)
- Vessel Status (list with health indicators)
- Equipment Health (by vessel or type)
- Real-time Telemetry panel

### 2. Maintenance Hub (ENHANCED)

**Combines:** Work Orders, Maintenance Schedules, Maintenance Templates  
**Structure:** Tabs for each function

### 3. Crew & Compliance (NEW)

**Combines:** Crew Management, Crew Scheduler/Schedule Board, Hours of Rest  
**Structure:** Tabs for roster, scheduling, compliance

### 4. Logs Hub (ENHANCED)

**Already exists as Logs & Compliance Hub - enhance with:**

- Direct access to all log types
- Unified compliance dashboard
- Remove StormGeo Settings (move to Config)

### 5. Analytics Hub (KEEP)

**Already well-organized with tabs.** Add:

- Financial Reports tab
- ML Governance tab (or keep separate for admin audience)

### 6. Configuration Hub (ENHANCED)

**Consolidate all settings:**

- General Settings
- Organization Management
- Email & Alerts
- StormGeo Integration
- Storage & Transport
- System Administration

### 7. Equipment & Sensors (NEW)

**Combines:** Equipment Registry, Sensors, Sensor Templates
**Structure:** Tabs for equipment, sensors, templates

---

## Next Steps

1. **Phase 2:** Create proposed UX structure document with detailed navigation mapping
2. **Phase 3:** Identify and refactor shared components
3. **Phase 4:** Implement consolidated pages with compatibility redirects
4. **Phase 5:** Polish and cleanup
5. **Phase 6:** Regression testing

---

_Generated: Phase 1 UX Discovery - December 2025_
