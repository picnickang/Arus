/**
 * Vessel Performance Routes - Operating Mode Detection
 */

import type { Express, Request, Response } from "express";
import type { VesselPerformanceRoutesConfig } from "./types.js";
import { withErrorHandling } from "../../../lib/route-utils.js";

export function registerModeRoutes(app: Express, config: VesselPerformanceRoutesConfig): void {
  const { storage } = config;

  app.get("/api/vessels/:id/operating-mode", withErrorHandling("detect operating mode", async (req: Request, res: Response) => {
    const { id: vesselId } = req.params, orgId = req.headers["x-org-id"] as string;
    if (!orgId) {return res.status(400).json({ message: "Organization ID is required" });}

    const now = new Date(), oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    const equipment = await storage.listEquipment(orgId);
    const vesselEquipment = equipment.filter(e => e.vesselId === vesselId);

    if (vesselEquipment.length === 0) {return res.status(404).json({ message: "No equipment found for vessel" });}

    const { ModeDetector } = await import("../../../context/mode-detector.js");
    const detector = new ModeDetector();
    let latestMode: any = null;

    for (const eq of vesselEquipment) {
      const telemetry = await storage.getTelemetry(eq.id, oneHourAgo, now, orgId);
      if (telemetry.length > 0) {
        const windows = telemetry.map(t => detector.toTelemetryWindow(t));
        const detection = detector.detectModeFromWindow(windows);
        if (!latestMode || detection.confidence > latestMode.confidence) {latestMode = detection;}
      }
    }

    if (!latestMode) {return res.json({ mode: "Unknown", confidence: 0, indicators: ["No recent telemetry data"], timestamp: now.toISOString() });}

    res.setHeader("Cache-Control", "public, max-age=60");
    res.json({ ...latestMode, timestamp: latestMode.timestamp.toISOString(), color: detector.getModeColor(latestMode.mode), label: detector.getModeLabel(latestMode.mode) });
  }));
}
