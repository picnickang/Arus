/**
 * IoT Processing Domain Routes
 * Extracted from routes.ts for Phase 4 modularization
 *
 * Provides MQTT device management, ML analytics, and Digital Twin operations
 */

import { Express, Request, Response } from "express";
import { RateLimitRequestHandler } from "express-rate-limit";
import { withErrorHandling } from "../../lib/route-utils";
import { logger } from "../../utils/logger.js";
import type { AuthenticatedRequest } from "../../middleware/auth";

interface MqttIngestionService {
  registerMqttDevice: (deviceData: unknown) => Promise<unknown>;
  getMqttDevices: () => Promise<unknown[]>;
  getHealthStatus: () => Record<string, unknown>;
}

interface MlAnalyticsService {
  detectAnomalies: (
    orgId: string,
    equipmentId: string,
    sensorType: string,
    value: number,
    timestamp: Date
  ) => Promise<unknown>;
  getHealthStatus: () => Record<string, unknown>;
}

interface DigitalTwinService {
  createDigitalTwin: (
    vesselId: string,
    twinType: string,
    name: string,
    specifications: unknown,
    physicsModel: unknown
  ) => Promise<unknown>;
  getDigitalTwins: (vesselId?: string) => Promise<unknown[]>;
  runSimulation: (twinId: string, scenarioName: string, scenario: unknown) => Promise<unknown>;
  getHealthStatus: () => Record<string, unknown>;
}

interface IotProcessingDependencies {
  writeOperationRateLimit: RateLimitRequestHandler;
  mqttIngestionService: MqttIngestionService;
  mlAnalyticsService: MlAnalyticsService;
  digitalTwinService: DigitalTwinService;
}

export function registerIotProcessingRoutes(app: Express, deps: IotProcessingDependencies): void {
  const { writeOperationRateLimit, mqttIngestionService, mlAnalyticsService, digitalTwinService } =
    deps;

  // ========================================
  // MQTT Real-time Data Ingestion API Routes
  // ========================================

  // Register MQTT device
  app.post(
    "/api/mqtt/devices",
    writeOperationRateLimit,
    withErrorHandling("register MQTT device", async (req: Request, res: Response) => {
      const deviceData = req.body;
      const mqttDevice = await mqttIngestionService.registerMqttDevice(deviceData);
      res.status(201).json(mqttDevice);
    })
  );

  // Get MQTT devices
  app.get(
    "/api/mqtt/devices",
    withErrorHandling("fetch MQTT devices", async (req: Request, res: Response) => {
      const devices = await mqttIngestionService.getMqttDevices();
      res.json(devices);
    })
  );

  // MQTT service health check
  app.get(
    "/api/mqtt/health",
    withErrorHandling("get MQTT health status", async (req: Request, res: Response) => {
      const health = mqttIngestionService.getHealthStatus();
      res.json({
        service: "MQTT Ingestion Service",
        ...health,
        timestamp: new Date().toISOString(),
      });
    })
  );

  // ========================================
  // ML Analytics API Routes
  // ========================================

  // Detect anomalies for equipment/sensor
  app.post(
    "/api/ml/anomaly-detection",
    writeOperationRateLimit,
    withErrorHandling("detect anomalies", async (req: Request, res: Response) => {
      const {
        orgId = (req as AuthenticatedRequest).orgId,
        equipmentId,
        sensorType,
        value,
        timestamp,
      } = req.body;

      const result = await mlAnalyticsService.detectAnomalies(
        orgId,
        equipmentId,
        sensorType,
        value,
        timestamp ? new Date(timestamp) : new Date()
      );

      res.json(result);
    })
  );

  // Predict equipment failure (DEPRECATED - redirects to /api/ml/predict/failure)
  app.post(
    "/api/ml/failure-prediction",
    writeOperationRateLimit,
    async (req: Request, res: Response) => {
      res.setHeader(
        "X-Deprecation-Warning",
        "This endpoint is deprecated. Use /api/ml/predict/failure instead."
      );
      res.setHeader("X-New-Endpoint", "/api/ml/predict/failure");
      res.redirect(307, "/api/ml/predict/failure");
    }
  );

  // ML Analytics service health check
  app.get(
    "/api/ml/health",
    withErrorHandling("get ML Analytics health status", async (req: Request, res: Response) => {
      const health = mlAnalyticsService.getHealthStatus();
      res.json({
        service: "ML Analytics Service",
        ...health,
        timestamp: new Date().toISOString(),
      });
    })
  );

  // ========================================
  // Digital Twin API Routes
  // ========================================

  // Create digital twin
  app.post(
    "/api/digital-twins",
    writeOperationRateLimit,
    withErrorHandling("create digital twin", async (req: Request, res: Response) => {
      const { vesselId, twinType, name, specifications, physicsModel } = req.body;

      const digitalTwin = await digitalTwinService.createDigitalTwin(
        vesselId,
        twinType,
        name,
        specifications,
        physicsModel
      );

      res.status(201).json(digitalTwin);
    })
  );

  // Get digital twins
  app.get(
    "/api/digital-twins",
    withErrorHandling("fetch digital twins", async (req: Request, res: Response) => {
      const { vesselId } = req.query;
      const twins = await digitalTwinService.getDigitalTwins(vesselId as string);
      res.json(twins);
    })
  );

  // Run simulation scenario
  app.post(
    "/api/digital-twins/:twinId/simulate",
    writeOperationRateLimit,
    withErrorHandling("run simulation", async (req: Request, res: Response) => {
      const { twinId } = req.params;
      const { scenarioName, scenario } = req.body;

      const simulation = await digitalTwinService.runSimulation(twinId, scenarioName, scenario);
      res.status(201).json(simulation);
    })
  );

  // Digital Twin service health check
  app.get(
    "/api/digital-twins/health",
    withErrorHandling("get Digital Twin health status", async (req: Request, res: Response) => {
      const health = digitalTwinService.getHealthStatus();
      res.json({
        service: "Digital Twin Service",
        ...health,
        timestamp: new Date().toISOString(),
      });
    })
  );

  logger.info("IoTProcessingRoutes", "Registered (mqtt: 3, ml-analytics: 3, digital-twin: 4)");
}
