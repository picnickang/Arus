import type { Request, RequestHandler } from "express";
import { authenticatedRequest } from "../middleware/auth";
import { DEFAULT_ORG_ID } from "@shared/config/tenant";

export interface ServiceRequestRouteRateLimiters {
  writeOperationRateLimit: RequestHandler;
  generalApiRateLimit: RequestHandler;
}

export interface ServiceRequestRow {
  id: string;
  request_number: string;
  title: string;
  description: string | null;
  urgency: string | null;
  estimated_cost: number | string | null;
  requested_by: string | null;
  status: string;
  rejection_reason: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  converted_at: string | null;
  work_order_id: string;
  service_order_id: string | null;
  previous_wo_status: string | null;
  service_details: string | null;
  special_requirements: string | null;
  wo_number?: string;
  wo_description?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface WorkOrderRow {
  id: string;
  wo_number: string;
  status: string;
  description: string | null;
  equipment_id: string | null;
  vessel_id: string | null;
  org_id: string;
}

export function getOrgId(req: Request): string {
  const orgId = authenticatedRequest(req).orgId || DEFAULT_ORG_ID;
  if (!orgId) {
    throw new Error("Missing orgId");
  }
  return orgId as string;
}

export function getUserId(req: Request): string {
  return authenticatedRequest(req).user?.id || (req.headers["x-user-id"] as string) || "system";
}

export function unwrapRows<T = Record<string, unknown>>(r: unknown): T[] {
  if (Array.isArray(r)) {
    return r as T[];
  }
  if (r && typeof r === "object" && "rows" in r) {
    return (r as { rows: T[] }).rows ?? [];
  }
  return [];
}
