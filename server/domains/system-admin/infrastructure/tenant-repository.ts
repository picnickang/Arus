/**
 * Infrastructure: tenant lifecycle data access.
 *
 * Holds the raw `db` access for the tenant admin routes (list / provision /
 * suspend / unsuspend) plus the `TenantDeleteService` wiring, so the route
 * layer (routes/tenant-routes.ts) depends on this repository instead of the
 * database handle directly (hexagonal storage boundary). SQL is unchanged —
 * moved verbatim from the route.
 */
import { sql } from "drizzle-orm";
import { db } from "../../../db-config";
import { TenantDeleteService } from "../../../services/tenant-delete-facade";
import { TENANT_TABLE_NAMES } from "../../../tenancy/tenant-tables";

interface PgExecResult {
  rows?: unknown[];
  [key: string]: unknown;
}

export interface TenantRow {
  id: string;
  name: string;
  slug: string | null;
  suspended_at: string | null;
  suspension_reason: string | null;
  max_storage_bytes: number | null;
  max_equipment_count: number | null;
  max_telemetry_rows_per_day: number | null;
}

export interface ProvisionTenantInput {
  id: string;
  name: string;
  slug?: string;
  maxStorageBytes?: number;
  maxEquipmentCount?: number;
  maxTelemetryRowsPerDay?: number;
}

export async function listTenants(): Promise<TenantRow[]> {
  const result = (await db.execute(
    sql`SELECT o.id, o.name, o.slug, o.suspended_at, o.suspension_reason,
               q.max_storage_bytes, q.max_equipment_count,
               q.max_telemetry_rows_per_day
        FROM organizations o
        LEFT JOIN tenant_quotas q ON q.org_id = o.id
        ORDER BY o.id`
  )) as object as PgExecResult | TenantRow[];
  return Array.isArray(result)
    ? (result as TenantRow[])
    : (((result as PgExecResult).rows as TenantRow[] | undefined) ?? []);
}

export async function provisionTenant(t: ProvisionTenantInput): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.execute(
      sql`INSERT INTO organizations (id, name, slug)
          VALUES (${t.id}, ${t.name}, ${t.slug ?? t.id})
          ON CONFLICT (id) DO NOTHING`
    );
    await tx.execute(
      sql`INSERT INTO tenant_quotas (org_id, max_storage_bytes,
            max_equipment_count, max_telemetry_rows_per_day)
          VALUES (
            ${t.id},
            ${t.maxStorageBytes ?? 10737418240},
            ${t.maxEquipmentCount ?? 5000},
            ${t.maxTelemetryRowsPerDay ?? 10000000}
          )
          ON CONFLICT (org_id) DO UPDATE SET
            max_storage_bytes = EXCLUDED.max_storage_bytes,
            max_equipment_count = EXCLUDED.max_equipment_count,
            max_telemetry_rows_per_day = EXCLUDED.max_telemetry_rows_per_day,
            updated_at = now()`
    );
  });
}

export async function suspendTenant(orgId: string, reason: string): Promise<void> {
  await db.execute(
    sql`UPDATE organizations
        SET suspended_at = now(), suspension_reason = ${reason}
        WHERE id = ${orgId}`
  );
}

export async function unsuspendTenant(orgId: string): Promise<void> {
  await db.execute(
    sql`UPDATE organizations
        SET suspended_at = NULL, suspension_reason = NULL
        WHERE id = ${orgId}`
  );
}

/**
 * Build a TenantDeleteService bound to the server's db handle. The
 * constructor's `db` parameter is intentionally typed loosely so it can also
 * accept a transaction inside tests.
 */
export function createTenantDeleteService(signingSecret: string): TenantDeleteService {
  return new TenantDeleteService({
    db: db as object as ConstructorParameters<typeof TenantDeleteService>[0]["db"],
    tables: TENANT_TABLE_NAMES.map((table) => ({ table })),
    signingSecret,
  });
}
