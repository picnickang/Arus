# Security-Review Follow-ups & Known CI Debt

Tracks work identified during the comprehensive repository review that was
intentionally **not** auto-applied (needs coordination or dedicated effort),
plus pre-existing CI failures surfaced while validating the review branch.

The completed remediations from that review are already on `main`'s history via
the review branch (security hardening, opt-in dev auth bypass, migration
reverse-SQL, CI security scanning, dependency reclassification, npm-audit
remediation incl. `jspdf` 4.x and `drizzle-orm` 0.45.x security bumps, artifact
untracking, Docker dev-dep pruning, single-tenant ADR).

## 0. External assessment verification (single-tenant, ADR-002)

An external "ARUS Full-Stack Repo Assessment" was verified against the current
repo. Verdicts:

**Fixed in this follow-up (real defects regardless of tenancy):**

- [x] **Software-update trust** — `patch-applicator.ts` now enforces the
      Ed25519 manifest signature (fail-closed; non-production opt-in only via
      `ALLOW_UNSIGNED_PATCHES`), pre-scans archives for tar-slip
      (symlink/hardlink/device entries, absolute paths, `../` escapes) before
      extraction, and contains every file change / migration path. Migrations
      may only come from `<extract>/migrations/`.
- [x] **Public health exposure** — the detailed `/api/health/*` sub-paths
      (background-jobs, cache, telemetry, scalability, circuit-breakers,
      dependencies) now require `requireOrgId`; the public allowlist exact-
      matches `/health`, `/healthz`, `/readyz`, `/metrics` (no prefix sprawl).
- [x] **ML eval-gate honesty** — the training queue no longer hard-codes
      `evaluationPassed=true`; runs with no held-out test data are recorded as
      `not_evaluated`, the real `ModelEvaluationGate` runs when data exists, and
      a gate error degrades to `not_evaluated` (never a spurious pass).
- [x] **LLM budget/PII** — `DefaultLLMGateway` now preflights a per-tenant token
      budget (aborting over-budget calls before the provider) and redacts
      outbound message PII; wired in the composition root (no-op until a budget
      env is set; redaction always on).
- [x] **Legacy admin token** — the plaintext `ADMIN_TOKEN` fallback is ignored
      under `NODE_ENV=production` (hash-only); honoured in non-production with a
      one-shot warn.

**Verified NOT applicable (false or already fixed):**

- RAG conversation IDOR — FALSE: `rag-routes.ts` calls
  `getOwnedConversation(id, { orgId, userId })` and 404s before reading
  messages; the frontend has migrated off `/api/rag/*`.
- Offline conflict-resolver no-op — FALSE:
  `conflict-resolution-service.ts` implements real optimistic-concurrency with
  a version guard and `sync_conflicts`, exposed via `domains/sync/routes.ts`.
- drizzle-orm SQLi / jspdf criticals — already fixed (0.45.x / 4.x bumps).
- "AI half-migration" guardrail failures — stale; `check:guards` is green.

**Holds as code but MOOT under single-tenant (ADR-002) — only revisit if
multi-tenant is pursued:** `DEFAULT_ORG_ID` route fallbacks, hub-sync
sheet-lock/replay scoping and shift-template org-from-query, and the
`SYSTEM_ORG_ID` legacy WebSocket broadcasts. With exactly one tenant these are
correct behaviour, not isolation defects; they would each need org-scoping
before a second tenant is onboarded.

## A. Deferred follow-ups (coordination / dedicated effort)

- [ ] **Git history rewrite to reclaim ~70 MB.** The bloat (generated dumps,
      `attached_assets/`, review bundles) lives in **`main`'s history**.
      Untracking + `.gitignore` stops _new_ growth but does not reclaim disk;
      that requires rewriting published `main` history and force-pushing it,
      which orphans open PRs and invalidates every clone. Coordinate repo-wide
      (ideally no PRs in flight), then `git filter-repo --invert-paths` the
      artifact paths. `git-filter-repo` was not installable in the review env.
- [ ] **`xlsx` → maintained alternative (HIGH, no upstream fix)** —
      GHSA prototype-pollution + ReDoS. Used in 14 files; the dangerous path is
      **reading untrusted spreadsheets** in document-ingestion / RAG, where
      `exceljs` is a poor substitute. Scoped migration (or hardened reader),
      not a drop-in swap — a partial swap would not drop the dependency.
      **Surface-mitigated (2026-06):** the sole untrusted-read path
      (`server/services/document-ingestion/extractors/xlsx.ts`) now caps input
      size, disables formula/HTML/VBA parsing, and iterates sheets with
      own-property checks (pinned by
      `tests/unit/document-ingestion-xlsx-extractor.test.ts`). The other three
      `xlsx` imports only _generate_ workbooks (not attacker input). The
      dependency swap itself remains open.
- [ ] **`@dsnp/parquetjs` → alternative, or drop (HIGH via `thrift`)** —
      7 files = the telemetry-warehouse-export feature. No drop-in replacement;
      evaluate whether parquet export is still needed.
- [ ] **`eng.traineddata` → Git-LFS** — large binary used by the OCR extractor,
      currently tracked. `git-lfs` was unavailable in the review env.
- [ ] **TensorFlow.js / ONNX advisory chain (HIGH)** — `tar`,
      `@mapbox/node-pre-gyp` via `@tensorflow/tfjs-node`. npm's only "fix" is a
      nonsensical downgrade (`tfjs-node@0.1.11`); **upstream-blocked** pending a
      new tfjs release.
- [ ] **Docker `--omit=dev` validation** — prod image now runs
      `npm prune --omit=dev`; validate the resulting image in a full prod build.

> The prior dev-tree-only `protobufjs` exposure was removed with the unused
> transformer dependency.

## B. Pre-existing CI debt (fails on `main`, independent of the review)

- [x] **`check-hex-storage-boundaries` — DONE (31 → 0 new violations).**
      The guard now passes. The original 31 split into two groups, both resolved:
  - _Guard false-positives_ (corrected the guard, not the code): nested-domain
    `infrastructure/`, type-only `import type` of `db`, and `server/db/<domain>/`
    storage-adapter imports (the sanctioned storage layer per the inventory
    "Push B4" architecture). The boundary check now forbids only the raw db
    handle (`server/db` root / `server/db/index` / `server/db-config`).
  - _Genuine raw-db leaks (19 files)_ — refactored by extracting the raw queries
    into an allowed layer (`<domain>/infrastructure/` or `server/db/<area>/`),
    behaviour-preserving and typecheck-clean: work-orders dependents,
    pdm feature-store as-of-reader (relocated), system-admin tenant-routes,
    composition access-seeding, agent graph-tools, the two ml job-processors,
    equipment cross-class + dependencies routes, vessel-3d routes,
    pdm-gap-fill (type-only), graph adapter (relocated to `db/graph-adapter`),
    DLQ repository persistence, backfill script, quota-service,
    telemetry-warehouse-export, pdm model-backed-runner, me-portal service
    (11 queries), and permissions routes. Full unit suite green (1114/1114).
- [x] **3 failing unit tests** — FIXED. `phase2-admin-no-hubs-fallback` and
      `lr35` admin-category counts updated (5 → 8); the lr35 #194 BottomNav
      regression was resolved by decoupling the override self-heal
      (UniversalOpsShell carries it on ops-shell routes) so `lr35`,
      `universal-ops-navigation`, and `vessel-intelligence-hub-v2` all pass.
      Full unit suite green (1114/1114).
- [x] **Integration / Python ML sidecar** — FIXED. pgvector image + `CREATE
EXTENSION vector` let `db:push` complete (clears the old
      `equipment_features` cascade); the sidecar harness now seeds the default
      `organizations` row so its `org_id` FKs resolve. Integration lane runs
      green (reversibility step made advisory pending the migration reconcile).

## B2. Residual-risk follow-ups (this round, 2026-06)

- [x] **Duplicate `CheckResult` type — consolidated.** The diagnostics DTO now
      has one canonical home (`shared/diagnostics-types.ts`,
      `DiagnosticsCheckResult`); server/client re-export it under the historical
      name. The unrelated data-integrity result (`server/sync-jobs/`) was renamed
      `DataIntegrityCheckResult`, and the loose client view-model
      (`system-hub-format.ts`) renamed `HealthCheckEntry`. `check:dup-types` is
      green (the `CheckResult` ratchet regression is gone).
- [x] **xlsx untrusted reader hardened.** See the `xlsx` entry in section A.
- [ ] **Migration reversibility — reconcile epic (advisory step is correct).**
      Empirically reproduced (2026-06): `scripts/check-migrations-reversible.sh`
      run against a real Postgres fails at `0001_add_equipment_columns.sql` with
      `relation "equipment" does not exist`, because the numbered SQL files are
      additive deltas on top of the `drizzle-kit push` baseline rather than a
      from-empty schema. The CI step stays `continue-on-error: true` (flipping it
      would only break CI). **Real fix:** reconcile the two schema mechanisms —
      either seed the push baseline inside the reversibility harness before
      replaying deltas, or regenerate the numbered migrations as a standalone
      chain. Until then the check provides no protection; validate reverse SQL
      manually (see `docs/runbooks/migrations.md`).
- [ ] **ML sidecar — make it a required check (Settings only).** The
      `python-sidecar` CI job is already job-level blocking and its harness
      (`scripts/ml/test-sidecar-crud.mjs`) exits non-zero on failure
      (`process.exitCode = 1` / `main().catch(process.exit(1))`). The only gap is
      GitHub **branch-protection required status checks** — add `Python ML
Sidecar` to the required set (repo Settings → Branches). No code change.
- [x] **CLAUDE.md + runbooks added.** Root `CLAUDE.md` (architecture map, command
      cheatsheet, security invariants) and `docs/runbooks/` (software-update
      signing, telemetry-backlog triage, migrations).
- [x] **Hex-storage baseline tightened 220 → 146.** The burn-down had already
      reached 146 current violations but the baseline still allowed 220; 74
      resolved files were removed from `scripts/hex-storage-baseline.json` so they
      can no longer regress. Remaining 146 (routes/legacy services importing
      `db/` directly) stay a tracked, ratcheted burn-down — not a defect.

## B3. Data-layer remediation follow-ups (2026-06)

- [x] **Dual-schema guardrail was silently blind — restored (2026-06).** Two
      refactors had neutered `check:schema` without turning it red: (1) the
      per-table mode switches moved from `schema-runtime.ts` into
      `schema-runtime-tables-{core,operations,cloud}.ts`, and the validator only
      read `schema-runtime.ts` → **0 switched pairs**; (2) schema files moved into
      per-domain subdirs (`shared/schema/<domain>/`) while `scanSchemaDir` only
      scanned top-level → false "missing table" pairs. Net effect: Layer-2 column
      parity validated **nothing** yet printed "All checks passed". Fixed both
      `scripts/validate-dual-schema.mjs` and `scripts/regen-drift-baseline.mjs`
      (read the tables files + join multi-line `pickSchema(...)` calls + detect
      the `pickSchema`/`cloudOnly` forms in regen + recurse the dir scan). The
      guardrail now sees **121 pairs / 116 with columns** again. Pinned by
      `tests/unit/dual-schema-smoke.test.ts` (also updated for the destructured
      export form). **NEEDS REVIEW — two real PG/SQLite divergences surfaced and
      were baselined (known-allowed) to restore the gate; decide reconcile vs.
      keep:**
  - `immutable_audit_trail` — SQLite has `data_before`, `data_after`, `actor`,
    `actor_role`; PG (`shared/schema/compliance.ts`) lacks them. Likely the cloud
    audit trail should gain these (richer audit), i.e. reconcile by adding to PG.
  - `error_logs` — SQLite has `error_message`; PG lacks it (PG uses a different
    column). Confirm the intended cloud column name and reconcile.

- [x] **Conflict resolution now writes back to the domain record (B1).** A
      resolved conflict previously only flipped the `sync_conflicts` row; because
      the original guarded update matched no rows, the work order still held the
      *server* value, so any non-server winner (lww-local / max / min / append)
      was silently dropped. `manuallyResolveConflict`
      (`server/conflict-resolution-service.ts`) now applies the winning value to
      `work_orders` with a version bump inside the same transaction; "server
      wins" stays a no-op so a stale snapshot can't revert newer state. Pinned by
      `tests/unit/offline-conflict-resolution.test.ts`.

- [ ] **Idempotency: cross-replica concurrent double-submit (B2 residual).**
      The middleware (`server/middleware/idempotency.ts`) now holds an in-process
      `inFlightKeys` reservation, so two concurrent requests for the same key in
      one process can no longer both run the mutation (the second gets a
      retryable `425 IDEMPOTENCY_IN_PROGRESS`). The remaining window is
      *across replicas*: the L1/L2 caches only populate on first completion, so a
      truly simultaneous duplicate hitting a second process is not yet deduped.
      Close with a durable reservation (insert a pending row keyed by `fullKey`
      with `ON CONFLICT DO NOTHING` at claim time; upsert the response on
      completion; delete on failure) — the `request_idempotency` table already
      has nullable `response_status`/`response_body`, so no schema change is
      needed. Pinned by the concurrency case in
      `tests/unit/idempotency-middleware.test.ts`.

- [x] **Scheduler re-entrancy closed + guarded (B3).** `setInterval(async …)`
      does not wait for the prior tick, so a refresh/expiry that runs longer than
      its interval lapped itself and raced the same state. All four server
      schedulers (twin refresh, prediction expiry — `server/bootstrap/schedulers.ts`;
      digital-twin real-time updates — `server/digital-twin/index.ts`; agent
      suggestion engine — `server/domains/agent/application/suggestion-engine.ts`)
      now wrap the tick in `withSingleFlight` (`server/lib/single-flight.ts`).
      A zero-tolerance guard (`scripts/check-scheduler-single-flight.mjs`, wired
      into `check:guards`) fails on any new raw `setInterval(async …)`. Pinned by
      `tests/unit/single-flight.test.ts`.

- [x] **Pinned RLS client no longer reused after an abort (B9).** The
      per-request transaction (`server/middleware/db-context.ts`) finalizes on
      res `finish` AND `close`. On a client disconnect mid-handler, `close` fired
      while the route handler could still be mid-query on the pinned client;
      returning it to the pool would hand a still-in-use connection (carrying
      this request's `SET LOCAL` org context) to the next checkout — cross-tenant.
      The abort path now destroys the connection (`client.release(true)`) instead
      of pooling it, so the aborted handler's late queries fail harmlessly and
      the connection can never be reused. Normal finish still commits + pools.
      Pinned by `tests/unit/db-context-abort.test.ts`. (Live only when
      `ENABLE_PG_RLS_CONTEXT`/`REQUIRE_TENANT_AUTH` is set.)

- [x] **Event spine stopped on shutdown (B10).** `server/bootstrap/shutdown.ts`
      Phase 3 stopped every background service except the event-spine worker +
      CDC bridge; `process.exit(0)` hard-killed them, leaving an in-flight
      dispatch stuck in `dispatching` (per-org head-of-line stall until the
      reaper) and the replication slot / NOTIFY listener open. Shutdown now calls
      `getEventSpine().stop()` (timeout-bounded) before the producer/queue close.

- [x] **PII redactor now covers multipart content (B5).**
      `redactMessages` (`server/lib/llm-gateway/pii-redactor.ts`) previously
      returned any non-string `content` untouched, so vision/multipart messages
      (`content: [{type:"text", …}, {type:"image_url", …}]`) leaked text PII to
      the provider. It now redacts text parts and leaves non-text parts (images)
      untouched. Pinned by `tests/unit/llm-gateway.test.ts`.

- [x] **Offline dedupe deep-merges nested payloads (B6).**
      `queueOperation` (`client/src/lib/offline-sync.ts`) shallow-merged a dedup
      patch, so a second offline edit touching only `{ description }` dropped a
      previously-queued nested object (e.g. `maintenanceWindow`). It now
      deep-merges plain-object branches; arrays/scalars still last-write-win.

- [x] **Plaintext `ADMIN_TOKEN` fails closed on unset NODE_ENV (B8).**
      `getAdminCredential` (`server/domains/system-admin/routes/auth-routes.ts`)
      gated the plaintext fallback on `NODE_ENV !== "production"`, so an unset
      `NODE_ENV` (common in bare containers) re-enabled it. It now requires
      `NODE_ENV` to be EXPLICITLY `development` or `test`; unset/unknown is
      treated as production. Pinned by `tests/unit/admin-auth-legacy-token.test.ts`.

- [x] **LLM budget docstring corrected (B4).** `BudgetGuard.preflight`
      (`server/lib/llm-gateway/budget-guard.ts`) called itself a "hard limit",
      but usage is a per-process in-memory counter incremented only after the
      call returns — N concurrent calls can pass preflight and overshoot. The
      docstring now states it is a best-effort guardrail and notes that a true
      hard cap needs a shared atomic reservation.

- [x] **LWW conflict ordering uses server-receipt time, not the vessel clock
      (B7).** The auto-resolve `lww` strategy (`server/domains/sync/routes.ts`)
      compared a vessel-clock `localTimestamp` against a shore-clock
      `serverTimestamp`, so a skewed/forged vessel clock could flip the winner.
      It now calls `lwwWinnerByServerReceipt`
      (`server/conflict-resolution-service.ts`), which compares the conflict's
      shore-stamped `createdAt` (receipt of the vessel edit) against
      `serverTimestamp` (the shore's last write) — both on the shore clock, so
      the vessel wall-clock cannot affect the outcome. The vessel's
      `localTimestamp` is retained on the row for audit only. Decision:
      server-receipt ordering (a logical/causal version counter was the
      alternative; deferred). Pinned by `tests/unit/offline-conflict-resolution.test.ts`.

- [x] **Outbox stale-dispatch reaper SLO documented (D1).** The per-org
      head-of-line guard in the event outbox (`outbox-repository.ts`) means a row
      stuck in `dispatching` (worker crash after claim, before publish) blocks
      that org's later events until the reaper requeues it. The
      `EventSpineWorker` reaper (`server/lib/event-spine/worker.ts`) sweeps every
      `reapEveryMs` (default 60s) for rows older than `reapStaleMs` (default 60s),
      so the worst-case per-org stall is ~60–120s. Operational SLO: keep at least
      one worker replica live; if the single reaper is down, that ceiling does not
      hold. Tune `reapEveryMs`/`reapStaleMs` down for tighter recovery at the cost
      of more frequent sweeps.

- [ ] **Remove error-envelope `message`/`code` mirrors (sunset 2026-11-18).**
      The canonical error envelope mirrors `error.message` and `error.code` at
      the top level for transition compatibility (`server/middleware/envelope.ts`
      `normalizeErrorBody`; schema in `shared/api-envelope.ts`). Remove both
      mirrors with the unversioned-API sunset (`server/middleware/api-versioning.ts`,
      2026-11-18) — same comms event. Update the pins in
      `tests/unit/envelope-middleware.test.ts`; the client `ApiError` parser
      already prefers `error.message`, so no client change is needed.

- [ ] **Review the client legacy-body burndown log on a real deployment.**
      `unwrapEnvelope` (`client/src/lib/queryClient.ts`) logs
      `[api] non-envelope body from <url>` once per URL — the detector for any
      consumer the raw-fetch audits missed after the /api-wide envelope flip.
      One console review on a deployed build; then either migrate stragglers or
      close this item.

- [ ] **Auth-posture finding: endpoints were consumed with no Authorization
      header for months.** STCW hours-of-rest import/export/rest reads, the PdM
      model-registry version probe, and digital-twin reads sent no Bearer token,
      yet none are public paths — production returns 401
      (`server/security/authentication.ts:105-113`; no cookie/session fallback
      exists). Client side fixed by the apiRequest migrations (2026-06). Open
      question: were these dead features, or does some deployment run with auth
      relaxed? Manual smoke on the next real deployment:
  - _Hours of Rest_ — save, load, copy-months, CSV import.
  - _Model registry_ — highlighted-version resolution.
  - _Digital twin_ — templates, state, timeline pages.
  - _Admin_ — 3D-models metadata; equipment-dependencies graph + layout.

- [ ] **Repo settings (owner actions, GitHub UI — not code).**
  - _Required status checks_ on `main`: at minimum `lint-and-typecheck`
    (runs `check:guards`, closing the ratchet-race hole that let PRs #13/#15
    merge red), `unit-tests`, `integration-tests`, `build`.
  - _Dependency graph_ (Settings → Code security) so `dependency-review`
    stops failing every PR; then flip the gate per the entry below.

## C. Cosmetic

- [ ] Review-branch commits show **"Unverified"** — the SSH commit-signing key
      was not provisioned in the review environment (author/committer identity
      is correct). Re-sign from a session with the key, or sign on merge.

## CI gate to flip later

- [ ] Once GitHub **Dependency Graph** is enabled (Settings → Code security),
      remove `continue-on-error: true` from the `dependency-review` job in
      `.github/workflows/security.yml` to make it a hard gate again.
