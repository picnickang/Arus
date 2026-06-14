/**
 * Devices Domain - Types
 *
 * Entity/command types alias the canonical schema types (the storage layer
 * returns these shapes; behaviour-preserving — see the alerts/notifications
 * reference and the remediation plan §3).
 */

import type { Device, InsertDevice, EdgeHeartbeat } from "@shared/schema";

export type { Device, InsertDevice };

/** A device joined with its current edge status/heartbeat. */
export type DeviceWithStatusEntity = Device & {
  status: string;
  lastHeartbeat?: EdgeHeartbeat | undefined;
};
