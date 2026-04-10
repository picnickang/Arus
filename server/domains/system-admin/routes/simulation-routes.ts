/**
 * System Admin Routes - Telemetry Simulation
 * Vessel telemetry simulation and stress testing
 */

import { Express, Request, Response, z, SystemAdminDependencies } from "./types.js";
import { withErrorHandling, sendCreated } from "../../../lib/route-utils.js";
import { logger } from "../../../utils/logger.js";
import { dbTelemetryStorage } from "../../../repositories.js";

const telemetryWriter = { createTelemetryReading: (r: any) => dbTelemetryStorage.createTelemetryReading(r) } as any;

export function registerSimulationRoutes(app: Express, deps: SystemAdminDependencies): void {
  const {
    generalApiRateLimit,
    writeOperationRateLimit,
    requireAdminAuth,
    auditAdminAction,
  } = deps;

  app.post(
    "/api/admin/simulate-telemetry",
    requireAdminAuth,
    writeOperationRateLimit,
    auditAdminAction("SIMULATE_TELEMETRY"),
    withErrorHandling("generate simulated telemetry", async (req: Request, res: Response) => {
      const { orgId } = req.body;

      if (!orgId) {
        res.status(400).json({ error: "orgId is required" });
        return;
      }

      const simulationConfigSchema = z.object({
        orgId: z.string(),
        vesselType: z.enum([
          "tug",
          "workboat",
          "pilot",
          "psv",
          "ahts",
          "crewboat",
          "survey",
          "multicat",
          "lct",
          "bunker",
          "errv",
        ]),
        equipmentId: z.string(),
        deviceId: z.string(),
        durationMinutes: z.number().min(1).max(480).default(60),
        samplingIntervalSeconds: z.number().min(1).max(60).default(1),
        injectFault: z.boolean().optional(),
        faultStartMinute: z.number().optional(),
        faultSeverity: z.number().min(0).max(1).optional(),
        signals: z.array(z.string()).optional(),
      });

      const config = simulationConfigSchema.parse(req.body);

      logger.info("AdminSimulation", `Generating simulated telemetry for ${config.vesselType} (${config.durationMinutes} min)`);

      const { getVesselSimulator } = await import("../../../vessel-simulator.js");
      const simulator = getVesselSimulator();

      const result = await simulator.simulateAndIngest(config);

      sendCreated(res, {
        success: true,
        vesselType: result.vesselType,
        equipmentId: result.equipmentId,
        pointsGenerated: result.dataPoints.length,
        statistics: result.statistics,
        message: `Successfully generated ${result.dataPoints.length} telemetry points`,
      });
    })
  );

  app.get(
    "/api/admin/vessel-types",
    requireAdminAuth,
    generalApiRateLimit,
    withErrorHandling("fetch vessel types", async (req: Request, res: Response) => {
      const { VESSEL_TYPE_PRESETS } = await import("../../../vessel-simulator-types.js");

      const vesselTypes = Object.entries(VESSEL_TYPE_PRESETS).map(([type, preset]) => ({
        type,
        ...preset,
      }));

      res.json({ vesselTypes });
    })
  );

  app.post(
    "/api/admin/telemetry/stress-test",
    requireAdminAuth,
    writeOperationRateLimit,
    auditAdminAction("RUN_TELEMETRY_STRESS_TEST"),
    withErrorHandling("run telemetry stress test", async (req: Request, res: Response) => {
      const stressTestSchema = z.object({
        equipmentId: z.string().min(1),
        orgId: z.string().min(1),
        durationSeconds: z.number().min(1).max(300).default(30),
        messagesPerSecond: z.number().min(10).max(2000).default(100),
        sensorTypes: z.array(z.string()).default(["temperature", "pressure", "vibration"]),
        useBatchWriter: z.boolean().default(true),
      });

      const config = stressTestSchema.parse(req.body);

      logger.info("AdminSimulation", `Starting telemetry stress test: ${config.messagesPerSecond} msg/sec for ${config.durationSeconds}s`);

      const { TelemetryStressTest } = await import("../../../vessel-simulator.js");
      const stressTest = new TelemetryStressTest(telemetryWriter);
      const result = await stressTest.run(config);

      res.json({
        success: true,
        result,
        message: `Stress test completed: ${result.totalMessages} messages at ${result.actualMsgPerSec} msg/sec`,
      });
    })
  );

  app.post(
    "/api/admin/telemetry/fleet-stress-test",
    requireAdminAuth,
    writeOperationRateLimit,
    auditAdminAction("RUN_FLEET_STRESS_TEST"),
    withErrorHandling("run fleet stress test", async (req: Request, res: Response) => {
      const fleetStressSchema = z.object({
        vesselCount: z.number().min(1).max(50).default(20),
        sensorsPerVessel: z.number().min(1).max(50).default(30),
        durationSeconds: z.number().min(5).max(600).default(30),
        messagesPerSecondPerSensor: z.number().min(0.1).max(10).default(1),
        orgId: z.string().min(1),
        useBatchWriter: z.boolean().default(true),
      });

      const config = fleetStressSchema.parse(req.body);
      const totalSensors = config.vesselCount * config.sensorsPerVessel;
      const targetMsgPerSec = totalSensors * config.messagesPerSecondPerSensor;

      logger.info("AdminSimulation", `Starting fleet stress test: ${config.vesselCount} vessels, ${config.sensorsPerVessel} sensors each (${totalSensors} total), target ${targetMsgPerSec} msg/sec for ${config.durationSeconds}s`);

      const { initFleetStressTest, getFleetStressTest } = await import("../../../vessel-simulator.js");
      let fleetStressTest;
      try {
        fleetStressTest = getFleetStressTest();
      } catch {
        fleetStressTest = initFleetStressTest(telemetryWriter);
      }
      const result = await fleetStressTest.run(config);

      res.json({
        success: true,
        result,
        summary: {
          totalVessels: result.totalVessels,
          totalSensors: result.totalSensors,
          totalMessages: result.totalMessages,
          actualMsgPerSec: result.actualMsgPerSec,
          targetMsgPerSec: result.targetMsgPerSec,
          efficiency: `${Math.round(result.actualMsgPerSec / result.targetMsgPerSec * 100)}%`,
          errors: result.errors,
          dropped: result.dropped,
          memoryUsageMB: result.memoryUsageMB,
          avgLatencyMs: result.avgLatencyMs,
        },
        message: `Fleet stress test completed: ${result.totalMessages} messages from ${result.totalVessels} vessels at ${result.actualMsgPerSec} msg/sec`,
      });
    })
  );
}
