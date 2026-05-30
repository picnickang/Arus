/**
 * Safety-alarm realtime fan-out.
 *
 * Emergency notices must reach the User page near-instantly. The
 * `EmergencyAlarmBanner` polls `/api/me/safety-alarms` as a fallback, but
 * the canonical delivery path is the existing WebSocket bus: admin
 * trigger/clear and user acknowledge each publish a frame on the
 * `safety-alarms` channel scoped to the tenant `orgId`, and subscribed
 * clients invalidate their alarm query on receipt.
 *
 * Fan-out is best-effort — a missing/closed WS server (e.g. during tests
 * or early boot) must never break the HTTP request path, so every emit is
 * wrapped and any failure swallowed. Polling remains the safety net.
 */

import { getWebSocketServer } from "../websocket-server";

export const SAFETY_ALARM_WS_CHANNEL = "safety-alarms";

export type SafetyAlarmRealtimeEventType =
  | "safety_alarm_triggered"
  | "safety_alarm_cleared"
  | "safety_alarm_acknowledged";

export function broadcastSafetyAlarmEvent(
  orgId: string,
  type: SafetyAlarmRealtimeEventType,
  data: Record<string, unknown>,
): void {
  try {
    getWebSocketServer()?.broadcast(SAFETY_ALARM_WS_CHANNEL, { type, ...data }, orgId);
  } catch {
    /* realtime fan-out is best-effort; never let it break the request path */
  }
}
