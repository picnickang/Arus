# ARUS

ARUS is a marine predictive-maintenance and operations platform. It combines
crew, vessel, work-order, telemetry, compliance, inventory, analytics, and ML
workflows into one TypeScript application.

## Architecture At A Glance

- `client/src/` contains the React app, UI components, route pages, and
  frontend application services.
- `server/` contains the Express API, domain routers, repositories, bootstrap
  services, integrations, sync jobs, telemetry, and ML orchestration.
- `shared/` contains schemas, shared types, runtime schema adapters, and
  cross-tier domain helpers.
- `migrations/` contains database migrations; every forward migration must have
  a matching `.down.sql`.
- `src-tauri/` and `ios/` support desktop/mobile packaging surfaces.

The backend is organized around domain modules registered through
`server/routes/domain-router-registry.ts`. Some modules are loaded dynamically,
so keep `knip.json` in sync when adding or removing router entries.

## Deployment Modes

- **Cloud mode:** PostgreSQL/Neon-backed deployment with the full server stack.
- **Vessel/local mode:** SQLite/libSQL-backed offline-first deployment for vessel
  environments.

The dialect bridge lives in `shared/schema-runtime.ts`; schema parity is checked
by `npm run check:schema`.

## Local Setup

```bash
npm ci
npm run dev
```

The dev server defaults to port `5000`. Most server commands expect a valid
`DATABASE_URL`; test and CI flows use a local PostgreSQL service.

## Quality Gates

Common pre-PR commands:

```bash
npm run lint
npm run check
npm run check:guards-full
npm run test:unit
npm run test:integration
npm run build
```

Additional focused checks:

```bash
npm run check:dead-code
npm run check:duplication
npm run test:coverage:summary
npx playwright test
```

`check:guards-full` combines schema parity, route registration, domain-boundary,
type-debt, hygiene, boot-health, and formatting checks. Several guards use
monotonic burndown baselines; never raise a baseline just to make a regression
pass.

## Common Edit Areas

- New API surface: add or update a domain router and keep router registration
  centralized.
- Shared request/response contracts: prefer Zod schemas and `z.infer` types.
- Database changes: update both Postgres and SQLite schema paths and include a
  reverse migration.
- Frontend workflows: keep page-level route behavior separate from reusable UI
  components and view models.
- Permission-sensitive changes: add tests around tenant scope, authorization,
  lockout protection, and audit output.

## Repo Hygiene

`attached_assets/` contains historical prompt/input material and large reference
assets. Treat it as supporting context, not product source; do not add to it
without an explicit reason.

## More Documentation

- `CONTRIBUTING.md` for contributor rules and guardrail details.
- `docs/TESTING_GUIDE.md` for test-lane selection and coverage notes.
- `replit.md` for project architecture and Replit-specific operating context.
- `docs/adr/` for architecture decisions.
