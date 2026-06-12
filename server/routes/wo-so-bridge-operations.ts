import { randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import { db as defaultDb } from "../db";
import { logger } from "../utils/logger";
import { generateSoNumber } from "../service-orders/repository";

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
  // an inline SELECT MAX(...)+1 with no lock, which raced under concurrent
  // conversions for the same org and could produce duplicate so_number values.
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
