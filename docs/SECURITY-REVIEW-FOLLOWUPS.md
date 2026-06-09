# Security-Review Follow-ups & Known CI Debt

Tracks work identified during the comprehensive repository review that was
intentionally **not** auto-applied (needs coordination or dedicated effort),
plus pre-existing CI failures surfaced while validating the review branch.

The completed remediations from that review are already on `main`'s history via
the review branch (security hardening, opt-in dev auth bypass, migration
reverse-SQL, CI security scanning, dependency reclassification, npm-audit
remediation incl. `jspdf` 4.x and `drizzle-orm` 0.45.x security bumps, artifact
untracking, Docker dev-dep pruning, single-tenant ADR).

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

> The lone remaining **critical** (`protobufjs`) is dev-tree-only (via
> `@xenova/transformers`, a devDependency) and is not shipped to production.

## B. Pre-existing CI debt (fails on `main`, independent of the review)

- [ ] **`check-hex-storage-boundaries` baseline drift** — baseline allows 220
      files importing `db/` directly; current is **249** (31 new, 2 resolved).
      Fix the 31 boundary violations or consciously re-baseline.
- [ ] **3 failing unit tests** — `tests/unit/phase2-admin-no-hubs-fallback.test.ts`
      (expects 5 admin categories, gets 8) and
      `tests/unit/lr35-bottom-nav-override-leak.test.ts`. Tests appear stale vs.
      the current admin-nav configuration.
- [ ] **Integration / Python ML sidecar** — `relation "equipment_features" does
    not exist` during the sidecar CRUD/trainer harness; schema/migration setup
      gap.

## C. Cosmetic

- [ ] Review-branch commits show **"Unverified"** — the SSH commit-signing key
      was not provisioned in the review environment (author/committer identity
      is correct). Re-sign from a session with the key, or sign on merge.

## CI gate to flip later

- [ ] Once GitHub **Dependency Graph** is enabled (Settings → Code security),
      remove `continue-on-error: true` from the `dependency-review` job in
      `.github/workflows/security.yml` to make it a hard gate again.
