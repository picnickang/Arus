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

const ORG = process.env["SEED_ORG_ID"] || "default-org-id";
const pool = new pg.Pool({ connectionString: url });

async function main() {
  await pool.query(
    `INSERT INTO organizations (id, name, slug) VALUES ($1, 'Default Organization', 'default')
     ON CONFLICT (id) DO NOTHING`,
    [ORG]
  );
  await pool.query(
    `INSERT INTO vessels (id, org_id, name) VALUES ('seed-vessel-1', $1, 'MV Integration Fixture')
     ON CONFLICT (id) DO NOTHING`,
    [ORG]
  );
  await pool.query(
    `INSERT INTO equipment (id, org_id, name, type, vessel_id, is_active)
     VALUES ('seed-equip-1', $1, 'Fixture Main Engine', 'engine', 'seed-vessel-1', true)
     ON CONFLICT (id) DO NOTHING`,
    [ORG]
  );
  await pool.query(
    `INSERT INTO crew (id, org_id, name) VALUES ('seed-crew-1', $1, 'Fixture Crew Member')
     ON CONFLICT (id) DO NOTHING`,
    [ORG]
  );
  await pool.query(
    `INSERT INTO suppliers (id, org_id, name, code) VALUES ('seed-supplier-1', $1, 'Fixture Supplier', 'FIX-1')
     ON CONFLICT (id) DO NOTHING`,
    [ORG]
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
