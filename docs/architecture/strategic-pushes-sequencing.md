# ARUS — Two Strategic Pushes: Sequencing Plan

**Source:** Enterprise-Grade Audit (Nov 2026) §16 "Final Verdict" — _"ARUS is two strategic engineering pushes away from being genuinely best-in-class."_

**Purpose:** Break the two pushes into discrete, dependency-ordered backlog items. Each item is sized to be a single project task (one PR-able unit of work). This document is the source-of-truth for converting to project tasks in Plan mode.

**Status:** Sequencing only — no code yet. The 30 v2 gap-fill waves already shipped are the substrate; this plan builds on top of them.

---

## Push A — Real ML/Twin/Graph Substance Behind the UI

**Goal:** Replace heuristic stubs and simulated explanations with trained inference, defensible attribution, and graph-based reasoning. The UI surfaces already imply this level of intelligence; this push earns it.

**Total estimated effort:** 14–22 weeks (3–5 engineers).

### Track A1 — Real ML Inference (audit Top-ROI #2, Top-Risk #1)

| #    | Task                                                           | Blocked by           | Scope                                                                                                                                                                                                       | Acceptance                                                                                                                                |
| ---- | -------------------------------------------------------------- | -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| A1.1 | **ONNX runtime integration**                                   | —                    | Add `onnxruntime-node` (server) + `onnxruntime-web` (client offline scoring). Define `MLInferenceAdapter` port in `server/domains/pdm-platform/ports.ts`. Wire to existing `ml_models` registry (Wave 3.2). | A no-op ONNX model loads and serves predictions through the existing `serveWithShadowOrCanary` (Wave 3.3) path. No UX change.             |
| A1.2 | **Feature store (point-in-time correct)**                      | —                    | Build `server/feature-store/` on top of existing `equipment_features` + `featureSetVersion` lineage (already in `prediction_lineage`). Snapshot writer + as-of reader.                                      | Given a prediction, `getFeaturesAsOf(equipmentId, snapshotId)` returns the exact features used at training time.                          |
| A1.3 | **Label pipeline from closeout wizard**                        | —                    | Wire `WorkOrderCloseoutWizard`'s prediction-feedback step into a `prediction_outcomes` table; backfill from existing `failureHistory`.                                                                      | One row per closed WO that had a prediction; `(modelVersionId, outcomeLabel, observedAt)` queryable.                                      |
| A1.4 | **Train first real model: rotating-equipment bearing failure** | A1.2, A1.3           | XGBoost on labelled bearing failures, vibration FFT features + oil quality + hours. Train offline, export to ONNX. Promote via existing `POST /api/v1/ml/models/:id/promote`.                               | Model serves shadow traffic (A1.1) for 2 weeks with PSI<0.25; promote to canary 10%; promote to live when MAE < 15% of current heuristic. |
| A1.5 | **Train second model: pump degradation**                       | A1.4 (same pipeline) | Same playbook, different equipment class.                                                                                                                                                                   | Same acceptance bar.                                                                                                                      |
| A1.6 | **Closed-loop retraining cron**                                | A1.4                 | Weekly pg-boss job (Wave 0.1): pull last 7d of outcomes, refit, evaluate, register new model version. Auto-promote if MAE improves >5% AND drift KPIs (Wave 3.1) stay green.                                | Two consecutive auto-promotions in staging without manual intervention.                                                                   |
| A1.7 | **Real SHAP attribution** (audit Top-ROI #7)                   | A1.4                 | Replace `server/ml-explainability-service.ts` stub. Use `shap` Python sidecar (via subprocess) or port to JS (`shap-js` if it covers tree models). Surface per-feature contribution on prediction cards.    | Engineer can answer "why does the model think bearing #2 will fail?" with feature attributions, not narrative.                            |

### Track A2 — Knowledge Graph (audit Top-ROI #9)

| #    | Task                                                         | Blocked by | Scope                                                                                                                                                                      | Acceptance                                                                                                                                |
| ---- | ------------------------------------------------------------ | ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| A2.1 | **Choose graph substrate: PG-AGE vs Neo4j**                  | —          | ADR comparing in-PG (PG-AGE, no new infra) vs Neo4j (mature tooling). Recommend PG-AGE for tenant-isolation simplicity + transactional consistency with relational tables. | ADR merged at `docs/architecture/adr/0xx-graph-store.md`.                                                                                 |
| A2.2 | **Install + bootstrap PG-AGE**                               | A2.1       | Add `pg_age` extension to managed Postgres. Bootstrap script analogous to `timescaledb-bootstrap.ts` (Wave 2.8). Opt-in via `GRAPH_ENABLED`.                               | `MATCH (n) RETURN n` against an empty graph returns 200 in <50ms.                                                                         |
| A2.3 | **Equipment → failure-mode → parts → supplier graph schema** | A2.2       | Cypher schema + edge inserters wired into existing `equipment`/`failure_history` write paths. Backfill from current relational data.                                       | Graph contains every current `(equipment, failureMode, partId, supplierId)` tuple, byte-exact with relational source.                     |
| A2.4 | **Graph query as copilot tool**                              | A2.3       | New tool in `server/domains/agent/application/tool-registry.ts`: `findSimilarFailures(equipmentId)`, `whatPartsDoINeed(failureModeId)`. Hook into RAG orchestrator.        | Copilot can answer "what parts have I needed historically when this equipment shows these symptoms?" with graph traversal, not SQL JOINs. |
| A2.5 | **Cross-vessel learning** (audit Missing #4)                 | A2.3       | Graph query that aggregates failure-mode→part patterns across all vessels of the same class.                                                                               | "For class-X vessels, 78% of bearing-Y failures needed part-Z" surfaces in equipment 360°.                                                |

### Track A3 — 3D Twin Viewer (audit Top-ROI implicit, Category-Leading #2)

| #    | Task                          | Blocked by         | Scope                                                                                                                     | Acceptance                                                                        |
| ---- | ----------------------------- | ------------------ | ------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| A3.1 | **glTF ingestion pipeline**   | —                  | Storage + metadata for vessel 3D models; admin upload route with size/format validation.                                  | A vessel record can have a glTF asset attached; sub-100MB file loads in viewer.   |
| A3.2 | **Three.js viewer component** | A3.1               | New `client/src/components/vessel/Vessel3DTwin/`. Camera controls, equipment-pin overlays, health-colour mapping.         | Equipment markers on the 3D model click through to existing equipment detail.     |
| A3.3 | **System dependency overlay** | A2.3 (graph), A3.2 | Visualise failure propagation in 3D: if pump fails, downstream cooling loop turns amber.                                  | Engineer can see "if I lose this pump, what else degrades?" by clicking the pump. |
| A3.4 | **Replay/scrubbing UI**       | A3.2               | Time-scrub bar on the 3D twin: plays back last 6h of telemetry-driven state changes. Wraps existing `ScenarioSimService`. | Operator can rewind to before an alarm and watch what changed.                    |

### Push A — Critical Path

```
A1.1 ─┐
A1.2 ─┼─→ A1.4 ─→ A1.5
A1.3 ─┘    │
           ├─→ A1.6
           └─→ A1.7

A2.1 ─→ A2.2 ─→ A2.3 ─┬─→ A2.4
                      └─→ A2.5

A3.1 ─→ A3.2 ─→ A3.4
              └─→ A3.3 (also needs A2.3)
```

**Minimum-viable Push A:** A1.1 + A1.2 + A1.3 + A1.4 + A1.7 = real ML on bearings with real SHAP. ~8 weeks, 2 engineers. Everything else is depth/breadth.

---

## Push B — Multi-Tenant Horizontally-Scalable Runtime

**Goal:** Turn the single-process, single-tenant deployment into a SaaS platform that serves N customers from one cluster with hard isolation and elastic horizontal scale.

**Total estimated effort:** 10–14 weeks (3–4 engineers).

### Track B1 — Multi-Tenancy (audit Top-ROI #3, Top-Risk #3)

| #    | Task                                                 | Blocked by | Scope                                                                                                                                                                                                                       | Acceptance                                                                                                   |
| ---- | ---------------------------------------------------- | ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| B1.1 | **Auth-derived `req.orgId`**                         | —          | Remove `DEFAULT_ORG_ID` from `server/middleware/auth.ts:52`. Derive `orgId` from session claim. Failing auth → 401, not silent default. Update all tests.                                                                   | Boot with `DEFAULT_ORG_ID` unset succeeds; unauth'd `/api/*` requests return 401.                            |
| B1.2 | **PostgreSQL RLS policies**                          | B1.1       | Add RLS to every `org_id`-scoped table (the GDPR tenant-delete allowlist from Wave 6.6 is the authoritative set). `SET LOCAL app.current_org_id` (already in `middleware/db-context.ts`, Wave hardening) drives the policy. | Test: connect as one tenant, attempt to query another's data, get 0 rows even if SQL forgets a WHERE clause. |
| B1.3 | **Per-tenant rate limits**                           | B1.1       | Extend existing rate-limiter to key on `orgId` not just IP.                                                                                                                                                                 | Tenant A burst doesn't throttle tenant B.                                                                    |
| B1.4 | **Per-tenant feature flags already work** (Wave 0.6) | B1.1       | No new work; just verify it propagates through the RLS layer correctly.                                                                                                                                                     | Existing tests pass; one new test for cross-tenant flag isolation.                                           |
| B1.5 | **Tenant lifecycle: provision / suspend / delete**   | B1.2       | `POST /api/v1/admin/tenants`, `PATCH .../suspend`, `DELETE` (wraps Wave 6.6 GDPR delete). Admin UI.                                                                                                                         | New tenant signs up, gets isolated workspace; delete returns the Wave 6.6 deletion certificate.              |
| B1.6 | **Per-tenant resource quotas**                       | B1.5       | Storage bytes, equipment count, telemetry rows/day. Soft-throttle at 80%, hard at 100%.                                                                                                                                     | Quota exceeded → 429 with `Retry-After`; tenant dashboard shows usage.                                       |

### Track B2 — WebSocket Fan-out & Horizontal Scale (audit Top-ROI #8, Top-Risk #4)

| #    | Task                                                  | Blocked by | Scope                                                                                                                                                                           | Acceptance                                                                                                            |
| ---- | ----------------------------------------------------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| B2.1 | **Choose fan-out substrate: Redis Pub/Sub vs NATS**   | —          | ADR. Recommend Redis Pub/Sub — already a project dependency, no new infra. NATS only if message replay needed.                                                                  | ADR merged.                                                                                                           |
| B2.2 | **Channel-per-tenant pub/sub adapter**                | B1.1, B2.1 | Replace in-process `server/websocket.ts` broadcast with `redis.publish(`arus:${orgId}:${channel}`, msg)`. Each Node instance subscribes to channels its connected clients need. | Two Node instances behind a load balancer; alert published to one instance reaches WS clients connected to the other. |
| B2.3 | **Reconnect-with-replay protocol**                    | B2.2       | Client sends `lastEventId` on reconnect; server replays from a short Redis stream (TTL 5min).                                                                                   | Killing a client's WS for 60s and reconnecting: zero missed events.                                                   |
| B2.4 | **Remove sticky sessions from LB config**             | B2.2, B2.3 | Document the change in deployment readme.                                                                                                                                       | Load balancer round-robins; no session affinity required.                                                             |
| B2.5 | **Horizontal autoscale on CPU + WS connection count** | B2.4       | k8s HPA / Replit deployment autoscale config.                                                                                                                                   | Synthetic load (Wave 2.6 k6 spike test) triggers scale-out and stays stable.                                          |

### Track B3 — Event-Streaming Spine (audit Top-Risk #6)

| #    | Task                                                                | Blocked by | Scope                                                                                                                                                                | Acceptance                                                                                |
| ---- | ------------------------------------------------------------------- | ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| B3.1 | **Choose streaming substrate: Kafka vs Redpanda vs NATS JetStream** | —          | ADR. Recommend Redpanda for ops simplicity (Kafka-compatible, single binary, no Zookeeper).                                                                          | ADR merged.                                                                               |
| B3.2 | **Publish existing domain events to streaming spine**               | B3.1, B1.2 | Wrap current `server/domains/*/events/*` event bus with a publish-after-commit outbox pattern (transactional safety). Topic-per-event-type, partition-key = `orgId`. | Every domain event lands as a stream message; existing in-process consumers keep working. |
| B3.3 | **First external consumer: telemetry → analytics warehouse**        | B3.2       | Sink connector that streams `telemetry_ingested` events into a warehouse table (or S3 Parquet for cheaper storage).                                                  | Analytics queries no longer hit the OLTP database.                                        |
| B3.4 | **CDC from PG to streaming spine**                                  | B3.1       | Debezium (or equivalent) for `org_id`-partitioned topics from PG WAL.                                                                                                | Schema changes in PG appear as CDC events; downstream consumers can rebuild views.        |

### Track B4 — Architectural Decoupling (audit Top-Risk #5, #8)

| #    | Task                                                            | Blocked by               | Scope                                                                                                                                                                                                                                                                  | Acceptance                                                                                                      |
| ---- | --------------------------------------------------------------- | ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| B4.1 | **Repositories.ts proxy decomposition (1st domain: equipment)** | —                        | Move equipment data access from `server/repositories.ts` proxy + `server/db/equipment/*` into proper hexagonal adapter under `server/domains/equipment/infrastructure/`. Existing storage-import-boundary guard (`check-storage-imports.mjs`) enforces no regressions. | Equipment domain has zero references to `server/repositories.ts`; guard passes; all tests green.                |
| B4.2 | **Repeat decomposition for: vessels, work-orders, inventory**   | B4.1 (pattern)           | Same playbook, three domains. Each as a separate task.                                                                                                                                                                                                                 | Each domain free of the proxy.                                                                                  |
| B4.3 | **Delete legacy `server/db/*` once empty**                      | B4.2 + remaining domains | Audit which legacy folders are still imported anywhere; for each, either migrate or document why it stays.                                                                                                                                                             | `server/db/` is either gone or every remaining file has an explicit "this is the canonical home for X" comment. |

### Push B — Critical Path

```
B1.1 ─→ B1.2 ─→ B1.3
            └─→ B1.5 ─→ B1.6
        B1.4

B2.1 ─→ B2.2 ─→ B2.3 ─→ B2.4 ─→ B2.5
       (needs B1.1)

B3.1 ─→ B3.2 ─→ B3.3
             └─→ B3.4
       (needs B1.2 for partitioning)

B4.1 ─→ B4.2 ─→ B4.3  (independent of B1/B2/B3 but unblocks them long-term)
```

**Minimum-viable Push B:** B1.1 + B1.2 + B2.1 + B2.2 + B2.3 + B2.4 = multi-tenant + horizontally scalable. ~6 weeks, 2 engineers. B3 and B4 are the longer-term hardening.

---

## Cross-Push Sequencing

Push A and Push B are **largely independent** and can run in parallel with different engineers. Two cross-dependencies:

1. **A2.5 (cross-vessel learning) needs B1.2 (RLS)** — otherwise "cross-vessel" silently leaks across tenants.
2. **A1.6 (closed-loop retraining cron) needs B3.2 (event spine)** for clean outcome→retraining triggers, _but_ can ship without it by polling the `prediction_outcomes` table.

**Recommended start order if engineers are scarce:**

1. **Week 1–6:** Push B minimum-viable (B1.1, B1.2, B2.1–B2.4). Unblocks SaaS sale; technical-buyer audit passes the multi-tenancy question.
2. **Week 4–12:** Push A minimum-viable (A1.1, A1.2, A1.3, A1.4, A1.7). Unblocks the credibility question on ML; technical-buyer audit passes "how was this prediction made?".
3. **Week 12+:** Depth on both — graph, 3D twin, event spine, repositories decomposition. Category-leading territory.

**Risk note:** Don't start A2/A3/B3/B4 before the minimum-viable items land. They're force-multipliers, not foundations.

---

## Out-of-Scope for These Two Pushes

These are listed in the audit but belong to a different push (UX/cockpit) that the audit also calls out:

- Persistent fleet status ribbon (Top-ROI #4)
- Equipment 360° drawer (Top-ROI #5)
- Alarm management subsystem (Top-ROI #6)
- Real AIS map on home (Top-ROI #4)
- All 10 of audit's "Top UX Improvements"
- All 10 of audit's "Top Features to Become Category-Leading" except those already mapped above

A "Push C — Operator Cockpit Redesign" sequencing doc should be drafted separately if/when those become the priority.

---

## Converting to Project Tasks

When this plan is approved:

1. Switch agent to Plan mode.
2. For each numbered item above, create one project task with:
   - **Title:** the bold task name
   - **Blocked-by:** the dependency column
   - **Body:** the Scope + Acceptance from the table
3. Group by Track using task tags (`push-a-track-1`, etc.) so the backlog stays navigable.

Estimated count: **31 project tasks** (7 in A1, 5 in A2, 4 in A3, 6 in B1, 5 in B2, 4 in B3, 3 in B4 — minus overlaps and bookkeeping the planner will merge).
