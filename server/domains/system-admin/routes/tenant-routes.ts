/**
 * Push B1 step 5 — Tenant lifecycle admin endpoints.
 *
 * These routes are mounted by `registerSystemAdminRoutes` under
 * `/api/admin/tenants`. They give a platform admin the ability to:
 *   - List all tenants (with suspension state).
 *   - Provision a new tenant + bootstrap default quotas.
 *   - Suspend / unsuspend a tenant (suspension is checked by RLS-side
 *     middleware in a follow-up; the column is set today so the UI can
 *     surface state and the route can be wired in).
 *   - Hard-delete a tenant by delegating to the Wave 6.6 GDPR
 *     `TenantDeleteService`, which returns an HMAC-signed deletion
 *     certificate the admin can keep for compliance evidence.
 *
 * Auth: every endpoint requires admin auth + critical-op rate limit.
 * Deletion additionally requires an explicit `confirm: "DELETE_TENANT"`
 * field in the body so it can't be triggered by accident.
 */

import { sql } from "drizzle-orm";
import { z } from "zod";
import type { RequestHandler } from "express";
import { db } from "../../../db-config";
import { TenantDeleteService } from "../../../services/tenant-delete-facade";
import { TENANT_TABLE_NAMES } from "../../../tenancy/tenant-tables";
import { createLogger } from "../../../lib/structured-logger";
import { authenticatedRequest } from "../../../middleware/auth";
import type { Express, SystemAdminDependencies } from "./types.js";

interface PgExecResult {
  rows?: unknown[];
  [key: string]: unknown;
}

interface TenantRow {
  id: string;
  name: string;
  slug: string | null;
  suspended_at: string | null;
  suspension_reason: string | null;
  max_storage_bytes: number | null;
  max_equipment_count: number | null;
  max_telemetry_rows_per_day: number | null;
}

const logger = createLogger("SystemAdmin:TenantRoutes");

const provisionSchema = z.object({
  id: z
    .string()
    .min(3)
    .max(64)
    .regex(/^[A-Za-z0-9_-]+$/, "id must be slug-safe"),
  name: z.string().min(1).max(255),
  slug: z.string().min(1).max(64).optional(),
  maxStorageBytes: z.number().int().positive().optional(),
  maxEquipmentCount: z.number().int().positive().optional(),
  maxTelemetryRowsPerDay: z.number().int().positive().optional(),
});

const suspendSchema = z.object({
  reason: z.string().min(1).max(500),
});

const deleteSchema = z.object({
  confirm: z.literal("DELETE_TENANT"),
  reason: z.string().min(1).max(500),
});

export function registerTenantRoutes(
  app: Express,
  deps: SystemAdminDependencies
): void {
  const { requireAdminAuth, auditAdminAction, criticalOperationRateLimit } =
    deps;
  const adminAuth: RequestHandler = (req, res, next) => requireAdminAuth(req, res, next);
  const auditAdmin = (action: string): RequestHandler =>
    (req, res, next) => auditAdminAction(action)(req, res, next);

  // List tenants ------------------------------------------------------------
  app.get(
    "/api/admin/tenants",
    criticalOperationRateLimit,
    adminAuth,
    async (_req, res) => {
      try {
        const result = (await db.execute(
          sql`SELECT o.id, o.name, o.slug, o.suspended_at, o.suspension_reason,
                     q.max_storage_bytes, q.max_equipment_count,
                     q.max_telemetry_rows_per_day
              FROM organizations o
              LEFT JOIN tenant_quotas q ON q.org_id = o.id
              ORDER BY o.id`
        )) as object as PgExecResult | TenantRow[];
        const rows: TenantRow[] = Array.isArray(result)
          ? (result as TenantRow[])
          : ((result as PgExecResult).rows as TenantRow[] | undefined) ?? [];
        return res.json({ tenants: rows });
      } catch (err: unknown) {
        logger.error("List tenants failed", undefined, err);
        return res
          .status(500)
          .json({ error: "Failed to list tenants", code: "TENANT_LIST_FAILED" });
      }
    }
  );

  // Provision a new tenant + default quotas --------------------------------
  app.post(
    "/api/admin/tenants",
    criticalOperationRateLimit,
    adminAuth,
    auditAdmin("tenant_provision"),
    async (req, res) => {
      const parsed = provisionSchema.safeParse(req.body);
      if (!parsed.success) {
        return res
          .status(400)
          .json({ error: "Invalid body", details: parsed.error.flatten() });
      }
      const t = parsed.data;
      try {
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
        logger.info("Provisioned tenant", { orgId: t.id });
        return res.status(201).json({ orgId: t.id, status: "provisioned" });
      } catch (err: unknown) {
        logger.error("Provision tenant failed", undefined, err);
        return res.status(500).json({
          error: "Failed to provision tenant",
          code: "TENANT_PROVISION_FAILED",
        });
      }
    }
  );

  // Suspend / unsuspend ----------------------------------------------------
  app.patch(
    "/api/admin/tenants/:orgId/suspend",
    criticalOperationRateLimit,
    adminAuth,
    auditAdmin("tenant_suspend"),
    async (req, res) => {
      const parsed = suspendSchema.safeParse(req.body);
      if (!parsed.success) {
        return res
          .status(400)
          .json({ error: "Invalid body", details: parsed.error.flatten() });
      }
      try {
        await db.execute(
          sql`UPDATE organizations
              SET suspended_at = now(), suspension_reason = ${parsed.data.reason}
              WHERE id = ${req.params['orgId']}`
        );
        return res.json({ orgId: req.params['orgId'], suspended: true });
      } catch (err: unknown) {
        logger.error("Suspend tenant failed", undefined, err);
        return res
          .status(500)
          .json({ error: "Failed to suspend tenant", code: "TENANT_SUSPEND_FAILED" });
      }
    }
  );

  app.patch(
    "/api/admin/tenants/:orgId/unsuspend",
    criticalOperationRateLimit,
    adminAuth,
    auditAdmin("tenant_unsuspend"),
    async (req, res) => {
      try {
        await db.execute(
          sql`UPDATE organizations
              SET suspended_at = NULL, suspension_reason = NULL
              WHERE id = ${req.params['orgId']}`
        );
        return res.json({ orgId: req.params['orgId'], suspended: false });
      } catch (err: unknown) {
        logger.error("Unsuspend tenant failed", undefined, err);
        return res.status(500).json({
          error: "Failed to unsuspend tenant",
          code: "TENANT_UNSUSPEND_FAILED",
        });
      }
    }
  );

  // Hard-delete via GDPR cert ----------------------------------------------
  app.delete(
    "/api/admin/tenants/:orgId",
    criticalOperationRateLimit,
    adminAuth,
    auditAdmin("tenant_delete"),
    async (req, res) => {
      const parsed = deleteSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          error:
            "Tenant deletion requires { confirm: 'DELETE_TENANT', reason }",
          details: parsed.error.flatten(),
        });
      }
      try {
        const adminId = authenticatedRequest(req).user?.id ?? "admin";
        // Fail-closed: in production we refuse to mint a deletion
        // certificate without an explicit signing secret — the dev
        // fallback would silently produce non-verifiable certs.
        const signingSecret =
          process.env['GDPR_DELETION_HMAC_SECRET'] ??
          process.env['SESSION_SECRET'];
        if (!signingSecret) {
          if (process.env['NODE_ENV'] === "production") {
            logger.error(
              "Tenant delete refused: GDPR_DELETION_HMAC_SECRET (or SESSION_SECRET) is not configured"
            );
            return res.status(503).json({
              error:
                "Tenant deletion is unavailable: GDPR signing secret is not configured",
            });
          }
          logger.warn(
            "Tenant delete: GDPR signing secret missing; using non-prod dev fallback"
          );
        }
        const service = new TenantDeleteService({
          // TenantDeleteService accepts the same drizzle handle the rest of
          // the server uses; the constructor's `db` parameter is intentionally
          // typed loosely so it can also accept a transaction inside tests.
          db: db as object as ConstructorParameters<typeof TenantDeleteService>[0]["db"],
          tables: TENANT_TABLE_NAMES.map((table) => ({ table })),
          signingSecret:
            signingSecret ?? "dev-only-fallback-secret-do-not-use-in-prod",
        });
        const result = await service.execute(
          req.params['orgId'] ?? '',
          parsed.data.reason
        );
        logger.warn("Tenant deleted", {
          orgId: req.params['orgId'] ?? '',
          requestedBy: adminId,
          certificateId: result.certificate.certificateId,
        });
        return res.json({ status: "deleted", ...result });
      } catch (err: unknown) {
        logger.error("Delete tenant failed", undefined, err);
        return res.status(500).json({
          error: "Failed to delete tenant",
          code: "TENANT_DELETE_FAILED",
          message: err instanceof Error ? err.message : undefined,
        });
      }
    }
  );
}
