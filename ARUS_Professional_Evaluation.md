# ARUS Maritime Platform — Professional Evaluation Report

**Evaluator Perspective:** Senior Maritime Technology Consultant
**Date:** April 2026
**Fleet Context:** 15-vessel mixed fleet (tankers, bulkers, offshore)

---

## 1. Operational Reality Check — Score: 3.5 / 5

### What Works Well

**Work Order Model:** The `work_orders` schema (`shared/schema/work-orders.ts`) is genuinely maritime-grade. It covers `maintenanceType` (preventive, corrective, predictive, emergency), links to equipment and vessels, tracks planned vs. actual hours and costs, and includes downtime impact fields (`affectsVesselDowntime`, `actualDowntimeHours`). Sub-tables for tasks, checklists, parts consumption, and technician worklogs match what a superintendent would expect from a PMS.

**Equipment Registry:** The `equipment` table includes `systemType`, `componentType`, `criticalityLevel`, and JSONB fields for `specifications`, `operatingParameters`, and `maintenanceSchedule`. The manufacturer/model/serial number triad is present. Condition monitoring tables (`oil_analysis`, `wear_particle_analysis`, `condition_monitoring`) are unusually detailed for a startup platform — viscosity, iron/copper ppm, ferrography results.

**Maintenance Templates:** Job plans with `frequencyDays`/`frequencyHours`, `requiredSkills`, `checklistItems`, and `requiredParts` match how a planned maintenance system actually works. Templates can pre-fill work orders, reducing the chief engineer's data entry burden.

### What's Missing or Broken

**Equipment Hierarchy:** There is no `parentEquipmentId` or tree structure in the equipment table. Real vessels need multi-level hierarchies: Vessel → Main Engine → Turbocharger → Bearing Assembly. The current flat model with `systemType`/`componentType` strings won't satisfy a class surveyor who needs to trace a deficiency from a specific sub-component up to the system level. AMOS and ShipManager both have 5-7 level equipment trees.

**Inventory Gaps for Maritime:** The `parts` table has no first-class fields for IMO Dangerous Goods Class, IMDG codes, shelf life/expiry dates, hazmat classifications, or customs documentation requirements. These are stored (if at all) in generic `specifications` JSONB, which means they can't be queried, filtered, or validated. A vessel carrying spare lithium batteries or refrigerant gases needs explicit hazmat tracking to clear port state customs.

**Crew Certifications:** The `crew_cert` table tracks `cert_number`, `issued_at`, `expires_at`, and expiry alerts — but has no fields for endorsements, flag state requirements, issuing authority, or STCW regulation references. A crewing department managing 15 vessels across multiple flag states needs to know: "Does this Second Engineer's CoC have a Panama endorsement?" The current model tracks that a certificate exists and when it expires, but not the regulatory matrix behind it.

### Priority Fix
Add a proper parent-child equipment hierarchy with at least 5 levels and a recursive query capability. This is table stakes for any PMS that a classification society will accept.

---

## 2. Regulatory & Classification Readiness — Score: 3.5 / 5

### What Works Well

**Immutable Audit Trail:** The SHA-256 hash-chained audit system (`server/compliance/immutable-audit/`) is genuinely impressive. Each record stores `previousState` and `newState`, the hash includes `prevHash + timestamp + entityId + data states`, and a verification service can traverse the chain to detect tampering. This exceeds what most maritime CMMS platforms offer and would satisfy a quality auditor.

**STCW/MLC 2006 Compliance:** The compliance checker (`server/stcw-compliance/compliance-checker.ts`) correctly implements the 10-hour/24-hour minimum, the 77-hour/7-day rolling window, and the 6-hour minimum block rule. The fatigue risk scoring goes beyond compliance — tracking sleep debt, night work ratio, consecutive night shifts, and time since last full rest. The HoR projector that predicts future violations before they occur is a genuine differentiator.

**Digital Logbooks:** Both deck and engine room logbooks are implemented with timestamps, author identification (`performedBy`), and structured entries. The engine logbook includes a "Auto-Fill from Telemetry" feature that pulls sensor readings directly into official log entries — this saves significant time for watch engineers.

**PSC Tools:** The regulatory toolset includes PSC inspection history lookup by IMO number (Paris MoU, Tokyo MoU), deficiency pattern analysis, and automated compliance assessments that generate certification reports with digital signatures and unique certification hashes.

### What's Missing or Broken

**Official Log Entries:** While the logbooks capture data, there's no evidence of a formal "correction with reason" workflow that flag states require. The audit trail captures state changes at the database level, but the logbook UI should enforce: "This entry was corrected by [Officer Name] on [Date]. Original entry: [text]. Reason for correction: [text]." Silent database-level tracking isn't sufficient — the correction must be visible to the PSC officer reading the logbook.

**Equipment Certificates:** There's no dedicated table for statutory and class certificates (Safety Equipment Certificate, IOPP, Class Certificate of Machinery). These have specific survey windows, conditions of class, and flag state endorsements. A class surveyor during a renewal survey needs to see the certificate registry alongside the maintenance records.

**Emergency Drill Exceptions:** The STCW compliance checker implements the standard rules but doesn't account for the documented exceptions in Section A-VIII/1 — specifically the relaxation of rest hour requirements during emergency drills, which are mandatory under SOLAS. Without this, the system would flag legitimate drill periods as violations.

### Priority Fix
Add an equipment certificate registry with survey dates, conditions of class, and expiry tracking. This is what the class surveyor looks at first.

---

## 3. Vessel-Shore Architecture — Score: 4 / 5

### What Works Well

**Dual-Mode Database:** The `db-config.ts` architecture elegantly handles both cloud (PostgreSQL) and vessel (SQLite/libSQL/Turso) deployments. The `LOCAL_MODE` and `EMBEDDED_MODE` flags control which database engine is active, and the application code works with both through Drizzle ORM abstraction.

**Conflict Resolution Strategy:** The documented 3-layer approach (`docs/ARUS_CONFLICT_STRATEGY.md`) is thoughtfully designed:
- Layer 1: Optimistic locking with version columns on critical tables
- Layer 2: Field-level change tracking via `sync_journal` with `old_value`/`new_value`
- Layer 3: Safety-first auto-resolution with deterministic rules for non-critical fields and mandatory manual resolution for safety-critical data (sensor thresholds, crew assignments)

This is significantly more sophisticated than the "last write wins" approach most maritime software uses.

**MQTT Reliable Sync:** The secondary sync layer (`server/mqtt-reliable-sync/`) for critical data (work orders, alerts, crew changes) provides QoS 1/2 guaranteed delivery with local message queueing during offline periods. This is the right architecture for a vessel that gets intermittent satellite connectivity.

**Circuit Breaker & DLQ:** The SQLite Bridge uses a circuit breaker to detect shore unavailability and diverts data to a dead letter queue for later replay. WAL mode enables concurrent reads and writes. This handles the "sync fails halfway" scenario correctly.

**Delta Sync:** libSQL/Turso handles database page-level delta synchronization, and the batch processing with configurable `batchSize` prevents bandwidth saturation.

### What's Missing or Broken

**Bandwidth Estimation:** While the architecture is bandwidth-aware, there's no documented bandwidth budget or compression strategy. A 15-vessel fleet on shared VSAT at 128kbps needs to know: "How many KB per sync cycle?" The MQTT layer and delta sync help, but telemetry data could still saturate a constrained link if not carefully throttled.

**Recovery Documentation:** The Tauri desktop app recovery path for vessel crashes isn't explicitly documented as a user-facing procedure. The WAL mode and local persistence provide the technical foundation for recovery, but a chief engineer who sees a crash needs a simple "restart the app, your data is safe" procedure, not a debugging session.

### Priority Fix
Add configurable bandwidth throttling with per-vessel sync quotas and a documented "what to do when it crashes" procedure for vessel crew.

---

## 4. Predictive Maintenance Credibility — Score: 4 / 5

### What Works Well

**End-to-End Pipeline:** The data path is complete and traceable:
1. Hardware sensors → C# Telemetry Agent → Local SQLite (WAL mode)
2. Node.js Bridge → PostgreSQL
3. Feature Store aggregation (Mean, StdDev, RMS, Peak-to-Peak, Kurtosis, Skewness)
4. ML Training Pipeline (LSTM, Random Forest, XGBoost)
5. Model Registry with promotion lifecycle (training → staging → active)
6. Inference Engine → Failure probability + RUL estimation
7. RUL Engine with operating mode awareness
8. Recommendation generation → Work Order creation

This is a real pipeline, not a dashboard with "AI" in the name.

**Digital Twin Implementation:** The digital twin is substantive — it uses:
- Haversine formula for navigation
- Quadratic torque-RPM relationships for engine dynamics
- Time-constant thermal lag modeling
- Regression models for expected sensor values with load and ambient temperature factors
- Weibull distribution with MLE (Newton-Raphson) for reliability modeling
- Z-score based residual analysis for anomaly detection with fleet-wide baselines

This is a genuine physics-informed statistical model, not just a 3D rendering.

**Sensor Health & Data Quality:** The RUL Engine calculates a `dataQualityScore` based on sample count, span, and staleness. Low-quality data reduces prediction confidence rather than producing overconfident predictions. The telemetry health services track buffer status and ingestion gaps.

**Graceful Degradation:** When ML models aren't available, the system falls back to deterministic scoring based on physical thresholds (temperature > 80C, vibration > 5mm/s RMS). This handles the cold-start problem — a new vessel gets threshold-based monitoring immediately and transitions to ML predictions as data accumulates.

### What's Missing or Broken

**Sensor Calibration Tracking:** While sensor health is monitored for data quality, there's no explicit calibration registry — "this vibration sensor was last calibrated on [date] by [vendor] with [reference standard]." Maritime sensors drift significantly, and a class surveyor may ask for calibration certificates. The system detects degraded data quality but doesn't tell the chief engineer "Sensor X needs recalibration."

**Training Data Labeling:** The ML training pipeline needs labeled failure data to learn from. The system has the infrastructure for training (feature store, training pipeline, model registry), but for a new fleet, where do the failure labels come from? There's no documented process for: "Here's how you import 3 years of historical failure records from your existing CMMS to bootstrap the ML models."

### Priority Fix
Add a sensor calibration registry that tracks calibration dates, due dates, and reference standards. Link it to the data quality scoring so that overdue calibrations automatically reduce prediction confidence.

---

## 5. Integration with Existing Maritime Software — Score: 2.5 / 5

### What Works Well

**StormGeo Integration:** A robust integration with StormGeo for weather routing, vessel positions, and performance metrics, including API clients, XML/JSON parsers, and dedicated database storage (`server/services/stormgeo/`).

**Aquametro FMCC:** Direct integration with fuel monitoring via both Modbus TCP (sensor polling) and REST API. Automatic population of Engine Room Logbooks with fuel data is a genuine time-saver.

**AIS/Vessel Tracking:** Support for MarineTraffic API and PortCall API for real-time vessel positions, headings, speeds, and port information.

**Data Export/Import:** A comprehensive JSONL-based export/import service with tar.gz packaging, manifest validation, and entity upsert logic. Includes a GDPR-compliant anonymization engine. The C# telemetry agent supports CAN J1939 and NMEA 0183 protocols.

### What's Missing or Broken

**No CMMS Adapters:** Despite positioning as an "AI/analytics layer alongside existing CMMS," there are no import adapters for AMOS, MESPAS, or DNV ShipManager. No XML/CSV parsers for their export formats, no API clients, no field mapping configurations. A fleet running AMOS can't get their 10 years of maintenance history into ARUS without building a custom integration. This is the single biggest barrier to adoption.

**No IMO FAL Forms:** While the underlying data exists in the schema, there are no form generators for the 7 standard IMO FAL forms that every vessel needs for port entry. No BIMCO noon report format export either.

**No Classification Society APIs:** No integration with DNV Veracity, Lloyd's Register CLASS Direct, or BV MyVeristar for pulling survey status, conditions of class, or certificate data.

### Priority Fix
Build an AMOS CSV/XML import adapter. Most maritime fleets will not consider a new platform unless they can migrate their existing maintenance history without manual re-entry.

---

## 6. Security & Multi-Tenancy — Score: 3 / 5

### What Works Well

**Org Scoping Pattern:** Repository queries consistently apply `where(eq(table.orgId, orgId))` filters. The middleware chain injects `orgId` into request context, and PostgreSQL session variables (`SET LOCAL app.current_org_id`) enable Row-Level Security policies.

**RBAC Implementation:** Role-based access control with defined roles from `chief_engineer` to `admin`, enforced via `requireRole` middleware. Specialized middleware like `requirePartsManagementRole` restricts inventory access to senior engineers.

**RAG Tenant Isolation:** The RAG system has dedicated security — vector search is scoped by `orgId` and `visibilityFilter`, prompt injection detection scans for "ignore previous instructions" patterns, rate limiting uses user/org-based keys, and the audit logger tracks all queries and document accesses.

**Comprehensive Security Layers:** HMAC authentication for edge devices, bcryptjs password hashing, SHA-256 session tokens, Helmet CSP, rate limiting, and input validation via Zod schemas.

### What's Missing or Broken

**Single-Tenant Reality:** Despite the multi-tenant infrastructure, the system runs in single-tenant mode with a hardcoded `default-org-id`. The `OrganizationContext` on the frontend always resolves to this default. For a 15-vessel fleet, this is fine — but the code gives the impression of multi-tenancy without actually enforcing it in production.

**Dev Mode Bypass:** The frontend includes a "Dev Mode" toggle that bypasses permission checks. If this ships to a vessel, any user who discovers it can elevate their privileges. This needs to be compile-time excluded from production builds, not just a runtime toggle.

**Desktop Credential Storage:** There's no documented secure credential storage for the Tauri desktop app. If someone steals the laptop from the bridge, what credentials are cached locally? Are session tokens persisted in plaintext? Is there disk encryption or a secure keychain integration?

### Priority Fix
Remove the Dev Mode permission bypass from production builds (gate it behind `NODE_ENV === 'development'` at the build level, not runtime). Document and implement secure credential storage for the Tauri desktop deployment.

---

## 7. UX for Maritime Users — Score: 4 / 5

### What Works Well

**Bridge Night Mode:** A dedicated `bridge` theme (`client/src/styles/bridge-and-daylight.css`) uses deep red-on-black colors (`hsl(0, 65%, 45%)` foreground, `hsl(0, 0%, 2%)` background) specifically to preserve scotopic (night) vision. A separate high-contrast daylight mode handles sunlight washout. This shows genuine understanding of bridge operations.

**Touch Targets:** CSS classes enforce 44px minimum for standard interactions and 56px for critical actions (`client/src/index.css`). Safe area support for notched devices, sticky form actions positioned above bottom navigation for thumb access, and mobile-specific bottom navigation with role-based defaults for different officer types.

**Work Order Creation:** Templates pre-fill 80% of the form in 1-2 taps. Equipment lists filter by selected vessel. The `WorkOrderFormDialog` is a single-step dialog — a chief engineer can create an overdue work order in approximately 4-5 taps (select vessel, select equipment, choose template, adjust priority, submit).

**Hours of Rest Recording:** The `HoursOfRestGrid` uses a 24-column grid with drag-to-fill for desktop and a specialized `MobileDayCard` with large tap targets for mobile. A "Live Compliance Check" toggle provides real-time STCW validation as data is entered. Recording 6 hours of rest takes approximately 3 taps on mobile (select date, drag rest block, confirm).

**Engine Room Logging:** The "Auto-Fill from Telemetry" button on the engine logbook page is excellent — one tap pulls sensor readings into the official logbook, replacing manual round-sheet transcription.

### What's Missing or Broken

**Offline Indication:** There's no prominent "you are offline" banner or connectivity status indicator visible in the UI. On a vessel at sea, the user needs to know whether their changes are being synced or queued locally. This is critical for trust in the system.

**Undo/Confirmation:** While the audit trail tracks all changes, there's no documented undo mechanism for user mistakes. Destructive actions (deleting a work order, modifying a logbook entry) should have explicit confirmation dialogs with the consequences spelled out.

### Priority Fix
Add a persistent connectivity status indicator (online/offline/syncing) to the top navigation bar and confirmation dialogs for destructive actions.

---

## 8. Business Viability — Score: 3 / 5

### What Works Well

**ROI Tracking:** The work order schema includes `roi`, `totalCost`, `totalPartsCost`, `totalLaborCost`, and downtime tracking fields. The platform can quantify: "PdM detected this bearing failure 30 days early, avoiding 5 days of unplanned downtime worth $X."

**Cost Savings Dashboard:** The analytics module tracks cost savings from predictive vs. reactive maintenance, spare parts optimization, and reduced PSC detention risk.

**Comprehensive Feature Set:** For a startup platform, the breadth is exceptional — PdM, crew management, inventory, purchasing, logbooks, compliance, digital twin, AI copilot, and knowledge base. This covers most of what a fleet manager needs in a single platform.

### What's Missing or Broken

**Deployment Complexity:** The system requires PostgreSQL, Redis, SQLite/Turso, MQTT broker, and a Tauri desktop build per vessel. For 15 vessels, that's 15 desktop installations plus shore infrastructure. There's no documented deployment playbook, no fleet-wide MDM (Mobile Device Management) strategy, and no remote update mechanism for vessel installations.

**CMMS Migration Path:** Without AMOS/MESPAS import adapters (see Dimension 5), the deployment timeline for a fleet with existing CMMS data could stretch to months of manual data migration. This is the biggest commercial blocker.

**Data Export/Lock-In:** While the JSONL export service exists, there's no documented "export to AMOS format" or standard maritime data interchange format. A fleet that wants to switch back after 2 years can export their data, but importing it into another CMMS would require custom development.

**Fleet Size Justification:** The platform's value proposition (AI/ML predictions, digital twin, RAG knowledge base) requires sufficient data volume to be meaningful. For a 5-vessel fleet, the ML models may not have enough training data for accurate predictions. The sweet spot appears to be 10-20+ vessels where fleet-wide baselines and cross-vessel learning become valuable.

### Priority Fix
Create a documented deployment playbook with per-vessel setup time estimates, shore infrastructure requirements, and a phased rollout plan (e.g., 3 pilot vessels → fleet-wide in 6 months).

---

## Summary Scorecard

| Dimension | Score | Status |
|---|---|---|
| 1. Operational Reality | 3.5/5 | Strong foundations, gaps in hierarchy and maritime-specific inventory |
| 2. Regulatory Readiness | 3.5/5 | Excellent audit trail and STCW, needs certificate registry |
| 3. Vessel-Shore Architecture | 4.0/5 | Best-in-class sync design with conflict resolution |
| 4. PdM Credibility | 4.0/5 | Genuine end-to-end ML pipeline with physics-based digital twin |
| 5. Integration | 2.5/5 | Good maritime sensor integration, no CMMS adapters |
| 6. Security & Multi-Tenancy | 3.0/5 | Solid patterns, single-tenant reality, dev mode risk |
| 7. Maritime UX | 4.0/5 | Night mode, touch optimization, auto-fill — shows real maritime understanding |
| 8. Business Viability | 3.0/5 | Needs deployment playbook and migration tooling |

**Overall: 3.4 / 5**

---

## Go / No-Go Recommendation

**No-Go for production deployment today.** But this is closer than most platforms I've evaluated at this stage.

### What Makes This Platform Genuinely Promising

1. **The PdM pipeline is real.** This isn't a dashboard with "AI" painted on it. The path from sensor → feature store → ML training → inference → RUL → work order is complete and traceable. The digital twin uses actual physics equations, not just visualizations.

2. **The vessel-shore sync architecture is thoughtful.** Three-layer conflict resolution with safety-first manual override for critical fields, MQTT guaranteed delivery for critical data, circuit breakers, and dead letter queues — this was designed by someone who understands maritime connectivity.

3. **The UX shows maritime domain knowledge.** Bridge night mode with proper red-on-black, 56px critical touch targets, auto-fill logbooks from telemetry, drag-to-fill rest hour grids — these aren't generic enterprise patterns.

### Minimum Viable Path to "Put It on a Vessel"

**Phase 1 (4-6 weeks) — Regulatory Blockers:**
1. Add equipment certificate registry (class, statutory, flag state certificates with survey windows)
2. Add parent-child equipment hierarchy (minimum 5 levels)
3. Add logbook correction workflow with visible audit trail (not just database-level)
4. Remove Dev Mode permission bypass from production builds
5. Add hazmat/IMDG classification fields to inventory parts

**Phase 2 (4-6 weeks) — Commercial Blockers:**
1. Build AMOS CSV/XML import adapter for maintenance history migration
2. Create deployment playbook with per-vessel setup procedures
3. Add connectivity status indicator to UI
4. Document desktop app crash recovery procedure for vessel crew
5. Add sensor calibration tracking registry

**Phase 3 (Pilot — 8-12 weeks):**
1. Deploy on 3 pilot vessels with parallel operation alongside existing CMMS
2. Validate sync architecture under real satellite constraints
3. Collect feedback from chief engineers and deck officers
4. Tune ML models with actual fleet data
5. Iterate on UX based on field observations

**After successful Phase 3 pilot: Go for fleet-wide rollout.**

The platform has the architectural foundations to become a serious contender in maritime PdM. The key risks are all addressable — they're gaps in maritime-specific data modeling and operational tooling, not fundamental architectural flaws. The underlying engineering quality (hexagonal architecture, domain-driven design, comprehensive type safety) is strong enough to support rapid iteration on these gaps.
