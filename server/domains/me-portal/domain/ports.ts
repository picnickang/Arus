/**
 * Me Portal Domain - Ports
 *
 * The me-portal BFF aggregates data it does not own: the vessel roster (vessels
 * domain) and admin-session writes (system-admin storage). It depends only on
 * this narrow port; the concrete adapter lives in
 * server/composition/me-portal-data.ts.
 */

import type { AdminSession, InsertAdminSession, Vessel } from "@shared/schema";

export interface IMePortalExternalData {
  getVessels(orgId: string): Promise<Vessel[]>;
  createAdminSession(session: InsertAdminSession): Promise<AdminSession>;
}

/**
 * Cross-domain task feeds aggregated into the personal task list: work orders
 * (work-orders domain), maintenance schedules (maintenance), and alert
 * notifications (alerts). Rows are consumed structurally, hence `unknown[]`.
 */
export interface IMePortalTaskSources {
  getWorkOrdersWithDetails(filter: undefined, orgId: string): Promise<unknown[]>;
  getMaintenanceSchedules(filter: undefined, orgId: string): Promise<unknown[]>;
  getAlertNotifications(includeRead: boolean, orgId: string): Promise<unknown[]>;
}
