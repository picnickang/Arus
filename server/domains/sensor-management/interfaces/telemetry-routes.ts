/**
 * Telemetry Routes - telemetry history endpoint.
 * OLTP reads go through the service (telemetry-history port); the analytics-sink
 * cutover path reads the NDJSON warehouse sink directly.
 */

import type { Express, Request } from "express";
import type { SensorRouteContext } from "./types.js";
import {
  analyticsReadMode,
  readTelemetryFromSink,
} from "../../../lib/event-spine/analytics-sink-reader.js";

function getOrgIdFromReq(req: Request): string {
  const fromReq = (req as Request & { orgId?: string }).orgId;
  if (!fromReq) {
    throw new Error("Organization context required");
  }
  return fromReq;
}

export function registerTelemetryRoutes(app: Express, ctx: SensorRouteContext) {
  const { requireOrgId, service } = ctx;

  app.get("/api/telemetry/history/:equipmentId/:sensorType", requireOrgId, async (req, res) => {
    try {
      const { equipmentId = "", sensorType = "" } = req.params;
      const hours = req.query["hours"] ? Number.parseInt(req.query["hours"] as string) : 24;
      // Push B3 analytics cutover: when EVENT_SPINE_ANALYTICS_READ=sink the read
      // goes to the NDJSON sink (warehouse path) instead of the OLTP telemetry
      // table. The OLTP path stays the default until the production sink is wired.
      if (analyticsReadMode() === "sink") {
        const orgId = getOrgIdFromReq(req);
        const days = Math.max(1, Math.ceil(hours / 24));
        const sinkRows = await readTelemetryFromSink({
          orgId,
          equipmentId,
          sensorType,
          daysBack: days,
          limit: 2000,
        });
        res.json(sinkRows);
        return;
      }
      const history = await service.getTelemetryHistory(equipmentId, sensorType, hours);
      res.json(history);
    } catch {
      res.status(500).json({ message: "Failed to fetch telemetry history" });
    }
  });
}
