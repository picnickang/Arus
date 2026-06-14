/**
 * Service-request review/approve/reject/convert data access.
 *
 * Split from repository.ts to stay under the long-file ceiling. Under
 * server/db/ (allowed to hold the raw db handle).
 */
import { db } from "../../db-config";
import { sql } from "drizzle-orm";
import { unwrapRows, type ServiceRequestRow } from "../../routes/service-request-route-utils";
import {
  createServiceOrderFromWorkOrder,
  type CreatedServiceOrderRow,
} from "../../routes/wo-so-bridge-operations";
// Service-request review/approve/reject/convert. Extracted from
// service-request-review-routes.ts so the route layer no longer holds the raw
// db handle. Raw SQL preserved verbatim; domain-event emission and validation
// stay in the route.
// ---------------------------------------------------------------------------
export async function getServiceRequestForReview(
  id: string,
  orgId: string
): Promise<ServiceRequestRow | undefined> {
  const [sr] = await db
    .execute(
      sql`
        SELECT id, status, work_order_id, request_number FROM service_requests
        WHERE id = ${id} AND org_id = ${orgId}
      `
    )
    .then(unwrapRows<ServiceRequestRow>);
  return sr;
}

export async function setServiceRequestUnderReview(
  id: string,
  orgId: string,
  userId: string | undefined
): Promise<ServiceRequestRow | undefined> {
  const [updated] = await db
    .execute(
      sql`
        UPDATE service_requests
        SET status = 'under_review', reviewed_by = ${userId}, updated_at = NOW()
        WHERE id = ${id} AND org_id = ${orgId}
        RETURNING *
      `
    )
    .then(unwrapRows<ServiceRequestRow>);
  return updated;
}

export async function getServiceRequestForApproval(
  id: string,
  orgId: string
): Promise<ServiceRequestRow | undefined> {
  const [sr] = await db
    .execute(
      sql`
        SELECT id, status, work_order_id, title, description, estimated_cost, request_number
        FROM service_requests
        WHERE id = ${id} AND org_id = ${orgId}
      `
    )
    .then(unwrapRows<ServiceRequestRow>);
  return sr;
}

export async function approveServiceRequest(
  id: string,
  orgId: string,
  userId: string | undefined
): Promise<ServiceRequestRow | undefined> {
  const [updated] = await db
    .execute(
      sql`
        UPDATE service_requests
        SET status = 'approved', reviewed_by = ${userId}, reviewed_at = NOW(), updated_at = NOW()
        WHERE id = ${id} AND org_id = ${orgId}
        RETURNING *
      `
    )
    .then(unwrapRows<ServiceRequestRow>);
  return updated;
}

export async function getServiceRequestForRejection(
  id: string,
  orgId: string
): Promise<ServiceRequestRow | undefined> {
  const [sr] = await db
    .execute(
      sql`
        SELECT id, status, work_order_id, request_number, previous_wo_status
        FROM service_requests
        WHERE id = ${id} AND org_id = ${orgId}
      `
    )
    .then(unwrapRows<ServiceRequestRow>);
  return sr;
}

export async function rejectServiceRequest(
  id: string,
  orgId: string,
  userId: string | undefined,
  reason: string | null
): Promise<ServiceRequestRow | undefined> {
  const [updated] = await db
    .execute(
      sql`
        UPDATE service_requests
        SET
          status = 'rejected',
          rejection_reason = ${reason},
          reviewed_by = ${userId},
          reviewed_at = NOW(),
          updated_at = NOW()
        WHERE id = ${id} AND org_id = ${orgId}
        RETURNING *
      `
    )
    .then(unwrapRows<ServiceRequestRow>);
  return updated;
}

export async function getOtherActiveServiceRequest(
  workOrderId: string | null | undefined,
  excludeId: string,
  orgId: string
): Promise<ServiceRequestRow | undefined> {
  const [otherActiveSr] = await db
    .execute(
      sql`
        SELECT id FROM service_requests
        WHERE work_order_id = ${workOrderId} AND org_id = ${orgId}
          AND id != ${excludeId}
          AND status NOT IN ('rejected', 'converted')
        LIMIT 1
      `
    )
    .then(unwrapRows<ServiceRequestRow>);
  return otherActiveSr;
}

export async function restoreWorkOrderStatus(
  workOrderId: string | null | undefined,
  orgId: string,
  restoreStatus: string
): Promise<void> {
  await db.execute(sql`
    UPDATE work_orders
    SET
      status = ${restoreStatus},
      updated_at = NOW()
    WHERE id = ${workOrderId} AND org_id = ${orgId}
      AND status = 'awaiting_service'
  `);
}

export async function getServiceRequestForConversion(
  id: string,
  orgId: string
): Promise<ServiceRequestRow | undefined> {
  const [sr] = await db
    .execute(
      sql`
        SELECT sr.id, sr.status, sr.work_order_id, sr.title, sr.description,
               sr.estimated_cost, sr.request_number, sr.service_details, sr.special_requirements,
               wo.wo_number, wo.description AS wo_description,
               wo.equipment_id, wo.vessel_id
        FROM service_requests sr
        JOIN work_orders wo ON wo.id = sr.work_order_id AND wo.org_id = ${orgId}
        WHERE sr.id = ${id} AND sr.org_id = ${orgId}
      `
    )
    .then(unwrapRows<ServiceRequestRow>);
  return sr;
}

export async function getWorkOrderStatusRow(
  workOrderId: string | null | undefined,
  orgId: string
): Promise<ServiceRequestRow | undefined> {
  const [wo] = await db
    .execute(
      sql`
        SELECT id, status FROM work_orders
        WHERE id = ${workOrderId} AND org_id = ${orgId}
      `
    )
    .then(unwrapRows<ServiceRequestRow>);
  return wo;
}

export interface ConvertServiceRequestParams {
  orgId: string;
  workOrderId: string | null | undefined;
  woNumber: string | null | undefined;
  woDescription: string | null | undefined;
  serviceProviderId: string;
  scope: string | null;
  estimatedCost: number | null;
  scheduledStartDate: string | null;
  scheduledEndDate: string | null;
  serviceDetails: string | null;
  specialRequirements: string | null;
}

export async function convertServiceRequestToServiceOrder(
  serviceRequestId: string,
  orgId: string,
  userId: string | undefined,
  p: ConvertServiceRequestParams
): Promise<CreatedServiceOrderRow> {
  const newSo = await createServiceOrderFromWorkOrder(db, {
    orgId,
    workOrderId: p.workOrderId ?? "",
    woNumber: p.woNumber ?? "",
    woDescription: p.woDescription ?? null,
    serviceProviderId: p.serviceProviderId,
    scope: p.scope,
    estimatedCost: p.estimatedCost,
    scheduledStartDate: p.scheduledStartDate,
    scheduledEndDate: p.scheduledEndDate,
    serviceDetails: p.serviceDetails,
    specialRequirements: p.specialRequirements,
    updateWorkOrderStatus: true,
  });

  await db.execute(sql`
    UPDATE service_requests
    SET
      status = 'converted',
      service_order_id = ${newSo.id},
      converted_at = NOW(),
      reviewed_by = ${userId},
      reviewed_at = COALESCE(reviewed_at, NOW()),
      updated_at = NOW()
    WHERE id = ${serviceRequestId} AND org_id = ${orgId}
  `);

  return newSo;
}
