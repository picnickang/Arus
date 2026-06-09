# Postgres Contract Tests

## Purpose

The Postgres contract lane covers behavior that must not be reinterpreted as embedded SQLite behavior:

- row-level security and tenant isolation at the database layer
- PostgreSQL migrations and schema contracts
- immutable audit-chain hash verification
- quota throttling and database-backed upload limits
- safety bulletin feed behavior that is built around a direct `pg` pool

## Command

```bash
npm run test:integration:postgres
```

## Fail-Fast Behavior

If `DATABASE_URL` is missing, the lane exits immediately with setup instructions. This is intentional. The default release gate must not require PostgreSQL or produce low-signal `ECONNREFUSED` noise.

Example:

```bash
DATABASE_URL=postgresql://user:pass@localhost:5432/arus_test npm run test:integration:postgres
```

## Current Suites

- `tests/integration/audit-chain-mixed-hash-versions.test.ts`
- `tests/integration/cross-tenant-domains.test.ts`
- `tests/integration/rls-cross-tenant-api.test.ts`
- `tests/integration/rls-cross-tenant.test.ts`
- `tests/integration/safety-bulletins-feed.test.ts`
- `tests/integration/tenant-quota-throttle.test.ts`

## Current Status

Not part of the default release gate. Requires a seeded PostgreSQL contract database and explicit `DATABASE_URL`.

## Required Before Full Production

- Document seed requirements.
- Run the lane in CI against a disposable PostgreSQL service.
- Keep the embedded lane separate; do not run Postgres contract tests against SQLite.
