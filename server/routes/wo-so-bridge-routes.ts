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

import type { Express, Request, Response } from "express";
import { db as defaultDb } from "../db";
import { sql } from "drizzle-orm";
import { requireOrgId, requireOrgIdAndValidateBody } from "../middleware/auth";
import { withErrorHandling, sendCreated, sendNotFound } from "../lib/route-utils";
import { logger } from "../utils/logger";

function getOrgId(req: any): string {
  const orgId = req.orgId || req.headers["x-org-id"];
  if (!orgId) throw new Error("Missing orgId");
  return orgId as string;
}

export interface CreateSOParams {
  orgId: string;
  workOrderId: string;
  woNumber: string;
  woDescription?: string | null;
  serviceProviderId: string;
  scope?: string | null;
  estimatedCost?: number | null;
  scheduledStartDate?: string | null;
  scheduledEndDate?: string | null;
  estimatedDurationHours?: number | null;
  serviceDetails?: string | null;
  specialRequirements?: string | null;
  updateWorkOrderStatus?: boolean;
}

export async function createServiceOrderFromWorkOrder(
  db: typeof defaultDb,
  params: CreateSOParams
): Promise<any> {
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

  const [seqResult] = await db.execute(sql`
    SELECT COALESCE(
      MAX(CAST(SUBSTRING(so_number FROM 'SO-([0-9]+)') AS INTEGER)),
      0
    ) + 1 AS next_num
    FROM service_orders
    WHERE org_id = ${orgId}
  `).then((r) => r.rows || r);
  const soNumber = `SO-${String(seqResult?.next_num || 1).padStart(4, "0")}`;

  const [newSo] = await db.execute(sql`
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
      gen_random_uuid()::text,
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
  `).then((r) => r.rows || r);

  if (updateWorkOrderStatus) {
    await db.execute(sql`
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
  return newSo;
}

export function registerWoSoBridgeRoutes(
  app: Express,
  rateLimiters: {
    writeOperationRateLimit: any;
    generalApiRateLimit: any;
  }
) {
  const { writeOperationRateLimit, generalApiRateLimit } = rateLimiters;

  app.get(
    "/api/work-orders/:id/service-orders",
    requireOrgId,
    generalApiRateLimit,
    withErrorHandling("fetch work order service orders", async (req: Request, res: Response) => {
      const orgId = getOrgId(req);
      const workOrderId = req.params.id;

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
          so.quoted_amount AS "quotedAmount",
          so.actual_amount AS "actualAmount",
          so.revised_amount AS "revisedAmount",
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

      res.json({
        workOrderId,
        serviceOrders: rows.rows || rows,
        count: (rows.rows || rows).length,
      });
    })
  );

  app.post(
    "/api/work-orders/:id/service-orders",
    requireOrgIdAndValidateBody,
    writeOperationRateLimit,
    withErrorHandling("create service order from work order", async (req: Request, res: Response) => {
      const orgId = getOrgId(req);
      const workOrderId = req.params.id;

      const [wo] = await defaultDb.execute(sql`
        SELECT id, wo_number, equipment_id, description, vessel_id, org_id
        FROM work_orders
        WHERE id = ${workOrderId} AND org_id = ${orgId}
      `).then((r) => r.rows || r);

      if (!wo) {
        return sendNotFound(res, "Work Order");
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
        woNumber: wo.wo_number,
        woDescription: wo.description,
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
    })
  );

  app.get(
    "/api/service-orders/:id/work-order",
    requireOrgId,
    generalApiRateLimit,
    withErrorHandling("fetch service order work order", async (req: Request, res: Response) => {
      const orgId = getOrgId(req);
      const serviceOrderId = req.params.id;

      const [row] = await defaultDb.execute(sql`
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
      `).then((r) => r.rows || r);

      if (!row) {
        return res.json({ workOrder: null, linked: false });
      }

      res.json({ workOrder: row, linked: true });
    })
  );

  app.patch(
    "/api/service-orders/:id/link-work-order",
    requireOrgIdAndValidateBody,
    writeOperationRateLimit,
    withErrorHandling("link service order to work order", async (req: Request, res: Response) => {
      const orgId = getOrgId(req);
      const serviceOrderId = req.params.id;
      const { workOrderId } = req.body;

      if (!workOrderId) {
        return res.status(400).json({ error: "workOrderId is required" });
      }

      const [wo] = await defaultDb.execute(sql`
        SELECT id, wo_number FROM work_orders
        WHERE id = ${workOrderId} AND org_id = ${orgId}
      `).then((r) => r.rows || r);

      if (!wo) {
        return sendNotFound(res, "Work Order");
      }

      const [so] = await defaultDb.execute(sql`
        UPDATE service_orders
        SET
          work_order_id = ${workOrderId},
          work_order_number = ${wo.wo_number},
          updated_at = NOW()
        WHERE id = ${serviceOrderId} AND org_id = ${orgId}
        RETURNING *
      `).then((r) => r.rows || r);

      if (!so) {
        return sendNotFound(res, "Service Order");
      }

      logger.info(`Linked service order ${serviceOrderId} to work order ${workOrderId}`);
      res.json(so);
    })
  );

  app.post(
    "/api/service-orders/:id/sync-work-order-status",
    requireOrgIdAndValidateBody,
    writeOperationRateLimit,
    withErrorHandling("sync work order status from service order", async (req: Request, res: Response) => {
      const orgId = getOrgId(req);
      const serviceOrderId = req.params.id;

      const [so] = await defaultDb.execute(sql`
        SELECT id, work_order_id, status, so_number
        FROM service_orders
        WHERE id = ${serviceOrderId} AND org_id = ${orgId}
      `).then((r) => r.rows || r);

      if (!so || !so.work_order_id) {
        return res.json({ synced: false, reason: "No linked work order" });
      }

      const [soStatus] = await defaultDb.execute(sql`
        SELECT
          COUNT(*)::int AS total,
          COUNT(*) FILTER (WHERE status = 'completed')::int AS completed,
          COUNT(*) FILTER (WHERE status = 'cancelled')::int AS cancelled
        FROM service_orders
        WHERE work_order_id = ${so.work_order_id} AND org_id = ${orgId}
      `).then((r) => r.rows || r);

      const allDone = soStatus.completed + soStatus.cancelled === soStatus.total;

      if (allDone && soStatus.completed > 0) {
        await defaultDb.execute(sql`
          UPDATE work_orders
          SET
            status = CASE
              WHEN status = 'awaiting_service' THEN 'in_progress'
              ELSE status
            END,
            updated_at = NOW()
          WHERE id = ${so.work_order_id} AND org_id = ${orgId}
        `);
        return res.json({ synced: true, workOrderStatus: "in_progress", reason: "All service orders completed" });
      }

      res.json({ synced: false, reason: `${soStatus.total - soStatus.completed - soStatus.cancelled} service orders still active` });
    })
  );
}
