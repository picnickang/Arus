/**
 * WO ↔ SO Bridge — API Routes
 *
 * New endpoints:
 *   GET  /api/work-orders/:id/service-orders
 *        → Returns all service orders linked to a work order
 *
 *   POST /api/work-orders/:id/service-orders
 *        → Creates a service order pre-linked to the work order
 *        → Optionally sets WO status to "awaiting_service"
 *
 *   GET  /api/service-orders/:id/work-order
 *        → Returns the linked work order for a service order
 *
 *   PATCH /api/service-orders/:id/link-work-order
 *        → Links an existing SO to a WO (retroactive linking)
 */

import { randomUUID } from "node:crypto";
import type { Express, Request, RequestHandler, Response } from "express";
import { db as defaultDb } from "../db";
import { sql } from "drizzle-orm";
import {
  authenticatedRequest,
  requireOrgId,
  requireOrgIdAndValidateBody,
} from "../middleware/auth";
import { withErrorHandling, sendCreated, sendNotFound } from "../lib/route-utils";
import { logger } from "../utils/logger";
import { checkPermissionInDev } from "../domains/permissions/middleware";
import { DEFAULT_ORG_ID } from "@shared/config/tenant";
import { generateSoNumber } from "../service-orders/repository";

function getOrgId(req: Request): string {
  const orgId = authenticatedRequest(req).orgId || DEFAULT_ORG_ID;
  if (!orgId) {
    throw new Error("Missing orgId");
  }
  return orgId;
}

export interface CreateSOParams {
  orgId: string;
  workOrderId: string;
  woNumber: string;
  woDescription?: string | null | undefined;
  serviceProviderId: string;
  scope?: string | null | undefined;
  estimatedCost?: number | null | undefined;
  scheduledStartDate?: string | null | undefined;
  scheduledEndDate?: string | null | undefined;
  estimatedDurationHours?: number | null | undefined;
  serviceDetails?: string | null | undefined;
  specialRequirements?: string | null | undefined;
  updateWorkOrderStatus?: boolean | undefined;
}

export interface CreatedServiceOrderRow {
  id: string;
  so_number: string;
  status: string;
  work_order_id: string | null;
  org_id: string;
  [key: string]: unknown;
}

export async function createServiceOrderFromWorkOrder(
  db: typeof defaultDb,
  params: CreateSOParams
): Promise<CreatedServiceOrderRow> {
  const {
    orgId,
    workOrderId,
    woNumber,
    woDescription,
    serviceProviderId,
    scope,
    estimatedCost,
    scheduledStartDate,
    scheduledEndDate,
    estimatedDurationHours,
    serviceDetails,
    specialRequirements,
    updateWorkOrderStatus = true,
  } = params;

  // Use the canonical generator (advisory-xact-locked) inside a transaction
  // so the lock is held until the INSERT commits. Previously this path used
  // an inline `SELECT MAX(...)+1` with no lock, which raced under concurrent
  // WO→SO conversions for the same org and could produce duplicate so_number
  // values. See server/service-orders/repository.ts:generateSoNumber.
  return await defaultDb.transaction(async (tx) => {
    const soNumber = await generateSoNumber(orgId, tx as object as { execute: typeof db.execute });
    const serviceOrderId = randomUUID();

    const [inserted] = await tx
      .execute(
        sql`
    INSERT INTO service_orders (
      id, org_id, so_number, status,
      work_order_id, work_order_number,
      service_provider_id,
      scope, quoted_amount,
      scheduled_start_date, scheduled_end_date,
      estimated_duration_hours,
      service_details, special_requirements,
      created_at, updated_at
    )
    VALUES (
      ${serviceOrderId},
      ${orgId},
      ${soNumber},
      'draft',
      ${workOrderId},
      ${woNumber},
      ${serviceProviderId},
      ${scope || woDescription || null},
      ${estimatedCost != null ? Number(estimatedCost) : null},
      ${scheduledStartDate || null},
      ${scheduledEndDate || null},
      ${estimatedDurationHours != null ? Number(estimatedDurationHours) : null},
      ${serviceDetails || null},
      ${specialRequirements || null},
      NOW(),
      NOW()
    )
    RETURNING *
  `
      )
      .then((r) => r.rows || r);

    if (updateWorkOrderStatus) {
      await tx.execute(sql`
        UPDATE work_orders
        SET
          status = CASE
            WHEN status IN ('open', 'in_progress') THEN 'awaiting_service'
            ELSE status
          END,
          updated_at = NOW()
        WHERE id = ${workOrderId} AND org_id = ${orgId}
      `);
    }

    logger.info(`Created service order ${soNumber} from work order ${workOrderId}`);
    if (!inserted || typeof inserted !== "object") {
      throw new Error("Service order insert returned no row");
    }
    const row = inserted as Record<string, unknown>;
    if (
      typeof row["id"] !== "string" ||
      typeof row["so_number"] !== "string" ||
      typeof row["status"] !== "string" ||
      typeof row["org_id"] !== "string"
    ) {
      throw new Error("Service order RETURNING row has unexpected shape");
    }
    const workOrderIdCol = row["work_order_id"];
    const created: CreatedServiceOrderRow = {
      ...row,
      id: row["id"],
      so_number: row["so_number"],
      status: row["status"],
      org_id: row["org_id"],
      work_order_id: typeof workOrderIdCol === "string" ? workOrderIdCol : null,
      // numeric columns reach raw RETURNING rows as strings (0041)
      quoted_amount: row["quoted_amount"] != null ? Number(row["quoted_amount"]) : null,
    };
    return created;
  });
}

export function registerWoSoBridgeRoutes(
  app: Express,
  rateLimiters: {
    writeOperationRateLimit: RequestHandler;
    generalApiRateLimit: RequestHandler;
  }
) {
  const { writeOperationRateLimit, generalApiRateLimit } = rateLimiters;

  app.get(
    "/api/work-orders/:id/service-orders",
    requireOrgId,
    generalApiRateLimit,
    withErrorHandling("fetch work order service orders", async (req: Request, res: Response) => {
      const orgId = getOrgId(req);
      const workOrderId = req.params["id"];

      const rows = await defaultDb.execute(sql`
        SELECT
          so.id,
          so.so_number AS "soNumber",
          so.status,
          so.service_provider_id AS "serviceProviderId",
          s.name AS "serviceProviderName",
          s.id AS "supplierProfileId",
          so.scope,
          so.service_details AS "serviceDetails",
          so.special_requirements AS "specialRequirements",
          so.quoted_amount::float8 AS "quotedAmount",
          so.actual_amount::float8 AS "actualAmount",
          so.revised_amount::float8 AS "revisedAmount",
          so.revision_notes AS "revisionNotes",
          so.currency,
          so.scheduled_start_date AS "scheduledStartDate",
          so.scheduled_end_date AS "scheduledEndDate",
          so.actual_start_date AS "actualStartDate",
          so.actual_end_date AS "actualEndDate",
          so.estimated_duration_hours AS "estimatedDurationHours",
          so.actual_duration_hours AS "actualDurationHours",
          so.sent_at AS "sentAt",
          so.confirmed_at AS "confirmedAt",
          so.completed_at AS "completedAt",
          so.cancelled_at AS "cancelledAt",
          so.cancellation_reason AS "cancellationReason",
          so.created_at AS "createdAt",
          so.updated_at AS "updatedAt"
        FROM service_orders so
        LEFT JOIN suppliers s ON s.id = so.service_provider_id AND s.org_id = ${orgId}
        WHERE so.work_order_id = ${workOrderId}
          AND so.org_id = ${orgId}
        ORDER BY so.created_at DESC
      `);

      return res.json({
        workOrderId,
        serviceOrders: rows.rows || rows,
        count: (rows.rows || rows).length,
      });
    })
  );

  app.post(
    "/api/work-orders/:id/service-orders",
    requireOrgIdAndValidateBody,
    checkPermissionInDev("service_orders", "create"),
    writeOperationRateLimit,
    withErrorHandling(
      "create service order from work order",
      async (req: Request, res: Response) => {
        const orgId = getOrgId(req);
        const workOrderId = req.params["id"] ?? "";

        const [wo] = await defaultDb
          .execute(
            sql`
        SELECT id, wo_number, equipment_id, description, vessel_id, org_id
        FROM work_orders
        WHERE id = ${workOrderId} AND org_id = ${orgId}
      `
          )
          .then((r) => r.rows || r);

        if (!wo) {
          return sendNotFound(res, "Work Order");
        }

        const [pendingSr] = await defaultDb
          .execute(
            sql`
        SELECT id, request_number, status
        FROM service_requests
        WHERE work_order_id = ${workOrderId} AND org_id = ${orgId}
          AND status NOT IN ('rejected', 'converted')
        LIMIT 1
      `
          )
          .then((r) => r.rows || r);

        if (pendingSr) {
          return res.status(409).json({
            error: `This work order has an active service request (${pendingSr["request_number"]}, status: ${pendingSr["status"]}). Complete the SR workflow before creating a service order directly.`,
          });
        }

        const {
          serviceProviderId,
          scope,
          estimatedCost,
          scheduledStartDate,
          scheduledEndDate,
          estimatedDurationHours,
          serviceDetails,
          specialRequirements,
          updateWorkOrderStatus = true,
        } = req.body;

        if (!serviceProviderId) {
          return res.status(400).json({ error: "serviceProviderId is required" });
        }

        const newSo = await createServiceOrderFromWorkOrder(defaultDb, {
          orgId,
          workOrderId,
          woNumber: wo["wo_number"] as string,
          woDescription: wo["description"] as string | null | undefined,
          serviceProviderId,
          scope,
          estimatedCost: estimatedCost ? Number(estimatedCost) : null,
          scheduledStartDate,
          scheduledEndDate,
          estimatedDurationHours: estimatedDurationHours ? Number(estimatedDurationHours) : null,
          serviceDetails,
          specialRequirements,
          updateWorkOrderStatus,
        });

        sendCreated(res, newSo);
      }
    )
  );

  app.get(
    "/api/service-orders/:id/work-order",
    requireOrgId,
    generalApiRateLimit,
    withErrorHandling("fetch service order work order", async (req: Request, res: Response) => {
      const orgId = getOrgId(req);
      const serviceOrderId = req.params["id"];

      const [row] = await defaultDb
        .execute(
          sql`
        SELECT
          wo.id,
          wo.wo_number AS "workOrderNumber",
          wo.description,
          wo.status,
          wo.priority,
          wo.equipment_id AS "equipmentId",
          wo.vessel_id AS "vesselId",
          wo.created_at AS "createdAt",
          wo.updated_at AS "updatedAt",
          wo.completed_at AS "completedAt"
        FROM service_orders so
        JOIN work_orders wo ON wo.id = so.work_order_id
        WHERE so.id = ${serviceOrderId}
          AND so.org_id = ${orgId}
          AND so.work_order_id IS NOT NULL
      `
        )
        .then((r) => r.rows || r);

      if (!row) {
        return res.json({ workOrder: null, linked: false });
      }

      return res.json({ workOrder: row, linked: true });
    })
  );

  app.patch(
    "/api/service-orders/:id/link-work-order",
    requireOrgIdAndValidateBody,
    checkPermissionInDev("service_orders", "edit"),
    writeOperationRateLimit,
    withErrorHandling("link service order to work order", async (req: Request, res: Response) => {
      const orgId = getOrgId(req);
      const serviceOrderId = req.params["id"];
      const { workOrderId } = req.body;

      if (!workOrderId) {
        return res.status(400).json({ error: "workOrderId is required" });
      }

      const [wo] = await defaultDb
        .execute(
          sql`
        SELECT id, wo_number FROM work_orders
        WHERE id = ${workOrderId} AND org_id = ${orgId}
      `
        )
        .then((r) => r.rows || r);

      if (!wo) {
        return sendNotFound(res, "Work Order");
      }

      const [so] = await defaultDb
        .execute(
          sql`
        UPDATE service_orders
        SET
          work_order_id = ${workOrderId},
          work_order_number = ${wo["wo_number"]},
          updated_at = NOW()
        WHERE id = ${serviceOrderId} AND org_id = ${orgId}
        RETURNING *
      `
        )
        .then((r) => r.rows || r);

      if (!so) {
        return sendNotFound(res, "Service Order");
      }

      logger.info(`Linked service order ${serviceOrderId} to work order ${workOrderId}`);
      return res.json(so);
    })
  );

  app.post(
    "/api/service-orders/:id/sync-work-order-status",
    requireOrgIdAndValidateBody,
    checkPermissionInDev("service_orders", "edit"),
    writeOperationRateLimit,
    withErrorHandling(
      "sync work order status from service order",
      async (req: Request, res: Response) => {
        const orgId = getOrgId(req);
        const serviceOrderId = req.params["id"];

        const [so] = await defaultDb
          .execute(
            sql`
        SELECT id, work_order_id, status, so_number
        FROM service_orders
        WHERE id = ${serviceOrderId} AND org_id = ${orgId}
      `
          )
          .then((r) => r.rows || r);

        if (!so || !so["work_order_id"]) {
          return res.json({ synced: false, reason: "No linked work order" });
        }

        const result = await syncWorkOrderFromServiceOrders(
          defaultDb,
          orgId,
          so["work_order_id"] as string
        );
        return res.json(result);
      }
    )
  );

  app.post(
    "/api/service-orders/:id/revert-to-request",
    requireOrgIdAndValidateBody,
    checkPermissionInDev("service_orders", "edit"),
    writeOperationRateLimit,
    withErrorHandling("revert service order to request", async (req: Request, res: Response) => {
      const orgId = getOrgId(req);
      const serviceOrderId = req.params["id"];

      const [so] = await defaultDb
        .execute(
          sql`
            SELECT id, work_order_id, status, so_number
            FROM service_orders
            WHERE id = ${serviceOrderId} AND org_id = ${orgId}
          `
        )
        .then((r) => r.rows || r);

      if (!so) {
        return sendNotFound(res, "Service Order");
      }

      const REVERTIBLE: string[] = ["draft", "sent", "confirmed"];
      if (!REVERTIBLE.includes(so["status"] as string)) {
        return res.status(400).json({
          error: `Cannot revert a service order in '${so["status"]}' status. Only draft, sent, or confirmed orders can be reverted.`,
        });
      }

      const [sr] = await defaultDb
        .execute(
          sql`
            SELECT id, request_number, previous_wo_status
            FROM service_requests
            WHERE service_order_id = ${serviceOrderId} AND org_id = ${orgId}
            LIMIT 1
          `
        )
        .then((r) => r.rows || r);

      if (!sr) {
        return res.status(400).json({
          error:
            "This service order was not created from a service request and cannot be reverted. Use Cancel instead.",
        });
      }

      // Run revert atomically so a partial failure can't leave the SR/SO/WO in
      // an inconsistent state.
      const restored = await defaultDb.transaction(async (tx) => {
        await tx.execute(sql`
          UPDATE service_requests
          SET status = 'approved',
              service_order_id = NULL,
              converted_at = NULL,
              updated_at = NOW()
          WHERE id = ${sr["id"]} AND org_id = ${orgId}
        `);

        if (so["work_order_id"]) {
          const previous = (sr["previous_wo_status"] as string | null) || "open";
          await tx.execute(sql`
            UPDATE work_orders
            SET status = CASE
                  WHEN status = 'awaiting_service' THEN ${previous}
                  ELSE status
                END,
                updated_at = NOW()
            WHERE id = ${so["work_order_id"]} AND org_id = ${orgId}
          `);
        }

        await tx.execute(sql`
          DELETE FROM service_order_events
          WHERE so_id = ${serviceOrderId} AND org_id = ${orgId}
        `);
        await tx.execute(sql`
          DELETE FROM service_orders
          WHERE id = ${serviceOrderId} AND org_id = ${orgId}
        `);

        const [row] = await tx
          .execute(
            sql`
              SELECT * FROM service_requests
              WHERE id = ${sr["id"]} AND org_id = ${orgId}
            `
          )
          .then((r) => r.rows || r);
        return row;
      });

      logger.info(
        `Reverted service order ${so["so_number"]} back to service request ${sr["request_number"]}`
      );
      return res.json({ reverted: true, serviceRequest: restored });
    })
  );
}

/**
 * Shared helper used by both the standalone sync route and the SO complete
 * handler so completing the last open SO on a WO advances the parent WO
 * automatically.
 */
export async function syncWorkOrderFromServiceOrders(
  db: typeof defaultDb,
  orgId: string,
  workOrderId: string
): Promise<{ synced: boolean; workOrderStatus?: string; reason: string }> {
  const [soStatus] = await db
    .execute(
      sql`
        SELECT
          COUNT(*)::int AS total,
          COUNT(*) FILTER (WHERE status = 'completed')::int AS completed,
          COUNT(*) FILTER (WHERE status = 'cancelled')::int AS cancelled
        FROM service_orders
        WHERE work_order_id = ${workOrderId} AND org_id = ${orgId}
      `
    )
    .then((r) => r.rows || r);

  const stat = (soStatus ?? {}) as {
    total?: number | string;
    completed?: number | string;
    cancelled?: number | string;
  };
  const total = Number(stat.total ?? 0);
  const completed = Number(stat.completed ?? 0);
  const cancelled = Number(stat.cancelled ?? 0);
  const allDone = total > 0 && completed + cancelled === total;

  if (allDone && completed > 0) {
    await db.execute(sql`
      UPDATE work_orders
      SET status = CASE
            WHEN status = 'awaiting_service' THEN 'in_progress'
            ELSE status
          END,
          updated_at = NOW()
      WHERE id = ${workOrderId} AND org_id = ${orgId}
    `);
    return {
      synced: true,
      workOrderStatus: "in_progress",
      reason: "All service orders completed",
    };
  }

  return {
    synced: false,
    reason: `${total - completed - cancelled} service orders still active`,
  };
}
