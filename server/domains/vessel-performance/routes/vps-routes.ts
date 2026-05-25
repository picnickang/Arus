/**
 * Vessel Performance Routes - VPS Analysis Endpoints
 * Power vs Speed Through Water + Fleet Benchmarks
 */

import type { Express, Response } from "express";
import { z } from "zod";
import type { VesselPerformanceRoutesConfig, AuthenticatedRequest } from "./types.js";

const idParamSchema = z.object({ id: z.string().min(1) });
const dateRangeQuerySchema = z.object({
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});
const fleetQuerySchema = dateRangeQuerySchema.extend({
  vesselType: z.string().optional(),
});
import { withErrorHandling } from "../../../lib/route-utils.js";
import { vesselService } from "../../../services/domains/vessel-service.js";
import { dbEquipmentStorage } from "../../../db/equipment/index.js";
import { dbTelemetryStorage } from "../../../db/telemetry/index.js";
import { requireOrgId } from "../../../middleware/auth.js";

export function registerVPSRoutes(app: Express, _config: VesselPerformanceRoutesConfig): void {
  app.get(
    "/api/vessels/:id/power-stw-analysis",
    requireOrgId,
    withErrorHandling("compute power-STW analysis", async (req: AuthenticatedRequest, res: Response) => {
      const vesselId = idParamSchema.parse(req.params).id;
      const orgId = req.orgId;

      const vessel = await vesselService.getVessel(vesselId, orgId);
      if (!vessel) {
        return res.status(404).json({ message: "Vessel not found" });
      }

      const q = dateRangeQuerySchema.parse(req.query);
      const now = new Date(),
        defaultStart = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      const startDate = q.startDate ? new Date(q.startDate) : defaultStart;
      const endDate = q.endDate ? new Date(q.endDate) : now;
      if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
        return res.status(400).json({ message: "Invalid date format. Use ISO 8601 strings." });
      }
      if (startDate > endDate) {
        return res.status(400).json({ message: "Start date must be before end date" });
      }

      const vesselEquipment = await dbEquipmentStorage.getEquipmentByVessel(vesselId, orgId);
      type TelemetryReading = Awaited<
        ReturnType<typeof dbTelemetryStorage.getTelemetryByEquipmentAndDateRange>
      >[number];
      const allTelemetry: TelemetryReading[] = [];
      for (const equipment of vesselEquipment) {
        const telemetry = await dbTelemetryStorage.getTelemetryByEquipmentAndDateRange(
          equipment.id,
          startDate,
          endDate,
          orgId
        );
        allTelemetry.push(...telemetry);
      }

      const telemetryMap = new Map<number, { rpm?: number; torque?: number; stw?: number }>();
      for (const reading of allTelemetry) {
        const timestamp = new Date(reading.ts).getTime();
        if (!telemetryMap.has(timestamp)) {
          telemetryMap.set(timestamp, {});
        }
        const entry = telemetryMap.get(timestamp)!;
        if (reading.sensorType === "rpm" || reading.sensorType === "engine_rpm") {
          entry.rpm = reading.value;
        } else if (reading.sensorType === "shaft_torque" || reading.sensorType === "torque") {
          entry.torque = reading.value;
        } else if (
          reading.sensorType === "speed" ||
          reading.sensorType === "stw" ||
          reading.sensorType === "gps_speed"
        ) {
          entry.stw = reading.value;
        }
      }

      const completeReadings = Array.from(telemetryMap.entries())
        .filter(([_, data]) => data.rpm && data.torque)
        .map(([timestamp, data]) => ({
          timestamp,
          rpm: data.rpm!,
          torque: data.torque!,
          stw: data.stw,
        }));
      const { calculatePowerSTWCurve } = await import("../../../vps-kpi-service.js");
      const rpm = completeReadings.map((r) => r.rpm),
        torque = completeReadings.map((r) => r.torque),
        stw = completeReadings.map((r) => r.stw).filter((s) => s !== undefined) as number[];
      const actualCurve = calculatePowerSTWCurve(rpm, torque, stw.length > 0 ? stw : undefined);
      const sortedActual = actualCurve
        .filter((p: { x: number; y: number }) => p.y > 0 && p.x > 0)
        .sort((a: { x: number }, b: { x: number }) => a.x - b.x);
      const baselineCurve: { x: number; y: number }[] = [];

      if (sortedActual.length > 0) {
        const medianIndex = Math.floor(sortedActual.length / 2),
          refSpeed = sortedActual[medianIndex]!.x,
          refPower = sortedActual[medianIndex]!.y;
        const minSpeed = Math.min(...sortedActual.map((p: { x: number }) => p.x)),
          maxSpeed = Math.max(...sortedActual.map((p: { x: number }) => p.x)),
          speedStep = (maxSpeed - minSpeed) / 20;
        for (let speed = minSpeed; speed <= maxSpeed; speed += speedStep) {
          baselineCurve.push({ x: speed, y: refPower * Math.pow(speed / refSpeed, 3) });
        }
      }

      res.setHeader("Cache-Control", "private, max-age=300");
      return res.json({
        actual: actualCurve,
        baseline: baselineCurve,
        metadata: {
          vesselId,
          vesselName: vessel.name,
          sampleCount: completeReadings.length,
          period: { start: startDate.toISOString(), end: endDate.toISOString() },
          timezone: "UTC",
          hasSTWData: stw.length > 0,
          estimatedSTW: stw.length === 0,
        },
      });
    })
  );

  app.get(
    "/api/fleet/benchmarks",
    requireOrgId,
    withErrorHandling("compute fleet benchmarks", async (req: AuthenticatedRequest, res: Response) => {
      const orgId = req.orgId;

      const q = fleetQuerySchema.parse(req.query);
      const now = new Date(),
        defaultStart = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      const startDate = q.startDate ? new Date(q.startDate) : defaultStart;
      const endDate = q.endDate ? new Date(q.endDate) : now;
      if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
        return res.status(400).json({ message: "Invalid date format. Use ISO 8601 strings." });
      }
      if (startDate > endDate) {
        return res.status(400).json({ message: "Start date must be before end date" });
      }

      const vesselType = q.vesselType;
      const { computeFleetLoadBenchmarks, computeFleetPowerSTWBenchmarks } = await import(
        "../../../vps-kpi-service.js"
      );
      const [loadBenchmarks, powerSTWBenchmarks] = await Promise.all([
        computeFleetLoadBenchmarks(orgId, { start: startDate, end: endDate }, vesselType),
        computeFleetPowerSTWBenchmarks(orgId, { start: startDate, end: endDate }, vesselType),
      ]);

      const vessels = await vesselService.getVessels(orgId);
      const vesselCount = vesselType
        ? vessels.filter((v) => (v as { vesselType?: string | null }).vesselType === vesselType).length
        : vessels.length;

      res.setHeader("Cache-Control", "private, max-age=300");
      return res.json({
        loadDistribution: loadBenchmarks,
        powerSTW: powerSTWBenchmarks,
        vesselCount,
        periodStart: startDate.toISOString(),
        periodEnd: endDate.toISOString(),
        filter: vesselType ? { vesselType } : null,
      });
    })
  );
}
