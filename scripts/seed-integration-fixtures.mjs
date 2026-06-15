/**
 * Seed the minimal parent fixtures the forms/journeys contract lane needs.
 *
 * tests/integration/forms/_helpers.ts#getRefIds requires at least one
 * vessel / active equipment / crew / supplier under TEST_ORG_ID
 * ("default-org-id") to exist before the suites run; it reads (never creates)
 * them. This seeder is idempotent (stable ids + ON CONFLICT DO NOTHING) so it
 * is safe to re-run, and is invoked by the `integration-postgres` CI job after
 * `db:push`.
 *
 * Usage: DATABASE_URL=postgres://... node scripts/seed-integration-fixtures.mjs
 */
import pg from "pg";

const url = process.env["DATABASE_URL"];
if (!url) {
  console.error("[seed] DATABASE_URL is required");
  process.exit(1);
}

// Fixed to the canonical single-tenant org the forms helper reads
// (TEST_ORG_ID). The fixture ids below are constant, so a different org would
// skip the ON CONFLICT inserts and fail the count check — no override exposed.
const ORG = "default-org-id";

// Fixture primary keys are real UUIDs: several create endpoints (e.g.
// POST /api/equipment) validate referenced ids with `z.string().uuid()`, so a
// non-UUID vessel id would 400 the contract suites. getRefIds() reads these
// back from the DB, so the tests never hard-code them.
const IDS = {
  vessel: "11111111-1111-4111-8111-111111111111",
  equipment: "22222222-2222-4222-8222-222222222222",
  crew: "33333333-3333-4333-8333-333333333333",
  supplier: "44444444-4444-4444-8444-444444444444",
};
const pool = new pg.Pool({ connectionString: url });

async function main() {
  await pool.query(
    `INSERT INTO organizations (id, name, slug) VALUES ($1, 'Default Organization', 'default')
     ON CONFLICT (id) DO NOTHING`,
    [ORG]
  );
  await pool.query(
    `INSERT INTO vessels (id, org_id, name) VALUES ($2, $1, 'MV Integration Fixture')
     ON CONFLICT (id) DO NOTHING`,
    [ORG, IDS.vessel]
  );
  await pool.query(
    `INSERT INTO equipment (id, org_id, name, type, vessel_id, is_active)
     VALUES ($2, $1, 'Fixture Main Engine', 'engine', $3, true)
     ON CONFLICT (id) DO NOTHING`,
    [ORG, IDS.equipment, IDS.vessel]
  );
  await pool.query(
    `INSERT INTO crew (id, org_id, name) VALUES ($2, $1, 'Fixture Crew Member')
     ON CONFLICT (id) DO NOTHING`,
    [ORG, IDS.crew]
  );
  await pool.query(
    `INSERT INTO suppliers (id, org_id, name, code) VALUES ($2, $1, 'Fixture Supplier', 'FIX-1')
     ON CONFLICT (id) DO NOTHING`,
    [ORG, IDS.supplier]
  );

  const { rows } = await pool.query(
    `SELECT
       (SELECT count(*)::int FROM vessels WHERE org_id = $1) AS vessels,
       (SELECT count(*)::int FROM equipment WHERE org_id = $1 AND is_active = true) AS active_equipment,
       (SELECT count(*)::int FROM crew WHERE org_id = $1) AS crew,
       (SELECT count(*)::int FROM suppliers WHERE org_id = $1) AS suppliers`,
    [ORG]
  );
  const r = rows[0];
  console.log(`[seed] fixtures for org=${ORG}:`, r);
  if (!r.vessels || !r.active_equipment || !r.crew || !r.suppliers) {
    console.error("[seed] missing one or more required fixtures after seeding");
    process.exit(1);
  }
}

main()
  .then(() => pool.end())
  .catch((err) => {
    console.error("[seed] failed:", err instanceof Error ? err.message : err);
    pool.end();
    process.exit(1);
  });
