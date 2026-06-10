# CLAUDE.md

Working notes for AI agents and contributors. Keep this current when architecture,
commands, or invariants change.

## What ARUS is

A **single-tenant** marine-fleet predictive-maintenance / scheduling / crew / RAG platform.
Node + TypeScript (Express) server, Vite + React client, Drizzle ORM over a **dual
PostgreSQL / SQLite** schema. Two deployment modes:

- **CLOUD** — Postgres + Redis + job queue (shore-side).
- **VESSEL** — SQLite, offline-first, local-only (onboard).

Single-tenancy is canonical per **`docs/adr/002-single-tenant-operating-model.md`**: there is
one organization, addressed by `DEFAULT_ORG_ID` (`@shared/config/tenant`). `org_id` columns are
retained for forward-compatibility but are **not** an isolation boundary today. Do not add
multi-tenant isolation logic without revisiting ADR-002.

## Layout

- `server/domains/<domain>/` — 62 hexagonal domains, each split into
  `domain/ · application/ · infrastructure/ · interfaces/`. Cross-domain imports are
  forbidden (guarded). Raw DB access lives only in `infrastructure/` (or `server/db/<area>/`).
- `server/composition/` — lightweight dependency wiring (e.g. `llm-gateway.ts`).
- `server/lib/`, `server/services/` — shared libs and cross-domain services.
- `shared/` — schema (`shared/schema/*`, dual PG/SQLite) and cross-cutting DTOs; importable from
  both server and client via the `@shared/*` alias.
- `client/src/` — feature-colocated React (`features/ · components/ · pages/ · hooks/ ·
contexts/`, with thin `application/` + `infrastructure/` for navigation).
- `migrations/` — numbered SQL deltas (`NNNN_*.sql` + matching `.down.sql`) applied **on top of**
  the `drizzle-kit push` baseline (see Gotchas).

## Commands

```
npm run dev               # dev server (NODE_ENV=development, ARUS_DEV_LOGIN=1)
npm run check             # tsc --noEmit (typecheck)
npm run lint              # eslint .
npm run format            # prettier --write
npm run check:guards      # ALL architecture/type-debt guards (run before pushing)
npm run test:unit         # unit lane — ESM (--experimental-vm-modules)
npm run test:integration  # integration lane (embedded SQLite by default)
npm run build             # vite (client) + esbuild (server)
npm run db:push           # push Drizzle schema to the DB
```

Run a single unit test file (the lane needs the ESM flag — plain `npx jest` will fail on
`jest.unstable_mockModule`):

```
node --experimental-vm-modules node_modules/jest/bin/jest.js tests/unit/<file>.test.ts --forceExit
```

## Security invariants (do not regress)

- **Org context:** every non-public route goes through `requireOrgId`. The unauthenticated
  surface is an **exact-match** allowlist in `server/bootstrap/public-api-paths.ts`, pinned by
  `tests/unit/lr35-public-api-paths-audit.test.ts`. Adding a public path requires a justification
  comment **and** a negative-pin test.
- **Software updates** must be Ed25519-signed: `server/services/patch-applicator.ts`
  (`verifyPatchTrust`) fails closed when `UPDATE_SIGNING_PUBLIC_KEY` is unset; archives are
  tar-slip pre-scanned (`assertSafeArchive`) and every file path is contained via
  `validatePath` (`server/lib/secure-exec.ts`). Subprocesses use `runTrustedExecutable` only.
- **LLM calls** go through the gateway (`server/lib/llm-gateway/`): messages are PII-redacted and
  budget-preflighted **before** the provider is hit (`gateway.ts`), wired in
  `server/composition/llm-gateway.ts`.
- **Admin auth:** plaintext `ADMIN_TOKEN` is ignored in production (hash-only); credentials use
  constant-time comparison (`server/lib/constant-time-compare.ts`).
- **DB access** is parameterized via Drizzle (`eq()` / bound `sql`). No string-concatenated SQL.

## Guardrails

`check:guards` enforces domain boundaries, the hexagonal storage boundary
(`scripts/check-hex-storage-boundaries.mjs`, baselined burn-down), and type-debt ratchets
(duplicate types, `as any` / cast burndown, zod escape hatches, etc.). They ratchet **down only** —
do not raise a baseline to make a check pass; fix the code or consolidate. Some checks are
monotonic baselines under `scripts/*-baseline.json`.

## Gotchas

- **Migrations are deltas, not a standalone schema.** The canonical schema is produced by
  `drizzle-kit push`; the numbered SQL files ALTER tables that push already created. A from-empty
  replay fails at `0001` (`relation "equipment" does not exist`). The reversibility CI step
  (`scripts/check-migrations-reversible.sh`) is therefore advisory pending a migration reconcile —
  see `docs/SECURITY-REVIEW-FOLLOWUPS.md`.
- **Unit lane is ESM.** Use `jest.unstable_mockModule` + dynamic `import()` (hoisted `jest.mock`
  is a no-op under `--experimental-vm-modules`).
- **Commit identity** must be `noreply@anthropic.com`; never put model identifiers in commits,
  PRs, or code.

## More docs

ADRs in `docs/adr/` and `docs/architecture/adr/`; the security ledger in
`docs/SECURITY-REVIEW-FOLLOWUPS.md`; operational runbooks in `docs/runbooks/`.
