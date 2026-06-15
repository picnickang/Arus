/**
 * Composition seam for telemetry's cross-domain alert read.
 *
 * The sensor-health rollup needs open alert notifications, but the telemetry
 * domain may neither import the alerts domain (cross-domain guard) nor
 * reference `dbAlertStorage` from its routes layer (domain-leak guard). The
 * previous inline dynamic import of the repositories barrel dodged the
 * static guards while still counting as dynamic-import + storage debt.
 */
import { dbAlertStorage } from "../repositories.js";

export const listUnacknowledgedAlertNotifications = (orgId: string) =>
  dbAlertStorage.getAlertNotifications(false, orgId);
